import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircleIcon, XCircleIcon } from '../../../components/MotionIcons';
import ScoreRulesBadge from './ScoreRulesBadge';

/**
 * QuestionCard
 * The universal single question-display unit used across all quiz modes
 * styled in the HistoFacts parchment, ink, and gold design system.
 */
export default function QuestionCard({
  question,
  options = [],
  selectedOption = null,
  onSelect,
  disabled = false,
  showCorrectAnswer = false,
  correctAnswer = null,
  index = 0,
  total = 10,
  difficulty = null,
  scoringRules = null,
  className = '',
}) {
  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`relative rounded-histo bg-histo-cream border border-histo-dark/10 p-6 sm:p-8 shadow-medium overflow-hidden ${className}`}
    >
      {/* Top decorative double line */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-histo-gold via-histo-copper to-histo-gold" />

      {/* Question Header Meta */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-histo-dark text-histo-paper border border-histo-gold/50 flex items-center justify-center font-display font-bold text-xs shadow-soft">
            {index + 1}
          </div>
          <span className="text-xs font-ui font-semibold text-histo-ink/70 tracking-wider uppercase">
            Question {index + 1} of {total}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {difficulty && (
            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-ui font-bold border uppercase tracking-wider ${
              difficulty === 'easy'
                ? 'bg-emerald-100 border-emerald-300 text-emerald-900'
                : difficulty === 'hard'
                ? 'bg-rose-100 border-rose-300 text-rose-900'
                : 'bg-amber-100 border-amber-300 text-amber-900'
            }`}>
              {difficulty}
            </span>
          )}

          {scoringRules && (
            <ScoreRulesBadge
              correct={scoringRules.correct ?? 2}
              wrong={scoringRules.wrong ?? 0}
              size="xs"
            />
          )}
        </div>
      </div>

      {/* Question Text */}
      <h3 className="font-display text-lg sm:text-xl font-bold text-histo-dark leading-relaxed mb-6">
        {question}
      </h3>

      {/* Options List */}
      <div className="space-y-3">
        {options.map((optionText, optIdx) => {
          const isSelected = selectedOption === optIdx;
          const isCorrect = correctAnswer === optIdx;
          const isUserWrong = showCorrectAnswer && isSelected && !isCorrect;
          const isUserCorrect = showCorrectAnswer && isSelected && isCorrect;
          const isRevealedCorrect = showCorrectAnswer && isCorrect;

          let cardStyle = 'border-histo-dark/15 bg-white/80 hover:bg-white hover:border-histo-gold text-histo-ink shadow-soft';
          let letterBadgeStyle = 'bg-histo-paper text-histo-dark border border-histo-dark/20 font-bold';

          if (showCorrectAnswer) {
            if (isRevealedCorrect) {
              cardStyle = 'border-2 border-emerald-600 bg-emerald-50 text-emerald-950 shadow-soft font-semibold';
              letterBadgeStyle = 'bg-emerald-600 text-white border-emerald-700 font-bold';
            } else if (isUserWrong) {
              cardStyle = 'border-2 border-rose-600 bg-rose-50 text-rose-950 shadow-soft font-semibold';
              letterBadgeStyle = 'bg-rose-600 text-white border-rose-700 font-bold';
            } else {
              cardStyle = 'border-histo-dark/10 bg-white/40 opacity-50 text-histo-ink/60';
            }
          } else if (isSelected) {
            cardStyle = 'border-2 border-histo-gold bg-white text-histo-dark shadow-medium font-semibold ring-2 ring-histo-gold/20';
            letterBadgeStyle = 'bg-histo-gold text-histo-dark border-histo-gold font-bold';
          }

          return (
            <motion.button
              key={optIdx}
              type="button"
              disabled={disabled || showCorrectAnswer}
              onClick={() => onSelect && onSelect(optIdx)}
              whileHover={!disabled && !showCorrectAnswer ? { scale: 1.008, x: 3 } : {}}
              whileTap={!disabled && !showCorrectAnswer ? { scale: 0.995 } : {}}
              className={`w-full text-left flex items-center justify-between p-4 rounded-histo border transition-all duration-200 cursor-pointer disabled:cursor-default ${cardStyle}`}
            >
              <div className="flex items-center gap-3.5 min-w-0 pr-2">
                <span className={`h-7 w-7 shrink-0 rounded-[6px] flex items-center justify-center text-xs font-ui transition-colors ${letterBadgeStyle}`}>
                  {letters[optIdx] || optIdx + 1}
                </span>
                <span className="text-sm sm:text-base font-body tracking-wide leading-snug">
                  {optionText}
                </span>
              </div>

              {/* Status Icons */}
              <div className="shrink-0 ml-2">
                {showCorrectAnswer ? (
                  isRevealedCorrect ? (
                    <div className="h-6 w-6 text-emerald-700 flex items-center justify-center">
                      <CheckCircleIcon className="h-5 w-5" />
                    </div>
                  ) : isUserWrong ? (
                    <div className="h-6 w-6 text-rose-700 flex items-center justify-center">
                      <XCircleIcon className="h-5 w-5" />
                    </div>
                  ) : null
                ) : (
                  isSelected && (
                    <div className="h-6 w-6 text-histo-gold flex items-center justify-center">
                      <CheckCircleIcon className="h-5 w-5" />
                    </div>
                  )
                )}
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Immediate feedback banner when showCorrectAnswer is active */}
      <AnimatePresence>
        {showCorrectAnswer && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 pt-4 border-t border-histo-dark/10 flex items-center justify-between text-xs font-ui"
          >
            <div className="flex items-center gap-2">
              {selectedOption === correctAnswer ? (
                <span className="text-emerald-800 font-bold flex items-center gap-1.5 bg-emerald-100 px-3 py-1.5 rounded-full border border-emerald-300">
                  <CheckCircleIcon className="h-4 w-4 text-emerald-700" /> Correct! (+{scoringRules?.correct ?? 2} pts)
                </span>
              ) : (
                <span className="text-rose-800 font-bold flex items-center gap-1.5 bg-rose-100 px-3 py-1.5 rounded-full border border-rose-300">
                  <XCircleIcon className="h-4 w-4 text-rose-700" /> Incorrect ({scoringRules?.wrong ? `${scoringRules.wrong} pts` : '0 pts'}). Correct is Option {letters[correctAnswer]}.
                </span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}