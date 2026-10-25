import { useEffect, useState } from 'react';
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
import { startGlobalQuizApi, completeQuizApi, getCurrentGlobalQuizApi } from '../../../api/quiz';

const GLOBAL_RULES = {
  correct: 2,
  wrong: -2,
  maxScore: 80,
  questionsCount: 40,
};

export default function GlobalQuizEntry({ onBackToHub, onOpenLeaderboard }) {
  const [sessionId, setSessionId] = useState(null);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState([]);
  const [startTime, setStartTime] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [poolStatus, setPoolStatus] = useState('checking');

  const checkPool = async () => {
    setPoolStatus('checking');
    setErrorMsg('');
    try {
      await getCurrentGlobalQuizApi();
      setPoolStatus('ready');
    } catch (error) {
      setPoolStatus(error.status === 503 ? 'unavailable' : 'error');
      if (error.status !== 503) setErrorMsg(error.message || 'Could not check this month’s challenge.');
    }
  };
  useEffect(() => {
    let active = true;
    getCurrentGlobalQuizApi().then(() => { if (active) setPoolStatus('ready'); }).catch((error) => {
      if (!active) return;
      setPoolStatus(error.status === 503 ? 'unavailable' : 'error');
      if (error.status !== 503) setErrorMsg(error.message || 'Could not check this month’s challenge.');
    });
    return () => { active = false; };
  }, []);

  const getDaysRemainingInMonth = () => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return Math.max(1, lastDay.getDate() - now.getDate());
  };

  const daysRemaining = getDaysRemainingInMonth();

  const handleStartChallenge = async () => {
    setIsLoading(true);
    try {
      const res = await startGlobalQuizApi();
      setSessionId(res.session_id);
      setQuestions(res.questions);
      setUserAnswers(Array(res.questions.length).fill(null));
      setResult(null);
      setErrorMsg('');
      setCurrentIndex(0);
      setStartTime(Date.now());
      setIsPlaying(true);
    } catch (e) {
      if (e.status === 503) {
        setPoolStatus('unavailable');
        setErrorMsg('');
      } else setErrorMsg(e.message || 'Could not load global quiz');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectOption = (optionIndex) => {
    if (isSaving) return;
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

  const finishGlobalQuiz = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setErrorMsg('');
    const end = Date.now();
    try {
      const saved = await completeQuizApi(sessionId, questions, userAnswers, Math.round((end - startTime) / 1000));
      setResult(saved);
    } catch (e) {
      setErrorMsg(e.message || 'Could not save quiz. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // 1. Results View
  if (result) {
    return (
      <div className="max-w-3xl mx-auto py-4">
        {errorMsg && <p role="alert" className="text-red-600 mb-4">{errorMsg}</p>}
        {isSaving && <p role="status">Saving results...</p>}
        <ResultsSummary
          score={result.score}
          maxScore={result.max_score}
          correctCount={result.correct_count}
          wrongCount={result.wrong_count}
          totalQuestions={questions.length}
          timeSpentSeconds={result.total_time_seconds}
          quizType="global"
          topic="Global Ranked Challenge"
          difficulty="standard"
          rank={result.rank}
          details={result.details}
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
        {errorMsg && <p role="alert" className="text-red-600 mb-4">{errorMsg}</p>}
        {isSaving && <p role="status">Saving results...</p>}
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
            disabled={isSaving}
            scoringRules={{ correct: GLOBAL_RULES.correct, wrong: GLOBAL_RULES.wrong }}
          />
        )}

        {/* Footer Navigation */}
        <div className="flex items-center justify-between mt-6">
          <button
            type="button"
            onClick={handlePrev}
            disabled={isSaving || currentIndex === 0}
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
            disabled={isSaving || !isCurrentAnswered}
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
        {errorMsg && <p role="alert" className="text-red-600 mb-4">{errorMsg}</p>}
        {isSaving && <p role="status">Saving results...</p>}
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
              ⏱ {daysRemaining} days remaining until monthly leaderboard reset
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
              +2 for correct answer, -2 penalty for incorrect answer. Review your choices before submitting.
            </p>
          </div>

          <div className="rounded-histo bg-white p-4 border border-histo-dark/10 shadow-xs">
            <div className="flex items-center gap-2 text-xs font-ui font-bold text-emerald-800 mb-1">
              <SparklesIcon className="h-4 w-4 text-emerald-700" />
              <span>Earn Histoins</span>
            </div>
            <p className="text-xs font-body text-histo-ink/70 leading-relaxed">
              Earn Histoins equal to your final score, up to 80. Negative scores earn no coins.
            </p>
          </div>

          <div className="rounded-histo bg-white p-4 border border-histo-dark/10 shadow-xs">
            <div className="flex items-center gap-2 text-xs font-ui font-bold text-histo-copper mb-1">
              <TrophyIcon className="h-4 w-4 text-histo-copper" />
              <span>Monthly Ladder</span>
            </div>
            <p className="text-xs font-body text-histo-ink/70 leading-relaxed">
              Compare your official score with other scholars on this month's leaderboard.
            </p>
          </div>
        </div>

        {/* Start Button */}
        {poolStatus !== 'ready' && (
          <div role="status" className="mb-6 rounded border border-histo-copper/30 bg-white p-4 text-sm font-body text-histo-dark">
            {poolStatus === 'checking' ? 'Checking this month’s official questions…' : poolStatus === 'unavailable' ? 'This month’s challenge is not ready yet. Please check back once the official questions are published.' : 'Challenge availability could not be checked.'}
            {poolStatus !== 'checking' && <button type="button" onClick={checkPool} className="block mx-auto mt-3 text-histo-copper underline">Check again</button>}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-center gap-4">
          <button
            type="button"
            onClick={handleStartChallenge}
            disabled={isLoading || poolStatus !== 'ready'}
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
