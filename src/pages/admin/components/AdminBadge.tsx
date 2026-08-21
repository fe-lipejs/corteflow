type BadgeVariant = 'active' | 'trial' | 'suspended' | 'blocked' | 'canceled' | 'neutral' | 'violet' | 'blue' | 'deleted' | 'past_due';

const variantMap: Record<BadgeVariant, string> = {
  active:    'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  trial:     'bg-amber-500/10 text-amber-400 border-amber-500/20',
  suspended: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  blocked:   'bg-red-500/10 text-red-400 border-red-500/20',
  canceled:  'bg-zinc-800/50 text-zinc-500 border-zinc-700/30',
  deleted:   'bg-red-950/50 text-red-500 border-red-500/30 line-through decoration-red-500/50',
  past_due:  'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  neutral:   'bg-[#1a1a1a] text-[#777] border-[#333]',
  violet:    'bg-violet-500/10 text-violet-400 border-violet-500/20',
  blue:      'bg-blue-500/10 text-blue-400 border-blue-500/20',
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
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />}
      {text}
    </span>
  );
}

