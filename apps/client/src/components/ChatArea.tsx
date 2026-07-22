import { useEffect, useRef } from "react";
import { useChatStore } from "../stores/chat-store.js";
import { useAuthStore } from "../stores/auth-store.js";
import { MessageInput } from "./MessageInput.js";

export function ChatArea() {
  const activeChannelId = useChatStore((s) => s.activeChannelId);
  const messages = useChatStore((s) => s.messages);
  const typingUsers = useChatStore((s) => s.typingUsers);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const bottomRef = useRef<HTMLDivElement>(null);

  const channelMessages = activeChannelId
    ? (messages.get(activeChannelId) ?? [])
    : [];

  const channelTyping = activeChannelId
    ? (typingUsers.get(activeChannelId) ?? new Set())
    : new Set();
  const typingList = [...channelTyping].filter((u) => u !== currentUserId);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [channelMessages.length]);

  if (!activeChannelId) {
    return (
      <div className="flex flex-1 items-center justify-center bg-zinc-900">
        <p className="text-sm text-zinc-500">
          Select a channel to start chatting
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-zinc-900">
      {/* Messages */}
      {channelMessages.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-zinc-500">
            No messages yet. Say something!
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {channelMessages.map((msg) => {
            const isMe = msg.authorId === currentUserId;
            const initials = msg.author.username
              .split(/\s+/)
              .slice(0, 2)
              .map((w) => w[0])
              .join("")
              .toUpperCase();

            const time = new Date(msg.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <div
                key={msg.id}
                className="group flex gap-3 rounded-md px-2 py-1 transition-colors hover:bg-zinc-800/40"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-xs font-bold text-zinc-300">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span
                      className={`text-sm font-semibold ${
                        isMe ? "text-indigo-400" : "text-zinc-200"
                      }`}
                    >
                      {msg.author.username}
                    </span>
                    <span className="text-[10px] text-zinc-600">
                      {time}
                    </span>
                  </div>
                  <p className="break-words text-sm text-zinc-300">
                    {msg.content}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Typing indicator */}
      {typingList.length > 0 && (
        <div className="px-4 pb-1 text-xs text-zinc-500">
          <span className="inline-flex items-center gap-1">
            <span className="flex gap-0.5">
              <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-zinc-400 [animation-delay:0ms]" />
              <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-zinc-400 [animation-delay:150ms]" />
              <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-zinc-400 [animation-delay:300ms]" />
            </span>
            {typingList.length === 1
              ? `${typingList[0]} is typing...`
              : `${typingList.join(", ")} are typing...`}
          </span>
        </div>
      )}

      {/* Input */}
      <MessageInput />
    </div>
  );
}
