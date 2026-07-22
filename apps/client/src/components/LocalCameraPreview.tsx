import { useEffect, useRef } from "react";
import { useVoiceStore } from "../stores/voice-store.js";

export function LocalCameraPreview() {
  const cameraEnabled = useVoiceStore((s) => s.cameraEnabled);
  const cameraStream = useVoiceStore((s) => s.cameraStream);
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (ref.current && cameraStream) {
      ref.current.srcObject = cameraStream;
    }
  }, [cameraStream]);

  if (!cameraEnabled || !cameraStream) return null;

  return (
    <div className="border-b border-zinc-800 bg-zinc-950 p-2">
      <div className="relative inline-block h-48 w-64 overflow-hidden rounded-lg bg-black border border-zinc-700 shadow-lg">
        <video
          ref={ref}
          autoPlay
          playsInline
          muted
          className="h-full w-full object-cover"
          style={{ transform: "scaleX(-1)" }}
        />
        <span className="absolute bottom-1 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-zinc-300">
          You
        </span>
      </div>
    </div>
  );
}
