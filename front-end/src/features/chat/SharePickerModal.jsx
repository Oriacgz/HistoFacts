import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Loader2, Share2 } from 'lucide-react';
import { useChat } from '../../contexts/ChatContext';
import { useToast } from '../../contexts/ToastContext';
import { shareNoteApi } from '../../api/aiNotes';
import { getConversationsApi } from '../../api/chat';
import ShareTargetList from './ShareTargetList';

/**
 * Modal dialog allowing users to pick conversations/groups and share a note.
 *
 * @param {string} noteId - ID of the note to share
 * @param {Function} onClose - Callback when modal is closed
 */
export default function SharePickerModal({ noteId, onClose }) {
  const chatContext = useChat();
  const toast = useToast();
  const [selected, setSelected] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [fallbackConversations, setFallbackConversations] = useState([]);

  // If outside ChatProvider, fetch conversations directly
  useEffect(() => {
    if (!chatContext?.conversations) {
      let cancelled = false;
      getConversationsApi()
        .then((data) => {
          if (!cancelled) setFallbackConversations(data || []);
        })
        .catch((err) => {
          console.error('Failed to load conversations for sharing:', err);
        });
      return () => {
        cancelled = true;
      };
    }
  }, [chatContext?.conversations]);

  const conversations = chatContext?.conversations || fallbackConversations;

  const handleToggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleShare = async () => {
    if (selected.size === 0 || loading || !noteId) return;
    setLoading(true);
    try {
      const resp = await shareNoteApi(noteId, Array.from(selected));
      toast?.show?.(
        `Note shared to ${resp.shared_to || selected.size} conversation${(resp.shared_to || selected.size) > 1 ? 's' : ''}!`,
        'success'
      );
      onClose();
    } catch (err) {
      console.error('Failed to share note:', err);
      toast?.show?.(err.message || 'Failed to share note', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-histo-dark/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-md bg-white border border-histo-dark/15 rounded-xl shadow-2xl flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-histo-dark/10 bg-histo-cream/30">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-md bg-histo-copper/15 text-histo-copper flex items-center justify-center">
                <Share2 className="h-4 w-4" />
              </div>
              <h3 className="font-display font-bold text-sm text-histo-dark m-0">
                Share Note
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-md text-histo-ink/50 hover:text-histo-dark hover:bg-histo-cream/80 transition-colors border-none bg-transparent cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 flex-1">
            <ShareTargetList
              targets={conversations}
              selected={selected}
              onToggle={handleToggle}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-histo-dark/10 bg-histo-cream/20">
            <span className="text-xs font-ui text-histo-ink/60">
              {selected.size === 0
                ? 'Select conversations to share'
                : `${selected.size} selected`}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg text-xs font-ui font-medium text-histo-ink/70 hover:bg-histo-cream transition-colors border border-transparent cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={selected.size === 0 || loading}
                onClick={handleShare}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-histo-copper hover:bg-histo-copper/90 text-white font-ui text-xs font-semibold shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all active:scale-95"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Sharing...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    <span>Send</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
