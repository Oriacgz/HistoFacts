import { motion, useReducedMotion } from 'framer-motion';

const tabs = [
  { id: 'personalized', label: 'Personalized', icon: '🎯', desc: 'Topic-based quizzes' },
  { id: 'lobby', label: 'Group Lobby', icon: '👥', desc: 'Play with friends' },
  { id: 'global', label: 'Global Ranked', icon: '🌍', desc: 'Monthly leaderboard' },
  { id: 'history', label: 'History', icon: '📜', desc: 'Past attempts' },
];

export default function QuizTabNav({ activeTab, onTabChange, className = '' }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.nav
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex gap-2 overflow-x-auto pb-2 scrollbar-hide ${className}`}
      role="tablist"
      aria-label="Quiz modes"
    >
      {tabs.map((tab) => (
        <motion.button
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          onClick={() => onTabChange(tab.id)}
          whileHover={shouldReduceMotion ? {} : { y: -2 }}
          whileTap={shouldReduceMotion ? {} : { scale: 0.98 }}
          className={`relative flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl border transition-all duration-300 group whitespace-nowrap ${
            activeTab === tab.id
              ? 'bg-histo-gold/10 border-histo-gold/30 text-histo-gold shadow-lg shadow-histo-gold/10'
              : 'bg-white/[0.03] border-white/[0.06] text-white/60 hover:text-white hover:border-white/15 hover:bg-white/[0.06]'
          }`}
        >
          <span className="text-2xl" aria-hidden="true">{tab.icon}</span>
          <span className="font-ui font-semibold text-sm uppercase tracking-wider">{tab.label}</span>
          <span className="font-body text-[10px] text-white/40 uppercase tracking-wider">{tab.desc}</span>
          {activeTab === tab.id && (
            <motion.div
              layoutId="tab-indicator"
              className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-1 bg-histo-gold rounded-full"
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            />
          )}
        </motion.button>
      ))}
    </motion.nav>
  );
}