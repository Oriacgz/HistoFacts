import React from 'react';
import { motion } from 'framer-motion';
import {
  TrophyIcon,
  CrownIcon,
  CheckCircleIcon,
  XCircleIcon,
  RightArrowIcon,
  ClockIcon,
} from '../../../components/MotionIcons';

/**
 * ResultsSummary
 * Unified end-of-quiz results card used across Personalized, Lobby, and Global quiz modes
 * styled in the HistoFacts parchment aesthetic.
 */
export default function ResultsSummary({
  score = 0,
  maxScore = 20,
  correctCount = 0,
  wrongCount = 0,
  totalQuestions = 10,
  timeSpentSeconds = 0,
  rank = null,
  quizType = 'personalized', // 'personalized' | 'lobby' | 'global'
  topic = 'History Trivia',
  difficulty = 'medium',
  onRetry,
  onTryHarder,
  onBackToHub,
  className = '',
}) {
  const accuracy = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s}s`;
  };

  const getCelebration = () => {
    if (accuracy >= 90) return { title: 'Master Historian!', desc: 'Flawless recall of historical chronology and events.' };
    if (accuracy >= 70) return { title: 'Accomplished Scholar!', desc: 'Solid analytical depth across the curriculum.' };
    if (accuracy >= 50) return { title: 'Knowledgeable Explorer', desc: 'Good foundation with room to master key nuances.' };
    return { title: 'Dedicated Learner', desc: 'Every attempt builds stronger long-term retention.' };
  };

  const celeb = getCelebration();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={`relative rounded-histo bg-histo-cream border-2 border-histo-dark/15 p-6 sm:p-10 shadow-deep text-histo-ink ${className}`}
    >
      {/* Decorative top border */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-histo-gold via-histo-copper to-histo-gold" />

      {/* Lobby Specific Notice */}
      {quizType === 'lobby' && (
        <div className="mb-6 rounded-histo bg-blue-50 border border-blue-200 p-4 text-xs font-ui text-blue-900 shadow-soft">
          <strong className="text-blue-950 font-bold block mb-1">Group Practice Session:</strong>
          Lobby match results are for study groups and bragging rights — they do not affect your monthly Global Ranked Leaderboard or Histoin payouts.
        </div>
      )}

      {/* Global Ranked Histoin Reward Banner */}
      {quizType === 'global' && (
        <div className="mb-6 rounded-histo bg-emerald-50 border border-emerald-300 p-4 flex items-center justify-between gap-3 text-xs font-ui text-emerald-950 shadow-soft">
          <span><strong>Global Challenge Completed!</strong> Score submitted to the monthly ranked ladder.</span>
          <span className="font-bold text-emerald-800 shrink-0 font-mono">+20 🪙 Histoins</span>
        </div>
      )}

      {/* Header Badge & Title */}
      <div className="text-center mb-8">
        <motion.div
          initial={{ scale: 0, rotate: -15 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-histo-dark text-histo-gold border-2 border-histo-gold shadow-medium mb-4"
        >
          {rank ? (
            <div className="text-center">
              <span className="text-[10px] uppercase tracking-wider text-histo-gold/80 block font-ui font-semibold">Rank</span>
              <span className="text-2xl font-bold font-display text-white">#{rank}</span>
            </div>
          ) : (
            <TrophyIcon className="h-10 w-10 text-histo-gold" />
          )}
        </motion.div>

        <h2 className="text-2xl sm:text-3xl font-display font-bold text-histo-dark mb-2">
          {celeb.title}
        </h2>
        <p className="text-sm font-body text-histo-ink/70 max-w-md mx-auto italic">
          {celeb.desc}
        </p>
      </div>

      {/* Key Metric Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mb-8">
        {/* Score */}
        <div className="rounded-histo bg-white p-4 text-center border border-histo-dark/10 shadow-soft">
          <span className="text-[11px] uppercase tracking-wider text-histo-ink/60 font-ui font-semibold block mb-1">
            Total Score
          </span>
          <span className="text-2xl sm:text-3xl font-display font-bold text-histo-copper">
            {score}
          </span>
          <span className="text-xs text-histo-ink/40 font-ui block mt-0.5">/{maxScore} pts</span>
        </div>

        {/* Accuracy */}
        <div className="rounded-histo bg-white p-4 text-center border border-histo-dark/10 shadow-soft">
          <span className="text-[11px] uppercase tracking-wider text-histo-ink/60 font-ui font-semibold block mb-1">
            Accuracy
          </span>
          <span className={`text-2xl sm:text-3xl font-display font-bold ${
            accuracy >= 70 ? 'text-emerald-700' : accuracy >= 50 ? 'text-amber-700' : 'text-rose-700'
          }`}>
            {accuracy}%
          </span>
          <span className="text-xs text-histo-ink/40 font-ui block mt-0.5">{correctCount}/{totalQuestions} correct</span>
        </div>

        {/* Breakdown */}
        <div className="rounded-histo bg-white p-4 text-center border border-histo-dark/10 shadow-soft">
          <span className="text-[11px] uppercase tracking-wider text-histo-ink/60 font-ui font-semibold block mb-1">
            Breakdown
          </span>
          <div className="flex items-center justify-center gap-2 mt-1">
            <span className="text-xs font-ui font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
              +{correctCount}
            </span>
            <span className="text-xs font-ui font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded border border-rose-300">
              -{wrongCount}
            </span>
          </div>
          <span className="text-[11px] text-histo-ink/50 font-ui block mt-1.5 capitalize">{difficulty} difficulty</span>
        </div>

        {/* Time */}
        <div className="rounded-histo bg-white p-4 text-center border border-histo-dark/10 shadow-soft">
          <span className="text-[11px] uppercase tracking-wider text-histo-ink/60 font-ui font-semibold block mb-1">
            Time Spent
          </span>
          <span className="text-xl sm:text-2xl font-display font-bold text-histo-dark">
            {formatTime(timeSpentSeconds)}
          </span>
          <span className="text-xs text-histo-ink/40 font-ui block mt-0.5">Self-paced</span>
        </div>
      </div>

      {/* CTA Action Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-3.5 pt-2">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="px-5 py-3 rounded-[4px] border border-histo-dark/20 bg-white text-xs font-ui font-bold tracking-wider uppercase text-histo-dark hover:border-histo-gold hover:bg-histo-paper transition-all shadow-soft cursor-pointer"
          >
            Retry Same Topic
          </button>
        )}

        {onTryHarder && difficulty !== 'hard' && (
          <button
            type="button"
            onClick={onTryHarder}
            className="px-5 py-3 rounded-[4px] bg-histo-copper text-white text-xs font-ui font-bold tracking-wider uppercase shadow-soft hover:bg-histo-dark transition-all cursor-pointer"
          >
            Try Harder Difficulty
          </button>
        )}

        {onBackToHub && (
          <button
            type="button"
            onClick={onBackToHub}
            className="px-5 py-3 rounded-[4px] bg-histo-gold text-histo-dark text-xs font-ui font-bold tracking-wider uppercase hover:bg-histo-copper hover:text-white transition-all shadow-soft flex items-center gap-2 cursor-pointer"
          >
            <span>Quiz Hub</span>
            <RightArrowIcon className="h-4 w-4" />
          </button>
        )}
      </div>
    </motion.div>
  );
}