import { useState } from 'react';
import { Send, MessageSquare } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import CommentItem from './CommentItem';

export default function CommentSection({
  comments = [],
  postId,
  onAddComment,
  onDeleteComment,
  loading = false,
}) {
  const { user } = useAuth();
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || submitting || !user) return;

    setSubmitting(true);
    try {
      await onAddComment(postId, newComment.trim());
      setNewComment('');
    } catch (err) {
      console.error('Failed to post comment:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pt-4 border-t border-histo-dark/10 mt-4">
      {/* Add Top-level Comment */}
      <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
        <input
          type="text"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder={user ? "Write a scholarly remark or question..." : "Log in to join the conversation..."}
          disabled={!user || submitting}
          className="flex-1 px-3.5 py-2 bg-histo-paper/50 border border-histo-dark/15 rounded-lg text-xs md:text-sm font-body outline-none focus:border-histo-copper focus:bg-white transition-all disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={!user || !newComment.trim() || submitting}
          className="px-4 py-2 bg-histo-dark text-white rounded-lg text-xs font-ui font-medium hover:bg-histo-copper transition-colors disabled:opacity-40 flex items-center gap-1.5 shadow-sm"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Post</span>
        </button>
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
