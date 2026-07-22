import { create } from "zustand";
import { api } from "../lib/api.js";

interface Server {
  id: string;
  name: string;
  iconUrl: string | null;
}

interface Channel {
  id: string;
  serverId: string;
  name: string;
  type: "text" | "voice";
}

interface DataState {
  servers: Server[];
  channels: Channel[];
  activeServerId: string | null;
  activeChannelId: string | null;

  setActiveServer: (id: string) => void;
  setActiveChannel: (id: string | null) => void;
  getServerChannels: (serverId: string) => Channel[];

  fetchServers: (token: string) => Promise<void>;
  fetchChannels: (serverId: string, token: string) => Promise<void>;
  addServer: (server: Server) => void;
  addChannel: (channel: Channel) => void;
}

export const useDataStore = create<DataState>((set, get) => ({
  servers: [],
  channels: [],
  activeServerId: null,
  activeChannelId: null,

  setActiveServer: (id) => set({ activeServerId: id, activeChannelId: null }),
  setActiveChannel: (id) => set({ activeChannelId: id }),

  getServerChannels: (serverId) =>
    get().channels.filter((c) => c.serverId === serverId),

  fetchServers: async (token) => {
    try {
      const { servers } = await api.getServers(token);
      set((state) => ({
        servers,
        activeServerId: state.activeServerId ?? servers[0]?.id ?? null,
      }));
    } catch (err) {
      console.error("[data] Failed to fetch servers:", err);
    }
  },

  fetchChannels: async (serverId, token) => {
    try {
      const { channels } = await api.getChannels(serverId, token);
      set({ channels });
    } catch (err) {
      console.error("[data] Failed to fetch channels:", err);
    }
  },

  addServer: (server) =>
    set((state) => ({
      servers: [...state.servers, server],
      activeServerId: server.id,
    })),

  addChannel: (channel) =>
    set((state) => ({
      channels: [...state.channels, channel],
    })),
}));
