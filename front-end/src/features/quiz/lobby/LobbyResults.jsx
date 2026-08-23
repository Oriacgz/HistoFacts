import { useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Chart } from 'chart.js/auto';
import { ChevronLeft, Trophy, Users, Award, ArrowRight, RotateCcw, Sparkles } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { ResultsSummary, MiniLeaderboard } from '../components';

export default function LobbyResults({
  lobbyData,
  leaderboard,
  playerId,
  onPlayAgain,
  onBackToHub,
}) {
  const { toast } = useToast();
  const shouldReduceMotion = useReducedMotion();
  const performanceChartRef = useRef(null);
  const currentPlayer = leaderboard.find(p => p.id === playerId);
  const currentPlayerRank = leaderboard.findIndex(p => p.id === playerId) + 1;
  const score = currentPlayer?.score || 0;
  const totalQuestions = lobbyData?.quizData?.questions?.length || 10;

  useEffect(() => {
    if (!performanceChartRef.current) return;
    new Chart(performanceChartRef.current, {
      type: 'bar',
      data: {
        labels: leaderboard.slice(0, 10).map((p, i) => `${i + 1}. ${p.username}`),
        datasets: [{
          label: 'Score',
          data: leaderboard.slice(0, 10).map(p => p.score),
          backgroundColor: leaderboard.slice(0, 10).map((p, i) => 
            p.id === playerId ? 'rgba(217, 165, 102, 0.8)' : `rgba(255, 255, 255, ${0.15 + i * 0.05})`
          ),
          borderColor: leaderboard.slice(0, 10).map((p, i) => 
            p.id === playerId ? 'rgba(217, 165, 102, 1)' : `rgba(255, 255, 255, ${0.3 + i * 0.05})`
          ),
          borderWidth: 2,
          borderRadius: 8,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
          title: { display: true, text: 'Final Scores', color: '#e2e8f0', font: { size: 14, family: 'Poppins' } },
          legend: { display: false },
        },
        scales: {
          x: { beginAtZero: true, ticks: { color: '#94a3b8', font: { family: 'Poppins' } }, grid: { color: 'rgba(255,255,255,0.05)' } },
          y: { ticks: { color: '#94a3b8', font: { family: 'Poppins' } }, grid: { display: false } },
        },
        animation: shouldReduceMotion ? false : { duration: 1000, easing: 'easeOutQuart' },
      },
    });
  }, [leaderboard, playerId, shouldReduceMotion]);

  return (
    <div className="relative min-h-screen overflow-x-hidden font-ui text-[1rem] leading-6">
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a]" />
      
      <header className="fixed left-0 top-0 z-50 w-full border-b border-white/5 bg-black/30 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <button type="button" onClick={onBackToHub} className="h-9 w-9 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center text-white/50 hover:text-white hover:border-white/20 transition-all cursor-pointer">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-display font-bold text-white tracking-wider">LOBBY RESULTS</h1>
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
              maxScore={totalQuestions * 3}
              correctCount={Math.floor(score / 3)}
              wrongCount={totalQuestions - Math.floor(score / 3)}
              rank={currentPlayerRank}
              quizType="lobby"
              topic={lobbyData?.quizData?.topic}
              onRetry={onPlayAgain}
              onBackToHub={onBackToHub}
            />

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-6 mb-8"
            >
              <div className="flex items-center gap-3 mb-4">
                <Trophy className="h-5 w-5 text-histo-gold" />
                <h3 className="text-xl font-semibold text-white">Final Leaderboard</h3>
                <span className="ml-auto px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 text-xs font-ui uppercase tracking-wider">
                  Lobby Only
                </span>
              </div>
              <p className="text-sm text-white/50 mb-4 text-center">
                <span className="font-semibold text-amber-400">Note:</span> Lobby results don't count toward the global leaderboard or Histoins.
              </p>
              <MiniLeaderboard
                players={leaderboard}
                maxVisible={leaderboard.length}
                title=""
                className="mb-6"
              />
              <div className="w-full h-64">
                <canvas ref={performanceChartRef} className="w-full h-full" />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <Award className="h-5 w-5 text-histo-gold" />
                <h3 className="text-xl font-semibold text-white">Your Performance</h3>
              </div>
              {currentPlayer && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <div className="font-display text-3xl font-bold text-emerald-400">{currentPlayer.correct || 0}</div>
                    <div className="text-sm text-white/60">Correct</div>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                    <div className="font-display text-3xl font-bold text-red-400">{currentPlayer.wrong || 0}</div>
                    <div className="text-sm text-white/60">Incorrect</div>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-histo-gold/10 border border-histo-gold/20">
                    <div className="font-display text-3xl font-bold text-histo-gold">{currentPlayer.accuracy ? `${currentPlayer.accuracy}%` : '0%'}</div>
                    <div className="text-sm text-white/60">Accuracy</div>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <div className="font-display text-3xl font-bold text-amber-400">#{currentPlayerRank}</div>
                    <div className="text-sm text-white/60">Rank</div>
                  </div>
                </div>
              )}
            </motion.div>

            <div className="flex flex-wrap justify-center gap-4 mt-8">
              {onPlayAgain && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onPlayAgain}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-histo-gold to-histo-copper px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-histo-gold/20 hover:shadow-histo-gold/40 transition-all cursor-pointer"
                >
                  <RotateCcw className="h-4 w-4" /> Play Again
                </motion.button>
              )}
              {onPlayAgain && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { /* Try harder - would need new quiz */ }}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-6 py-3 text-sm font-medium text-white/70 hover:text-white hover:border-white/20 transition-all cursor-pointer"
                >
                  <ArrowRight className="h-4 w-4" /> New Quiz
                </motion.button>
              )}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onBackToHub}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-6 py-3 text-sm font-medium text-white/70 hover:text-white hover:border-white/20 transition-all cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" /> Back to Hub
              </motion.button>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}

