import { useState } from 'react';
import { Send, Paperclip } from 'lucide-react';

export default function ChatComposer({ onSend, disabled }) {
  const [text, setText] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend({ message_type: 'text', content: trimmed });
    setText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-end gap-2 p-3 border-t border-histo-dark/10 bg-white shrink-0"
    >
      {/* Attach button — placeholder for future share-picker */}
      <button
        type="button"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-histo-dark/10 text-histo-ink/40 hover:text-histo-copper hover:border-histo-copper transition-colors cursor-pointer bg-transparent shrink-0"
        title="Share note or quiz (coming soon)"
      >
        <Paperclip className="h-4 w-4" />
      </button>

      {/* Text input */}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a message..."
        rows={1}
        className="flex-1 resize-none px-3 py-2 text-[13px] font-body bg-histo-cream/40 border border-histo-dark/10 rounded-lg outline-none focus:border-histo-copper transition-colors placeholder:text-histo-ink/35 text-histo-ink leading-relaxed max-h-24 overflow-y-auto"
      />

      {/* Send button */}
      <button
        type="submit"
        disabled={!text.trim() || disabled}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-histo-dark text-histo-gold hover:bg-histo-copper transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed border-none shrink-0 shadow-sm"
      >
        <Send className="h-4 w-4" />
      </button>
    </form>
  );
}
