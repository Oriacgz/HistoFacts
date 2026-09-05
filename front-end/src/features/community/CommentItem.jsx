import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Heart, Trash2, CornerDownRight, Send } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function CommentItem({
  comment,
  postId,
  onAddReply,
  onDeleteComment,
  depth = 0,
}) {
  const { user } = useAuth();
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAuthor = user?.id === comment.user_id;

  const handleReplySubmit = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onAddReply(postId, replyText.trim(), comment.id);
      setReplyText('');
      setShowReplyBox(false);
    } catch (err) {
      console.error('Failed to add reply:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className={`relative ${depth > 0 ? 'ml-4 md:ml-7 pl-3 border-l-2 border-histo-dark/10' : ''} my-3`}>
      <div className="bg-histo-paper/60 border border-histo-dark/10 rounded-lg p-3.5 transition-colors hover:bg-histo-paper/90">
        {/* Comment Header */}
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-histo-dark text-white flex items-center justify-center font-display text-xs font-bold shadow-inner">
              {comment.author?.avatar_url ? (
                <img src={comment.author.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                comment.author?.username?.[0]?.toUpperCase() || '?'
              )}
            </div>
            <span className="font-ui font-semibold text-xs text-histo-dark">
              {comment.author?.username || 'Scholar'}
              {comment.author?.tag && (
                <span className="text-histo-ink/40 font-normal text-[10px] ml-1">#{comment.author.tag}</span>
              )}
            </span>
            <span className="text-[10px] text-histo-ink/40 font-ui">• {formatDate(comment.created_at)}</span>
          </div>

          {isAuthor && (
            <button
              onClick={() => onDeleteComment(postId, comment.id)}
              className="text-histo-ink/40 hover:text-histo-danger p-1 rounded transition-colors"
              title="Delete Comment"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Comment Content */}
        <p className="font-body text-xs md:text-sm text-histo-ink leading-relaxed whitespace-pre-wrap pl-8">
          {comment.content}
        </p>

        {/* Reply Action */}
        <div className="flex items-center gap-3 mt-2 pl-8">
          {user && depth < 3 && (
            <button
              onClick={() => setShowReplyBox(!showReplyBox)}
              className="flex items-center gap-1 text-[11px] font-ui text-histo-ink/60 hover:text-histo-copper font-medium transition-colors"
            >
              <CornerDownRight className="w-3 h-3" />
              {showReplyBox ? 'Cancel Reply' : 'Reply'}
            </button>
          )}
        </div>

        {/* Reply Composer */}
        <AnimatePresence>
          {showReplyBox && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              onSubmit={handleReplySubmit}
              className="mt-3 pl-8 flex gap-2"
            >
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder={`Replying to @${comment.author?.username || 'scholar'}...`}
                autoFocus
                className="flex-1 px-3 py-1.5 bg-white border border-histo-dark/15 rounded text-xs font-body outline-none focus:border-histo-copper"
              />
              <button
                type="submit"
                disabled={!replyText.trim() || isSubmitting}
                className="px-3 py-1.5 bg-histo-copper text-white rounded text-xs font-ui font-semibold hover:bg-histo-dark transition-colors disabled:opacity-50 flex items-center gap-1"
              >
                <Send className="w-3 h-3" />
                Reply
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>

      {/* Recursive Nested Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="space-y-1">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              postId={postId}
              onAddReply={onAddReply}
              onDeleteComment={onDeleteComment}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
