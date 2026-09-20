import { useState } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, MoreVertical, Share2, Trash2, Lock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import CommentSection from './CommentSection';
import PostMedia from './PostMedia';
import VoteControl from './VoteControl';
import UserAvatar from '../../components/UserAvatar';
import { formatRelativeTime } from './relativeTime';

function PostActionBar({ post, onVote, onToggleComments, onOpenShare }) {
  return (
    <div className="mt-3 flex max-w-md items-center justify-between text-histo-ink/60">
      <button
        type="button"
        onClick={onToggleComments}
        className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-ui transition-colors cursor-pointer ${
          post.showComments ? 'text-histo-copper bg-histo-copper/10' : 'hover:text-histo-copper hover:bg-histo-copper/10'
        }`}
      >
        <MessageCircle className="w-4 h-4" />
        <span>{post.comment_count || 0}</span>
      </button>

      <button
        type="button"
        onClick={onOpenShare}
        className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-ui transition-colors hover:text-histo-copper hover:bg-histo-copper/10 cursor-pointer"
      >
        <Share2 className="w-4 h-4" />
        {post.share_count > 0 && <span>{post.share_count}</span>}
      </button>

      {/* Upvote/downvote interaction — Reddit's model, Twitter's card */}
      <VoteControl postId={post.id} score={post.score} userVote={post.user_vote} onVote={onVote} />
    </div>
  );
}

export default function PostCard({
  post,
  onVote,
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

  const isAuthor = user?.id === post.user_id;
  const displayAuthor = isAuthor ? { ...post.author, ...user } : post.author;

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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="border-b border-histo-dark/10 px-4 py-3 transition-colors hover:bg-histo-paper/40"
    >
      <div className="flex gap-3">
        <UserAvatar user={displayAuthor} size="md" />

        <div className="min-w-0 flex-1">
          {/* Author row: name, tag, relative time, options */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-1 text-sm">
              <span className="font-ui font-bold text-histo-dark">
                {displayAuthor?.username || 'Chronicle Scholar'}
              </span>
              {displayAuthor?.tag && (
                <span className="font-ui text-xs text-histo-ink/50">#{displayAuthor.tag}</span>
              )}
              <span className="font-ui text-xs text-histo-ink/40">
                · {formatRelativeTime(post.created_at)}
              </span>
              {post.is_locked && (
                <span className="inline-flex items-center gap-0.5 rounded bg-histo-paper px-1.5 py-0.5 text-[10px] font-ui text-histo-ink/60 border border-histo-dark/10">
                  <Lock className="w-2.5 h-2.5" /> Locked
                </span>
              )}
            </div>

            {isAuthor && (
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-1.5 text-histo-ink/40 hover:text-histo-dark hover:bg-histo-paper rounded-full transition-colors cursor-pointer"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
                {showMenu && (
                  <div className="absolute right-0 top-8 w-36 bg-white border border-histo-dark/15 rounded-lg shadow-medium py-1 z-20">
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
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Thread headline (optional) */}
          {post.title && (
            <h2 className="font-display font-bold text-sm md:text-base text-histo-dark leading-snug mt-0.5">
              {post.title}
            </h2>
          )}

          {/* Post body */}
          <p className="mt-0.5 whitespace-pre-wrap font-body text-[15px] text-histo-ink leading-relaxed">
            {post.content}
          </p>

          <PostMedia post={post} />

          <PostActionBar
            post={post}
            onVote={onVote}
            onToggleComments={handleToggleComments}
            onOpenShare={() => onOpenShare(post)}
          />

          {showComments && (
            <div className="mt-3 border-t border-histo-dark/10 pt-3">
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
}
