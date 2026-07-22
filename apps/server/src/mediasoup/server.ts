import * as mediasoup from "mediasoup";
import os from "node:os";
import type {
  Worker,
  Router,
  WebRtcTransport,
  Producer,
  Consumer,
  WebRtcTransportOptions,
} from "mediasoup/types";
import { mediaCodecs, getWebRtcTransportOptions } from "./config.js";

const NUM_WORKERS = Math.max(1, os.cpus().length);

interface PeerState {
  transports: Map<string, WebRtcTransport>;
  producers: Map<string, Producer>;
  consumers: Map<string, Consumer>;
}

export class MediasoupServer {
  private workers: Worker[] = [];
  private nextWorkerIdx = 0;
  private routers = new Map<string, Router>();
  private peers = new Map<string, PeerState>();

  async run() {
    for (let i = 0; i < NUM_WORKERS; i++) {
      const worker = await mediasoup.createWorker({
        rtcMinPort: 10000,
        rtcMaxPort: 10100,
      });
      worker.on("died", () => {
        console.error(`[mediasoup] worker ${worker.pid} died`);
      });
      this.workers.push(worker);
    }
    console.log(`[mediasoup] ${this.workers.length} workers started`);
  }

  private getNextWorker(): Worker {
    const worker = this.workers[this.nextWorkerIdx];
    this.nextWorkerIdx = (this.nextWorkerIdx + 1) % this.workers.length;
    return worker;
  }

  async getOrCreateRouter(channelId: string): Promise<Router> {
    let router = this.routers.get(channelId);
    if (router) return router;

    const worker = this.getNextWorker();
    router = await worker.createRouter({ mediaCodecs });
    this.routers.set(channelId, router);
    return router;
  }

  getRouterRtpCapabilities(channelId: string) {
    return this.routers.get(channelId)?.rtpCapabilities;
  }

  ensurePeer(userId: string): PeerState {
    if (!this.peers.has(userId)) {
      this.peers.set(userId, {
        transports: new Map(),
        producers: new Map(),
        consumers: new Map(),
      });
    }
    return this.peers.get(userId)!;
  }

  async createWebRtcTransport(channelId: string, peerId: string) {
    const router = await this.getOrCreateRouter(channelId);
    const transport = await router.createWebRtcTransport(
      getWebRtcTransportOptions() as WebRtcTransportOptions,
    );

    const peer = this.ensurePeer(peerId);
    peer.transports.set(transport.id, transport);

    transport.on("dtlsstatechange", (state: string) => {
      if (state === "closed") transport.close();
    });

    return {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    };
  }

  async connectTransport(
    transportId: string,
    peerId: string,
    dtlsParameters: { role?: string; fingerprints: { algorithm: string; value: string }[] },
  ) {
    const peer = this.peers.get(peerId);
    const transport = peer?.transports.get(transportId);
    if (!transport) throw new Error("Transport not found");
    await transport.connect({ dtlsParameters: dtlsParameters as never });
  }

  async produce(
    _channelId: string,
    peerId: string,
    transportId: string,
    kind: "audio" | "video",
    rtpParameters: Record<string, unknown>,
  ) {
    const peer = this.peers.get(peerId);
    const transport = peer?.transports.get(transportId);
    if (!transport) throw new Error("Transport not found");

    const producer = await transport.produce({
      kind,
      rtpParameters: rtpParameters as never,
    });
    peer!.producers.set(producer.id, producer);

    producer.on("transportclose", () => producer.close());

    return { producerId: producer.id };
  }

  async consume(
    channelId: string,
    producerPeerId: string,
    consumerPeerId: string,
    producerId: string,
  ) {
    const producerPeer = this.peers.get(producerPeerId);
    const producer = producerPeer?.producers.get(producerId);
    if (!producer) throw new Error("Producer not found");

    const consumerPeer = this.peers.get(consumerPeerId);
    if (!consumerPeer) throw new Error("Consumer peer not found");

    // Find the recv transport for the consumer peer
    let recvTransport: WebRtcTransport | undefined;
    for (const [, transport] of consumerPeer.transports) {
      const appData = (transport as unknown as { appData: Record<string, unknown> }).appData;
      if (appData?.direction === "recv") {
        recvTransport = transport;
        break;
      }
    }
    if (!recvTransport) {
      // Fallback: take first transport
      for (const [, transport] of consumerPeer.transports) {
        recvTransport = transport;
        break;
      }
    }
    if (!recvTransport) throw new Error("No recv transport for consumer peer");

    // Get the router for this specific channel
    const targetRouter = this.routers.get(channelId);
    if (!targetRouter) throw new Error("No router found for channel");

    const consumer = await recvTransport.consume({
      producerId: producer.id,
      rtpCapabilities: targetRouter.rtpCapabilities,
      paused: true,
    });

    consumerPeer.consumers.set(consumer.id, consumer);

    consumer.on("transportclose", () => consumer.close());
    consumer.on("producerclose", () => consumer.close());

    return {
      consumerId: consumer.id,
      producerId: producer.id,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
    };
  }

  resumeConsumer(consumerId: string, peerId: string) {
    const peer = this.peers.get(peerId);
    const consumer = peer?.consumers.get(consumerId);
    consumer?.resume();
  }

  closeProducer(producerId: string, peerId: string) {
    const peer = this.peers.get(peerId);
    const producer = peer?.producers.get(producerId);
    if (producer) {
      producer.close();
      peer!.producers.delete(producerId);
    }
  }

  closeConsumer(consumerId: string, peerId: string) {
    const peer = this.peers.get(peerId);
    const consumer = peer?.consumers.get(consumerId);
    if (consumer) {
      consumer.close();
      peer!.consumers.delete(consumerId);
    }
  }

  removePeer(peerId: string) {
    const peer = this.peers.get(peerId);
    if (!peer) return;

    for (const transport of peer.transports.values()) {
      transport.close();
    }
    this.peers.delete(peerId);
  }

  getChannelProducers(_channelId: string) {
    const results: { peerId: string; producerId: string; kind: string }[] = [];

    for (const [peerId, peer] of this.peers) {
      for (const [producerId, producer] of peer.producers) {
        results.push({
          peerId,
          producerId,
          kind: producer.kind,
        });
      }
    }

    return results;
  }

  async destroyRouter(channelId: string) {
    const router = this.routers.get(channelId);
    if (router) {
      router.close();
      this.routers.delete(channelId);
    }
  }
}

export const mediasoupServer = new MediasoupServer();
