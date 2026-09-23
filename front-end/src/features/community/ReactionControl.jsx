import { motion } from 'framer-motion';
import { ThumbsDown, ThumbsUp } from 'lucide-react';

export default function ReactionControl({
  postId,
  likes = 0,
  dislikes = 0,
  userReaction = null,
  onReaction,
}) {
  const cast = (reaction) => {
    onReaction?.(postId, userReaction === reaction ? 'none' : reaction);
  };

  const buttonClass = (active, tone) =>
    `inline-flex h-8 sm:h-8.5 items-center gap-1.5 rounded-full px-2.5 sm:px-3 text-xs font-ui font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-histo-copper/40 ${
      active
        ? tone === 'like'
          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-xs'
          : 'bg-red-50 text-red-600 border border-red-200/80 shadow-xs'
        : 'text-histo-ink/60 hover:bg-histo-paper hover:text-histo-dark border border-transparent'
    }`;

  return (
    <div className="inline-flex items-center gap-1" role="group" aria-label="Post reactions">
      <motion.button
        type="button"
        whileTap={{ scale: 0.9 }}
        whileHover={{ scale: 1.04 }}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
        onClick={() => cast('like')}
        disabled={!onReaction}
        title="Like"
        aria-label={`Like, ${likes} scholars agreed`}
        aria-pressed={userReaction === 'like'}
        className={buttonClass(userReaction === 'like', 'like')}
      >
        <motion.div
          animate={userReaction === 'like' ? { scale: [1, 1.3, 1] } : { scale: 1 }}
          transition={{ duration: 0.25 }}
        >
          <ThumbsUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </motion.div>
        <span>{likes}</span>
      </motion.button>
      <motion.button
        type="button"
        whileTap={{ scale: 0.9 }}
        whileHover={{ scale: 1.04 }}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
        onClick={() => cast('dislike')}
        disabled={!onReaction}
        title="Dislike"
        aria-label={`Dislike, ${dislikes} scholars disputed`}
        aria-pressed={userReaction === 'dislike'}
        className={buttonClass(userReaction === 'dislike', 'dislike')}
      >
        <motion.div
          animate={userReaction === 'dislike' ? { scale: [1, 1.3, 1] } : { scale: 1 }}
          transition={{ duration: 0.25 }}
        >
          <ThumbsDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </motion.div>
        <span>{dislikes}</span>
      </motion.button>
    </div>
  );
}
