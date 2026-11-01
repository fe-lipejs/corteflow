type BadgeVariant = 'active' | 'trial' | 'suspended' | 'blocked' | 'canceled' | 'neutral' | 'violet' | 'blue' | 'deleted' | 'past_due';

const variantMap: Record<BadgeVariant, string> = {
  active:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  trial:     'bg-amber-50 text-amber-700 border-amber-200',
  suspended: 'bg-orange-50 text-orange-700 border-orange-200',
  blocked:   'bg-red-50 text-red-700 border-red-200',
  canceled:  'bg-slate-100 text-slate-600 border-slate-200',
  deleted:   'bg-red-50 text-red-600 border-red-200 line-through decoration-red-400',
  past_due:  'bg-amber-50 text-amber-700 border-amber-200',
  neutral:   'bg-slate-100 text-slate-600 border-slate-200',
  violet:    'bg-indigo-50 text-indigo-700 border-indigo-200',
  blue:      'bg-blue-50 text-blue-700 border-blue-200',
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
