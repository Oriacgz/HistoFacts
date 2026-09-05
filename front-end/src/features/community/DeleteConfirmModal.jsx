import { motion } from 'framer-motion';
import { AlertTriangle, Trash2, X } from 'lucide-react';

export default function DeleteConfirmModal({
  isOpen,
  title = "Delete Item",
  message = "Are you sure you wish to delete this entry? This action cannot be undone.",
  onConfirm,
  onClose,
  loading = false,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-histo-dark/40 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-xl shadow-deep border border-histo-dark/15 max-w-sm w-full p-6 relative"
      >
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute top-4 right-4 text-histo-ink/40 hover:text-histo-dark p-1 rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-display font-bold text-base text-histo-dark">{title}</h3>
          </div>
        </div>

        <p className="text-xs font-body text-histo-ink/70 mb-6 leading-relaxed">
          {message}
        </p>

        <div className="flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 border border-histo-dark/15 rounded-lg text-xs font-ui font-medium text-histo-dark hover:bg-histo-paper transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-ui font-semibold hover:bg-red-700 transition-colors shadow-sm disabled:opacity-50"
          >
            {loading ? (
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
            Confirm Delete
          </button>
        </div>
      </motion.div>
    </div>
  );
}
