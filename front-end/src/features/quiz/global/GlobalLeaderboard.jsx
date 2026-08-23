import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  TrophyIcon,
  CrownIcon,
  SearchIcon,
  ChevronLeftIcon,
  RightArrowIcon,
} from '../../../components/MotionIcons';
import { getGlobalLeaderboardApi } from '../../../api/quiz';

const PAGE_SIZE = 6;

export default function GlobalLeaderboard({ user, onTakeQuiz }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const myRowRef = useRef(null);

  useEffect(() => {
    async function fetchLeaderboard() {
      setLoading(true);
      try {
        const res = await getGlobalLeaderboardApi();
        setData(res);
      } catch (err) {
        console.warn('Leaderboard API fetch failed:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchLeaderboard();
  }, []);

  const leaderboardList = data?.leaderboard || [];

  const filteredList = leaderboardList.filter((item) =>
    item.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.tag.includes(searchQuery)
  );

  const totalPages = Math.max(1, Math.ceil(filteredList.length / PAGE_SIZE));
  const paginatedList = filteredList.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const handleJumpToMyRank = () => {
    const myIndex = filteredList.findIndex(
      (item) => item.is_current_user || item.username === user?.username
    );

    if (myIndex !== -1) {
      const targetPage = Math.floor(myIndex / PAGE_SIZE) + 1;
      setCurrentPage(targetPage);
      setTimeout(() => {
        myRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  };

  const getRankBadge = (rank) => {
    if (rank === 1) {
      return (
        <div className="h-7 w-7 rounded-full bg-amber-100 text-amber-800 border border-amber-400 flex items-center justify-center font-bold text-xs shadow-xs">
          <CrownIcon className="h-4 w-4" />
        </div>
      );
    }
    if (rank === 2) {
      return (
        <div className="h-7 w-7 rounded-full bg-slate-100 text-slate-700 border border-slate-300 flex items-center justify-center font-bold text-xs shadow-xs">
          2
        </div>
      );
    }
    if (rank === 3) {
      return (
        <div className="h-7 w-7 rounded-full bg-amber-900/10 text-amber-900 border border-amber-700/30 flex items-center justify-center font-bold text-xs shadow-xs">
          3
        </div>
      );
    }
    return (
      <div className="h-7 w-7 rounded-full bg-histo-paper text-histo-dark/70 border border-histo-dark/10 flex items-center justify-center font-ui font-semibold text-xs">
        {rank}
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header Info */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <TrophyIcon className="h-5 w-5 text-histo-copper" />
            <h2 className="text-2xl font-display font-bold text-histo-dark">
              Global Ranked Leaderboard
            </h2>
          </div>
          <p className="text-xs font-ui text-histo-ink/60">
            {data?.month_name || 'Current Month'} Season • {data?.days_remaining || 14} days until monthly reset
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleJumpToMyRank}
            className="px-3.5 py-2 rounded-[4px] bg-white border border-histo-dark/20 text-xs font-ui font-bold uppercase tracking-wider text-histo-dark hover:border-histo-gold transition-all shadow-soft cursor-pointer"
          >
            Jump to My Rank
          </button>

          {onTakeQuiz && (
            <button
              type="button"
              onClick={onTakeQuiz}
              className="px-4 py-2 rounded-[4px] bg-histo-copper hover:bg-histo-dark text-white text-xs font-ui font-bold uppercase tracking-wider shadow-soft transition-all cursor-pointer"
            >
              Take Ranked Quiz
            </button>
          )}
        </div>
      </div>

      {/* Search Input */}
      <div className="mb-4">
        <div className="relative">
          <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-histo-ink/40" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            placeholder="Search scholar username or #tag..."
            className="w-full rounded-[4px] border border-histo-dark/20 bg-white pl-10 pr-4 py-2.5 text-xs text-histo-dark outline-none placeholder:text-histo-ink/40 focus:border-histo-gold shadow-xs font-ui transition-all"
          />
        </div>
      </div>

      {/* Ranked Table Card */}
      <div className="rounded-histo bg-histo-cream border border-histo-dark/10 shadow-medium overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-histo-ink/50 text-xs font-body italic">
            <div className="h-8 w-8 border-2 border-histo-dark/20 border-t-histo-copper rounded-full animate-spin mx-auto mb-3" />
            <span>Loading global ladder rankings...</span>
          </div>
        ) : (
          <div className="divide-y divide-histo-dark/10">
            {/* Table Header */}
            <div className="grid grid-cols-12 px-6 py-3 text-[10px] font-ui font-bold uppercase tracking-wider text-histo-ink/60 bg-histo-paper/60">
              <span className="col-span-2 sm:col-span-1 text-center">Rank</span>
              <span className="col-span-6 sm:col-span-5">Scholar</span>
              <span className="col-span-2 sm:col-span-2 text-right">Score</span>
              <span className="hidden sm:block sm:col-span-2 text-right">Accuracy</span>
              <span className="col-span-2 sm:col-span-2 text-right">Quizzes</span>
            </div>

            {/* Rows */}
            {paginatedList.length === 0 ? (
              <div className="py-12 text-center text-xs text-histo-ink/50 font-body italic">
                No scholars match your search.
              </div>
            ) : (
              paginatedList.map((entry) => {
                const isMe = entry.is_current_user || entry.username === user?.username;

                return (
                  <motion.div
                    key={entry.user_id || entry.rank}
                    ref={isMe ? myRowRef : null}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={`grid grid-cols-12 items-center px-6 py-3.5 transition-colors ${
                      isMe
                        ? 'bg-white border-l-4 border-l-histo-gold text-histo-dark font-bold shadow-2xs'
                        : 'bg-white/60 hover:bg-white text-histo-ink'
                    }`}
                  >
                    {/* Rank */}
                    <div className="col-span-2 sm:col-span-1 flex justify-center">
                      {getRankBadge(entry.rank)}
                    </div>

                    {/* Scholar */}
                    <div className="col-span-6 sm:col-span-5 flex items-center gap-3 min-w-0 pr-2">
                      <div className="h-8 w-8 rounded-full bg-histo-dark text-histo-paper flex items-center justify-center font-display font-bold text-xs shrink-0">
                        {entry.username[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs sm:text-sm font-ui font-semibold text-histo-dark truncate">
                            {entry.username}
                          </span>
                          <span className="text-[10px] text-histo-ink/40 font-mono">
                            #{entry.tag}
                          </span>
                          {isMe && (
                            <span className="text-[9px] bg-histo-gold/20 text-histo-copper px-1.5 py-0.5 rounded font-bold uppercase">
                              You
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Score */}
                    <div className="col-span-2 sm:col-span-2 text-right">
                      <span className="text-xs sm:text-sm font-display font-bold text-histo-copper">
                        {entry.score} pts
                      </span>
                    </div>

                    {/* Accuracy */}
                    <div className="hidden sm:block sm:col-span-2 text-right">
                      <span className={`text-xs font-ui font-semibold ${
                        entry.accuracy >= 85 ? 'text-emerald-700 font-bold' : 'text-histo-ink/70'
                      }`}>
                        {entry.accuracy}%
                      </span>
                    </div>

                    {/* Quizzes Taken */}
                    <div className="col-span-2 sm:col-span-2 text-right">
                      <span className="text-xs font-ui text-histo-ink/60">
                        {entry.quizzes_taken}
                      </span>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        )}

        {/* Pagination Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-histo-dark/10 bg-histo-paper/40 text-xs text-histo-ink/60 font-ui">
          <span>
            Page {currentPage} of {totalPages} ({filteredList.length} Scholars)
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
              className="p-1.5 rounded-[4px] border border-histo-dark/20 bg-white hover:bg-histo-paper disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
              className="p-1.5 rounded-[4px] border border-histo-dark/20 bg-white hover:bg-histo-paper disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <RightArrowIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
