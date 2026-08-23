import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  TrophyIcon,
  CalendarIcon,
  ShieldIcon,
  RightArrowIcon,
  ChevronLeftIcon,
  SparklesIcon,
} from '../../../components/MotionIcons';
import ScoreRulesBadge from '../components/ScoreRulesBadge';
import QuestionCard from '../components/QuestionCard';
import ResultsSummary from '../components/ResultsSummary';
import { getQuizQuestionsApi, saveQuizSessionApi } from '../../../api/quiz';

const GLOBAL_RULES = {
  correct: 2,
  wrong: -2,
  maxScore: 80,
  questionsCount: 40,
};

export default function GlobalQuizEntry({ user, onBackToHub, onOpenLeaderboard }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState([]);
  const [startTime, setStartTime] = useState(null);
  const [endTime, setEndTime] = useState(null);
  const [isFinished, setIsFinished] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const getDaysRemainingInMonth = () => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return Math.max(1, lastDay.getDate() - now.getDate());
  };

  const daysRemaining = getDaysRemainingInMonth();

  const handleStartChallenge = async () => {
    setIsLoading(true);
    try {
      const q = await getQuizQuestionsApi('');
      let pool = q && q.length > 0 ? q : [];
      const final40 = [];
      for (let i = 0; i < 40; i++) {
        const sourceQ = pool[i % pool.length] || {
          question: `Global Challenge Question #${i + 1}: Which major historical event redefined global political boundaries?`,
          options: [
            'Treaty of Westphalia (1648)',
            'Congress of Vienna (1815)',
            'Treaty of Versailles (1919)',
            'United Nations Charter (1945)',
          ],
          correct_answer: (i % 4),
        };
        final40.push({
          id: `global-q-${i + 1}`,
          question: sourceQ.question,
          options: sourceQ.options,
          correct_answer: sourceQ.correct_answer,
          difficulty: 'standard',
        });
      }
      setQuestions(final40);
      setUserAnswers(Array(40).fill(null));
      setCurrentIndex(0);
      setStartTime(Date.now());
      setIsPlaying(true);
    } catch (e) {
      console.error('Could not load global questions:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectOption = (optionIndex) => {
    const newAnswers = [...userAnswers];
    newAnswers[currentIndex] = optionIndex;
    setUserAnswers(newAnswers);
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      finishGlobalQuiz();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const calculateGlobalScore = () => {
    let score = 0;
    let correctCount = 0;
    let wrongCount = 0;

    questions.forEach((q, idx) => {
      const chosen = userAnswers[idx];
      if (chosen !== null && chosen !== undefined) {
        if (chosen === q.correct_answer) {
          score += GLOBAL_RULES.correct;
          correctCount += 1;
        } else {
          score += GLOBAL_RULES.wrong;
          wrongCount += 1;
        }
      }
    });

    return {
      score: Math.max(0, score),
      correctCount,
      wrongCount,
    };
  };

  const finishGlobalQuiz = async () => {
    const end = Date.now();
    setEndTime(end);
    setIsFinished(true);

    const { score, correctCount, wrongCount } = calculateGlobalScore();
    const duration = Math.round((end - (startTime || Date.now())) / 1000);

    const details = questions.map((q, idx) => ({
      question_id: q.id,
      question: q.question,
      options: q.options,
      selected_option: userAnswers[idx],
      correct_answer: q.correct_answer,
      is_correct: userAnswers[idx] === q.correct_answer,
      difficulty: 'standard',
    }));

    try {
      await saveQuizSessionApi({
        quiz_type: 'global',
        topic: 'Global Ranked Challenge',
        difficulty: 'standard',
        score,
        max_score: GLOBAL_RULES.maxScore,
        correct_count: correctCount,
        wrong_count: wrongCount,
        total_time_seconds: duration,
        details,
      });
    } catch (e) {
      console.warn('Could not save global session:', e);
    }
  };

  // 1. Results View
  if (isFinished) {
    const { score, correctCount, wrongCount } = calculateGlobalScore();
    const timeSpent = Math.round(((endTime || Date.now()) - (startTime || Date.now())) / 1000);

    return (
      <div className="max-w-3xl mx-auto py-4">
        <ResultsSummary
          score={score}
          maxScore={GLOBAL_RULES.maxScore}
          correctCount={correctCount}
          wrongCount={wrongCount}
          totalQuestions={questions.length}
          timeSpentSeconds={timeSpent}
          quizType="global"
          topic="Global Ranked Challenge"
          difficulty="standard"
          onRetry={handleStartChallenge}
          onBackToHub={onBackToHub}
        />
      </div>
    );
  }

  // 2. In-Play 40-Question Exam
  if (isPlaying) {
    const currentQ = questions[currentIndex];
    const progressPct = ((currentIndex + 1) / questions.length) * 100;
    const isCurrentAnswered = userAnswers[currentIndex] !== null;

    return (
      <div className="max-w-3xl mx-auto">
        {/* Header Bar */}
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsPlaying(false)}
              className="h-9 w-9 rounded-full border border-histo-dark/20 bg-white text-histo-dark hover:border-histo-gold flex items-center justify-center transition-all shadow-soft cursor-pointer"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            <div>
              <h3 className="text-base font-display font-bold text-histo-dark">
                Global Ranked Challenge
              </h3>
              <span className="text-[11px] text-histo-ink/60 font-ui uppercase tracking-wider">
                Official Monthly Ladder • 40 Questions
              </span>
            </div>
          </div>

          <ScoreRulesBadge
            correct={GLOBAL_RULES.correct}
            wrong={GLOBAL_RULES.wrong}
            size="sm"
          />
        </div>

        {/* Progress */}
        <div className="w-full h-2 rounded-full bg-histo-dark/10 mb-6 overflow-hidden border border-histo-dark/10">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-histo-gold via-histo-copper to-histo-gold"
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {/* QuestionCard */}
        {currentQ && (
          <QuestionCard
            index={currentIndex}
            total={questions.length}
            question={currentQ.question}
            options={currentQ.options}
            selectedOption={userAnswers[currentIndex]}
            onSelect={handleSelectOption}
            scoringRules={{ correct: GLOBAL_RULES.correct, wrong: GLOBAL_RULES.wrong }}
          />
        )}

        {/* Footer Navigation */}
        <div className="flex items-center justify-between mt-6">
          <button
            type="button"
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="px-4 py-2.5 rounded-[4px] border border-histo-dark/20 bg-white text-xs font-ui font-bold uppercase tracking-wider text-histo-dark hover:border-histo-gold transition-all disabled:opacity-30 cursor-pointer shadow-soft"
          >
            <ChevronLeftIcon className="h-4 w-4" /> Previous
          </button>

          <span className="text-xs font-ui font-semibold text-histo-ink/60">
            {currentIndex + 1} / {questions.length}
          </span>

          <button
            type="button"
            onClick={handleNext}
            disabled={!isCurrentAnswered}
            className="px-6 py-2.5 rounded-[4px] bg-histo-copper hover:bg-histo-dark text-white text-xs font-ui font-bold uppercase tracking-wider shadow-medium transition-all flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 cursor-pointer"
          >
            {currentIndex === questions.length - 1 ? (
              <>Submit Score <SparklesIcon className="h-4 w-4" /></>
            ) : (
              <>Next <RightArrowIcon className="h-4 w-4" /></>
            )}
          </button>
        </div>
      </div>
    );
  }

  // 3. Entry Screen
  return (
    <div className="max-w-3xl mx-auto">
      {/* Top Banner */}
      <div className="rounded-histo bg-histo-cream border border-histo-dark/15 p-4 mb-8 flex flex-wrap items-center justify-between gap-4 shadow-soft">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-white border border-histo-copper/30 text-histo-copper flex items-center justify-center shrink-0 shadow-xs">
            <CalendarIcon className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-display font-bold text-histo-dark">
              {new Date().toLocaleString('default', { month: 'long' })} Ranked Season
            </h4>
            <p className="text-xs font-ui text-histo-ink/60">
              ⏱ {daysRemaining} days remaining until monthly leaderboard reset & Histoin payout
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ScoreRulesBadge
            correct={GLOBAL_RULES.correct}
            wrong={GLOBAL_RULES.wrong}
            size="sm"
          />
        </div>
      </div>

      {/* Main Challenge Card */}
      <div className="rounded-histo bg-histo-cream border border-histo-dark/10 p-8 shadow-medium text-center mb-8">
        <div className="h-16 w-16 rounded-full bg-histo-dark text-histo-gold border-2 border-histo-gold flex items-center justify-center mx-auto mb-4 shadow-soft">
          <TrophyIcon className="h-8 w-8 text-histo-gold" />
        </div>

        <h2 className="text-3xl font-display font-bold text-histo-dark mb-2">
          Global Ranked Championship
        </h2>
        <p className="text-sm font-body text-histo-ink/70 max-w-md mx-auto mb-8">
          The ultimate 40-question historical assessment. Tests comprehensive world chronology with competitive negative marking.
        </p>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 text-left">
          <div className="rounded-histo bg-white p-4 border border-histo-dark/10 shadow-xs">
            <div className="flex items-center gap-2 text-xs font-ui font-bold text-rose-800 mb-1">
              <ShieldIcon className="h-4 w-4 text-rose-700" />
              <span>Negative Marking</span>
            </div>
            <p className="text-xs font-body text-histo-ink/70 leading-relaxed">
              +2 for correct answer, -2 penalty for incorrect answer. Think before locking!
            </p>
          </div>

          <div className="rounded-histo bg-white p-4 border border-histo-dark/10 shadow-xs">
            <div className="flex items-center gap-2 text-xs font-ui font-bold text-emerald-800 mb-1">
              <SparklesIcon className="h-4 w-4 text-emerald-700" />
              <span>Earn Histoins</span>
            </div>
            <p className="text-xs font-body text-histo-ink/70 leading-relaxed">
              Every correct answer awards +20 Histoins to unlock study packs in the shop.
            </p>
          </div>

          <div className="rounded-histo bg-white p-4 border border-histo-dark/10 shadow-xs">
            <div className="flex items-center gap-2 text-xs font-ui font-bold text-histo-copper mb-1">
              <TrophyIcon className="h-4 w-4 text-histo-copper" />
              <span>Monthly Ladder</span>
            </div>
            <p className="text-xs font-body text-histo-ink/70 leading-relaxed">
              Climb the global ranks. Top 10 scholars receive exclusive seasonal badges.
            </p>
          </div>
        </div>

        {/* Start Button */}
        <div className="flex flex-wrap items-center justify-center gap-4">
          <button
            type="button"
            onClick={handleStartChallenge}
            disabled={isLoading}
            className="px-8 py-4 rounded-[4px] bg-histo-copper hover:bg-histo-dark text-white text-xs font-ui font-bold tracking-widest uppercase shadow-medium transition-all flex items-center gap-2.5 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 cursor-pointer"
          >
            {isLoading ? (
              <>
                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Loading 40-Question Exam...</span>
              </>
            ) : (
              <>
                <SparklesIcon className="h-4 w-4" />
                <span>Start Official 40-Question Challenge</span>
              </>
            )}
          </button>

          {onOpenLeaderboard && (
            <button
              type="button"
              onClick={onOpenLeaderboard}
              className="px-6 py-4 rounded-[4px] border border-histo-dark/20 bg-white text-xs font-ui font-bold uppercase tracking-wider text-histo-dark hover:bg-histo-paper shadow-soft transition-all cursor-pointer"
            >
              View Global Leaderboard
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
