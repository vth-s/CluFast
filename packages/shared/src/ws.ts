import type { Message, User } from "./types.js";

// ── Client → Server ──────────────────────────────────────────

export interface WsClientEvents {
  "channel:join": { channelId: string };
  "channel:leave": { channelId: string };
  "message:send": { channelId: string; content: string };
  "message:update": { messageId: string; content: string };
  "message:delete": { messageId: string };
  "typing:start": { channelId: string };
  "typing:stop": { channelId: string };

  // ── RTC / Voice ───────────────────────────────────────────
  "rtc:join-voice": { channelId: string };
  "rtc:leave-voice": { channelId: string };
  "rtc:get-rtp-capabilities": { channelId: string };
  "rtc:create-transport": {
    channelId: string;
    direction: "send" | "recv";
  };
  "rtc:connect-transport": {
    transportId: string;
    dtlsParameters: Record<string, unknown>;
  };
  "rtc:produce": {
    transportId: string;
    kind: "audio" | "video";
    rtpParameters: Record<string, unknown>;
  };
  "rtc:consume": {
    producerPeerId: string;
    producerId: string;
  };
  "rtc:consumer-resume": { consumerId: string };
  "rtc:producer-close": { producerId: string };
  "rtc:consumer-close": { consumerId: string };
}

// ── Server → Client ──────────────────────────────────────────

export interface WsServerEvents {
  "channel:joined": { channelId: string };
  "channel:left": { channelId: string };
  "message:new": Message & {
    author: Pick<User, "id" | "username" | "avatarUrl">;
  };
  "message:updated": Message;
  "message:deleted": { messageId: string; channelId: string };
  "typing:user-start": {
    channelId: string;
    userId: string;
    username: string;
  };
  "typing:user-stop": { channelId: string; userId: string };
  "error": { message: string };

  // ── RTC / Voice ───────────────────────────────────────────
  "rtc:rtp-capabilities": {
    rtpCapabilities: Record<string, unknown>;
  };
  "rtc:transport-created": {
    id: string;
    iceParameters: Record<string, unknown>;
    iceCandidates: Record<string, unknown>[];
    dtlsParameters: Record<string, unknown>;
    direction: "send" | "recv";
  };
  "rtc:transport-connected": { transportId: string };
  "rtc:produced": { producerId: string };
  "rtc:new-producer": {
    producerId: string;
    producerPeerId: string;
    kind: "audio" | "video";
  };
  "rtc:consumed": {
    consumerId: string;
    producerId: string;
    producerPeerId: string;
    kind: "audio" | "video";
    rtpParameters: Record<string, unknown>;
  };
  "rtc:consumer-resumed": { consumerId: string };
  "rtc:producer-closed": { producerId: string };
  "rtc:consumer-closed": { consumerId: string };
  "rtc:peer-joined": {
    userId: string;
    username: string;
    channelId: string;
  };
  "rtc:peer-left": { userId: string; channelId: string };
  "rtc:voice-state": {
    channelId: string;
    participants: { userId: string; username: string }[];
  };
}

// ── Helpers ──────────────────────────────────────────────────

export type WsClientEvent = keyof WsClientEvents;
export type WsServerEvent = keyof WsServerEvents;

export interface WsEnvelope<T = unknown> {
  event: string;
  data: T;
}

export function encodeWsMessage<T>(event: string, data: T): string {
  return JSON.stringify({ event, data } satisfies WsEnvelope<T>);
}

export function decodeWsMessage(raw: string): WsEnvelope | null {
  try {
    const msg = JSON.parse(raw) as WsEnvelope;
    if (typeof msg.event === "string") return msg;
    return null;
  } catch {
    return null;
  }
}
