import { AlertCircle, CalendarClock, CheckCircle2, Clock } from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext';
import type { PayableDisplayStatus } from '../../../types/financial';

interface StatusBadgeProps {
  status: PayableDisplayStatus;
  label: string;
  compact?: boolean;
}

export function PayableStatusBadge({ status, label, compact = false }: StatusBadgeProps) {
  const { theme } = useTheme();

  const stylesByStatus: Record<
    PayableDisplayStatus,
    { bg: string; color: string; border: string; Icon: any }
  > = {
    paid: {
      bg: `${theme.success}18`,
      color: theme.success,
      border: `${theme.success}40`,
      Icon: CheckCircle2,
    },
    overdue: {
      bg: `${theme.error}18`,
      color: theme.error,
      border: `${theme.error}40`,
      Icon: AlertCircle,
    },
    due_today: {
      bg: `${theme.warning}20`,
      color: theme.warning,
      border: `${theme.warning}45`,
      Icon: AlertCircle,
    },
    due_soon: {
      bg: `${theme.warning}15`,
      color: theme.warning,
      border: `${theme.warning}35`,
      Icon: Clock,
    },
    scheduled: {
      bg: `${theme.info}18`,
      color: theme.info,
      border: `${theme.info}40`,
      Icon: CalendarClock,
    },
    partial: {
      bg: theme.accentMuted,
      color: theme.accent,
      border: `${theme.accent}40`,
      Icon: Clock,
    },
    pending: {
      bg: theme.inputBg,
      color: theme.textSecondary,
      border: theme.border,
      Icon: Clock,
    },
  };

  const current = stylesByStatus[status] || stylesByStatus.pending;
  const Icon = current.Icon;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-bold whitespace-nowrap border ${
        compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
      }`}
      style={{
        background: current.bg,
        color: current.color,
        borderColor: current.border,
      }}
    >
      <Icon className={compact ? 'w-3 h-3 shrink-0' : 'w-3.5 h-3.5 shrink-0'} />
      <span>{label}</span>
    </span>
  );
}

