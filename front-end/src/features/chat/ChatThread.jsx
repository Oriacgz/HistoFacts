import { useRef, useEffect, useCallback } from 'react';
import MessageBubble from './MessageBubble';

export default function ChatThread({ messages, onLoadMore, hasMore, isGroup, currentUserId }) {
  const containerRef = useRef(null);
  const bottomRef = useRef(null);
  const prevLengthRef = useRef(0);
  const isInitialLoad = useRef(true);

  // Auto-scroll to bottom on initial load and new messages appended at the end
  useEffect(() => {
    if (!messages.length) return;

    if (isInitialLoad.current) {
      bottomRef.current?.scrollIntoView();
      isInitialLoad.current = false;
      prevLengthRef.current = messages.length;
      return;
    }

    // Only auto-scroll if new messages were appended (not prepended from scroll-up)
    const addedAtEnd = messages.length > prevLengthRef.current;
    prevLengthRef.current = messages.length;

    if (addedAtEnd && containerRef.current) {
      const el = containerRef.current;
      const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
      if (isNearBottom) {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [messages]);

  // Scroll-up to load older messages
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el || !hasMore) return;

    if (el.scrollTop < 60) {
      // Save scroll position to restore after prepend
      const prevHeight = el.scrollHeight;
      onLoadMore().then(() => {
        requestAnimationFrame(() => {
          if (containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight - prevHeight;
          }
        });
      });
    }
  }, [hasMore, onLoadMore]);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-2 scroll-smooth"
      style={{ minHeight: 0 }}
    >
      {hasMore && (
        <div className="text-center py-2">
          <span className="text-[10px] font-ui text-histo-ink/40 tracking-wider uppercase">
            Scroll up for older messages
          </span>
        </div>
      )}

      {messages.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs font-body text-histo-ink/40 italic text-center px-6">
            No messages yet — start the conversation!
          </p>
        </div>
      )}

      {messages.map((msg) => (
        <MessageBubble
          key={msg.id}
          message={msg}
          isOwnMessage={msg.sender_id === currentUserId}
          showSender={isGroup}
        />
      ))}

      <div ref={bottomRef} />
    </div>
  );
}
