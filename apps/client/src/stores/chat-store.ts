import { create } from "zustand";
import type { Message } from "@cordfast/shared";

type MessageWithAuthor = Message & {
  author: { id: string; username: string; avatarUrl: string | null };
};

interface ChatState {
  activeChannelId: string | null;
  messages: Map<string, MessageWithAuthor[]>;
  hasMore: Map<string, boolean>;
  loading: boolean;
  typingUsers: Map<string, Set<string>>;

  setActiveChannel: (channelId: string) => void;
  appendMessage: (channelId: string, message: MessageWithAuthor) => void;
  updateMessage: (channelId: string, message: Message) => void;
  removeMessage: (channelId: string, messageId: string) => void;
  setHistory: (
    channelId: string,
    messages: MessageWithAuthor[],
    hasMore: boolean,
  ) => void;
  prependHistory: (
    channelId: string,
    messages: MessageWithAuthor[],
    hasMore: boolean,
  ) => void;
  setLoading: (loading: boolean) => void;
  addTypingUser: (channelId: string, username: string) => void;
  removeTypingUser: (channelId: string, userId: string) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  activeChannelId: null,
  messages: new Map(),
  hasMore: new Map(),
  loading: false,
  typingUsers: new Map(),

  setActiveChannel: (channelId) => set({ activeChannelId: channelId }),

  appendMessage: (channelId, message) =>
    set((state) => {
      const existing = state.messages.get(channelId) ?? [];
      const next = new Map(state.messages);
      next.set(channelId, [...existing, message]);
      return { messages: next };
    }),

  updateMessage: (channelId, message) =>
    set((state) => {
      const existing = state.messages.get(channelId) ?? [];
      const next = new Map(state.messages);
      next.set(
        channelId,
        existing.map((m) => (m.id === message.id ? { ...m, ...message } : m)),
      );
      return { messages: next };
    }),

  removeMessage: (channelId, messageId) =>
    set((state) => {
      const existing = state.messages.get(channelId) ?? [];
      const next = new Map(state.messages);
      next.set(
        channelId,
        existing.filter((m) => m.id !== messageId),
      );
      return { messages: next };
    }),

  setHistory: (channelId, messages, hasMore) =>
    set((state) => {
      const nextMsgs = new Map(state.messages);
      const nextHasMore = new Map(state.hasMore);
      nextMsgs.set(channelId, messages);
      nextHasMore.set(channelId, hasMore);
      return { messages: nextMsgs, hasMore: nextHasMore };
    }),

  prependHistory: (channelId, messages, hasMore) =>
    set((state) => {
      const existing = state.messages.get(channelId) ?? [];
      const nextMsgs = new Map(state.messages);
      const nextHasMore = new Map(state.hasMore);
      nextMsgs.set(channelId, [...messages, ...existing]);
      nextHasMore.set(channelId, hasMore);
      return { messages: nextMsgs, hasMore: nextHasMore };
    }),

  setLoading: (loading) => set({ loading }),

  addTypingUser: (channelId, username) =>
    set((state) => {
      const next = new Map(state.typingUsers);
      const set = new Set(next.get(channelId) ?? []);
      set.add(username);
      next.set(channelId, set);
      return { typingUsers: next };
    }),

  removeTypingUser: (channelId, userId) =>
    set((state) => {
      const next = new Map(state.typingUsers);
      const set = new Set(next.get(channelId) ?? []);
      set.delete(userId);
      next.set(channelId, set);
      return { typingUsers: next };
    }),
}));
