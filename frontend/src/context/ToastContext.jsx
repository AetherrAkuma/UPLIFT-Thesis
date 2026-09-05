/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setToasts((prev) => [...prev, { id, message, type, duration }]);
    
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  const toast = useMemo(() => ({
    success: (msg, dur) => showToast(msg, 'success', dur),
    error: (msg, dur) => showToast(msg, 'error', dur),
    warning: (msg, dur) => showToast(msg, 'warning', dur),
    info: (msg, dur) => showToast(msg, 'info', dur),
  }), [showToast]);

  // Icon selector based on toast type
  const getIcon = (type, customClass) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className={`w-4 h-4 ${customClass} shrink-0`} />;
      case 'error':
        return <AlertCircle className={`w-4 h-4 ${customClass} shrink-0`} />;
      case 'warning':
        return <AlertTriangle className={`w-4 h-4 ${customClass} shrink-0`} />;
      case 'info':
      default:
        return <Info className={`w-4 h-4 ${customClass} shrink-0`} />;
    }
  };

  // Border/bg style selector based on toast type
  const getTypeStyles = (type) => {
    switch (type) {
      case 'success':
        return {
          accentBg: 'bg-emerald-50 dark:bg-emerald-500/10',
          indicatorBg: 'bg-emerald-500',
          iconColor: 'text-emerald-500',
        };
      case 'error':
        return {
          accentBg: 'bg-rose-50 dark:bg-rose-500/10',
          indicatorBg: 'bg-[#CE1126]',
          iconColor: 'text-[#CE1126] dark:text-rose-400',
        };
      case 'warning':
        return {
          accentBg: 'bg-amber-50 dark:bg-amber-500/10',
          indicatorBg: 'bg-amber-500',
          iconColor: 'text-amber-500',
        };
      case 'info':
      default:
        return {
          accentBg: 'bg-blue-50 dark:bg-blue-500/10',
          indicatorBg: 'bg-[#0038A8]',
          iconColor: 'text-[#0038A8] dark:text-blue-400',
        };
    }
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      
      {/* Toast Portal/Container */}
      <div 
        className="fixed top-5 right-5 z-[99999] flex flex-col gap-3 max-w-sm w-full pointer-events-none px-4 sm:px-0"
        aria-live="assertive"
        role="log"
      >
        <AnimatePresence mode="popLayout">
          {toasts.map((item) => {
            const styles = getTypeStyles(item.type);
            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -15, scale: 0.95, transition: { duration: 0.2 } }}
                transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                className="pointer-events-auto relative overflow-hidden flex items-stretch rounded-2xl border border-slate-100 bg-white shadow-[0_10px_25px_-5px_rgba(0,0,0,0.05),0_8px_10px_-6px_rgba(0,0,0,0.05)] w-full"
              >
                {/* Left accent indicator stripe */}
                <div className={`w-1.5 ${styles.indicatorBg} shrink-0`} />

                <div className="flex flex-1 items-start gap-3 p-4">
                  {/* Status Icon Badge */}
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${styles.accentBg} shrink-0`}>
                    {getIcon(item.type, styles.iconColor)}
                  </div>

                  {/* Message Content */}
                  <div className="flex-1 text-xs font-semibold pr-3 pt-1.5 break-words text-slate-700 leading-relaxed">
                    {item.message}
                  </div>

                  {/* Close Button */}
                  <button
                    onClick={() => removeToast(item.id)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 mt-0.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
                    aria-label="Close notification"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Progress Bar indicator */}
                {item.duration > 0 && (
                  <motion.div
                    initial={{ scaleX: 1 }}
                    animate={{ scaleX: 0 }}
                    transition={{ duration: item.duration / 1000, ease: 'linear' }}
                    style={{ originX: 0 }}
                    className={`absolute bottom-0 left-1.5 right-0 h-[3px] ${styles.indicatorBg} opacity-80`}
                  />
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};
