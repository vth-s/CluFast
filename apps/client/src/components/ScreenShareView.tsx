import { useEffect, useRef } from "react";
import { useVoiceStore } from "../stores/voice-store.js";

function VideoStream({ stream }: { id: string; stream: MediaStream }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="relative flex-1 min-w-[320px] max-w-full aspect-video overflow-hidden rounded-lg bg-black">
      <video
        ref={ref}
        autoPlay
        playsInline
        muted
        className="h-full w-full object-contain"
      />
      <span className="absolute bottom-1 left-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-zinc-300">
        Screen Share
      </span>
    </div>
  );
}

export function ScreenShareView() {
  const videoStreams = useVoiceStore((s) => s.videoStreams);

  const entries = Array.from(videoStreams.entries());

  if (entries.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 border-b border-zinc-800 bg-zinc-950 p-2">
      <div className="flex flex-wrap gap-2">
        {entries.map(([id, stream]) => (
          <VideoStream key={id} id={id} stream={stream} />
        ))}
      </div>
    </div>
  );
}
