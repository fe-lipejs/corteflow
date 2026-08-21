import { Clock, Tag, Edit, Trash2, ImageOff, Home, Store, MapPin } from 'lucide-react';
import type { Service } from '../../../hooks/useServices';
import { useTheme } from '../../../contexts/ThemeContext';

const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });

interface Props {
  service: Service;
  onEdit: (s: Service) => void;
  onDelete: (s: Service) => void;
}

export default function ServiceCard({ service: s, onEdit, onDelete }: Props) {
  const { theme } = useTheme();
  const accent = s.color || theme.accent;
  const initials = s.name.substring(0, 2).toUpperCase();

  return (
    <div className="rounded-2xl border shadow-xl flex flex-col overflow-hidden transition-all duration-300 hover:-translate-y-1 glass-card group" style={{ borderColor: theme.border }}>
      {/* Top accent bar */}
      <div className="h-1 w-full flex-shrink-0" style={{ background: `linear-gradient(90deg, ${accent}, ${accent}60)` }} />

      {/* Image / Initials */}
      <div className="relative h-36 flex items-center justify-center flex-shrink-0" style={{ background: theme.inputBg }}>
        {s.photo_url ? (
          <img src={s.photo_url} alt={s.name} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-bold font-serif" style={{ background: `${accent}20`, color: accent }}>
              {initials}
            </div>
            <span className="text-[10px] flex items-center gap-1" style={{ color: theme.textSecondary }}><ImageOff className="w-3 h-3" /> Sem foto</span>
          </div>
        )}
        {/* Category badge */}
        {s.category && (
          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold border backdrop-blur-sm" style={{ borderColor: theme.border, background: theme.bgOverlay, color: theme.textPrimary }}>
            {s.category}
          </span>
        )}
        {/* Status badge */}
        <span className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold border ${s.active ? 'border-[#4ade80]/30 bg-[#4ade80]/10 text-[#4ade80]' : 'border-[#f87171]/30 bg-[#f87171]/10 text-[#f87171]'}`}>
          {s.active ? 'Ativo' : 'Inativo'}
        </span>
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-bold text-base leading-tight mb-1" style={{ color: theme.textPrimary }}>{s.name}</h3>
        {s.description && <p className="text-xs mb-3 line-clamp-2" style={{ color: theme.textSecondary }}>{s.description}</p>}

        {/* Price row */}
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-lg font-bold" style={{ color: accent }}>{fmt.format(s.price)}</span>
          {(s as any).original_price && (
            <span className="text-xs line-through" style={{ color: theme.textSecondary }}>{fmt.format((s as any).original_price)}</span>
          )}
        </div>

        {/* Duration + Buffer */}
        <div className="flex items-center gap-4 text-xs mb-3" style={{ color: theme.textSecondary }}>
          <div className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {s.duration_minutes} min
          </div>
          {s.buffer_minutes > 0 && (
            <div className="flex items-center gap-1 opacity-70">
              <span className="text-[10px]">+{s.buffer_minutes} min buffer</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs mb-3 font-medium">
          {s.service_mode === 'home' ? (
            <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
              <Home className="w-3 h-3" /> À Domicílio
            </div>
          ) : s.service_mode === 'both' ? (
            <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md">
              <MapPin className="w-3 h-3" /> Híbrido
            </div>
          ) : (
            <div className="flex items-center gap-1 text-zinc-600 dark:text-zinc-400 bg-zinc-500/10 px-2 py-0.5 rounded-md">
              <Store className="w-3 h-3" /> No Local
            </div>
          )}
        </div>

        {/* Tags */}
        {s.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {s.tags.slice(0, 3).map(t => (
              <span key={t} className="flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded border" style={{ borderColor: theme.border, color: theme.textSecondary }}>
                <Tag className="w-2.5 h-2.5" />{t}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto" />

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2 pt-3 border-t mt-3" style={{ borderColor: theme.border }}>
          <button
            onClick={() => onEdit(s)}
            className="flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all hover:bg-[var(--theme-bg-hover)]"
            style={{ color: theme.textSecondary }}
          >
            <Edit className="w-3.5 h-3.5" /> Editar
          </button>
          <button
            onClick={() => onDelete(s)}
            className="flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all hover:bg-red-500/10"
            style={{ color: theme.error }}
          >
            <Trash2 className="w-3.5 h-3.5" /> Excluir
          </button>
        </div>
      </div>
    </div>
  );
}
