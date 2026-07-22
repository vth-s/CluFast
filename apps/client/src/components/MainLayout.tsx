import { useEffect, useState, useCallback } from "react";
import { useChatStore } from "../stores/chat-store.js";
import { useDataStore } from "../stores/data-store.js";
import { useAuthStore } from "../stores/auth-store.js";
import { useVoiceStore } from "../stores/voice-store.js";
import { useWebSocket } from "../hooks/use-websocket.js";
import { wsClient } from "../lib/ws-client.js";
import { api } from "../lib/api.js";
import { ServerSidebar } from "./ServerSidebar.js";
import { ChannelSidebar } from "./ChannelSidebar.js";
import { ChatArea } from "./ChatArea.js";
import { ScreenShareView } from "./ScreenShareView.js";
import { LocalCameraPreview } from "./LocalCameraPreview.js";

export function MainLayout() {
  useWebSocket();

  const token = useAuthStore((s) => s.token)!;
  const servers = useDataStore((s) => s.servers);
  const allChannels = useDataStore((s) => s.channels);
  const activeServerId = useDataStore((s) => s.activeServerId);
  const setActiveServer = useDataStore((s) => s.setActiveServer);
  const fetchChannels = useDataStore((s) => s.fetchChannels);

  const activeChannelId = useChatStore((s) => s.activeChannelId);
  const setActiveChannel = useChatStore((s) => s.setActiveChannel);
  const setHistory = useChatStore((s) => s.setHistory);

  const [voiceParticipants, setVoiceParticipants] = useState<
    Map<string, { userId: string; username: string }[]>
  >(new Map());

  const [createModal, setCreateModal] = useState<
    | { type: "server" }
    | { type: "channel"; serverId: string }
    | null
  >(null);

  // Fetch channels when active server changes
  useEffect(() => {
    if (activeServerId) {
      fetchChannels(activeServerId, token);
    }
  }, [activeServerId, token, fetchChannels]);

  // Fetch servers on mount if token exists but servers are empty
  useEffect(() => {
    if (servers.length === 0 && token) {
      useDataStore.getState().fetchServers(token);
    }
  }, [token, servers.length]);

  useEffect(() => {
    const unsub = wsClient.on(
      "rtc:voice-state",
      (data) => {
        const d = data as {
          channelId: string;
          participants: { userId: string; username: string }[];
        };
        setVoiceParticipants((prev) => {
          const next = new Map(prev);
          next.set(d.channelId, d.participants);
          return next;
        });
      },
    );
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = wsClient.on("rtc:peer-joined", (data) => {
      const d = data as {
        userId: string;
        username: string;
        channelId: string;
      };
      setVoiceParticipants((prev) => {
        const next = new Map(prev);
        const list = next.get(d.channelId) ?? [];
        if (!list.find((p) => p.userId === d.userId)) {
          next.set(d.channelId, [...list, { userId: d.userId, username: d.username }]);
        }
        return next;
      });
    });
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = wsClient.on("rtc:peer-left", (data) => {
      const d = data as { userId: string; channelId: string };
      setVoiceParticipants((prev) => {
        const next = new Map(prev);
        const list = next.get(d.channelId) ?? [];
        next.set(
          d.channelId,
          list.filter((p) => p.userId !== d.userId),
        );
        return next;
      });
    });
    return unsub;
  }, []);

  const handleSelectChannel = useCallback(
    async (channelId: string) => {
      setActiveChannel(channelId);
      wsClient.send("channel:join", { channelId });

      // Auto-join voice channels
      const allChannelsNow = useDataStore.getState().channels;
      const ch = allChannelsNow.find((c) => c.id === channelId);
      if (ch?.type === "voice") {
        const voiceState = useVoiceStore.getState();
        if (voiceState.channelId !== channelId) {
          if (voiceState.connected) voiceState.leaveVoice();
          useVoiceStore.getState().joinVoice(channelId);
        }
        return;
      }

      try {
        const { messages, hasMore } = await api.getMessages(channelId, token);
        setHistory(channelId, messages, hasMore);
      } catch (err) {
        console.error("[chat] Failed to load messages:", err);
      }
    },
    [setActiveChannel, setHistory, token],
  );

  const handleSelectServer = useCallback(
    (serverId: string) => {
      setActiveServer(serverId);
    },
    [setActiveServer],
  );

  const channels = activeServerId
    ? allChannels.filter((c) => c.serverId === activeServerId)
    : [];

  const activeServer = servers.find((s) => s.id === activeServerId);

  return (
    <div className="flex h-full">
      <ServerSidebar
        servers={servers}
        activeServerId={activeServerId}
        onSelectServer={handleSelectServer}
        onCreateServer={() => setCreateModal({ type: "server" })}
      />

      {activeServer && (
        <ChannelSidebar
          serverName={activeServer.name}
          channels={channels}
          activeChannelId={activeChannelId}
          onSelectChannel={handleSelectChannel}
          voiceParticipants={voiceParticipants}
          onCreateChannel={() =>
            setCreateModal({ type: "channel", serverId: activeServer.id })
          }
        />
      )}

      <div className="flex flex-1 flex-col min-w-0">
        <ScreenShareView />
        <LocalCameraPreview />
        <ChatArea />
      </div>

      {createModal?.type === "server" && (
        <CreateServerModal
          token={token}
          onClose={() => setCreateModal(null)}
          onCreated={(server) => {
            useDataStore.getState().addServer(server);
            setCreateModal(null);
          }}
        />
      )}

      {createModal?.type === "channel" && (
        <CreateChannelModal
          serverId={createModal.serverId}
          token={token}
          onClose={() => setCreateModal(null)}
          onCreated={(channel) => {
            useDataStore.getState().addChannel(channel);
            setCreateModal(null);
          }}
        />
      )}
    </div>
  );
}

// ── Create Server Modal ─────────────────────────────────────
function CreateServerModal({
  token,
  onClose,
  onCreated,
}: {
  token: string;
  onClose: () => void;
  onCreated: (server: { id: string; name: string; iconUrl: string | null }) => void;
}) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || loading) return;

    setLoading(true);
    setError("");
    try {
      const { server } = await api.createServer(name.trim(), token);
      onCreated(server);
    } catch (err: any) {
      setError(err.message || "Failed to create server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl bg-zinc-800 p-6 shadow-xl"
      >
        <h3 className="mb-4 text-lg font-bold text-white">Create a Server</h3>
        {error && (
          <p className="mb-3 rounded bg-red-600/20 px-3 py-1.5 text-xs text-red-400">
            {error}
          </p>
        )}
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Server name"
          className="mb-4 w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim() || loading}
            className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Create Channel Modal ────────────────────────────────────
function CreateChannelModal({
  serverId,
  token,
  onClose,
  onCreated,
}: {
  serverId: string;
  token: string;
  onClose: () => void;
  onCreated: (channel: { id: string; name: string; type: "text" | "voice"; serverId: string }) => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"text" | "voice">("text");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || loading) return;

    setLoading(true);
    setError("");
    try {
      const { channel } = await api.createChannel(serverId, name.trim(), type, token);
      onCreated(channel);
    } catch (err: any) {
      setError(err.message || "Failed to create channel");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl bg-zinc-800 p-6 shadow-xl"
      >
        <h3 className="mb-4 text-lg font-bold text-white">Create a Channel</h3>
        {error && (
          <p className="mb-3 rounded bg-red-600/20 px-3 py-1.5 text-xs text-red-400">
            {error}
          </p>
        )}
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Channel name"
          className="mb-3 w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <div className="mb-4 flex gap-2">
          {(["text", "voice"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                type === t
                  ? "bg-indigo-600 text-white"
                  : "bg-zinc-700 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {t === "text" ? "# Text" : "🔊 Voice"}
            </button>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim() || loading}
            className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}
