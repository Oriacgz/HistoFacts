import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check, Share2, X } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

export default function ShareModal({ post, isOpen, onClose, onShare }) {
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen || !post) return null;

  const postUrl = `${window.location.origin}/feed#post-${post.id}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(postUrl);
      setCopied(true);
      toast.success('Chronicle link copied to clipboard!');
      await onShare(post.id, { shareChannel: 'copy_link', caption: null });
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy URL:', err);
      toast.error('Failed to copy chronicle link.');
    }
  };

  const handleNativeShare = async (channel) => {
    try {
      if (channel === 'twitter') {
        const text = encodeURIComponent(`Check out this historical discussion on HistoFacts: "${post.title || post.content.slice(0, 80)}..."`);
        window.open(`https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(postUrl)}`, '_blank');
      } else if (channel === 'whatsapp') {
        const text = encodeURIComponent(`Historical insight on HistoFacts: ${postUrl}`);
        window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
      }
      await onShare(post.id, { shareChannel: channel, caption: null });
      onClose();
    } catch (err) {
      console.error('Share action failed:', err);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-histo-dark/60 backdrop-blur-xs"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        className="bg-white rounded-2xl shadow-deep border border-histo-dark/15 max-w-md w-full p-5 sm:p-6 relative"
        role="dialog"
        aria-modal="true"
        aria-label="Share Chronicle"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-histo-ink/40 hover:text-histo-dark hover:bg-histo-paper p-1.5 rounded-full transition-colors cursor-pointer"
          aria-label="Close share dialog"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-histo-copper/10 text-histo-copper flex items-center justify-center shrink-0">
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-display font-bold text-lg text-histo-dark">Share Chronicle</h3>
            <p className="text-xs font-ui text-histo-ink/60">Broadcast this discussion with other scholars</p>
          </div>
        </div>

        {/* Post Summary Preview */}
        <div className="p-3 bg-histo-paper/50 rounded-xl border border-histo-dark/10 mb-4 text-xs font-body text-histo-ink/80 italic line-clamp-2">
          "{post.title ? `${post.title}: ` : ''}{post.content}"
        </div>

        {/* Copy Link Row */}
        <div className="mb-5">
          <label className="block text-xs font-ui font-semibold text-histo-dark mb-1.5">Direct Chronicle Link</label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={postUrl}
              className="flex-1 min-w-0 px-3.5 py-2 bg-histo-paper/40 border border-histo-dark/15 rounded-xl text-xs font-ui text-histo-ink/75 select-all outline-none focus:border-histo-copper"
            />
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-4 py-2 bg-histo-dark text-white rounded-xl text-xs font-ui font-semibold hover:bg-histo-copper transition-colors shadow-xs cursor-pointer active:scale-95 shrink-0"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Social Channels */}
        <div className="space-y-2">
          <span className="block text-xs font-ui font-semibold text-histo-dark">Share via External Platform</span>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => handleNativeShare('twitter')}
              className="flex items-center justify-center gap-2 py-2 px-3 border border-histo-dark/15 rounded-xl text-xs font-ui font-medium text-histo-dark hover:bg-histo-paper transition-colors cursor-pointer"
            >
              <span>𝕏 / Twitter</span>
            </button>
            <button
              type="button"
              onClick={() => handleNativeShare('whatsapp')}
              className="flex items-center justify-center gap-2 py-2 px-3 border border-histo-dark/15 rounded-xl text-xs font-ui font-medium text-histo-dark hover:bg-histo-paper transition-colors cursor-pointer"
            >
              <span>WhatsApp</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
