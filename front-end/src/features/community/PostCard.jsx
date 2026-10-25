import { useState, useEffect, useRef, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, MoreVertical, Share2, Trash2, Lock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import CommentSection from './CommentSection';
import PostMedia from './PostMedia';
import ReactionControl from './ReactionControl';
import UserAvatar from '../../components/UserAvatar';
import { formatRelativeTime } from './relativeTime';

const PostActionBar = memo(function PostActionBar({ post, showComments, onReaction, onToggleComments, onOpenShare }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 pt-2 border-t border-histo-dark/5 text-histo-ink/60">
      <button
        type="button"
        onClick={onToggleComments}
        aria-expanded={showComments}
        aria-label={`${post.comment_count || 0} comments, toggle discussion thread`}
        className={`inline-flex h-8 sm:h-8.5 items-center gap-1.5 rounded-full px-3 text-xs font-ui font-semibold transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-histo-copper/40 ${
          showComments
            ? 'bg-histo-copper/10 text-histo-copper border border-histo-copper/25 shadow-xs'
            : 'hover:text-histo-copper hover:bg-histo-copper/10 border border-transparent'
        }`}
      >
        <MessageCircle className="w-4 h-4" />
        <span>{post.comment_count || 0}</span>
      </button>

      <button
        type="button"
        onClick={onOpenShare}
        aria-label="Share this chronicle"
        className="inline-flex h-8 sm:h-8.5 items-center gap-1.5 rounded-full px-3 text-xs font-ui font-semibold transition-all hover:text-histo-copper hover:bg-histo-copper/10 border border-transparent cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-histo-copper/40"
      >
        <Share2 className="w-4 h-4" />
        {post.share_count > 0 && <span>{post.share_count}</span>}
      </button>

      <ReactionControl
        postId={post.id}
        likes={post.likes}
        dislikes={post.dislikes}
        userReaction={post.user_reaction}
        onReaction={onReaction}
      />
    </div>
  );
});
PostActionBar.displayName = 'PostActionBar';

const PostCard = memo(function PostCard({
  post,
  onReaction,
  onAddComment,
  onDeleteComment,
  onDeletePost,
  onOpenShare,
  onLoadComments,
}) {
  const { user } = useAuth();
  const [showComments, setShowComments] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const menuRef = useRef(null);

  const isAuthor = user?.id === post.user_id;
  const displayAuthor = isAuthor ? { ...post.author, ...user } : post.author;

  useEffect(() => {
    if (!showMenu) return undefined;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

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

  return (
    <motion.article
      id={`post-${post.id}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="rounded-2xl border border-histo-dark/10 bg-white p-4 sm:p-5 md:p-6 shadow-soft hover:shadow-medium transition-all duration-200"
    >
      <div className="flex gap-3 sm:gap-4">
        <UserAvatar user={displayAuthor} size="md" />

        <div className="min-w-0 flex-1">
          {/* Author row: name, tag, relative time, options */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-sm">
              <span className="font-ui font-bold text-histo-dark hover:text-histo-copper transition-colors">
                {displayAuthor?.username || 'Chronicle Scholar'}
              </span>
              {displayAuthor?.tag && (
                <span className="inline-flex items-center rounded-md bg-histo-paper/80 px-1.5 py-0.5 text-[10px] font-ui text-histo-ink/60 border border-histo-dark/10">
                  #{displayAuthor.tag}
                </span>
              )}
              <span className="font-ui text-xs text-histo-ink/40">
                · {formatRelativeTime(post.created_at)}
              </span>
              {post.is_locked && (
                <span className="inline-flex items-center gap-1 rounded bg-histo-paper px-1.5 py-0.5 text-[10px] font-ui text-histo-ink/60 border border-histo-dark/10">
                  <Lock className="w-2.5 h-2.5" /> Locked
                </span>
              )}
            </div>

            {isAuthor && (
              <div className="relative shrink-0" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setShowMenu(!showMenu)}
                  aria-expanded={showMenu}
                  aria-label="Post options"
                  className="p-1.5 text-histo-ink/40 hover:text-histo-dark hover:bg-histo-paper rounded-full transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-histo-copper/40"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
                <AnimatePresence>
                  {showMenu && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -4 }}
                      transition={{ duration: 0.12 }}
                      className="absolute right-0 top-8 w-36 bg-white border border-histo-dark/15 rounded-xl shadow-medium py-1 z-20"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setShowMenu(false);
                          onDeletePost(post.id);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-ui text-red-600 hover:bg-red-50 transition-colors text-left cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete Post
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Thread headline (optional) */}
          {post.title && (
            <h2 className="mt-1 font-display text-base sm:text-lg font-bold text-histo-dark leading-snug tracking-tight">
              {post.title}
            </h2>
          )}

          {/* Post body */}
          <p className="mt-1.5 whitespace-pre-wrap font-body text-sm sm:text-[15px] text-histo-ink/90 leading-relaxed">
            {post.content}
          </p>

          <PostMedia post={post} />

          <PostActionBar
            post={post}
            showComments={showComments}
            onReaction={onReaction}
            onToggleComments={handleToggleComments}
            onOpenShare={() => onOpenShare(post)}
          />

          {showComments && (
            <div className="mt-4 border-t border-histo-dark/10 pt-3">
              <CommentSection
                comments={post.comments || []}
                postId={post.id}
                onAddComment={onAddComment}
                onDeleteComment={onDeleteComment}
                loading={loadingComments}
              />
            </div>
          )}
        </div>
      </div>
    </motion.article>
  );
});
PostCard.displayName = 'PostCard';

export default PostCard;
