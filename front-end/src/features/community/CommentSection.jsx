import { useState } from 'react';
import { Film, Send, Smile, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import CommentItem from './CommentItem';
import EmojiPickerPopover from './EmojiPickerPopover';
import GifPickerPopover from './GifPickerPopover';

export default function CommentSection({
  comments = [],
  postId,
  onAddComment,
  onDeleteComment,
  loading = false,
}) {
  const { user } = useAuth();
  const [newComment, setNewComment] = useState('');
  const [commentMedia, setCommentMedia] = useState(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showGifs, setShowGifs] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if ((!newComment.trim() && !commentMedia) || submitting || !user) return;

    setSubmitting(true);
    try {
      await onAddComment(postId, newComment.trim(), null, commentMedia);
      setNewComment('');
      setCommentMedia(null);
      setShowEmoji(false);
      setShowGifs(false);
    } catch (err) {
      console.error('Failed to post comment:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pt-1">
      {/* Add Top-level Comment */}
      <form onSubmit={handleSubmit} className="mb-4">
        {commentMedia && (
          <div className="relative inline-block mb-2">
            <img
              src={commentMedia}
              alt="Attached GIF"
              className="h-20 rounded-lg border border-histo-dark/10"
            />
            <button
              type="button"
              onClick={() => setCommentMedia(null)}
              title="Remove GIF"
              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-histo-dark text-white shadow-sm hover:bg-red-600 transition-colors cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        <div className="flex items-end gap-2 relative">
            <button
              type="button"
              onClick={() => {
                setShowEmoji(!showEmoji);
                setShowGifs(false);
              }}
              disabled={!user || submitting}
              title="Add emoji"
              className={`p-1.5 rounded-full transition-colors cursor-pointer disabled:opacity-40 ${
                showEmoji ? 'text-histo-copper bg-histo-copper/10' : 'text-histo-ink/50 hover:text-histo-copper'
              }`}
            >
              <Smile className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setShowGifs(!showGifs);
                setShowEmoji(false);
              }}
              disabled={!user || submitting}
              title="Add a GIF"
              className={`p-1.5 rounded-full transition-colors cursor-pointer disabled:opacity-40 ${
                showGifs ? 'text-histo-copper bg-histo-copper/10' : 'text-histo-ink/50 hover:text-histo-copper'
              }`}
            >
              <Film className="w-4 h-4" />
            </button>
            <EmojiPickerPopover
              open={showEmoji}
              onClose={() => setShowEmoji(false)}
              onEmojiClick={(emoji) => setNewComment((c) => c + emoji)}
            />
            <GifPickerPopover
              open={showGifs}
              onClose={() => setShowGifs(false)}
              onSelect={(gifUrl) => {
                setCommentMedia(gifUrl);
                setShowGifs(false);
              }}
            />

          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder={user ? 'Write a scholarly remark or question...' : 'Log in to join the conversation...'}
            disabled={!user || submitting}
            className="flex-1 px-3.5 py-2 bg-histo-paper/50 border border-histo-dark/15 rounded-full text-xs md:text-sm font-body outline-none focus:border-histo-copper focus:bg-white transition-all disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!user || (!newComment.trim() && !commentMedia) || submitting}
            className="px-4 py-2 bg-histo-dark text-white rounded-full text-xs font-ui font-medium hover:bg-histo-copper transition-colors disabled:opacity-40 flex items-center gap-1.5 shadow-sm shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Post</span>
          </button>
        </div>
      </form>

      {/* Comment List */}
      {loading ? (
        <div className="py-4 text-center text-xs font-ui text-histo-ink/50">Loading thoughts...</div>
      ) : comments.length === 0 ? (
        <div className="py-6 text-center text-xs font-body italic text-histo-ink/50 bg-histo-paper/30 rounded-lg border border-dashed border-histo-dark/10">
          No remarks yet. Be the first scholar to comment!
        </div>
      ) : (
        <div className="space-y-1">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              postId={postId}
              onAddReply={onAddComment}
              onDeleteComment={onDeleteComment}
              depth={0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
