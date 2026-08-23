import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Chart } from 'chart.js/auto';
import { generateQuizData } from '../data/quizData';
import { getQuizQuestionsApi, submitQuizAttemptApi } from '../api/quiz';
import {
  CheckCircle,
  ChevronLeft,
  ArrowRight,
  Search,
  Clock,
  XCircle,
  Trophy,
  Zap,
  Target,
  BookOpen,
  Sparkles,
  RotateCcw,
  Home,
  ChevronRight,
  Award,
  BarChart3,
} from 'lucide-react';

/* ── Topic suggestion chips ── */
const POPULAR_TOPICS = [
  'Mughal Empire', 'Indian Freedom Movement', 'Ancient Rome',
  'World War II', 'Egyptian Civilization', 'French Revolution',
  'Medieval India', 'Renaissance', 'American Revolution', 'Greek Mythology',
];

/* ── Difficulty badges ── */
const DIFFICULTY_CONFIG = {
  easy: { label: 'Easy', color: 'from-emerald-400 to-emerald-600', text: 'text-emerald-300', ring: 'ring-emerald-400/30' },
  medium: { label: 'Medium', color: 'from-amber-400 to-amber-600', text: 'text-amber-300', ring: 'ring-amber-400/30' },
  hard: { label: 'Hard', color: 'from-rose-400 to-rose-600', text: 'text-rose-300', ring: 'ring-rose-400/30' },
};

export default function QuizPage() {
  const [screen, setScreen] = useState('welcome');
  const [quizData, setQuizData] = useState({ id: null, topic: '', questions: [] });
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [userAnswers, setUserAnswers] = useState([]);
  const [quizStartTime, setQuizStartTime] = useState(0);
  const [quizEndTime, setQuizEndTime] = useState(0);
  const [timerText, setTimerText] = useState('00:00');
  const [errorMessage, setErrorMessage] = useState('');
  const [topic, setTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const performanceChartRef = useRef(null);
  const timeChartRef = useRef(null);
  const chartInstancesRef = useRef([]);
  const shouldReduceMotion = useReducedMotion();

  const totalQuestions = quizData.questions.length;
  const question = quizData.questions[currentQuestion];

  const showError = (message) => {
    setErrorMessage(message);
    window.setTimeout(() => setErrorMessage(''), 3000);
  };

  const generateQuiz = async (value) => {
    setIsGenerating(true);
    try {
      const apiQuestions = await getQuizQuestionsApi(value);
      if (apiQuestions && apiQuestions.length > 0) {
        setQuizData({
          id: `session-${Date.now()}`,
          topic: value || 'General History',
          questions: apiQuestions.map(q => ({
            id: q.id,
            question: q.question,
            options: q.options,
            correct_answer: q.correct_answer,
            difficulty: q.difficulty || 'medium',
          })),
        });
      } else {
        setQuizData(generateQuizData(value));
      }
    } catch {
      setQuizData(generateQuizData(value));
    }
    setIsGenerating(false);
    setCurrentQuestion(0);
    setUserAnswers(Array(10).fill(null));
    setQuizStartTime(Date.now());
    setQuizEndTime(0);
    setScreen('quiz');
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    const value = topic.trim();
    if (!value) {
      showError('Please enter a topic to start the quiz');
      return;
    }
    generateQuiz(value);
  };

  const handlePrev = () => {
    if (currentQuestion > 0) setCurrentQuestion(v => v - 1);
  };

  const handleNext = () => {
    if (userAnswers[currentQuestion] === null) {
      showError('Please select an answer before continuing');
      return;
    }
    if (currentQuestion < totalQuestions - 1) {
      setCurrentQuestion(v => v + 1);
      return;
    }
    setQuizEndTime(Date.now());
    setScreen('results');
  };

  const handleRetake = () => {
    setCurrentQuestion(0);
    setUserAnswers(Array(quizData.questions.length).fill(null));
    setQuizStartTime(Date.now());
    setQuizEndTime(0);
    setScreen('quiz');
  };

  /* ── Timer ── */
  useEffect(() => {
    if (screen !== 'quiz') return undefined;
    const updateTimer = () => {
      const elapsed = Math.floor((Date.now() - quizStartTime) / 1000);
      const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
      const s = String(elapsed % 60).padStart(2, '0');
      setTimerText(`${m}:${s}`);
    };
    updateTimer();
    const interval = window.setInterval(updateTimer, 1000);
    return () => window.clearInterval(interval);
  }, [screen, quizStartTime]);

  const totalTime = useMemo(() => {
    if (!quizStartTime || !quizEndTime) return 0;
    return Math.floor((quizEndTime - quizStartTime) / 1000);
  }, [quizStartTime, quizEndTime]);

  const score = useMemo(() => {
    return quizData.questions.reduce((count, item, index) => count + (userAnswers[index] === item.correct_answer ? 1 : 0), 0);
  }, [quizData.questions, userAnswers]);

  const scorePercentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;

  /* ── Confetti on high score ── */
  useEffect(() => {
    if (screen === 'results' && scorePercentage >= 70) {
      setShowConfetti(true);
      const t = setTimeout(() => setShowConfetti(false), 4000);
      return () => clearTimeout(t);
    }
  }, [screen, scorePercentage]);

  /* ── Charts ── */
  useEffect(() => {
    if (screen !== 'results') return undefined;
    chartInstancesRef.current.forEach(c => c.destroy());
    chartInstancesRef.current = [];
    if (!performanceChartRef.current || !timeChartRef.current) return undefined;

    const performanceChart = new Chart(performanceChartRef.current, {
      type: 'doughnut',
      data: {
        labels: ['Correct', 'Incorrect'],
        datasets: [{
          data: [score, totalQuestions - score],
          backgroundColor: ['rgba(16, 185, 129, 0.85)', 'rgba(239, 68, 68, 0.65)'],
          borderColor: ['rgba(16, 185, 129, 1)', 'rgba(239, 68, 68, 1)'],
          borderWidth: 2,
          hoverOffset: 8,
        }],
      },
      options: {
        responsive: true,
        cutout: '65%',
        plugins: {
          title: { display: true, text: 'Accuracy', color: '#e2e8f0', font: { size: 14, family: 'Poppins' } },
          legend: { position: 'bottom', labels: { color: '#94a3b8', font: { family: 'Poppins' }, padding: 16 } },
        },
      },
    });

    const avgTime = totalQuestions ? totalTime / totalQuestions : 0;
    const timeChart = new Chart(timeChartRef.current, {
      type: 'bar',
      data: {
        labels: ['Total', 'Avg / Question'],
        datasets: [{
          label: 'Seconds',
          data: [totalTime, avgTime.toFixed(1)],
          backgroundColor: ['rgba(217, 165, 102, 0.7)', 'rgba(78, 84, 200, 0.7)'],
          borderColor: ['rgba(217, 165, 102, 1)', 'rgba(78, 84, 200, 1)'],
          borderWidth: 2,
          borderRadius: 8,
        }],
      },
      options: {
        responsive: true,
        scales: {
          y: { beginAtZero: true, ticks: { color: '#94a3b8', font: { family: 'Poppins' } }, grid: { color: 'rgba(255,255,255,0.05)' } },
          x: { ticks: { color: '#94a3b8', font: { family: 'Poppins' } }, grid: { display: false } },
        },
        plugins: {
          title: { display: true, text: 'Time Analysis', color: '#e2e8f0', font: { size: 14, family: 'Poppins' } },
          legend: { display: false },
        },
      },
    });

    chartInstancesRef.current = [performanceChart, timeChart];
    return () => {
      chartInstancesRef.current.forEach(c => c.destroy());
      chartInstancesRef.current = [];
    };
  }, [screen, score, totalTime, totalQuestions]);

  /* ── Progress bar width ── */
  const progressWidth = totalQuestions > 0 ? ((currentQuestion + 1) / totalQuestions) * 100 : 0;

  /* ── Animation variants ── */
  const pageVariants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
    exit: { opacity: 0, y: shouldReduceMotion ? 0 : -20, transition: { duration: 0.3 } },
  };

  const cardVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] } },
  };

  const optionVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: (i) => ({
      opacity: 1,
      x: 0,
      transition: { delay: shouldReduceMotion ? 0 : i * 0.08, duration: 0.3, ease: 'easeOut' },
    }),
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden font-ui text-[1rem] leading-6">
      {/* ── Premium dark gradient background ── */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a]" />
      <div className="fixed inset-0 -z-[8] opacity-30 bg-[radial-gradient(ellipse_at_top,rgba(217,165,102,0.15),transparent_50%),radial-gradient(ellipse_at_bottom_right,rgba(78,84,200,0.12),transparent_50%)]" />

      {/* ── Floating ambient orbs ── */}
      <div className="fixed inset-0 -z-[6] pointer-events-none overflow-hidden">
        <div className="absolute top-[10%] left-[15%] w-[300px] h-[300px] rounded-full bg-histo-gold/5 blur-[100px] animate-pulse-slow" />
        <div className="absolute bottom-[20%] right-[10%] w-[400px] h-[400px] rounded-full bg-histo-blue/5 blur-[120px] animate-pulse-slow" style={{ animationDelay: '2s' }} />
        <div className="absolute top-[50%] left-[60%] w-[200px] h-[200px] rounded-full bg-purple-500/5 blur-[80px] animate-pulse-slow" style={{ animationDelay: '4s' }} />
      </div>

      {/* ── Header / Navbar ── */}
      <header className="fixed left-0 top-0 z-50 w-full border-b border-white/5 bg-black/30 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/home" className="flex items-center gap-3 group">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-histo-gold to-histo-copper flex items-center justify-center shadow-lg shadow-histo-gold/20 group-hover:shadow-histo-gold/40 transition-shadow">
              <BookOpen className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-display font-bold text-white tracking-wider">HISTOFACTS</span>
          </Link>
          <nav className="hidden md:flex items-center gap-2">
            <Link to="/home" className="px-4 py-2 text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-all duration-200">Home</Link>
            <Link to="/quiz" className="px-4 py-2 text-sm font-medium text-histo-gold bg-histo-gold/10 rounded-lg transition-all duration-200">Quiz</Link>
            <Link to="/notes" className="px-4 py-2 text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-all duration-200">AI Notes</Link>
            <Link to="/feed" className="px-4 py-2 text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-all duration-200">Feed</Link>
          </nav>
        </div>
      </header>

      {/* ── Main Content ── */}
      <div className="relative z-10 min-h-screen pt-24 pb-12">
        <div className="mx-auto max-w-[900px] px-4 sm:px-6">
          <AnimatePresence mode="wait">
            {/* ══════════════════════════ WELCOME SCREEN ══════════════════════════ */}
            {screen === 'welcome' && (
              <motion.div key="welcome" variants={pageVariants} initial="hidden" animate="visible" exit="exit">
                {/* Hero Section */}
                <div className="text-center mb-10">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
                    className="inline-flex items-center justify-center h-20 w-20 rounded-2xl bg-gradient-to-br from-histo-gold/20 to-histo-copper/20 border border-histo-gold/30 mb-6 shadow-xl shadow-histo-gold/10"
                  >
                    <Trophy className="h-10 w-10 text-histo-gold" />
                  </motion.div>
                  <h1 className="text-4xl sm:text-5xl font-display font-bold text-white mb-3 tracking-tight">
                    History <span className="bg-gradient-to-r from-histo-gold to-histo-copper bg-clip-text text-transparent">Challenge</span>
                  </h1>
                  <p className="text-lg text-white/50 max-w-md mx-auto font-light">
                    Test your knowledge across civilizations and centuries. Choose a topic to begin.
                  </p>
                </div>

                {/* Search Card */}
                <motion.div
                  variants={cardVariants}
                  className="relative rounded-2xl bg-white/[0.04] backdrop-blur-sm border border-white/[0.08] p-8 shadow-2xl shadow-black/20 overflow-hidden"
                >
                  {/* Subtle glow accent */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[200px] h-[1px] bg-gradient-to-r from-transparent via-histo-gold/50 to-transparent" />

                  <div className="flex items-center gap-3 mb-6">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-histo-blue to-histo-blue-soft flex items-center justify-center">
                      <Target className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-white">Choose Your Topic</h2>
                      <p className="text-sm text-white/40">Type any historical topic or pick from suggestions</p>
                    </div>
                  </div>

                  {/* Error */}
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

                  <form onSubmit={handleSearchSubmit} className="space-y-5">
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/30" />
                      <input
                        type="text"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        placeholder="e.g. Mughal Empire, World War II, Ancient Greece..."
                        className="w-full rounded-xl border border-white/10 bg-white/[0.04] pl-12 pr-4 py-4 text-base text-white outline-none placeholder:text-white/25 transition-all duration-300 focus:border-histo-gold/50 focus:bg-white/[0.06] focus:ring-2 focus:ring-histo-gold/20"
                      />
                    </div>

                    {/* Topic suggestion chips */}
                    <div className="flex flex-wrap gap-2">
                      {POPULAR_TOPICS.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => { setTopic(t); generateQuiz(t); }}
                          className="px-3 py-1.5 text-xs font-medium rounded-full border border-white/10 bg-white/[0.03] text-white/50 hover:text-histo-gold hover:border-histo-gold/30 hover:bg-histo-gold/5 transition-all duration-200 cursor-pointer"
                        >
                          {t}
                        </button>
                      ))}
                    </div>

                    <button
                      type="submit"
                      disabled={isGenerating}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-histo-gold to-histo-copper px-8 py-3.5 font-semibold text-white shadow-lg shadow-histo-gold/25 hover:shadow-histo-gold/40 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {isGenerating ? (
                        <>
                          <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Generating Quiz...
                        </>
                      ) : (
                        <>
                          <Zap className="h-5 w-5" /> Start Quiz
                        </>
                      )}
                    </button>
                  </form>
                </motion.div>

                {/* Stats / Info cards */}
                <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { icon: Target, label: '10 Questions', desc: 'Per quiz session', gradient: 'from-blue-500/20 to-indigo-500/20' },
                    { icon: Clock, label: 'Timed', desc: 'Track your speed', gradient: 'from-amber-500/20 to-orange-500/20' },
                    { icon: Award, label: '+20 Histoins', desc: 'Earn per quiz', gradient: 'from-emerald-500/20 to-teal-500/20' },
                  ].map((card) => (
                    <motion.div
                      key={card.label}
                      whileHover={{ y: -2 }}
                      className={`rounded-xl bg-gradient-to-br ${card.gradient} border border-white/[0.06] p-5 text-center`}
                    >
                      <card.icon className="h-6 w-6 text-white/60 mx-auto mb-2" />
                      <p className="text-sm font-semibold text-white/80">{card.label}</p>
                      <p className="text-xs text-white/40">{card.desc}</p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ══════════════════════════ QUIZ SCREEN ══════════════════════════ */}
            {screen === 'quiz' && question && (
              <motion.div key={`quiz-${currentQuestion}`} variants={pageVariants} initial="hidden" animate="visible" exit="exit">
                {/* Top bar: topic + timer + progress */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setScreen('welcome')}
                        className="h-9 w-9 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center text-white/50 hover:text-white hover:border-white/20 transition-all cursor-pointer"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <div>
                        <h2 className="text-lg font-semibold text-white">{quizData.topic}</h2>
                        <p className="text-xs text-white/40">Question {currentQuestion + 1} of {totalQuestions}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.06] border border-white/10 text-sm font-mono text-histo-gold">
                        <Clock className="h-4 w-4" /> {timerText}
                      </div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-histo-gold to-histo-copper"
                      initial={{ width: 0 }}
                      animate={{ width: `${progressWidth}%` }}
                      transition={{ duration: 0.4, ease: 'easeInOut' }}
                    />
                  </div>
                </div>

                {/* Question card */}
                <motion.div
                  variants={cardVariants}
                  className="relative rounded-2xl bg-white/[0.04] backdrop-blur-sm border border-white/[0.08] p-8 shadow-2xl shadow-black/20 overflow-hidden"
                >
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[200px] h-[1px] bg-gradient-to-r from-transparent via-histo-gold/50 to-transparent" />

                  {/* Question number badge */}
                  <div className="flex items-start gap-4 mb-6">
                    <div className="shrink-0 h-10 w-10 rounded-xl bg-gradient-to-br from-histo-gold/20 to-histo-copper/20 border border-histo-gold/30 flex items-center justify-center text-histo-gold font-bold text-sm">
                      {currentQuestion + 1}
                    </div>
                    <h3 className="text-xl font-semibold text-white leading-relaxed pt-1">{question.question}</h3>
                  </div>

                  {/* Answer options */}
                  <div className="space-y-3 mb-8">
                    {question.options.map((option, index) => {
                      const selected = userAnswers[currentQuestion] === index;
                      const letter = String.fromCharCode(65 + index);

                      return (
                        <motion.button
                          key={option}
                          custom={index}
                          variants={optionVariants}
                          initial="hidden"
                          animate="visible"
                          type="button"
                          onClick={() => {
                            setUserAnswers((current) => {
                              const next = [...current];
                              next[currentQuestion] = index;
                              return next;
                            });
                          }}
                          className={`group flex w-full items-center rounded-xl border p-4 text-left transition-all duration-200 cursor-pointer ${
                            selected
                              ? 'border-histo-gold/50 bg-histo-gold/10 shadow-lg shadow-histo-gold/5'
                              : 'border-white/[0.08] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
                          }`}
                        >
                          <span className={`mr-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold transition-all duration-200 ${
                            selected
                              ? 'bg-gradient-to-br from-histo-gold to-histo-copper text-white shadow-md shadow-histo-gold/20'
                              : 'bg-white/[0.06] text-white/50 group-hover:bg-white/10 group-hover:text-white/70'
                          }`}>
                            {letter}
                          </span>
                          <span className={`text-sm transition-colors duration-200 ${selected ? 'text-white font-medium' : 'text-white/70 group-hover:text-white/90'}`}>
                            {option}
                          </span>
                          {selected && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="ml-auto"
                            >
                              <CheckCircle className="h-5 w-5 text-histo-gold" />
                            </motion.div>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>

                  {/* Error */}
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

                  {/* Navigation buttons */}
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={handlePrev}
                      disabled={currentQuestion === 0}
                      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-medium text-white/60 hover:text-white hover:border-white/20 hover:bg-white/[0.06] transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <ChevronLeft className="h-4 w-4" /> Previous
                    </button>

                    {/* Question dots */}
                    <div className="hidden sm:flex items-center gap-1.5">
                      {quizData.questions.map((_, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            if (userAnswers[currentQuestion] !== null || i < currentQuestion) setCurrentQuestion(i);
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
                      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-histo-gold to-histo-copper px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-histo-gold/20 hover:shadow-histo-gold/40 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                    >
                      {currentQuestion === totalQuestions - 1 ? (
                        <><Sparkles className="h-4 w-4" /> Finish Quiz</>
                      ) : (
                        <>Next <ChevronRight className="h-4 w-4" /></>
                      )}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}

            {/* ══════════════════════════ RESULTS SCREEN ══════════════════════════ */}
            {screen === 'results' && (
              <motion.div key="results" variants={pageVariants} initial="hidden" animate="visible" exit="exit">
                {/* Score Hero */}
                <div className="text-center mb-8">
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                    className="relative inline-flex items-center justify-center h-28 w-28 rounded-full mb-4"
                  >
                    {/* Ring background */}
                    <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 120 120">
                      <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
                      <motion.circle
                        cx="60" cy="60" r="52" fill="none"
                        stroke={scorePercentage >= 70 ? '#d9a566' : scorePercentage >= 40 ? '#f59e0b' : '#ef4444'}
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 52}`}
                        initial={{ strokeDashoffset: 2 * Math.PI * 52 }}
                        animate={{ strokeDashoffset: 2 * Math.PI * 52 * (1 - scorePercentage / 100) }}
                        transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
                      />
                    </svg>
                    <div className="text-center">
                      <span className="text-3xl font-bold text-white">{score}</span>
                      <span className="text-base text-white/40">/{totalQuestions}</span>
                    </div>
                  </motion.div>

                  <h1 className="text-3xl font-display font-bold text-white mb-2">
                    {scorePercentage >= 80 ? 'Outstanding!' : scorePercentage >= 60 ? 'Well Done!' : scorePercentage >= 40 ? 'Keep Learning!' : 'Room to Grow!'}
                  </h1>
                  <p className="text-white/40 mb-4">
                    You scored {scorePercentage}% on {quizData.topic}
                  </p>
                  <div className="inline-flex items-center gap-4 text-sm text-white/40">
                    <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> {formatTime(totalTime)}</span>
                    <span className="w-1 h-1 rounded-full bg-white/20" />
                    <span className="flex items-center gap-1.5"><Target className="h-4 w-4" /> {score} correct</span>
                    <span className="w-1 h-1 rounded-full bg-white/20" />
                    <span className="flex items-center gap-1.5"><Trophy className="h-4 w-4 text-histo-gold" /> +20 Histoins</span>
                  </div>
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-6"
                  >
                    <canvas ref={performanceChartRef} />
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-6"
                  >
                    <canvas ref={timeChartRef} />
                  </motion.div>
                </div>

                {/* Answer Review */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-6 sm:p-8 mb-8"
                >
                  <div className="flex items-center gap-3 mb-6">
                    <BarChart3 className="h-5 w-5 text-histo-gold" />
                    <h3 className="text-xl font-semibold text-white">Answer Review</h3>
                  </div>

                  <div className="space-y-3">
                    {quizData.questions.map((item, index) => {
                      const isCorrect = userAnswers[index] === item.correct_answer;
                      const selectedIndex = userAnswers[index];

                      return (
                        <motion.div
                          key={item.question}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.7 + index * 0.05 }}
                          className={`rounded-xl border p-4 transition-all ${
                            isCorrect
                              ? 'border-emerald-500/20 bg-emerald-500/5'
                              : 'border-red-500/20 bg-red-500/5'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`mt-0.5 shrink-0 h-6 w-6 rounded-full flex items-center justify-center ${isCorrect ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                              {isCorrect ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-white/90 mb-1">
                                <span className="text-white/40">Q{index + 1}.</span> {item.question}
                              </p>
                              <p className={`text-xs ${isCorrect ? 'text-emerald-400/80' : 'text-red-400/80'}`}>
                                Your answer: {String.fromCharCode(65 + selectedIndex)} — {item.options[selectedIndex]}
                              </p>
                              {!isCorrect && (
                                <p className="text-xs text-emerald-400/70 mt-1">
                                  Correct: {String.fromCharCode(65 + item.correct_answer)} — {item.options[item.correct_answer]}
                                </p>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>

                {/* Action Buttons */}
                <div className="flex flex-wrap justify-center gap-4">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={handleRetake}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-6 py-3 text-sm font-medium text-white/70 hover:text-white hover:border-white/20 transition-all cursor-pointer"
                  >
                    <RotateCcw className="h-4 w-4" /> Retake Quiz
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={() => setScreen('welcome')}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-histo-gold to-histo-copper px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-histo-gold/20 hover:shadow-histo-gold/40 transition-all cursor-pointer"
                  >
                    <Sparkles className="h-4 w-4" /> New Topic
                  </motion.button>
                  <Link
                    to="/home"
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-6 py-3 text-sm font-medium text-white/70 hover:text-white hover:border-white/20 transition-all"
                  >
                    <Home className="h-4 w-4" /> Home
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function formatTime(timeInSeconds) {
  const minutes = String(Math.floor(timeInSeconds / 60)).padStart(2, '0');
  const seconds = String(timeInSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}