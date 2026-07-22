import { useVoiceStore } from "../stores/voice-store.js";

interface VoiceParticipantsProps {
  channelId: string;
  participants: { userId: string; username: string }[];
}

export function VoiceParticipants({
  channelId,
  participants,
}: VoiceParticipantsProps) {
  const activeChannelId = useVoiceStore((s) => s.channelId);
  const inThisChannel = activeChannelId === channelId;

  const displayParticipants = inThisChannel
    ? participants.filter(
        (p) => p.userId !== localStorage.getItem("cf_user_id"),
      )
    : participants;

  if (displayParticipants.length === 0) return null;

  return (
    <div className="mt-1 space-y-0.5 pl-2">
      {displayParticipants.map((p) => (
        <div
          key={p.userId}
          className="flex items-center gap-1.5 text-xs text-zinc-400"
        >
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-400" />
          <span className="truncate">{p.username}</span>
        </div>
      ))}
    </div>
  );
}
