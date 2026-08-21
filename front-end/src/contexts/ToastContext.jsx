import { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircleIcon, XCircleIcon, BellIcon } from '../components/MotionIcons';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 3500) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = {
    success: (msg, dur) => addToast(msg, 'success', dur),
    error: (msg, dur) => addToast(msg, 'error', dur),
    info: (msg, dur) => addToast(msg, 'info', dur),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Toast Overlay Container */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        <AnimatePresence mode="sync">
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 350, damping: 25 }}
              className={`pointer-events-auto flex items-start gap-3 p-4 rounded-[4px] shadow-deep border backdrop-blur-md transition-colors ${
                t.type === 'success'
                  ? 'bg-histo-dark/95 border-histo-gold/60 text-histo-paper'
                  : t.type === 'error'
                  ? 'bg-histo-dark/95 border-histo-danger/80 text-histo-paper'
                  : 'bg-histo-dark/95 border-histo-copper/60 text-histo-paper'
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {t.type === 'success' && <CheckCircleIcon className="h-5 w-5 text-histo-gold" />}
                {t.type === 'error' && <XCircleIcon className="h-5 w-5 text-histo-danger" />}
                {t.type === 'info' && <BellIcon className="h-5 w-5 text-histo-gold/80" />}
              </div>
              <div className="flex-1">
                <span className="text-[10px] font-ui font-semibold uppercase tracking-widest text-histo-gold block mb-0.5">
                  {t.type === 'success' ? 'Chronicle Notice' : t.type === 'error' ? 'Scholar Alert' : 'Notification'}
                </span>
                <p className="font-ui text-xs text-white/90 leading-snug">{t.message}</p>
              </div>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className="text-white/40 hover:text-white text-xs font-bold px-1"
              >
                ✕
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
