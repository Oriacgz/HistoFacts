import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ChevronLeftIcon,
  RightArrowIcon,
  SparklesIcon,
} from '../../../components/MotionIcons';
import QuestionCard from '../components/QuestionCard';
import ResultsSummary from '../components/ResultsSummary';
import ScoreRulesBadge from '../components/ScoreRulesBadge';
import { saveQuizSessionApi } from '../../../api/quiz';

const SCORING_RULES = {
  easy: { correct: 2, wrong: 0, maxScore: 20 },
  medium: { correct: 2, wrong: -1, maxScore: 20 },
  hard: { correct: 2, wrong: -3, maxScore: 20 },
};

export default function PersonalizedQuizPlay({
  quiz,
  onReset,
  onTryHarder,
  onBackToHub,
}) {
  const { topic, difficulty = 'medium', questions = [] } = quiz;
  const totalQuestions = questions.length;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState(Array(totalQuestions).fill(null));
  const [lockedAnswers, setLockedAnswers] = useState(Array(totalQuestions).fill(false));
  const [startTime] = useState(Date.now());
  const [endTime, setEndTime] = useState(null);
  const [isFinished, setIsFinished] = useState(false);

  const rules = SCORING_RULES[difficulty] || SCORING_RULES.medium;
  const currentQuestion = questions[currentIndex];

  const handleSelectOption = (optionIndex) => {
    if (lockedAnswers[currentIndex]) return;

    const newAnswers = [...selectedAnswers];
    newAnswers[currentIndex] = optionIndex;
    setSelectedAnswers(newAnswers);

    const newLocked = [...lockedAnswers];
    newLocked[currentIndex] = true;
    setLockedAnswers(newLocked);
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

  const calculateScore = () => {
    let totalScore = 0;
    let correctCount = 0;
    let wrongCount = 0;

    questions.forEach((q, idx) => {
      const chosen = selectedAnswers[idx];
      if (chosen !== null && chosen !== undefined) {
        if (chosen === q.correct_answer) {
          totalScore += rules.correct;
          correctCount += 1;
        } else {
          totalScore += rules.wrong;
          wrongCount += 1;
        }
      }
    });

    return {
      score: Math.max(0, totalScore),
      correctCount,
      wrongCount,
    };
  };

  const finishQuiz = async () => {
    const end = Date.now();
    setEndTime(end);
    setIsFinished(true);

    const { score, correctCount, wrongCount } = calculateScore();
    const duration = Math.round((end - startTime) / 1000);

    const details = questions.map((q, idx) => ({
      question_id: q.id || `q-${idx}`,
      question: q.question,
      options: q.options,
      selected_option: selectedAnswers[idx],
      correct_answer: q.correct_answer,
      is_correct: selectedAnswers[idx] === q.correct_answer,
      difficulty: q.difficulty || difficulty,
    }));

    try {
      await saveQuizSessionApi({
        quiz_type: 'personalized',
        topic,
        difficulty,
        score,
        max_score: rules.maxScore,
        correct_count: correctCount,
        wrong_count: wrongCount,
        total_time_seconds: duration,
        details,
      });
    } catch (e) {
      console.warn('Could not save session history:', e);
    }
  };

  const progressPercent = totalQuestions > 0 ? ((currentIndex + 1) / totalQuestions) * 100 : 0;
  const isCurrentAnswered = selectedAnswers[currentIndex] !== null;

  if (isFinished) {
    const { score, correctCount, wrongCount } = calculateScore();
    const timeSpent = Math.round(((endTime || Date.now()) - startTime) / 1000);

    return (
      <div className="max-w-4xl mx-auto py-4">
        <ResultsSummary
          score={score}
          maxScore={rules.maxScore}
          correctCount={correctCount}
          wrongCount={wrongCount}
          totalQuestions={totalQuestions}
          timeSpentSeconds={timeSpent}
          quizType="personalized"
          topic={topic}
          difficulty={difficulty}
          onRetry={onReset}
          onTryHarder={onTryHarder}
          onBackToHub={onBackToHub}
        />
      </div>
    );
  }

  return (
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
          disabled={lockedAnswers[currentIndex]}
          showCorrectAnswer={lockedAnswers[currentIndex]}
          correctAnswer={currentQuestion.correct_answer}
          difficulty={currentQuestion.difficulty || difficulty}
          scoringRules={{ correct: rules.correct, wrong: rules.wrong }}
        />
      )}

      {/* Footer Navigation Controls */}
      <div className="flex items-center justify-between mt-6">
        <button
          type="button"
          onClick={handlePrev}
          disabled={currentIndex === 0}
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
          disabled={!isCurrentAnswered}
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
  );
}