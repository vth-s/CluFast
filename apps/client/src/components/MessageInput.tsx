import { useState, useRef, useCallback } from "react";
import { useChatStore } from "../stores/chat-store.js";
import { wsClient } from "../lib/ws-client.js";

export function MessageInput() {
  const [text, setText] = useState("");
  const [typingTimeout, setTypingTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  const activeChannelId = useChatStore((s) => s.activeChannelId);

  const handleTyping = useCallback(() => {
    if (!activeChannelId) return;

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      wsClient.send("typing:start", { channelId: activeChannelId });
    }

    if (typingTimeout) clearTimeout(typingTimeout);

    const timeout = setTimeout(() => {
      isTypingRef.current = false;
      wsClient.send("typing:stop", { channelId: activeChannelId });
      setTypingTimeout(null);
    }, 3000);

    setTypingTimeout(timeout);
  }, [activeChannelId, typingTimeout]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || !activeChannelId) return;

    wsClient.send("message:send", {
      channelId: activeChannelId,
      content: trimmed,
    });
    setText("");

    // Stop typing indicator
    if (isTypingRef.current) {
      isTypingRef.current = false;
      wsClient.send("typing:stop", { channelId: activeChannelId });
    }
    if (typingTimeout) {
      clearTimeout(typingTimeout);
      setTypingTimeout(null);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  if (!activeChannelId) return null;

  return (
    <div className="border-t border-zinc-800 bg-zinc-900 px-4 pb-4 pt-2">
      <form
        onSubmit={handleSubmit}
        className="flex items-end gap-2 rounded-xl bg-zinc-800 px-4 py-2 ring-1 ring-zinc-700 transition-shadow focus-within:ring-indigo-500"
      >
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            handleTyping();
          }}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          rows={1}
          className="max-h-32 min-h-[24px] flex-1 resize-none bg-transparent text-sm text-white outline-none placeholder:text-zinc-500"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-indigo-500 disabled:opacity-30"
        >
          Send
        </button>
      </form>
    </div>
  );
}
