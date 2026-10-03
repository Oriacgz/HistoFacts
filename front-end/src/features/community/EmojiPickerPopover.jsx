import { useEffect, useRef } from 'react';
import EmojiPicker from 'emoji-picker-react';

// Shared emoji picker — responsive and clamped to viewport to prevent horizontal overflow.
export default function EmojiPickerPopover({ open, onClose, onEmojiClick }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handleOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-0 z-30 mb-2 max-w-[calc(100vw-2.5rem)] shadow-deep rounded-2xl overflow-hidden"
    >
      <EmojiPicker
        onEmojiClick={(emojiData) => onEmojiClick(emojiData.emoji)}
        previewConfig={{ showPreview: false }}
        searchDisabled={false}
        skinTonesDisabled
        width={typeof window !== 'undefined' ? Math.min(320, window.innerWidth - 40) : 320}
        height={360}
      />
    </div>
  );
}
