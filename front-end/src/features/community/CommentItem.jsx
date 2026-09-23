import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Film, Trash2, CornerDownRight, Send, Smile } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import UserAvatar from '../../components/UserAvatar';
import EmojiPickerPopover from './EmojiPickerPopover';
import GifPickerPopover from './GifPickerPopover';

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
  const [replyMedia, setReplyMedia] = useState(null);
  const [showReplyEmoji, setShowReplyEmoji] = useState(false);
  const [showReplyGifs, setShowReplyGifs] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAuthor = user?.id === comment.user_id;
  const displayAuthor = isAuthor ? { ...comment.author, ...user } : comment.author;

  const handleReplySubmit = async (e) => {
    e.preventDefault();
    if ((!replyText.trim() && !replyMedia) || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onAddReply(postId, replyText.trim(), comment.id, replyMedia);
      setReplyText('');
      setReplyMedia(null);
      setShowReplyEmoji(false);
      setShowReplyGifs(false);
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
    <div className={`relative ${depth > 0 ? 'ml-2.5 sm:ml-5 pl-2 sm:pl-3.5 border-l-2 border-histo-copper/30' : ''} my-2.5`}>
      <div className="bg-histo-paper/60 border border-histo-dark/10 rounded-xl p-3 sm:p-3.5 transition-colors hover:bg-histo-paper/90">
        {/* Comment Header */}
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <UserAvatar user={displayAuthor} size="xs" />
            <span className="font-ui font-semibold text-xs text-histo-dark truncate">
              {displayAuthor?.username || 'Scholar'}
              {displayAuthor?.tag && (
                <span className="text-histo-ink/40 font-normal text-[10px] ml-1">#{displayAuthor.tag}</span>
              )}
            </span>
            <span className="text-[10px] text-histo-ink/40 font-ui shrink-0">• {formatDate(comment.created_at)}</span>
          </div>

          {isAuthor && (
            <button
              type="button"
              onClick={() => onDeleteComment(postId, comment.id)}
              className="text-histo-ink/40 hover:text-histo-danger p-1 rounded-lg transition-colors cursor-pointer"
              title="Delete Comment"
              aria-label="Delete comment"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Comment Content */}
        {comment.content && (
          <p className="font-body text-xs sm:text-sm text-histo-ink leading-relaxed whitespace-pre-wrap pl-6 sm:pl-7">
            {comment.content}
          </p>
        )}
        {comment.media_url && (
          <div className="mt-2 pl-6 sm:pl-7">
            <img
              src={comment.media_url}
              alt="Comment media"
              loading="lazy"
              className="max-h-56 max-w-full rounded-xl border border-histo-dark/10 object-cover"
            />
          </div>
        )}

        {/* Reply Action */}
        <div className="flex items-center gap-3 mt-2 pl-6 sm:pl-7">
          {user && depth < 3 && (
            <button
              type="button"
              onClick={() => setShowReplyBox(!showReplyBox)}
              className="flex items-center gap-1 text-[11px] font-ui text-histo-ink/60 hover:text-histo-copper font-medium transition-colors cursor-pointer"
            >
              <CornerDownRight className="w-3 h-3" />
              <span>{showReplyBox ? 'Cancel Reply' : 'Reply'}</span>
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
              className="mt-2.5 pl-6 sm:pl-7 space-y-2"
            >
              {replyMedia && (
                <div className="relative inline-block">
                  <img src={replyMedia} alt="Attached GIF" className="h-16 rounded-lg border border-histo-dark/10 object-cover" />
                  <button
                    type="button"
                    onClick={() => setReplyMedia(null)}
                    title="Remove GIF"
                    aria-label="Remove GIF"
                    className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-histo-dark text-white shadow-xs hover:bg-red-600 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                  </button>
                </div>
              )}
              <div className="flex items-center gap-1.5 relative">
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setShowReplyEmoji(!showReplyEmoji);
                      setShowReplyGifs(false);
                    }}
                    title="Add emoji"
                    aria-label="Add emoji"
                    className={`p-1 rounded-full transition-colors cursor-pointer ${
                      showReplyEmoji ? 'text-histo-copper bg-histo-copper/10' : 'text-histo-ink/50 hover:text-histo-copper'
                    }`}
                  >
                    <Smile className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowReplyGifs(!showReplyGifs);
                      setShowReplyEmoji(false);
                    }}
                    title="Add a GIF"
                    aria-label="Add a GIF"
                    className={`p-1 rounded-full transition-colors cursor-pointer ${
                      showReplyGifs ? 'text-histo-copper bg-histo-copper/10' : 'text-histo-ink/50 hover:text-histo-copper'
                    }`}
                  >
                    <Film className="w-3.5 h-3.5" />
                  </button>
                  <EmojiPickerPopover
                    open={showReplyEmoji}
                    onClose={() => setShowReplyEmoji(false)}
                    onEmojiClick={(emoji) => setReplyText((t) => t + emoji)}
                  />
                  <GifPickerPopover
                    open={showReplyGifs}
                    onClose={() => setShowReplyGifs(false)}
                    onSelect={(gifUrl) => {
                      setReplyMedia(gifUrl);
                      setShowReplyGifs(false);
                    }}
                  />
                </div>
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={`Replying to @${comment.author?.username || 'scholar'}...`}
                  autoFocus
                  className="flex-1 min-w-0 px-3 py-1.5 bg-white border border-histo-dark/15 rounded-full text-xs font-body outline-none focus:border-histo-copper"
                />
                <button
                  type="submit"
                  disabled={(!replyText.trim() && !replyMedia) || isSubmitting}
                  className="px-3 py-1.5 bg-histo-copper text-white rounded-full text-xs font-ui font-semibold hover:bg-histo-dark transition-colors disabled:opacity-50 flex items-center gap-1 shrink-0 cursor-pointer active:scale-95"
                >
                  <Send className="w-3 h-3" />
                  <span>Reply</span>
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </div>

      {/* Recursive Nested Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="space-y-1 mt-1">
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
