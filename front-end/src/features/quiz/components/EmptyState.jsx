import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

const emptyStates = {
  default: {
    icon: '📝',
    title: 'Nothing here yet',
    description: 'Get started to see your content.',
    action: null,
  },
  history: {
    icon: '📜',
    title: 'No quizzes yet',
    description: 'Take your first quiz to see your history here.',
    action: { label: 'Take a Quiz', to: '/quiz?tab=personalized' },
  },
  lobby: {
    icon: '👥',
    title: 'No active lobbies',
    description: 'Create or join a lobby to play with friends.',
    action: { label: 'Create Lobby', onClick: () => {} },
  },
  leaderboard: {
    icon: '🌍',
    title: 'Leaderboard empty',
    description: 'Be the first to play the Global Ranked quiz this month!',
    action: { label: 'Play Now', to: '/quiz?tab=global' },
  },
  personalized: {
    icon: '🎯',
    title: 'Ready to test your knowledge?',
    description: 'Enter a topic or upload a PDF to generate a personalized quiz.',
    action: { label: 'Start Quiz', to: '/quiz?tab=personalized' },
  },
};

export default function EmptyState({
  type = 'default',
  customIcon,
  customTitle,
  customDescription,
  customAction,
  className = '',
  centered = true,
}) {
  const state = emptyStates[type] || emptyStates.default;
  const icon = customIcon || state.icon;
  const title = customTitle || state.title;
  const description = customDescription || state.description;
  const action = customAction || state.action;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={`relative rounded-2xl bg-white/[0.04] border border-white/[0.08] p-10 sm:p-16 text-center ${centered ? 'mx-auto max-w-md' : ''} ${className}`}
    >
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[200px] h-[1px] bg-gradient-to-r from-transparent via-histo-gold/50 to-transparent" />

      <div className="relative z-10">
        <div className="text-6xl mb-6 animate-bounce-slow">{icon}</div>
        <h3 className="text-xl sm:text-2xl font-semibold text-white mb-3">{title}</h3>
        <p className="text-white/50 mb-8 leading-relaxed">{description}</p>
        {action && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={action.onClick}
            className={action.to
              ? 'inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-histo-gold to-histo-copper px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-histo-gold/20 hover:shadow-histo-gold/40 transition-all cursor-pointer'
              : 'inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-histo-gold to-histo-copper px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-histo-gold/20 hover:shadow-histo-gold/40 transition-all cursor-pointer'}
            as={action.to ? Link : 'button'}
            to={action.to}
          >
            {action.label}
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}