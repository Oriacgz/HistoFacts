import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

export default function LoadMoreButton({ show, onClick, historyLength }) {
  if (!show) return null;

  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className="w-full mt-6 py-4 rounded-xl border border-white/10 bg-white/[0.04] text-white/70 hover:text-white hover:border-white/20 hover:bg-white/[0.06] transition-all cursor-pointer flex items-center justify-center gap-2"
    >
      <Loader2 className="h-4 w-4" /> Load More ({historyLength} loaded)
    </motion.button>
  );
}