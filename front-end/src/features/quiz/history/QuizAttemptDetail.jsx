import React from 'react';
import { motion } from 'framer-motion';
import {
  CalendarIcon,
  ClockIcon,
  TrophyIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '../../../components/MotionIcons';
import QuestionCard from '../components/QuestionCard';

export default function QuizAttemptDetail({ session, onClose }) {
  if (!session) return null;

  const {
    topic,
    quiz_type,
    score,
    max_score,
    correct_count,
    wrong_count,
    total_time_seconds,
    created_at,
    details = [],
  } = session;

  const formatDate = (isoString) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="relative w-full max-w-3xl rounded-histo bg-histo-paper border-2 border-histo-dark/20 p-6 sm:p-8 shadow-deep max-h-[90vh] overflow-y-auto"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-6 right-6 px-3 py-1 rounded-[4px] bg-histo-cream hover:bg-white border border-histo-dark/20 text-xs font-ui font-bold text-histo-dark transition-colors cursor-pointer"
        >
          Close Review ✕
        </button>

        {/* Modal Header */}
        <div className="mb-6 pb-6 border-b border-histo-dark/15 pr-16">
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-ui font-bold uppercase tracking-wider ${
              quiz_type === 'global'
                ? 'bg-purple-100 text-purple-900 border border-purple-300'
                : quiz_type === 'lobby'
                ? 'bg-blue-100 text-blue-900 border border-blue-300'
                : 'bg-amber-100 text-amber-900 border border-amber-300'
            }`}>
              {quiz_type === 'global' ? 'Global Ranked' : quiz_type === 'lobby' ? 'Group Lobby' : 'Personalized'}
            </span>

            <span className="text-xs text-histo-ink/60 font-ui flex items-center gap-1">
              <CalendarIcon className="h-3.5 w-3.5" />
              {formatDate(created_at)}
            </span>
          </div>

          <h2 className="text-2xl font-display font-bold text-histo-dark mb-3">{topic}</h2>

          {/* Metrics summary row */}
          <div className="flex flex-wrap gap-4 text-xs font-ui">
            <div className="flex items-center gap-1.5 text-histo-copper font-bold">
              <TrophyIcon className="h-4 w-4" />
              <span>Score: <strong>{score}/{max_score} pts</strong></span>
            </div>

            <div className="flex items-center gap-1.5 text-emerald-800 font-bold">
              <CheckCircleIcon className="h-4 w-4" />
              <span>Correct: <strong>{correct_count}</strong></span>
            </div>

            <div className="flex items-center gap-1.5 text-rose-800 font-bold">
              <XCircleIcon className="h-4 w-4" />
              <span>Wrong: <strong>{wrong_count}</strong></span>
            </div>

            {total_time_seconds > 0 && (
              <div className="flex items-center gap-1.5 text-histo-ink/70">
                <ClockIcon className="h-4 w-4" />
                <span>Time: <strong>{formatDuration(total_time_seconds)}</strong></span>
              </div>
            )}
          </div>
        </div>

        {/* Per-question Review List */}
        <div>
          <h3 className="text-xs font-ui font-bold uppercase tracking-wider text-histo-dark mb-4">
            Granular Question Review ({details.length || 0} Questions)
          </h3>

          <div className="space-y-4">
            {details.length === 0 ? (
              <p className="text-xs text-histo-ink/50 text-center py-6 font-body italic">
                No per-question logs saved for this attempt.
              </p>
            ) : (
              details.map((qItem, idx) => (
                <QuestionCard
                  key={qItem.question_id || idx}
                  index={idx}
                  total={details.length}
                  question={qItem.question}
                  options={qItem.options}
                  selectedOption={qItem.selected_option}
                  correctAnswer={qItem.correct_answer}
                  showCorrectAnswer
                  disabled
                />
              ))
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
