import { useEffect, useRef } from 'react';
import EmojiPicker from 'emoji-picker-react';

// Shared emoji picker — the single picker instance for the whole app (community feed, chat).
// Renders inline (not in a portal) so it stays anchored to the composer that opened it.
export default function EmojiPickerPopover({ open, onClose, onEmojiClick }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handleOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div ref={ref} className="absolute bottom-full left-0 z-30 mb-2">
      <EmojiPicker
        onEmojiClick={(emojiData) => onEmojiClick(emojiData.emoji)}
        previewConfig={{ showPreview: false }}
        searchDisabled={false}
        skinTonesDisabled
        width={320}
        height={380}
      />
    </div>
  );
}
