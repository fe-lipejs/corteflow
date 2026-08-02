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
  violet: 'hover:border-violet-500/30 hover:shadow-[0_0_30px_rgba(124,58,237,0.08)]',
  blue:   'hover:border-blue-500/30 hover:shadow-[0_0_30px_rgba(59,130,246,0.08)]',
  emerald:'hover:border-emerald-500/30 hover:shadow-[0_0_30px_rgba(16,185,129,0.08)]',
  amber:  'hover:border-amber-500/30 hover:shadow-[0_0_30px_rgba(245,158,11,0.08)]',
  red:    'hover:border-red-500/30 hover:shadow-[0_0_30px_rgba(239,68,68,0.08)]',
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
        bg-[#111111] border border-[#222222] rounded-xl
        transition-all duration-200
        ${hover ? `cursor-pointer ${accentMap[accent]} hover:border-[#333333]` : ''}
        ${paddingMap[padding]}
        ${className}
      `}
    >
      {children}
    </motion.div>
  );
}
