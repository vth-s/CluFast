import { useEffect, useRef } from "react";
import { wsClient } from "../lib/ws-client.js";
import { useChatStore } from "../stores/chat-store.js";
import { useAuthStore } from "../stores/auth-store.js";
import type { WsServerEvents } from "@cordfast/shared";

export function useWebSocket() {
  const token = useAuthStore((s) => s.token);
  const appendMessage = useChatStore((s) => s.appendMessage);
  const updateMessage = useChatStore((s) => s.updateMessage);
  const removeMessage = useChatStore((s) => s.removeMessage);
  const addTypingUser = useChatStore((s) => s.addTypingUser);
  const removeTypingUser = useChatStore((s) => s.removeTypingUser);
  const connectedRef = useRef(wsClient.connected);

  useEffect(() => {
    if (!token) return;

    wsClient.connect(token);

    const unsubs = [
      wsClient.on<WsServerEvents["message:new"]>("message:new", (msg) => {
        appendMessage(msg.channelId, msg);
      }),

      wsClient.on<WsServerEvents["message:updated"]>("message:updated", (msg) => {
        updateMessage(msg.channelId, msg);
      }),

      wsClient.on<WsServerEvents["message:deleted"]>("message:deleted", (msg) => {
        removeMessage(msg.channelId, msg.messageId);
      }),

      wsClient.on<WsServerEvents["typing:user-start"]>(
        "typing:user-start",
        (data) => {
          addTypingUser(data.channelId, data.username);
        },
      ),

      wsClient.on<WsServerEvents["typing:user-stop"]>(
        "typing:user-stop",
        (data) => {
          removeTypingUser(data.channelId, data.userId);
        },
      ),

      wsClient.on("auth:ok", () => {
        connectedRef.current = true;
      }),

      wsClient.on("disconnected", () => {
        connectedRef.current = false;
      }),
    ];

    return () => {
      unsubs.forEach((fn) => fn());
    };
  }, [token, appendMessage, updateMessage, removeMessage, addTypingUser, removeTypingUser]);
}
