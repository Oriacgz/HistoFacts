export const DIFFICULTY_CONFIG = {
  easy: {
    label: 'Easy',
    color: 'from-emerald-400 to-emerald-600',
    text: 'text-emerald-300',
    ring: 'ring-emerald-400/30',
    scoring: { correct: 2, wrong: 1 },
    description: 'Forgiving scoring for learning',
  },
  medium: {
    label: 'Medium',
    color: 'from-amber-400 to-amber-600',
    text: 'text-amber-300',
    ring: 'ring-amber-400/30',
    scoring: { correct: 2, wrong: 2 },
    description: 'Balanced challenge',
  },
  hard: {
    label: 'Hard',
    color: 'from-rose-400 to-rose-600',
    text: 'text-rose-300',
    ring: 'ring-rose-400/30',
    scoring: { correct: 3, wrong: 3 },
    description: 'High stakes, high rewards',
  },
};
