import { create } from "zustand";
import * as mediasoupClient from "mediasoup-client";
import { wsClient } from "../lib/ws-client.js";

type Device = mediasoupClient.types.Device;
type Transport = mediasoupClient.types.Transport;
type Producer = mediasoupClient.types.Producer;
type Consumer = mediasoupClient.types.Consumer;

interface RemoteProducer {
  producerId: string;
  producerPeerId: string;
  kind: "audio" | "video";
}

interface VoiceState {
  connected: boolean;
  channelId: string | null;
  muted: boolean;
  cameraEnabled: boolean;
  device: Device | null;
  sendTransport: Transport | null;
  recvTransport: Transport | null;
  localProducer: Producer | null;
  cameraProducer: Producer | null;
  cameraStream: MediaStream | null;
  screenSharing: boolean;
  screenProducer: Producer | null;
  remoteProducers: Map<string, RemoteProducer>;
  consumers: Map<string, Consumer>;
  audioElements: Map<string, HTMLAudioElement>;
  videoStreams: Map<string, MediaStream>;

  joinVoice: (channelId: string) => void;
  leaveVoice: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  startScreenShare: () => void;
  stopScreenShare: () => void;
  cleanup: () => void;
}

export const useVoiceStore = create<VoiceState>((set, get) => ({
  connected: false,
  channelId: null,
  muted: false,
  cameraEnabled: false,
  device: null,
  sendTransport: null,
  recvTransport: null,
  localProducer: null,
  cameraProducer: null,
  cameraStream: null,
  screenSharing: false,
  screenProducer: null,
  remoteProducers: new Map(),
  consumers: new Map(),
  audioElements: new Map(),
  videoStreams: new Map(),

  joinVoice: (channelId: string) => {
    wsClient.send("rtc:join-voice", { channelId });
    set({ connected: true, channelId });

    // Request RTP capabilities AFTER a short delay to ensure server is ready
    setTimeout(() => {
      wsClient.send("rtc:get-rtp-capabilities", { channelId });
    }, 100);
  },

  leaveVoice: () => {
    const state = get();

    if (state.localProducer) {
      wsClient.send("rtc:producer-close", {
        producerId: state.localProducer.id,
      });
      state.localProducer.close();
    }

    if (state.cameraProducer) {
      wsClient.send("rtc:producer-close", {
        producerId: state.cameraProducer.id,
      });
      state.cameraProducer.close();
    }

    if (state.cameraStream) {
      for (const track of state.cameraStream.getTracks()) track.stop();
    }

    if (state.screenProducer) {
      wsClient.send("rtc:producer-close", {
        producerId: state.screenProducer.id,
      });
      state.screenProducer.close();
    }

    for (const [, consumer] of state.consumers) {
      consumer.close();
    }

    for (const [, audio] of state.audioElements) {
      audio.srcObject = null;
      audio.remove();
    }

    for (const [, stream] of state.videoStreams) {
      for (const track of stream.getTracks()) track.stop();
    }

    state.sendTransport?.close();
    state.recvTransport?.close();

    wsClient.send("rtc:leave-voice", {});

    set({
      connected: false,
      channelId: null,
      muted: false,
      cameraEnabled: false,
      device: null,
      sendTransport: null,
      recvTransport: null,
      localProducer: null,
      cameraProducer: null,
      cameraStream: null,
      screenSharing: false,
      screenProducer: null,
      remoteProducers: new Map(),
      consumers: new Map(),
      audioElements: new Map(),
      videoStreams: new Map(),
    });
  },

  toggleMute: () => {
    const state = get();
    if (!state.localProducer) return;

    if (state.muted) {
      state.localProducer.resume();
    } else {
      state.localProducer.pause();
    }

    set({ muted: !state.muted });
  },

  toggleCamera: async () => {
    const state = get();

    // Turn camera OFF
    if (state.cameraEnabled && state.cameraProducer) {
      wsClient.send("rtc:producer-close", {
        producerId: state.cameraProducer.id,
      });
      state.cameraProducer.close();
      if (state.cameraStream) {
        for (const track of state.cameraStream.getTracks()) track.stop();
      }
      set({
        cameraEnabled: false,
        cameraProducer: null,
        cameraStream: null,
      });
      return;
    }

    // Turn camera ON
    if (!state.sendTransport || state.cameraEnabled) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
      });

      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack) return;

      const producer = await state.sendTransport.produce({
        track: videoTrack,
        encodings: [
          { maxBitrate: 1_500_000, scalabilityMode: "L1T3" },
        ],
        codecOptions: { videoGoogleStartBitrate: 800_000 },
      });

      producer.on("transportclose", () => {
        videoTrack.stop();
        set({ cameraProducer: null, cameraEnabled: false, cameraStream: null });
      });

      set({
        cameraProducer: producer,
        cameraEnabled: true,
        cameraStream: stream,
      });
    } catch (err) {
      console.error("[camera] Failed to start camera:", err);
    }
  },

  startScreenShare: async () => {
    const state = get();
    if (!state.sendTransport || state.screenSharing) return;

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      });

      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack) return;

      videoTrack.onended = () => {
        get().stopScreenShare();
      };

      const producer = await state.sendTransport.produce({
        track: videoTrack,
        encodings: [{ maxBitrate: 2_500_000, scalabilityMode: "L1T3" }],
        codecOptions: { videoGoogleStartBitrate: 1_000_000 },
      });

      set({ screenProducer: producer, screenSharing: true });

      producer.on("transportclose", () => {
        videoTrack.stop();
        set({ screenProducer: null, screenSharing: false });
      });
    } catch (err) {
      console.log("[screen] Share cancelled or failed:", err);
    }
  },

  stopScreenShare: () => {
    const state = get();
    if (!state.screenProducer) return;

    wsClient.send("rtc:producer-close", {
      producerId: state.screenProducer.id,
    });
    state.screenProducer.close();
    set({ screenProducer: null, screenSharing: false });
  },

  cleanup: () => {
    const state = get();
    for (const [, audio] of state.audioElements) {
      audio.srcObject = null;
      audio.remove();
    }
    for (const [, stream] of state.videoStreams) {
      for (const track of stream.getTracks()) track.stop();
    }
    set({
      audioElements: new Map(),
      videoStreams: new Map(),
      consumers: new Map(),
      remoteProducers: new Map(),
    });
  },
}));

// ── Wire WS events to the voice store ──────────────────────

wsClient.on("rtc:rtp-capabilities", async (data) => {
  const d = data as {
    rtpCapabilities: mediasoupClient.types.RtpCapabilities;
  };
  const device = new mediasoupClient.Device();
  await device.load({ routerRtpCapabilities: d.rtpCapabilities });
  useVoiceStore.setState({ device });

  const { channelId } = useVoiceStore.getState();
  if (channelId) {
    wsClient.send("rtc:create-transport", {
      channelId,
      direction: "recv",
    });
  }
});

wsClient.on("rtc:transport-created", async (data) => {
  const d = data as {
    id: string;
    iceParameters: mediasoupClient.types.IceParameters;
    iceCandidates: mediasoupClient.types.IceCandidate[];
    dtlsParameters: mediasoupClient.types.DtlsParameters;
    direction: "send" | "recv";
  };

  const { device } = useVoiceStore.getState();
  if (!device) return;

  if (d.direction === "recv") {
    const transport = device.createRecvTransport({
      id: d.id,
      iceParameters: d.iceParameters,
      iceCandidates: d.iceCandidates,
      dtlsParameters: d.dtlsParameters,
    });

    transport.on("connect", ({ dtlsParameters }, callback, errback) => {
      wsClient.send("rtc:connect-transport", {
        transportId: d.id,
        dtlsParameters,
      });

      const unsub = wsClient.on("rtc:transport-connected", () => {
        callback();
        unsub();
      });
      setTimeout(
        () => errback(new Error("Transport connect timeout")),
        10000,
      );
    });

    transport.on("connectionstatechange", (state: string) => {
      if (state === "failed" || state === "disconnected") {
        transport.close();
      }
    });

    useVoiceStore.setState({ recvTransport: transport });

    const { channelId } = useVoiceStore.getState();
    if (channelId) {
      wsClient.send("rtc:create-transport", {
        channelId,
        direction: "send",
      });
    }
  } else {
    const transport = device.createSendTransport({
      id: d.id,
      iceParameters: d.iceParameters,
      iceCandidates: d.iceCandidates,
      dtlsParameters: d.dtlsParameters,
    });

    transport.on(
      "connect",
      ({ dtlsParameters }, callback, errback) => {
        wsClient.send("rtc:connect-transport", {
          transportId: d.id,
          dtlsParameters,
        });

        const unsub = wsClient.on("rtc:transport-connected", () => {
          callback();
          unsub();
        });
        setTimeout(
          () => errback(new Error("Transport connect timeout")),
          10000,
        );
      },
    );

    transport.on(
      "produce",
      ({ kind, rtpParameters }, callback, errback) => {
        wsClient.send("rtc:produce", {
          transportId: d.id,
          kind,
          rtpParameters,
        });

        const unsub = wsClient.on("rtc:produced", (producedData) => {
          const { producerId } = producedData as { producerId: string };
          callback({ id: producerId });
          unsub();
        });
        setTimeout(() => errback(new Error("Produce timeout")), 10000);
      },
    );

    transport.on("connectionstatechange", (state: string) => {
      if (state === "failed" || state === "disconnected") {
        transport.close();
      }
    });

    useVoiceStore.setState({ sendTransport: transport });

    // Auto-capture microphone
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      const track = stream.getAudioTracks()[0];
      if (!track) {
        console.error("[voice] No audio track returned");
        return;
      }

      const producer = await transport.produce({ track });
      useVoiceStore.setState({ localProducer: producer });

      producer.on("transportclose", () => {
        track.stop();
        useVoiceStore.setState({ localProducer: null });
      });
    } catch (err) {
      console.error("[voice] Failed to get microphone:", err);
    }
  }
});

wsClient.on("rtc:consumed", (data) => {
  const d = data as {
    consumerId: string;
    producerId: string;
    producerPeerId: string;
    kind: "audio" | "video";
    rtpParameters: mediasoupClient.types.RtpParameters;
  };

  const { recvTransport } = useVoiceStore.getState();
  if (!recvTransport) return;

  (async () => {
    const consumer = await recvTransport.consume({
      id: d.consumerId,
      producerId: d.producerId,
      kind: d.kind,
      rtpParameters: d.rtpParameters,
    });

    useVoiceStore.setState((state) => {
      const nextConsumers = new Map(state.consumers);
      nextConsumers.set(d.consumerId, consumer);

      if (d.kind === "video") {
        const stream = new MediaStream([consumer.track]);
        const nextVideo = new Map(state.videoStreams);
        nextVideo.set(d.consumerId, stream);
        return { consumers: nextConsumers, videoStreams: nextVideo };
      } else {
        const audioEl = document.createElement("audio");
        audioEl.autoplay = true;
        audioEl.srcObject = new MediaStream([consumer.track]);
        document.body.appendChild(audioEl);

        const nextAudio = new Map(state.audioElements);
        nextAudio.set(d.consumerId, audioEl);
        return { consumers: nextConsumers, audioElements: nextAudio };
      }
    });

    wsClient.send("rtc:consumer-resume", {
      consumerId: d.consumerId,
    });
  })();
});

wsClient.on("rtc:new-producer", (data) => {
  const d = data as RemoteProducer;
  useVoiceStore.setState((state) => {
    const next = new Map(state.remoteProducers);
    next.set(d.producerId, d);
    return { remoteProducers: next };
  });

  wsClient.send("rtc:consume", {
    producerPeerId: d.producerPeerId,
    producerId: d.producerId,
  });
});

wsClient.on("rtc:producer-closed", (data) => {
  const { producerId } = data as { producerId: string };
  const state = useVoiceStore.getState();

  const consumer = state.consumers.get(producerId);
  if (consumer) {
    consumer.close();

    const audioEl = state.audioElements.get(producerId);
    if (audioEl) {
      audioEl.srcObject = null;
      audioEl.remove();
    }

    const stream = state.videoStreams.get(producerId);
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
    }

    useVoiceStore.setState((s) => {
      const nextC = new Map(s.consumers);
      const nextA = new Map(s.audioElements);
      const nextV = new Map(s.videoStreams);
      const nextP = new Map(s.remoteProducers);
      nextC.delete(producerId);
      nextA.delete(producerId);
      nextV.delete(producerId);
      nextP.delete(producerId);
      return {
        consumers: nextC,
        audioElements: nextA,
        videoStreams: nextV,
        remoteProducers: nextP,
      };
    });
  }
});

wsClient.on("rtc:peer-left", (data) => {
  const { userId } = data as { userId: string; channelId: string };
  const state = useVoiceStore.getState();

  for (const [prodId, rp] of state.remoteProducers) {
    if (rp.producerPeerId === userId) {
      state.consumers.get(prodId)?.close();

      const audioEl = state.audioElements.get(prodId);
      if (audioEl) {
        audioEl.srcObject = null;
        audioEl.remove();
      }

      const stream = state.videoStreams.get(prodId);
      if (stream) {
        for (const track of stream.getTracks()) track.stop();
      }
    }
  }

  useVoiceStore.setState((s) => {
    const nextP = new Map(s.remoteProducers);
    const nextC = new Map(s.consumers);
    const nextA = new Map(s.audioElements);
    const nextV = new Map(s.videoStreams);
    for (const [prodId, rp] of nextP) {
      if (rp.producerPeerId === userId) {
        nextP.delete(prodId);
        nextC.delete(prodId);
        nextA.delete(prodId);
        nextV.delete(prodId);
      }
    }
    return {
      remoteProducers: nextP,
      consumers: nextC,
      audioElements: nextA,
      videoStreams: nextV,
    };
  });
});
