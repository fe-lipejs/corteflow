import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface AdminCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  padding?: 'sm' | 'md' | 'lg' | 'none';
  accent?: 'violet' | 'blue' | 'emerald' | 'amber' | 'red' | 'none';
}

const accentMap = {
  violet: 'hover:border-indigo-400 hover:shadow-[0_4px_20px_rgba(99,102,241,0.1)]',
  blue:   'hover:border-blue-500 hover:shadow-[0_4px_20px_rgba(59,130,246,0.12)]',
  emerald:'hover:border-emerald-400 hover:shadow-[0_4px_20px_rgba(16,185,129,0.1)]',
  amber:  'hover:border-amber-400 hover:shadow-[0_4px_20px_rgba(245,158,11,0.1)]',
  red:    'hover:border-red-400 hover:shadow-[0_4px_20px_rgba(239,68,68,0.1)]',
  none:   '',
};

const paddingMap = {
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
  none: '',
};

export default function AdminCard({
  children,
  className = '',
  hover = false,
  padding = 'md',
  accent = 'none',
}: AdminCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`
        bg-white border border-slate-200/90 rounded-xl shadow-xs
        transition-all duration-200
        ${hover ? `cursor-pointer ${accentMap[accent]} hover:border-slate-300 hover:shadow-md` : ''}
        ${paddingMap[padding]}
        ${className}
      `}
    >
      {children}
    </motion.div>
  );
}
