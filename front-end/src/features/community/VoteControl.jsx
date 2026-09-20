import { ChevronDown, ChevronUp } from 'lucide-react';

// Reddit-style upvote/downvote control. Controlled: FeedPage owns the post state and
// performs the optimistic update, keeping a single source of truth for the feed.
export default function VoteControl({ postId, score = 0, userVote = 0, onVote }) {
  const cast = (value) => {
    // Clicking the active arrow clears the vote
    onVote?.(postId, userVote === value ? 0 : value);
  };

  return (
    <div className="flex items-center gap-0.5 rounded-full border border-histo-dark/10 bg-histo-paper/50 px-1 py-0.5">
      <button
        type="button"
        onClick={() => cast(1)}
        disabled={!onVote}
        title="Upvote"
        className={`p-1 rounded-full transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
          userVote === 1 ? 'text-emerald-600 bg-emerald-50' : 'text-histo-ink/50 hover:text-emerald-600'
        }`}
      >
        <ChevronUp className="w-4 h-4" />
      </button>
      <span
        className={`min-w-[1.5rem] text-center text-xs font-ui font-bold ${
          userVote === 1
            ? 'text-emerald-600'
            : userVote === -1
              ? 'text-red-500'
              : 'text-histo-ink'
        }`}
      >
        {score}
      </span>
      <button
        type="button"
        onClick={() => cast(-1)}
        disabled={!onVote}
        title="Downvote"
        className={`p-1 rounded-full transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
          userVote === -1 ? 'text-red-500 bg-red-50' : 'text-histo-ink/50 hover:text-red-500'
        }`}
      >
        <ChevronDown className="w-4 h-4" />
      </button>
    </div>
  );
}
