import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarIcon,
  ClockIcon,
  RightArrowIcon,
  BookOpenIcon,
} from '../../../components/MotionIcons';
import { getQuizHistoryApi } from '../../../api/quiz';
import QuizAttemptDetail from './QuizAttemptDetail';

export default function QuizHistoryList({ onStartPersonalized }) {
  const [historyList, setHistoryList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState(null);

  useEffect(() => {
    async function loadHistory() {
      setLoading(true);
      try {
        const records = await getQuizHistoryApi();
        setHistoryList(records || []);
      } catch (err) {
        console.warn('Could not load quiz history:', err);
      } finally {
        setLoading(false);
      }
    }
    loadHistory();
  }, []);

  const formatDate = (isoString) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return 'Recent';
    }
  };

  const formatDuration = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m > 0 ? `${m}m ` : ''}${s}s`;
  };

  const getTypeBadge = (type) => {
    if (type === 'global') {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-ui font-bold uppercase tracking-wider bg-purple-100 text-purple-900 border border-purple-300">
          Global Ranked
        </span>
      );
    }
    if (type === 'lobby') {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-ui font-bold uppercase tracking-wider bg-blue-100 text-blue-900 border border-blue-300">
          Group Lobby
        </span>
      );
    }
    return (
      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-ui font-bold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
        Personalized
      </span>
    );
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BookOpenIcon className="h-5 w-5 text-histo-copper" />
            <h2 className="text-2xl font-display font-bold text-histo-dark">
              Quiz Attempt History
            </h2>
          </div>
          <p className="text-xs font-ui text-histo-ink/60">
            Review past test logs, scores, and per-question answer breakdowns.
          </p>
        </div>

        <span className="text-xs font-ui font-semibold text-histo-dark bg-white border border-histo-dark/15 px-3 py-1.5 rounded-[4px] shadow-xs">
          {historyList.length} Sessions Logged
        </span>
      </div>

      {/* History List / Empty State */}
      {loading ? (
        <div className="py-20 text-center text-histo-ink/50 text-xs font-body italic">
          <div className="h-8 w-8 border-2 border-histo-dark/20 border-t-histo-copper rounded-full animate-spin mx-auto mb-3" />
          <span>Loading historical attempts...</span>
        </div>
      ) : historyList.length === 0 ? (
        <div className="rounded-histo bg-histo-cream border border-histo-dark/10 p-10 text-center shadow-medium">
          <div className="h-16 w-16 rounded-full bg-white border border-histo-copper/30 text-histo-copper flex items-center justify-center mx-auto mb-4 shadow-soft">
            <BookOpenIcon className="h-8 w-8" />
          </div>

          <h3 className="text-xl font-display font-bold text-histo-dark mb-2">
            No quizzes taken yet
          </h3>
          <p className="text-xs sm:text-sm font-body text-histo-ink/70 max-w-sm mx-auto mb-6">
            Take your first personalized quiz or join a multiplayer group lobby to start tracking your knowledge growth.
          </p>

          <button
            type="button"
            onClick={onStartPersonalized}
            className="px-6 py-3 rounded-[4px] bg-histo-copper hover:bg-histo-dark text-white text-xs font-ui font-bold uppercase tracking-widest shadow-medium transition-all cursor-pointer"
          >
            Create Your First Quiz
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {historyList.map((session, idx) => (
            <motion.div
              key={session.id || idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
              onClick={() => setSelectedSession(session)}
              className="group p-5 rounded-histo bg-white hover:bg-histo-cream border border-histo-dark/10 hover:border-histo-gold transition-all cursor-pointer flex items-center justify-between gap-4 shadow-soft"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  {getTypeBadge(session.quiz_type)}
                  <span className="text-[11px] font-ui text-histo-ink/60 flex items-center gap-1">
                    <CalendarIcon className="h-3 w-3" />
                    {formatDate(session.created_at)}
                  </span>
                  {session.total_time_seconds > 0 && (
                    <span className="text-[11px] font-ui text-histo-ink/60 flex items-center gap-1">
                      <ClockIcon className="h-3 w-3" />
                      {formatDuration(session.total_time_seconds)}
                    </span>
                  )}
                </div>

                <h3 className="text-base font-display font-bold text-histo-dark group-hover:text-histo-copper transition-colors truncate">
                  {session.topic}
                </h3>

                <div className="flex items-center gap-3 mt-2 text-xs font-ui">
                  <span className="text-emerald-700 font-bold">
                    +{session.correct_count} correct
                  </span>
                  <span className="text-histo-ink/30">•</span>
                  <span className="text-rose-700 font-bold">
                    -{session.wrong_count} wrong
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4 shrink-0">
                <div className="text-right font-ui">
                  <span className="text-xl font-display font-bold text-histo-copper block leading-none">
                    {session.score} pts
                  </span>
                  <span className="text-[10px] text-histo-ink/50">
                    /{session.max_score} max
                  </span>
                </div>

                <div className="h-8 w-8 rounded-full bg-histo-paper group-hover:bg-histo-gold text-histo-dark flex items-center justify-center transition-all shadow-xs">
                  <RightArrowIcon className="h-4 w-4" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Drill-down Detail Modal */}
      <AnimatePresence>
        {selectedSession && (
          <QuizAttemptDetail
            session={selectedSession}
            onClose={() => setSelectedSession(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}