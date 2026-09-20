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
    `inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-ui font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
      active
        ? tone === 'like'
          ? 'bg-emerald-50 text-emerald-700'
          : 'bg-red-50 text-red-600'
        : 'text-histo-ink/55 hover:bg-histo-paper hover:text-histo-dark'
    }`;

  return (
    <div className="inline-flex items-center gap-1" aria-label="Post reactions">
      <button
        type="button"
        onClick={() => cast('like')}
        disabled={!onReaction}
        title="Like"
        aria-label={`Like, ${likes}`}
        aria-pressed={userReaction === 'like'}
        className={buttonClass(userReaction === 'like', 'like')}
      >
        <ThumbsUp className="h-4 w-4" />
        <span>{likes}</span>
      </button>
      <button
        type="button"
        onClick={() => cast('dislike')}
        disabled={!onReaction}
        title="Dislike"
        aria-label={`Dislike, ${dislikes}`}
        aria-pressed={userReaction === 'dislike'}
        className={buttonClass(userReaction === 'dislike', 'dislike')}
      >
        <ThumbsDown className="h-4 w-4" />
        <span>{dislikes}</span>
      </button>
    </div>
  );
}
