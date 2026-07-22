import { useVoiceStore } from "../stores/voice-store.js";
import { useDataStore } from "../stores/data-store.js";
import { VoiceParticipants } from "./VoiceParticipants.js";
import { useAuthStore } from "../stores/auth-store.js";

interface Channel {
  id: string;
  name: string;
  type: "text" | "voice";
}

interface ChannelSidebarProps {
  serverName: string;
  channels: Channel[];
  activeChannelId: string | null;
  onSelectChannel: (channelId: string) => void;
  voiceParticipants: Map<string, { userId: string; username: string }[]>;
  onCreateChannel: () => void;
}

export function ChannelSidebar({
  serverName,
  channels,
  activeChannelId,
  onSelectChannel,
  voiceParticipants,
  onCreateChannel,
}: ChannelSidebarProps) {
  const textChannels = channels.filter((c) => c.type === "text");
  const voiceChannels = channels.filter((c) => c.type === "voice");
  const connected = useVoiceStore((s) => s.connected);

  return (
    <div className="flex w-60 flex-col bg-zinc-900">
      {/* Server header */}
      <div className="flex h-12 items-center border-b border-zinc-800 px-4 shadow-sm">
        <h2 className="truncate text-sm font-bold text-white">
          {serverName}
        </h2>
      </div>

      {/* Channel list */}
      <div className="flex-1 overflow-y-auto px-2 py-3">
        {/* Text channels */}
        {textChannels.length > 0 && (
          <div className="mb-4">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="px-2 text-xs font-bold uppercase tracking-wide text-zinc-500">
                Text Channels
              </h3>
              <button
                onClick={onCreateChannel}
                title="Create Channel"
                className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            </div>
            {textChannels.map((ch) => (
              <button
                key={ch.id}
                onClick={() => onSelectChannel(ch.id)}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                  activeChannelId === ch.id
                    ? "bg-zinc-700/60 text-white"
                    : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                }`}
              >
                <span className="text-base text-zinc-500">#</span>
                <span className="truncate">{ch.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* Voice channels */}
        {voiceChannels.length > 0 && (
          <div>
            <div className="mb-1 flex items-center justify-between">
              <h3 className="px-2 text-xs font-bold uppercase tracking-wide text-zinc-500">
                Voice Channels
              </h3>
              <button
                onClick={onCreateChannel}
                title="Create Voice Channel"
                className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            </div>
            {voiceChannels.map((ch) => {
              const participants = voiceParticipants.get(ch.id) ?? [];
              return (
                <div key={ch.id} className="mb-1">
                  <button
                    onClick={() => onSelectChannel(ch.id)}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                      activeChannelId === ch.id
                        ? "bg-zinc-700/60 text-white"
                        : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                    }`}
                  >
                    <svg
                      className="h-4 w-4 shrink-0 text-zinc-500"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M12 3a1 1 0 0 0-1 1v8a1 1 0 0 0 2 0V4a1 1 0 0 0-1-1ZM6.5 9A1.5 1.5 0 0 0 5 10.5v2a6.5 6.5 0 0 0 13 0v-2A1.5 1.5 0 0 0 16.5 9h-1.5a.5.5 0 0 0 0 1h1.5a.5.5 0 0 1 .5.5v2a5.5 5.5 0 0 1-11 0v-2a.5.5 0 0 1 .5-.5H7a.5.5 0 0 0 0-1h-.5ZM11 18.25a.75.75 0 0 0 1.5 0v-2.5a.75.75 0 0 0-1.5 0v2.5Z" />
                    </svg>
                    <span className="truncate">{ch.name}</span>
                  </button>
                  {participants.length > 0 && (
                    <VoiceParticipants
                      channelId={ch.id}
                      participants={participants}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Voice connection panel (above user bar) */}
      {connected && <VoiceConnectionPanel />}

      {/* User bar at bottom */}
      <UserBar />
    </div>
  );
}

// ── Voice Connection Panel ──────────────────────────────────
function VoiceConnectionPanel() {
  const voiceChannelId = useVoiceStore((s) => s.channelId);
  const channels = useDataStore((s) => s.channels);
  const channelName = channels.find((c) => c.id === voiceChannelId)?.name ?? "Unknown";
  const muted = useVoiceStore((s) => s.muted);
  const cameraEnabled = useVoiceStore((s) => s.cameraEnabled);
  const screenSharing = useVoiceStore((s) => s.screenSharing);
  const toggleMute = useVoiceStore((s) => s.toggleMute);
  const toggleCamera = useVoiceStore((s) => s.toggleCamera);
  const startScreenShare = useVoiceStore((s) => s.startScreenShare);
  const stopScreenShare = useVoiceStore((s) => s.stopScreenShare);
  const leaveVoice = useVoiceStore((s) => s.leaveVoice);

  return (
    <div className="border-t border-zinc-800 bg-zinc-950/60 px-3 py-2">
      {/* Connection info */}
      <div className="mb-2 flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
        <span className="text-xs font-semibold text-green-400">Voice Connected</span>
      </div>
      <p className="mb-2 truncate text-[11px] text-zinc-500">#{channelName}</p>

      {/* Control buttons */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={toggleMute}
          title={muted ? "Unmute" : "Mute"}
          className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
            muted
              ? "bg-red-600 text-white hover:bg-red-500"
              : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
          }`}
        >
          {muted ? (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <line x1="1" y1="1" x2="23" y2="23" />
              <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
              <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .28-.02.56-.06.83" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          )}
        </button>

        <button
          onClick={toggleCamera}
          title={cameraEnabled ? "Camera Off" : "Camera On"}
          className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
            cameraEnabled
              ? "bg-blue-600 text-white hover:bg-blue-500"
              : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
          }`}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 7l-7 5 7 5V7z" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
        </button>

        <button
          onClick={screenSharing ? stopScreenShare : startScreenShare}
          title={screenSharing ? "Stop Sharing" : "Share Screen"}
          className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
            screenSharing
              ? "bg-purple-600 text-white hover:bg-purple-500"
              : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
          }`}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
        </button>

        <div className="mx-0.5 h-5 w-px bg-zinc-700" />

        <button
          onClick={leaveVoice}
          title="Disconnect"
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-600/20 text-red-400 transition-colors hover:bg-red-600 hover:text-white"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
            <line x1="23" y1="1" x2="1" y2="23" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── User Bar ────────────────────────────────────────────────
function UserBar() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const initials = user
    ? user.username
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
    : "?";

  return (
    <div className="flex items-center gap-2 border-t border-zinc-800 bg-zinc-950 px-2 py-1.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-white">
          {user?.username ?? "Unknown"}
        </p>
        <p className="truncate text-[10px] text-zinc-500">Online</p>
      </div>
      <button
        onClick={logout}
        title="Sign out"
        className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
      >
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      </button>
    </div>
  );
}
