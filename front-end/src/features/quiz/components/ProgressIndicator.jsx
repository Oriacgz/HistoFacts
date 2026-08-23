import { motion, useReducedMotion } from 'framer-motion';

export default function ProgressIndicator({
  currentQuestion,
  totalQuestions,
  answeredCount = 0,
  className = '',
  showDots = true,
}) {
  const shouldReduceMotion = useReducedMotion();
  const progress = totalQuestions > 0 ? ((currentQuestion + 1) / totalQuestions) * 100 : 0;
  const answeredProgress = totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;

  return (
    <div className={`mb-6 ${className}`} role="progressbar" aria-valuenow={currentQuestion + 1} aria-valuemin={1} aria-valuemax={totalQuestions} aria-label={`Question ${currentQuestion + 1} of ${totalQuestions}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-white">
            Question {currentQuestion + 1} of {totalQuestions}
          </span>
          {answeredCount > 0 && (
            <span className="text-xs font-ui text-white/50 uppercase tracking-wider">
              {answeredCount} answered
            </span>
          )}
        </div>
      </div>

      <div className="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden relative">
        {answeredProgress > 0 && (
          <motion.div
            className="absolute inset-0 h-full rounded-full bg-white/[0.08]"
            initial={{ width: 0 }}
            animate={{ width: `${answeredProgress}%` }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          />
        )}
        <motion.div
          className="absolute inset-0 h-full rounded-full bg-gradient-to-r from-histo-gold to-histo-copper"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4, ease: 'easeInOut' }}
        />
      </div>

      {showDots && totalQuestions <= 20 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="hidden sm:flex items-center justify-center gap-1.5 mt-3"
          role="group"
          aria-label="Question navigation"
        >
          {Array.from({ length: totalQuestions }, (_, i) => (
            <motion.button
              key={i}
              type="button"
              disabled={i > currentQuestion}
              className={`h-2 w-2 rounded-full transition-all duration-200 cursor-pointer ${
                i === currentQuestion
                  ? 'w-6 bg-histo-gold'
                  : i < currentQuestion
                  ? 'bg-histo-gold/40'
                  : 'bg-white/15'
              } ${i > currentQuestion ? 'opacity-40 cursor-not-allowed' : ''}`}
              aria-label={`Question ${i + 1}`}
              aria-current={i === currentQuestion ? 'step' : undefined}
              whileHover={shouldReduceMotion ? {} : { scale: 1.5 }}
            />
          ))}
        </motion.div>
      )}
    </div>
  );
}