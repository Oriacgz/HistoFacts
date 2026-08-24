import { useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Chart } from 'chart.js/auto';
import { RotateCcw, Sparkles, ArrowRight, Trophy, BarChart3, Award, ChevronRight } from 'lucide-react';
import { DIFFICULTY_CONFIG } from '../constants';
import { ResultsSummary } from '../components';

function PerformanceChart({ score, totalQuestions, chartRef }) {
  const shouldReduceMotion = useReducedMotion();
  const correct = score;
  const incorrect = totalQuestions - score;

  useEffect(() => {
    if (!chartRef.current) return;
    new Chart(chartRef.current, {
      type: 'doughnut',
      data: {
        labels: ['Correct', 'Incorrect'],
        datasets: [{
          data: [correct, incorrect],
          backgroundColor: ['rgba(16, 185, 129, 0.85)', 'rgba(239, 68, 68, 0.65)'],
          borderColor: ['rgba(16, 185, 129, 1)', 'rgba(239, 68, 68, 1)'],
          borderWidth: 2,
          hoverOffset: 8,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          title: { display: true, text: 'Accuracy', color: '#e2e8f0', font: { size: 14, family: 'Poppins' } },
          legend: { position: 'bottom', labels: { color: '#94a3b8', font: { family: 'Poppins' }, padding: 16 } },
        },
        animation: shouldReduceMotion ? false : { animateRotate: true, animateScale: true },
      },
    });
  }, [score, totalQuestions, chartRef, shouldReduceMotion]);

  return <canvas ref={chartRef} className="w-full h-48" />;
}

export default function PersonalizedQuizResults({
  quizData,
  difficulty,
  userAnswers,
  totalTime,
  onRetry,
  onTryHarder,
  onNewTopic,
  onBackToHub,
}) {
  const shouldReduceMotion = useReducedMotion();
  const performanceChartRef = useRef(null);
  const totalQuestions = quizData.questions.length;
  const score = quizData.questions.reduce((count, item, index) => count + (userAnswers[index] === item.correct_answer ? 1 : 0), 0);
  const wrongCount = totalQuestions - score;
  const scorePercentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;
  const difficultyConfig = DIFFICULTY_CONFIG[difficulty];
  const nextDifficulty = difficulty === 'easy' ? 'medium' : difficulty === 'medium' ? 'hard' : null;
  const histoinsEarned = 20;

  const formatTime = (timeInSeconds) => {
    const minutes = String(Math.floor(timeInSeconds / 60)).padStart(2, '0');
    const seconds = String(timeInSeconds % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden font-ui text-[1rem] leading-6">
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a]" />
      <div className="fixed inset-0 -z-[8] opacity-30 bg-[radial-gradient(ellipse_at_top,rgba(217,165,102,0.15),transparent_50%),radial-gradient(ellipse_at_bottom_right,rgba(78,84,200,0.12),transparent_50%)]" />

      <header className="fixed left-0 top-0 z-50 w-full border-b border-white/5 bg-black/30 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div className="w-9" />
          <h1 className="text-xl font-display font-bold text-white tracking-wider">RESULTS</h1>
          <div className="w-9" />
        </div>
      </header>

      <main className="relative z-10 min-h-screen pt-24 pb-12">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            <ResultsSummary
              score={score}
              maxScore={totalQuestions}
              correctCount={score}
              wrongCount={wrongCount}
              histoinsEarned={histoinsEarned}
              quizType="personalized"
              topic={quizData.topic}
              onRetry={onRetry}
              onTryHarder={nextDifficulty ? () => onTryHarder(nextDifficulty) : undefined}
              onNewTopic={onNewTopic}
              onBackToHub={onBackToHub}
            />

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-6 mb-8"
            >
              <div className="flex items-center gap-3 mb-4">
                <BarChart3 className="h-5 w-5 text-histo-gold" />
                <h3 className="text-xl font-semibold text-white">Answer Review</h3>
              </div>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {quizData.questions.map((item, index) => {
                  const isCorrect = userAnswers[index] === item.correct_answer;
                  const selectedIndex = userAnswers[index];

                  return (
                    <motion.div
                      key={item.question}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + index * 0.03 }}
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

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <Trophy className="h-5 w-5 text-histo-gold" />
                <h3 className="text-xl font-semibold text-white">Scoring Breakdown</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <div className="flex items-center gap-2">
                    <Award className="h-4 w-4 text-emerald-400" />
                    <span className="text-white/80">Correct answers</span>
                  </div>
                  <div className="text-right">
                    <div className="font-display font-bold text-emerald-400">+{score * difficultyConfig.scoring.correct}</div>
                    <div className="text-xs text-white/50">{score} × +{difficultyConfig.scoring.correct} pts</div>
                  </div>
                </div>
                {wrongCount > 0 && (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                    <div className="flex items-center gap-2">
                      <Award className="h-4 w-4 text-red-400" />
                      <span className="text-white/80">Incorrect answers</span>
                    </div>
                    <div className="text-right">
                      <div className="font-display font-bold text-red-400">{wrongCount * -difficultyConfig.scoring.wrong}</div>
                      <div className="text-xs text-white/50">{wrongCount} × −{difficultyConfig.scoring.wrong} pts</div>
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between p-3 rounded-xl bg-histo-gold/10 border border-histo-gold/20">
                  <div className="flex items-center gap-2">
                    <Award className="h-4 w-4 text-histo-gold" />
                    <span className="text-white">Completion bonus</span>
                  </div>
                  <div className="font-display font-bold text-histo-gold">+{histoinsEarned} Histoins</div>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.06] border border-white/10">
                  <span className="text-white font-semibold">Total Score</span>
                  <div className="font-display font-bold text-histo-gold">{score * difficultyConfig.scoring.correct - wrongCount * difficultyConfig.scoring.wrong + histoinsEarned} pts</div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}