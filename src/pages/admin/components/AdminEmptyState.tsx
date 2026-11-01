import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Inbox } from 'lucide-react';

interface AdminEmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export default function AdminEmptyState({
  title,
  description,
  icon,
  action,
}: AdminEmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center py-20 px-8 text-center"
    >
      <div className="w-16 h-16 bg-blue-50 border border-blue-100 rounded-2xl flex items-center justify-center text-blue-500 mb-5 shadow-xs">
        {icon ?? <Inbox className="w-7 h-7" />}
      </div>
      <h3 className="text-slate-900 font-semibold text-base mb-2">{title}</h3>
      {description && <p className="text-slate-500 text-sm max-w-sm leading-relaxed">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </motion.div>
  );
}
