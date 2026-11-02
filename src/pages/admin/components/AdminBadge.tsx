type BadgeVariant = 'active' | 'trial' | 'suspended' | 'blocked' | 'canceled' | 'neutral' | 'violet' | 'blue' | 'deleted' | 'past_due' | 'emerald';

const variantMap: Record<BadgeVariant, string> = {
  active:    'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  emerald:   'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  trial:     'bg-amber-500/15 text-amber-400 border-amber-500/30',
  suspended: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  blocked:   'bg-rose-500/15 text-rose-400 border-rose-500/30',
  canceled:  'bg-zinc-800 text-zinc-400 border-zinc-700',
  deleted:   'bg-red-500/15 text-red-400 border-red-500/30 line-through decoration-red-400',
  past_due:  'bg-rose-500/15 text-rose-400 border-rose-500/30',
  neutral:   'bg-zinc-800/80 text-zinc-300 border-zinc-700',
  violet:    'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
  blue:      'bg-sky-500/15 text-sky-400 border-sky-500/30',
};

const labelMap: Record<string, string> = {
  active: 'Ativo',
  trial: 'Trial',
  suspended: 'Suspenso',
  blocked: 'Bloqueado',
  canceled: 'Cancelado',
  deleted: 'Excluída',
  past_due: 'Inadimplente',
  super_admin: 'Super Admin',
  admin: 'Admin',
  manager: 'Gerente',
  professional: 'Profissional',
  client: 'Cliente',
  owner: 'Dono',
};

interface AdminBadgeProps {
  variant?: BadgeVariant;
  label?: string;
  value?: string;
  dot?: boolean;
}

export default function AdminBadge({ variant = 'neutral', label, value, dot = false }: AdminBadgeProps) {
  const text = label ?? (value ? labelMap[value] ?? value : '—');
  const resolvedVariant: BadgeVariant = (value && variantMap[value as BadgeVariant]) ? value as BadgeVariant : variant;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${variantMap[resolvedVariant]}`}>
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />}
      {text}
    </span>
  );
}
