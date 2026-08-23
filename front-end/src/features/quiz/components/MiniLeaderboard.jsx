import React from 'react';
import { motion } from 'framer-motion';
import { TrophyIcon, CrownIcon } from '../../../components/MotionIcons';

/**
 * MiniLeaderboard
 * Live top 3–5 ranking card displayed between lobby questions in HistoFacts styling.
 */
export default function MiniLeaderboard({
  participants = [],
  currentUserId = null,
  title = 'Live Standings',
  className = '',
}) {
  const topList = [...participants]
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const getRankBadge = (rank) => {
    if (rank === 1) {
      return (
        <div className="h-6 w-6 rounded-full bg-amber-100 text-amber-800 border border-amber-400 flex items-center justify-center font-bold text-xs shadow-xs">
          <CrownIcon className="h-3.5 w-3.5" />
        </div>
      );
    }
    if (rank === 2) {
      return (
        <div className="h-6 w-6 rounded-full bg-slate-100 text-slate-700 border border-slate-300 flex items-center justify-center font-bold text-xs shadow-xs">
          2
        </div>
      );
    }
    if (rank === 3) {
      return (
        <div className="h-6 w-6 rounded-full bg-amber-900/10 text-amber-900 border border-amber-700/30 flex items-center justify-center font-bold text-xs shadow-xs">
          3
        </div>
      );
    }
    return (
      <div className="h-6 w-6 rounded-full bg-histo-paper text-histo-dark/60 border border-histo-dark/10 flex items-center justify-center font-mono text-xs font-semibold">
        {rank}
      </div>
    );
  };

  return (
    <div className={`rounded-histo bg-histo-cream border border-histo-dark/15 p-5 shadow-medium ${className}`}>
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-histo-dark/10">
        <div className="flex items-center gap-2">
          <TrophyIcon className="h-5 w-5 text-histo-copper" />
          <h4 className="font-display text-base font-bold text-histo-dark tracking-wide">{title}</h4>
        </div>
        <span className="text-[11px] font-ui font-semibold text-histo-ink/60 uppercase tracking-wider">Top Scholars</span>
      </div>

      <div className="space-y-2.5">
        {topList.length === 0 ? (
          <p className="text-xs text-histo-ink/50 text-center py-4 font-body italic">Waiting for round answers...</p>
        ) : (
          topList.map((p, idx) => {
            const rank = idx + 1;
            const isMe = p.user_id === currentUserId;

            return (
              <motion.div
                key={p.user_id || idx}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05, duration: 0.2 }}
                className={`flex items-center justify-between p-3 rounded-histo border transition-all ${
                  isMe
                    ? 'bg-white border-2 border-histo-gold text-histo-dark shadow-soft font-semibold'
                    : 'bg-white/70 border-histo-dark/10 text-histo-ink'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {getRankBadge(rank)}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-ui font-semibold text-histo-dark truncate">
                        {p.username}
                      </span>
                      {p.tag && (
                        <span className="text-[10px] text-histo-ink/40 font-mono">
                          #{p.tag}
                        </span>
                      )}
                      {isMe && (
                        <span className="text-[9px] bg-histo-gold/20 text-histo-copper px-1.5 py-0.2 rounded font-bold uppercase">
                          You
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {p.streak > 1 && (
                    <span className="text-[10px] font-ui font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                      🔥 {p.streak} streak
                    </span>
                  )}
                  <span className="text-sm font-display font-bold text-histo-copper">
                    {p.score} pts
                  </span>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}