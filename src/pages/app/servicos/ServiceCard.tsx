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
  const accent = theme.accent;
  const initials = s.name.substring(0, 2).toUpperCase();

  const isLight =
    theme.id === 'elegant' ||
    (theme.bg && (theme.bg.toLowerCase().startsWith('#f') || theme.bg.toLowerCase().startsWith('#fff')));

  return (
    <div
      className="rounded-2xl border flex flex-col overflow-hidden transition-all duration-300 hover:-translate-y-1 group"
      style={{
        borderColor: isLight ? '#E2E8F0' : theme.border,
        background: isLight ? '#FFFFFF' : theme.cardBg,
        boxShadow: isLight
          ? '0 2px 8px -1px rgba(0, 0, 0, 0.08), 0 1px 3px -1px rgba(0, 0, 0, 0.04)'
          : '0 10px 25px -5px rgba(0, 0, 0, 0.45)',
      }}
    >
      {/* Top accent bar */}
      <div className="h-1 w-full flex-shrink-0" style={{ background: `linear-gradient(90deg, ${accent}, ${accent}60)` }} />

      {/* Image / Initials */}
      <div
        className="relative h-36 flex items-center justify-center flex-shrink-0 border-b"
        style={{
          background: isLight ? '#F8FAFC' : (theme.inputBg || '#18181b'),
          borderColor: isLight ? '#F1F5F9' : 'rgba(255, 255, 255, 0.05)',
        }}
      >
        {s.photo_url ? (
          <img
            src={s.photo_url}
            alt={s.name}
            className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
          />
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-bold font-serif shadow-sm"
              style={{ background: `${accent}20`, color: accent }}
            >
              {initials}
            </div>
            <span
              className="text-[10px] flex items-center gap-1 font-medium"
              style={{ color: isLight ? '#64748B' : theme.textSecondary }}
            >
              <ImageOff className="w-3 h-3" /> Sem foto
            </span>
          </div>
        )}

        {/* Category badge - High Contrast */}
        {s.category && (
          <span
            className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide border shadow-sm backdrop-blur-md"
            style={{
              background: isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(15, 23, 42, 0.9)',
              color: isLight ? '#0F172A' : '#F8FAFC',
              borderColor: isLight ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.2)',
            }}
          >
            {s.category}
          </span>
        )}

        {/* Status badge - WCAG AAA Compliant */}
        <span
          className="absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide border shadow-sm backdrop-blur-md"
          style={{
            background: s.active
              ? (isLight ? '#DCFCE7' : 'rgba(6, 78, 59, 0.8)')
              : (isLight ? '#FEE2E2' : 'rgba(136, 19, 55, 0.8)'),
            color: s.active
              ? (isLight ? '#166534' : '#86EFAC')
              : (isLight ? '#991B1B' : '#FCA5A5'),
            borderColor: s.active
              ? (isLight ? '#86EFAC' : 'rgba(52, 211, 153, 0.4)')
              : (isLight ? '#FCA5A5' : 'rgba(251, 113, 133, 0.4)'),
          }}
        >
          {s.active ? 'Ativo' : 'Inativo'}
        </span>
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col flex-1">
        <h3
          className="font-bold text-base leading-tight mb-1"
          style={{ color: isLight ? '#0F172A' : theme.textPrimary }}
        >
          {s.name}
        </h3>

        {s.description && (
          <p
            className="text-xs mb-3 line-clamp-2 leading-relaxed"
            style={{ color: isLight ? '#475569' : theme.textSecondary }}
          >
            {s.description}
          </p>
        )}

        {/* Price row */}
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-xl font-bold tracking-tight" style={{ color: accent }}>
            {fmt.format(s.price)}
          </span>
          {(s as any).original_price && (
            <span
              className="text-xs line-through font-medium"
              style={{ color: isLight ? '#94A3B8' : theme.textMuted }}
            >
              {fmt.format((s as any).original_price)}
            </span>
          )}
        </div>

        {/* Duration + Buffer */}
        <div
          className="flex items-center gap-3 text-xs mb-3 font-semibold"
          style={{ color: isLight ? '#334155' : theme.textSecondary }}
        >
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 opacity-80" />
            <span>{s.duration_minutes} min</span>
          </div>
          {s.buffer_minutes > 0 && (
            <div className="flex items-center gap-1 opacity-80">
              <span className="text-[11px] font-normal">+{s.buffer_minutes} min buffer</span>
            </div>
          )}
        </div>

        {/* Mode badge */}
        <div className="flex items-center gap-2 text-xs mb-3 font-medium">
          {s.service_mode === 'home' ? (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border"
              style={{
                background: isLight ? '#ECFDF5' : 'rgba(6, 78, 59, 0.4)',
                color: isLight ? '#065F46' : '#6EE7B7',
                borderColor: isLight ? '#A7F3D0' : 'rgba(52, 211, 153, 0.3)',
              }}
            >
              <Home className="w-3 h-3" /> À Domicílio
            </div>
          ) : s.service_mode === 'both' ? (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border"
              style={{
                background: isLight ? '#EFF6FF' : 'rgba(30, 58, 138, 0.4)',
                color: isLight ? '#1E40AF' : '#93C5FD',
                borderColor: isLight ? '#BFDBFE' : 'rgba(96, 165, 250, 0.3)',
              }}
            >
              <MapPin className="w-3 h-3" /> Híbrido
            </div>
          ) : (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border"
              style={{
                background: isLight ? '#F1F5F9' : 'rgba(255, 255, 255, 0.08)',
                color: isLight ? '#334155' : '#E2E8F0',
                borderColor: isLight ? '#CBD5E1' : 'rgba(255, 255, 255, 0.12)',
              }}
            >
              <Store className="w-3 h-3" /> No Local
            </div>
          )}
        </div>

        {/* Tags */}
        {s.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {s.tags.slice(0, 3).map(t => (
              <span
                key={t}
                className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md border"
                style={{
                  background: isLight ? '#F8FAFC' : 'rgba(255, 255, 255, 0.04)',
                  borderColor: isLight ? '#E2E8F0' : theme.border,
                  color: isLight ? '#334155' : theme.textSecondary,
                }}
              >
                <Tag className="w-2.5 h-2.5 opacity-70" />{t}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto" />

        {/* Actions */}
        <div
          className="grid grid-cols-2 gap-2 pt-3 border-t mt-3"
          style={{ borderColor: isLight ? '#F1F5F9' : theme.border }}
        >
          <button
            onClick={() => onEdit(s)}
            className="flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer hover:opacity-90"
            style={{
              background: isLight ? '#F1F5F9' : 'rgba(255, 255, 255, 0.06)',
              color: isLight ? '#1E293B' : theme.textPrimary,
              border: isLight ? '1px solid #E2E8F0' : '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <Edit className="w-3.5 h-3.5" /> Editar
          </button>
          <button
            onClick={() => onDelete(s)}
            className="flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer hover:opacity-90"
            style={{
              background: isLight ? '#FEF2F2' : `${theme.error}15`,
              color: isLight ? '#B91C1C' : theme.error,
              border: isLight ? '1px solid #FECACA' : `1px solid ${theme.error}30`,
            }}
          >
            <Trash2 className="w-3.5 h-3.5" /> Excluir
          </button>
        </div>
      </div>
    </div>
  );
}
