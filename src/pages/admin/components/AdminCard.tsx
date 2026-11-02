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
  violet:  'hover:border-indigo-500/50 hover:shadow-[0_4px_24px_rgba(99,102,241,0.15)]',
  blue:    'hover:border-sky-500/50 hover:shadow-[0_4px_24px_rgba(14,165,233,0.15)]',
  emerald: 'hover:border-emerald-500/50 hover:shadow-[0_4px_24px_rgba(16,185,129,0.2)]',
  amber:   'hover:border-amber-500/50 hover:shadow-[0_4px_24px_rgba(245,158,11,0.15)]',
  red:     'hover:border-red-500/50 hover:shadow-[0_4px_24px_rgba(239,68,68,0.15)]',
  none:    '',
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
        bg-[#0B0B0E] border border-white/[0.08] rounded-2xl shadow-xl text-zinc-100
        transition-all duration-200
        ${hover ? `cursor-pointer ${accentMap[accent]} hover:border-white/20 hover:shadow-2xl` : ''}
        ${paddingMap[padding]}
        ${className}
      `}
    >
      {children}
    </motion.div>
  );
}
