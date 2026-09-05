import { useState } from 'react';
import { motion } from 'framer-motion';
import { Heart, MessageSquare, Share2, MoreVertical, Trash2, Lock, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import CommentSection from './CommentSection';

export default function PostCard({
  post,
  onLike,
  onAddComment,
  onDeleteComment,
  onDeletePost,
  onOpenShare,
  onLoadComments,
}) {
  const { user } = useAuth();
  const [showComments, setShowComments] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);

  const isAuthor = user?.id === post.user_id;

  const handleToggleComments = async () => {
    const nextState = !showComments;
    setShowComments(nextState);
    if (nextState && onLoadComments) {
      setLoadingComments(true);
      try {
        await onLoadComments(post.id);
      } finally {
        setLoadingComments(false);
      }
    }
  };

  const handleLikeClick = async () => {
    if (!user || isLiking) return;
    setIsLiking(true);
    try {
      await onLike(post.id);
    } finally {
      setIsLiking(false);
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    });
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="bg-white border border-histo-dark/15 rounded-xl shadow-soft hover:shadow-medium transition-all p-5 md:p-6 mb-5 relative"
    >
      {/* Post Header */}
      <div className="flex items-start justify-between gap-3 mb-3.5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-histo-dark text-white flex items-center justify-center font-display font-bold text-sm shadow-inner overflow-hidden border border-histo-copper/30">
            {post.author?.avatar_url ? (
              <img src={post.author.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              post.author?.username?.[0]?.toUpperCase() || 'S'
            )}
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-ui font-bold text-sm text-histo-dark">
                {post.author?.username || 'Chronicle Scholar'}
              </span>
              {post.author?.tag && (
                <span className="text-histo-ink/40 font-normal text-xs">#{post.author.tag}</span>
              )}
              {post.is_locked && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-histo-paper text-[10px] font-ui text-histo-ink/60 border border-histo-dark/10">
                  <Lock className="w-2.5 h-2.5" /> Locked
                </span>
              )}
            </div>
            <p className="text-[11px] font-ui text-histo-ink/50">{formatDate(post.created_at)}</p>
          </div>
        </div>

        {/* Options dropdown for Author */}
        {isAuthor && (
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 text-histo-ink/40 hover:text-histo-dark hover:bg-histo-paper rounded-lg transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-8 w-36 bg-white border border-histo-dark/15 rounded-lg shadow-medium py-1 z-20">
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onDeletePost(post.id);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-ui text-red-600 hover:bg-red-50 transition-colors text-left"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Post
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Post Title (if thread) */}
      {post.title && (
        <h2 className="font-display font-bold text-base md:text-lg text-histo-dark mb-2.5 leading-snug">
          {post.title}
        </h2>
      )}

      {/* Post Body */}
      <div className="font-body text-sm md:text-base text-histo-ink leading-relaxed whitespace-pre-wrap mb-4">
        {post.content}
      </div>

      {/* Interaction Toolbar */}
      <div className="flex items-center justify-between pt-3 border-t border-histo-dark/10 text-xs font-ui text-histo-ink/70">
        <div className="flex items-center gap-4 md:gap-6">
          {/* Like Button */}
          <button
            onClick={handleLikeClick}
            disabled={!user || isLiking}
            className={`flex items-center gap-1.5 py-1 px-2 rounded-lg transition-all active:scale-95 ${
              post.has_liked
                ? 'text-red-600 font-semibold bg-red-50'
                : 'hover:text-histo-copper hover:bg-histo-paper'
            }`}
          >
            <Heart className={`w-4 h-4 ${post.has_liked ? 'fill-red-600' : ''}`} />
            <span>{post.like_count || 0}</span>
          </button>

          {/* Comments Toggle */}
          <button
            onClick={handleToggleComments}
            className={`flex items-center gap-1.5 py-1 px-2 rounded-lg transition-colors cursor-pointer ${
              showComments ? 'text-histo-dark font-semibold bg-histo-paper' : 'hover:text-histo-dark hover:bg-histo-paper'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>{post.comment_count || 0} Comments</span>
          </button>

          {/* Share Button */}
          <button
            onClick={() => onOpenShare(post)}
            className="flex items-center gap-1.5 py-1 px-2 rounded-lg hover:text-histo-copper hover:bg-histo-paper transition-colors cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
            <span>{post.share_count || 0}</span>
          </button>
        </div>
      </div>

      {/* Expandable Comments Section */}
      {showComments && (
        <CommentSection
          comments={post.comments || []}
          postId={post.id}
          onAddComment={onAddComment}
          onDeleteComment={onDeleteComment}
          loading={loadingComments}
        />
      )}
    </motion.article>
  );
}
