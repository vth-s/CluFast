import type { RtpCodecCapability } from "mediasoup/types";

export const mediaCodecs: RtpCodecCapability[] = [
  {
    kind: "audio",
    mimeType: "audio/opus",
    clockRate: 48000,
    channels: 2,
    preferredPayloadType: 0,
  },
  {
    kind: "video",
    mimeType: "video/VP8",
    clockRate: 90000,
    parameters: {
      "x-google-start-bitrate": 1000,
    },
    preferredPayloadType: 0,
  },
  {
    kind: "video",
    mimeType: "video/H264",
    clockRate: 90000,
    parameters: {
      "packetization-mode": 1,
      "profile-level-id": "42e01f",
      "level-asymmetry-allowed": 1,
    },
    preferredPayloadType: 0,
  },
];

export const WEBRTC_LISTEN_IP = "0.0.0.0";
export const WEBRTC_PORT_RANGE_MIN = 10000;
export const WEBRTC_PORT_RANGE_MAX = 10100;

export function getWebRtcTransportOptions() {
  const announcedIp = process.env.WEBRTC_ANNOUNCED_IP || "127.0.0.1";

  return {
    listenIps: [
      {
        ip: WEBRTC_LISTEN_IP,
        announcedIp,
      },
    ],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
  };
}
