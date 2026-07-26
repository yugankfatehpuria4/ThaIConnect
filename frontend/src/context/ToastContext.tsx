'use client';

import React, { createContext, useCallback, useContext, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';

type ToastType = 'success' | 'info' | 'error';

type Toast = {
  id: number;
  message: string;
  type: ToastType;
};

type ToastContextValue = {
  showToast: (message: string, type?: ToastType, durationMs?: number) => void;
};

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export const useToast = () => useContext(ToastContext);

const STYLES: Record<ToastType, { ring: string; icon: React.ReactNode }> = {
  success: { ring: 'border-green/30', icon: <CheckCircle2 size={20} className="text-green" /> },
  info: { ring: 'border-blue/30', icon: <Info size={20} className="text-blue" /> },
  error: { ring: 'border-red/30', icon: <AlertTriangle size={20} className="text-red" /> },
};

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info', durationMs = 5000) => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, message, type }]);
      window.setTimeout(() => dismiss(id), durationMs);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Non-blocking toast stack — top-right, above everything */}
      <div className="fixed top-4 right-4 z-[10000] flex flex-col gap-2 w-[92vw] max-w-sm pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 40, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className={`pointer-events-auto flex items-start gap-3 rounded-2xl border ${STYLES[toast.type].ring} bg-white px-4 py-3 shadow-xl`}
              role="status"
            >
              <div className="mt-0.5 shrink-0">{STYLES[toast.type].icon}</div>
              <p className="flex-1 text-sm font-medium text-gray-800 leading-snug">{toast.message}</p>
              <button
                onClick={() => dismiss(toast.id)}
                className="shrink-0 text-gray-400 hover:text-gray-600"
                aria-label="Dismiss notification"
              >
                <X size={16} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};
