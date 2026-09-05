import { useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check, Share2, X, Send } from 'lucide-react';

export default function ShareModal({ post, isOpen, onClose, onShare }) {
  const [copied, setCopied] = useState(false);
  const [caption, setCaption] = useState('');
  const [sharing, setSharing] = useState(false);

  if (!isOpen || !post) return null;

  const postUrl = `${window.location.origin}/feed#post-${post.id}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(postUrl);
      setCopied(true);
      await onShare(post.id, { shareChannel: 'copy_link', caption });
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  };

  const handleNativeShare = async (channel) => {
    setSharing(true);
    try {
      if (channel === 'twitter') {
        const text = encodeURIComponent(`Check out this historical discussion on HistoFacts: "${post.title || post.content.slice(0, 80)}..."`);
        window.open(`https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(postUrl)}`, '_blank');
      } else if (channel === 'whatsapp') {
        const text = encodeURIComponent(`Historical insight on HistoFacts: ${postUrl}`);
        window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
      }
      await onShare(post.id, { shareChannel: channel, caption });
      onClose();
    } catch (err) {
      console.error('Share action failed:', err);
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-histo-dark/40 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-white rounded-xl shadow-deep border border-histo-dark/15 max-w-md w-full p-6 relative"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-histo-ink/40 hover:text-histo-dark p-1 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-10 h-10 rounded-full bg-histo-copper/10 text-histo-copper flex items-center justify-center">
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-display font-bold text-lg text-histo-dark">Share Chronicle</h3>
            <p className="text-xs font-ui text-histo-ink/60">Broadcast this discussion with other scholars</p>
          </div>
        </div>

        {/* Post Summary Preview */}
        <div className="p-3 bg-histo-paper/50 rounded-lg border border-histo-dark/10 mb-4 text-xs font-body text-histo-ink/80 italic line-clamp-2">
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
              className="flex-1 px-3 py-2 bg-histo-paper/40 border border-histo-dark/15 rounded-lg text-xs font-ui text-histo-ink/70 select-all outline-none"
            />
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-4 py-2 bg-histo-dark text-white rounded-lg text-xs font-ui font-semibold hover:bg-histo-copper transition-colors shadow-sm cursor-pointer active:scale-95"
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
              onClick={() => handleNativeShare('twitter')}
              className="flex items-center justify-center gap-2 py-2 px-3 border border-histo-dark/15 rounded-lg text-xs font-ui font-medium text-histo-dark hover:bg-histo-paper transition-colors"
            >
              <span>𝕏 / Twitter</span>
            </button>
            <button
              onClick={() => handleNativeShare('whatsapp')}
              className="flex items-center justify-center gap-2 py-2 px-3 border border-histo-dark/15 rounded-lg text-xs font-ui font-medium text-histo-dark hover:bg-histo-paper transition-colors"
            >
              <span>WhatsApp</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
