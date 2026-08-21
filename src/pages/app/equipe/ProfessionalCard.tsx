import { useState } from 'react';
import { Edit, Trash2, Calendar, AtSign, Phone, MoreVertical } from 'lucide-react';
import type { Professional } from '../../../types/database';
import { useTheme } from '../../../contexts/ThemeContext';

const STATUS_CONFIG: Record<Professional['status'], { label: string; bg: string; text: string; dot: string }> = {
  active:   { label: 'Ativo',     bg: '#16a34a10', text: '#4ade80', dot: '#4ade80' },
  vacation: { label: 'Férias',    bg: '#ca8a0410', text: '#facc15', dot: '#facc15' },
  leave:    { label: 'Afastado',  bg: '#ea580c10', text: '#fb923c', dot: '#fb923c' },
  inactive: { label: 'Inativo',   bg: '#ef444410', text: '#f87171', dot: '#f87171' },
};

interface Props {
  professional: Professional;
  onEdit: (p: Professional) => void;
  onDelete: (p: Professional) => void;
  onViewAgenda: (p: Professional) => void;
}

export default function ProfessionalCard({ professional: p, onEdit, onDelete, onViewAgenda }: Props) {
  const { theme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const statusCfg = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.active;
  const initials = p.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  return (
    <div className="rounded-2xl border shadow-xl transition-all duration-300 hover:-translate-y-1.5 flex flex-col overflow-hidden glass-card" style={{ borderColor: theme.border }}>

      {/* Top accent bar using agenda color */}
      <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${p.agenda_color}, ${p.agenda_color}80)` }} />

      {/* Card Body */}
      <div className="p-5 flex-1 flex flex-col">
        {/* Header Row */}
        <div className="flex items-start justify-between mb-4">
          {/* Avatar */}
          <div className="relative">
            <div
              className="w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center shadow-lg border-2"
              style={{ borderColor: `${p.agenda_color}40`, background: `${p.agenda_color}15` }}
            >
              {p.photo_url ? (
                <img src={p.photo_url} alt={p.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl font-bold font-serif" style={{ color: p.agenda_color }}>{initials}</span>
              )}
            </div>
            {/* Status dot */}
            <div
              className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2"
              style={{ background: statusCfg.dot, borderColor: theme.cardBg }}
            />
          </div>

          {/* Menu */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen(prev => !prev)}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:bg-[var(--theme-bg-hover)]"
              style={{ color: theme.textSecondary }}
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-9 z-20 w-44 rounded-xl border shadow-2xl py-1 overflow-hidden" style={{ background: theme.cardBg, borderColor: theme.border }}>
                  <button
                    onClick={() => { setMenuOpen(false); onEdit(p); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-all hover:bg-[var(--theme-bg-hover)]"
                    style={{ color: theme.textSecondary }}
                  >
                    <Edit className="w-4 h-4" /> Editar
                  </button>
                  <button
                    onClick={() => { setMenuOpen(false); onViewAgenda(p); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-all hover:bg-[var(--theme-bg-hover)]"
                    style={{ color: theme.textSecondary }}
                  >
                    <Calendar className="w-4 h-4" /> Ver Agenda
                  </button>
                  <div className="h-px mx-3 my-1" style={{ background: theme.border }} />
                  <button
                    onClick={() => { setMenuOpen(false); onDelete(p); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-all"
                    style={{ color: theme.error, background: `${theme.error}10` }}
                  >
                    <Trash2 className="w-4 h-4" /> Excluir
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Name & Role */}
        <h3 className="font-bold text-base leading-tight mb-0.5" style={{ color: theme.textPrimary }}>{p.name}</h3>
        <p className="text-sm mb-3" style={{ color: theme.textSecondary }}>{p.role_title || 'Profissional'}</p>

        {/* Status badge */}
        <div className="flex items-center gap-2 mb-4">
          <span
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border"
            style={{ background: statusCfg.bg, color: statusCfg.text, borderColor: statusCfg.text + '30' }}
          >
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: statusCfg.dot }} />
            {statusCfg.label}
          </span>
        </div>

        {/* Specialties */}
        {p.specialties?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {p.specialties.slice(0, 3).map(s => (
              <span key={s} className="text-[10px] font-semibold px-2 py-1 rounded-full border" style={{ borderColor: theme.border, color: theme.textSecondary, background: theme.inputBg }}>
                {s}
              </span>
            ))}
            {p.specialties.length > 3 && (
              <span className="text-[10px] font-semibold px-2 py-1 rounded-full border" style={{ borderColor: theme.border, color: theme.textSecondary, background: theme.inputBg }}>
                +{p.specialties.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Contact */}
        <div className="mt-auto space-y-1.5">
          {p.phone && (
            <a href={`tel:${p.phone}`} className="flex items-center gap-2 text-xs transition-colors hover:opacity-80" style={{ color: theme.textSecondary }}>
              <Phone className="w-3.5 h-3.5" /> {p.phone}
            </a>
          )}
          {p.instagram && (
            <a href={`https://instagram.com/${p.instagram.replace('@', '')}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs transition-colors" style={{ color: theme.textSecondary }}>
              <AtSign className="w-3.5 h-3.5" /> <span className="hover:underline" style={{ color: theme.accent }}>{p.instagram}</span>
            </a>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="grid grid-cols-2 border-t" style={{ borderColor: theme.border }}>
        <button
          onClick={() => onEdit(p)}
          className="flex items-center justify-center gap-2 py-3 text-xs font-semibold transition-all hover:bg-[var(--theme-bg-hover)]"
          style={{ color: theme.textSecondary }}
        >
          <Edit className="w-3.5 h-3.5" /> Editar
        </button>
        <button
          onClick={() => onViewAgenda(p)}
          className="flex items-center justify-center gap-2 py-3 text-xs font-semibold border-l transition-all hover:bg-[var(--theme-bg-hover)]"
          style={{ borderColor: theme.border, color: p.agenda_color }}
        >
          <Calendar className="w-3.5 h-3.5" /> Agenda
        </button>
      </div>
    </div>
  );
}

