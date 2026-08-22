import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  footer?: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, subtitle, children, maxWidth = 'xl', footer }: ModalProps) {
  const { theme } = useTheme();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handler);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = 'auto';
    };
  }, [isOpen, onClose]);

  const maxWidthClass = {
    'sm': 'max-w-sm',
    'md': 'max-w-md',
    'lg': 'max-w-lg',
    'xl': 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
  }[maxWidth];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-6 pb-6 pt-16">
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={`relative w-full ${maxWidthClass} rounded-3xl border shadow-2xl flex flex-col overflow-hidden glass-card max-h-[85dvh] sm:max-h-[85vh] mt-auto sm:mt-0`}
            style={{ 
              background: theme.cardBg, 
              borderColor: theme.border
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 pb-4 shrink-0 border-b" style={{ borderColor: theme.border, background: theme.bg }}>
              <div>
                <h2 className="font-serif text-2xl font-bold" style={{ color: theme.textPrimary }}>{title}</h2>
                {subtitle && <p className="text-xs mt-0.5" style={{ color: theme.textSecondary }}>{subtitle}</p>}
              </div>
              <button 
                onClick={onClose} 
                className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:bg-black/10 dark:hover:bg-white/10 active:scale-95 shrink-0 ml-4"
                style={{ color: theme.textSecondary, background: theme.inputBg }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto scrollbar-none p-6">
              {children}
            </div>

            {/* Footer Fixo */}
            {footer && (
              <div className="p-4 sm:p-6 border-t shrink-0 flex items-center justify-end gap-3" style={{ borderColor: theme.border, background: theme.bg }}>
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

