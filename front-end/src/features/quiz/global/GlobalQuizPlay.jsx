import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ChevronLeft, Clock, Sparkles, CheckCircle, XCircle, Trophy, ArrowRight } from 'lucide-react';
import { getQuizQuestionsApi, generateQuizApi, saveQuizSessionApi } from '../../../api/quiz';
import { QuestionCard, Countdown, ProgressIndicator, ResultsSummary } from '../components';

const cardVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] } },
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.3 } },
};

export default function GlobalQuizPlay({ onFinish, onBack }) {
  const shouldReduceMotion = useReducedMotion();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [userAnswers, setUserAnswers] = useState([]);
  const [quizStartTime, setQuizStartTime] = useState(0);
  const [quizEndTime, setQuizEndTime] = useState(0);
  const [timerText, setTimerText] = useState('00:00');
  const [errorMessage, setErrorMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const totalQuestions = questions.length;
  const question = questions[currentQuestion];

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        let data = await getQuizQuestionsApi();
        if (!data || data.length === 0) {
          data = await generateQuizApi({ topic: 'World History Championship', difficulty: 'hard', count: 10 });
        }
        if (data && data.length > 0) {
          setQuestions(data.map((q, i) => ({ ...q, id: q.id || `q-${i}` })));
        } else {
          throw new Error('No questions returned');
        }
      } catch (err) {
        setErrorMessage(err.message || 'Failed to load quiz questions');
      } finally {
        setLoading(false);
      }
    };
    fetchQuestions();
  }, []);

  useEffect(() => {
    if (currentQuestion === 0 && quizStartTime === 0) {
      setQuizStartTime(Date.now());
      setUserAnswers(Array(40).fill(null));
    }
  }, [currentQuestion]);

  useEffect(() => {
    if (loading) return;
    const updateTimer = () => {
      const elapsed = Math.floor((Date.now() - quizStartTime) / 1000);
      const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
      const s = String(elapsed % 60).padStart(2, '0');
      setTimerText(`${m}:${s}`);
    };
    updateTimer();
    const interval = window.setInterval(updateTimer, 1000);
    return () => window.clearInterval(interval);
  }, [quizStartTime, loading]);

  const totalTime = useMemo(() => {
    if (!quizStartTime || !quizEndTime) return 0;
    return Math.floor((quizEndTime - quizStartTime) / 1000);
  }, [quizStartTime, quizEndTime]);

  const showError = (message) => {
    setErrorMessage(message);
    setTimeout(() => setErrorMessage(''), 3000);
  };

  const handleAnswerSelect = (index) => {
    if (submitted) return;
    setUserAnswers((current) => {
      const next = [...current];
      next[currentQuestion] = index;
      return next;
    });
  };

  const handleNext = async () => {
    if (userAnswers[currentQuestion] === null) {
      showError('Please select an answer before continuing');
      return;
    }

    if (currentQuestion < totalQuestions - 1) {
      setCurrentQuestion(v => v + 1);
      return;
    }

    setSubmitting(true);
    try {
      const correctCount = questions.reduce((acc, q, idx) => {
        return acc + (userAnswers[idx] === q.correct_answer ? 1 : 0);
      }, 0);
      const totalTimeSecs = Math.max(1, Math.floor((Date.now() - quizStartTime) / 1000));

      await saveQuizSessionApi({
        quiz_type: 'global',
        topic: 'World History Championship',
        difficulty: 'hard',
        score: correctCount * 2,
        max_score: totalQuestions * 2,
        correct_count: correctCount,
        wrong_count: totalQuestions - correctCount,
        total_time_seconds: totalTimeSecs,
        details: questions.map((item, index) => ({
          question: item.question,
          selected: userAnswers[index],
          correct: item.correct_answer,
          is_correct: userAnswers[index] === item.correct_answer,
        })),
      });

      setQuizEndTime(Date.now());
      setSubmitted(true);
      onFinish();
    } catch (err) {
      showError(err.message || 'Failed to submit quiz');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrev = () => {
    if (currentQuestion > 0) setCurrentQuestion(v => v - 1);
  };

  const progressWidth = totalQuestions > 0 ? ((currentQuestion + 1) / totalQuestions) * 100 : 0;

  if (loading) {
    return (
      <div className="relative min-h-screen overflow-x-hidden font-ui text-[1rem] leading-6 flex items-center justify-center">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="h-12 w-12 border-4 border-histo-gold/30 border-t-histo-gold rounded-full mx-auto mb-4"
          />
          <p className="text-white/60">Loading ranked quiz...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden font-ui text-[1rem] leading-6">
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a]" />
      
      <header className="fixed left-0 top-0 z-50 w-full border-b border-white/5 bg-black/30 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <button type="button" onClick={onBack} className="h-9 w-9 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center text-white/50 hover:text-white hover:border-white/20 transition-all cursor-pointer">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-histo-gold to-histo-copper flex items-center justify-center shadow-lg shadow-histo-gold/20">
              <Trophy className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-display font-bold text-white tracking-wider">RANKED QUIZ</span>
          </div>
          <div className="flex items-center gap-3">
            <Countdown seconds={0} serverAuthoritative={false} size="sm" showLabel={false} />
          </div>
        </div>
      </header>

      <main className="relative z-10 min-h-screen pt-24 pb-12">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={`quiz-${currentQuestion}`}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <ProgressIndicator
                currentQuestion={currentQuestion}
                totalQuestions={totalQuestions}
                answeredCount={userAnswers.filter(a => a !== null).length}
                showDots={true}
              />

              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-white">Monthly Ranked Quiz</h2>
                  <span className="px-3 py-1 rounded-full text-xs font-ui uppercase tracking-wider bg-histo-gold/20 text-histo-gold">Global</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.06] border border-white/10 text-sm font-mono text-histo-gold">
                  <Clock className="h-4 w-4" /> {timerText}
                </div>
              </div>

              <QuestionCard
                question={question}
                selectedOption={userAnswers[currentQuestion]}
                onSelect={handleAnswerSelect}
                disabled={submitted}
                showCorrectAnswer={false}
                mode="global"
              />

              <AnimatePresence>
                {errorMessage && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400 flex items-center gap-2"
                  >
                    <XCircle className="h-4 w-4 shrink-0" /> {errorMessage}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={handlePrev}
                  disabled={currentQuestion === 0}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-medium text-white/60 hover:text-white hover:border-white/20 hover:bg-white/[0.06] transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" /> Previous
                </button>

                <div className="hidden sm:flex items-center gap-1.5">
                  {questions.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        if (userAnswers[currentQuestion] !== null || i <= currentQuestion) setCurrentQuestion(i);
                      }}
                      className={`h-2 w-2 rounded-full transition-all duration-200 cursor-pointer ${
                        i === currentQuestion
                          ? 'w-6 bg-histo-gold'
                          : userAnswers[i] !== null
                          ? 'bg-histo-gold/40'
                          : 'bg-white/15'
                      }`}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleNext}
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-histo-gold to-histo-copper px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-histo-gold/20 hover:shadow-histo-gold/40 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                >
                  {currentQuestion === totalQuestions - 1
                    ? <>Submit Quiz <Sparkles className="h-4 w-4" /></>
                    : <>Next <ChevronLeft className="h-4 w-4 -rotate-180" /></>}
                  {submitting && <span className="h-4 w-4 animate-spin">⏳</span>}
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}