import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ChevronLeftIcon,
  RightArrowIcon,
  SparklesIcon,
} from '../../../components/MotionIcons';
import QuestionCard from '../components/QuestionCard';
import ResultsSummary from '../components/ResultsSummary';
import ScoreRulesBadge from '../components/ScoreRulesBadge';
import QuizGenerationProgress from '../components/QuizGenerationProgress';
import { completeQuizApi } from '../../../api/quiz';

const SCORING_RULES = {
  easy: { correct: 2, wrong: 0, maxScore: 20 },
  medium: { correct: 2, wrong: -1, maxScore: 20 },
  hard: { correct: 2, wrong: -3, maxScore: 20 },
};

export default function PersonalizedQuizPlay({
  quiz,
  onReset,
  isRestarting = false,
  onTryHarder,
  onBackToHub,
}) {
  const { sessionId, topic, difficulty = 'medium', questions = [] } = quiz;
  const totalQuestions = questions.length;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState(Array(totalQuestions).fill(null));
  const [startTime] = useState(() => Date.now());
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const rules = SCORING_RULES[difficulty] || SCORING_RULES.medium;
  const currentQuestion = questions[currentIndex];

  const handleSelectOption = (optionIndex) => {
    if (isSaving) return;
    setSelectedAnswers((answers) => answers.map((answer, index) => index === currentIndex ? optionIndex : answer));
  };

  const handleNext = () => {
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      finishQuiz();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const finishQuiz = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setErrorMsg('');
    const end = Date.now();
    try {
      const saved = await completeQuizApi(sessionId, questions, selectedAnswers, Math.round((end - startTime) / 1000));
      setResult(saved);
    } catch (e) {
      setErrorMsg(e.message || 'Could not save quiz. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const progressPercent = totalQuestions > 0 ? ((currentIndex + 1) / totalQuestions) * 100 : 0;
  const isCurrentAnswered = selectedAnswers[currentIndex] !== null;

  if (result) {
    return (
      <div className="max-w-4xl mx-auto py-4">
        {isRestarting && <QuizGenerationProgress sourceType={quiz.sourceType} />}
        <ResultsSummary
          score={result.score}
          maxScore={result.max_score}
          correctCount={result.correct_count}
          wrongCount={result.wrong_count}
          totalQuestions={totalQuestions}
          timeSpentSeconds={result.total_time_seconds}
          quizType="personalized"
          topic={topic}
          difficulty={difficulty}
          details={result.details}
          isBusy={isRestarting}
          onRetry={onReset}
          onTryHarder={onTryHarder}
          onBackToHub={onBackToHub}
        />
      </div>
    );
  }

  return (
    <>
      {errorMsg && <p role="alert" className="text-red-600 mb-4">{errorMsg}</p>}
      {isSaving && <p role="status">Saving results...</p>}
    <div className="max-w-4xl mx-auto">
      {/* Top Meta Bar */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div>
            <h3 className="text-lg font-display font-bold text-histo-dark truncate max-w-sm sm:max-w-md">
              {topic}
            </h3>
            <span className="text-[11px] text-histo-ink/60 font-ui uppercase tracking-wider">
              Question {currentIndex + 1} of {totalQuestions} • Self-Paced Practice
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <ScoreRulesBadge
            correct={rules.correct}
            wrong={rules.wrong}
            size="sm"
          />
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-2 rounded-full bg-histo-dark/10 mb-6 overflow-hidden border border-histo-dark/10">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-histo-copper via-histo-gold to-histo-copper"
          initial={{ width: 0 }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        />
      </div>

      {/* Single QuestionCard */}
      {currentQuestion && (
        <QuestionCard
          key={currentQuestion.id || currentIndex}
          index={currentIndex}
          total={totalQuestions}
          question={currentQuestion.question}
          options={currentQuestion.options}
          selectedOption={selectedAnswers[currentIndex]}
          onSelect={handleSelectOption}
          disabled={isSaving}
          difficulty={currentQuestion.difficulty || difficulty}
          scoringRules={{ correct: rules.correct, wrong: rules.wrong }}
        />
      )}

      {/* Footer Navigation Controls */}
      <div className="flex items-center justify-between mt-6">
        <button
          type="button"
          onClick={handlePrev}
          disabled={isSaving || currentIndex === 0}
          className="px-4 py-2.5 rounded-[4px] border border-histo-dark/20 bg-white text-xs font-ui font-bold uppercase tracking-wider text-histo-dark hover:border-histo-copper transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-soft cursor-pointer"
        >
          <ChevronLeftIcon className="h-4 w-4" /> Previous
        </button>

        <span className="text-xs font-ui font-bold text-histo-ink/60">
          {currentIndex + 1} / {totalQuestions}
        </span>

        <button
          type="button"
          onClick={handleNext}
          disabled={isSaving || !isCurrentAnswered}
          className="px-6 py-2.5 rounded-[4px] bg-histo-copper hover:bg-histo-dark text-white text-xs font-ui font-bold uppercase tracking-wider shadow-medium transition-all flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          {currentIndex === totalQuestions - 1 ? (
            <>Finish Quiz <SparklesIcon className="h-4 w-4" /></>
          ) : (
            <>Next Question <RightArrowIcon className="h-4 w-4" /></>
          )}
        </button>
      </div>
    </div>
    </>
  );
}
