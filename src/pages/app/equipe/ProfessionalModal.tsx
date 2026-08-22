import { useState, useRef } from 'react';
import { X, Upload, Plus, Trash2, Camera, CalendarClock, User, Clock, Scissors, Check, Loader2 } from 'lucide-react';
import { processFileIfHeic } from '../../../lib/imageHelper';
import type { Professional, ProfessionalWorkingHour, Service } from '../../../types/database';
import type { CreateProfessionalInput, UpdateProfessionalInput } from '../../../hooks/useProfessionals';
import { useTheme } from '../../../contexts/ThemeContext';
import { Modal } from '../../../components/ui/Modal';
import { normalizeBrazilianPhone, formatPhoneMask } from '../../../lib/phoneUtils';
import { usePermissionEngine } from '../../../hooks/usePermissionEngine';
import { Crown, Lock, Key, Shield, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../integrations/supabase/client';

// ─── Constants ────────────────────────────────────────────────────────────────
const ROLES = ['Barbeiro', 'Cabeleireiro', 'Manicure', 'Pedicure', 'Esteticista', 'Maquiador', 'Outro'];
const SPECIALTIES = [
  'Corte Masculino', 'Corte Feminino', 'Barba', 'Coloração', 'Luzes',
  'Progressiva', 'Escova', 'Manicure', 'Pedicure', 'Esmaltação',
  'Sobrancelha', 'Design de Sobrancelha', 'Extensão de Cílios', 'Maquiagem',
];
const STATUS_OPTS: { value: Professional['status']; label: string; color: string }[] = [
  { value: 'active', label: 'Ativo', color: '#4ade80' },
  { value: 'vacation', label: 'Férias', color: '#facc15' },
  { value: 'leave', label: 'Afastado', color: '#fb923c' },
  { value: 'inactive', label: 'Inativo', color: '#f87171' },
];
const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const COLOR_PALETTE = [
  '#C9963B', '#E8B960', '#D4927A', '#60a5fa', '#a78bfa',
  '#34d399', '#f87171', '#fb923c', '#f472b6', '#94a3b8',
];

// ─── Default working hours ────────────────────────────────────────────────────
const defaultHours = (): WorkingHourForm[] =>
  [0, 1, 2, 3, 4, 5, 6].map(d => ({
    weekday: d as ProfessionalWorkingHour['weekday'],
    is_working: d >= 1 && d <= 6,
    open_time: '09:00',
    close_time: '18:00',
    lunch_start: '12:00',
    lunch_end: '13:00',
  }));

// ─── Types ────────────────────────────────────────────────────────────────────
interface WorkingHourForm {
  weekday: ProfessionalWorkingHour['weekday'];
  is_working: boolean;
  open_time: string;
  close_time: string;
  lunch_start: string;
  lunch_end: string;
}

interface Props {
  professional?: Professional | null; // null = create mode
  services: Service[];
  tenantId: string;
  onClose: () => void;
  onCreate?: (input: CreateProfessionalInput) => Promise<void>;
  onUpdate?: (input: UpdateProfessionalInput) => Promise<void>;
  isLoading?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ProfessionalModal({ professional, services, onClose, onCreate, onUpdate, isLoading }: Props) {
  const { theme } = useTheme();
  const engine = usePermissionEngine();
  const navigate = useNavigate();
  const isEditing = !!professional;
  const [tab, setTab] = useState<'info' | 'hours' | 'services' | 'access'>('info');
  const fileRef = useRef<HTMLInputElement>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(professional?.photo_url ?? null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [photoSize, setPhotoSize] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState(professional?.name ?? '');
  const [roleTitle, setRoleTitle] = useState(professional?.role_title ?? 'Barbeiro');
  const [phone, setPhone] = useState(professional?.phone ?? '');
  const [email, setEmail] = useState(professional?.email ?? '');
  const [instagram, setInstagram] = useState(professional?.instagram ?? '');
  const [bio, setBio] = useState(professional?.bio ?? '');
  const [agendaColor, setAgendaColor] = useState(professional?.agenda_color ?? '#C9963B');
  const [status, setStatus] = useState<Professional['status']>(professional?.status ?? 'active');
  const [specialties, setSpecialties] = useState<string[]>(professional?.specialties ?? []);
  
  // Home Service Fields
  const [offersHomeService, setOffersHomeService] = useState<boolean>(professional?.offers_home_service ?? false);
  const [maxHomeDistanceKm, setMaxHomeDistanceKm] = useState<string>(String(professional?.max_home_distance_km ?? 10));
  const [homeFee, setHomeFee] = useState<string>(String(professional?.home_fee ?? 0));

  const [hours, setHours] = useState<WorkingHourForm[]>(() => {
    if (professional?.professional_working_hours?.length) {
      return professional.professional_working_hours
        .sort((a, b) => a.weekday - b.weekday)
        .map(h => ({
          weekday: h.weekday,
          is_working: h.is_working,
          open_time: h.open_time?.slice(0, 5) ?? '09:00',
          close_time: h.close_time?.slice(0, 5) ?? '18:00',
          lunch_start: h.lunch_start?.slice(0, 5) ?? '12:00',
          lunch_end: h.lunch_end?.slice(0, 5) ?? '13:00',
        }));
    }
    return defaultHours();
  });

  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(
    professional
      ? professional.professional_services?.map(s => s.service_id) ?? []
      : services.map(s => s.id) // Default to all services for new professionals
  );

  // ─── Professional Access State ───
  const [accessEnabled, setAccessEnabled] = useState(!!professional?.auth_user_id);
  const [accessPermissions, setAccessPermissions] = useState<Record<string, boolean>>(
    (professional?.permissions as Record<string, boolean>) ?? {
      view_own_schedule: true,
      edit_own_schedule: false,
      view_financial: false,
      create_financial_entry: false,
      view_commission: true,
      view_clients: false,
      edit_own_availability: false
    }
  );
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [isManagingAccess, setIsManagingAccess] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Nome é obrigatório.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const buildHoursPayload = (): WorkingHourForm[] => hours;

  const handleSubmit = async () => {
    if (!validate()) { setTab('info'); return; }

    const hoursPayload = buildHoursPayload().map(h => ({
      weekday: h.weekday,
      is_working: h.is_working,
      open_time: h.open_time ? `${h.open_time}:00` : null,
      close_time: h.close_time ? `${h.close_time}:00` : null,
      lunch_start: h.lunch_start ? `${h.lunch_start}:00` : null,
      lunch_end: h.lunch_end ? `${h.lunch_end}:00` : null,
    }));

    if (isEditing && onUpdate) {
      await onUpdate({
        id: professional!.id,
        name,
        role_title: roleTitle,
        phone: phone || undefined,
        email: email || undefined,
        instagram: instagram || undefined,
        bio: bio || undefined,
        specialties,
        agenda_color: agendaColor,
        status,
        photoFile: photoFile ?? undefined,
        currentPhotoUrl: professional?.photo_url,
        workingHours: hoursPayload as any,
        serviceIds: selectedServiceIds,
        offers_home_service: offersHomeService,
        max_home_distance_km: Number(maxHomeDistanceKm),
        home_fee: Number(homeFee) || 0,
      });
    } else if (!isEditing && onCreate) {
      await onCreate({
        name,
        role_title: roleTitle,
        phone: phone || undefined,
        email: email || undefined,
        instagram: instagram || undefined,
        bio: bio || undefined,
        specialties,
        agenda_color: agendaColor,
        status,
        photoFile: photoFile ?? undefined,
        workingHours: hoursPayload as any,
        serviceIds: selectedServiceIds,
        offers_home_service: offersHomeService,
        max_home_distance_km: Number(maxHomeDistanceKm),
        home_fee: Number(homeFee) || 0,
      });
    }
  };

  const formatSize = (bytes: number) => {
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    let file = e.target.files?.[0];
    if (file) {
      setIsProcessingPhoto(true);
      try {
        file = await processFileIfHeic(file);
        setPhotoFile(file);
        setPhotoPreview(URL.createObjectURL(file));
        setPhotoSize(formatSize(file.size));
      } finally {
        setIsProcessingPhoto(false);
      }
    }
  };

  const toggleSpecialty = (s: string) => {
    setSpecialties(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  const toggleService = (sid: string) => {
    setSelectedServiceIds(prev => prev.includes(sid) ? prev.filter(x => x !== sid) : [...prev, sid]);
  };

  const updateHour = (weekday: number, field: keyof WorkingHourForm, value: string | boolean) => {
    setHours(prev => prev.map(h => h.weekday === weekday ? { ...h, [field]: value } : h));
  };

  const tabs = [
    { id: 'info', label: 'Dados', icon: User },
    { id: 'hours', label: 'Jornada', icon: Clock },
    { id: 'services', label: 'Serviços', icon: Scissors },
    { id: 'access', label: 'Acesso', icon: Lock },
  ] as const;

  const handleCreateAccess = async () => {
    if (!professional) return;
    setIsManagingAccess(true);
    setAccessError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-professional-access`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          professional_id: professional.id,
          email: email,
          permissions: accessPermissions
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao criar acesso');
      setTempPassword(data.tempPassword);
      setAccessEnabled(true);
    } catch (err: any) {
      setAccessError(err.message);
    } finally {
      setIsManagingAccess(false);
    }
  };

  const handleResetPassword = async () => {
    if (!professional) return;
    setIsManagingAccess(true);
    setAccessError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reset-professional-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          professional_id: professional.id
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao resetar senha');
      setTempPassword(data.tempPassword);
    } catch (err: any) {
      setAccessError(err.message);
    } finally {
      setIsManagingAccess(false);
    }
  };

  const handleToggleAccess = async (enable: boolean) => {
    if (!professional) return;
    setIsManagingAccess(true);
    setAccessError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/toggle-professional-access`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          professional_id: professional.id,
          action: enable ? 'enable' : 'disable'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao alterar acesso');
      // Apenas atualizar UI local
      window.location.reload(); // Simplificação para garantir sincronia do active
    } catch (err: any) {
      setAccessError(err.message);
      setIsManagingAccess(false);
    }
  };

  const footerContent = (
    <div className="flex w-full gap-3">
      <button onClick={onClose} className="flex-1 py-3 px-2 rounded-xl font-semibold text-sm transition-all text-center" style={{ background: theme.inputBg, color: theme.textPrimary }}>
        Cancelar
      </button>
      <button
        onClick={handleSubmit}
        disabled={isLoading}
        className="flex-1 py-3 px-2 rounded-xl font-bold text-sm transition-all shadow-[0_0_20px_rgba(201,150,59,0.2)] hover:shadow-[0_0_30px_rgba(201,150,59,0.4)] disabled:opacity-50 flex items-center justify-center gap-2 text-center"
        style={{ background: theme.accentGradient, color: theme.btnPrimaryText, boxShadow: theme.shadowAccent }}
      >
        {isLoading ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> <span className="hidden sm:inline">Salvando...</span></>
        ) : (
          isEditing ? 'Salvar Alterações' : 'Criar Profissional'
        )}
      </button>
    </div>
  );

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={isEditing ? 'Editar Profissional' : 'Novo Profissional'}
      subtitle={isEditing ? `Editando ${professional?.name}` : 'Preencha os dados abaixo'}
      maxWidth="2xl"
      footer={footerContent}
    >
      <div className="flex flex-col space-y-5">
        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl shrink-0 overflow-x-auto no-scrollbar scroll-smooth" style={{ background: theme.inputBg }}>
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 shrink-0 whitespace-nowrap min-w-[110px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all ${
                tab === t.id ? 'shadow-lg' : ''
              }`}
              style={tab === t.id ? { background: theme.accentGradient, color: theme.btnPrimaryText } : { color: theme.textSecondary }}
            >
              <t.icon className="w-4 h-4 shrink-0" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="space-y-5">

          {/* ── TAB: INFO ── */}
          {tab === 'info' && (
            <>
              {/* Photo upload */}
              <div className="flex items-center gap-5">
                <div className="relative shrink-0">
                  <div
                    onClick={() => !isProcessingPhoto && fileRef.current?.click()}
                    className="w-24 h-24 rounded-2xl border-2 border-dashed cursor-pointer overflow-hidden flex items-center justify-center transition-colors relative"
                    style={{ borderColor: theme.border, background: theme.inputBg }}
                  >
                    {isProcessingPhoto ? (
                      <div className="text-center flex flex-col items-center">
                        <Loader2 className="w-6 h-6 animate-spin mb-1" style={{ color: theme.accent }} />
                        <span className="text-[9px] font-bold" style={{ color: theme.accent }}>LENDO...</span>
                      </div>
                    ) : photoPreview ? (
                      <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center">
                        <Upload className="w-6 h-6 mx-auto mb-1" style={{ color: theme.textSecondary }} />
                        <span className="text-[10px]" style={{ color: theme.textSecondary }}>Foto</span>
                      </div>
                    )}
                    {photoSize && !isProcessingPhoto && (
                      <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] px-1 py-0.5 rounded font-medium backdrop-blur-sm">
                        {photoSize}
                      </div>
                    )}
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                </div>
                <div className="flex-1 space-y-3">
                  <div>
                    <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: theme.textSecondary }}>Nome Completo *</label>
                    <input
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none themed-input"
                      style={{ borderColor: errors.name ? theme.error : theme.border, background: theme.inputBg, color: theme.textPrimary }}
                      placeholder="Ex: João da Silva"
                    />
                    {errors.name && <p className="text-xs mt-1" style={{ color: theme.error }}>{errors.name}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: theme.textSecondary }}>Cargo</label>
                    <select
                      value={roleTitle}
                      onChange={e => setRoleTitle(e.target.value)}
                      className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none themed-input"
                      style={{ borderColor: theme.border, background: theme.inputBg, color: theme.textPrimary }}
                    >
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Contact */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: theme.textSecondary }}>Telefone</label>
                  <input 
                    value={phone} 
                    onChange={e => setPhone(formatPhoneMask(e.target.value))} 
                    className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none themed-input" 
                    style={{ borderColor: errors.phone ? theme.error : theme.border, background: theme.inputBg, color: theme.textPrimary }} 
                    placeholder="(11) 99999-9999" 
                  />
                  {errors.phone && <p className="text-xs mt-1" style={{ color: theme.error }}>{errors.phone}</p>}
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: theme.textSecondary }}>Instagram</label>
                  <input value={instagram} onChange={e => setInstagram(e.target.value)} className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none themed-input" style={{ borderColor: theme.border, background: theme.inputBg, color: theme.textPrimary }} placeholder="@seu_perfil" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: theme.textSecondary }}>E-mail (opcional)</label>
                  <input value={email} onChange={e => setEmail(e.target.value)} className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none themed-input" style={{ borderColor: theme.border, background: theme.inputBg, color: theme.textPrimary }} placeholder="joao@exemplo.com" />
                </div>
              </div>

              {/* Bio */}
              <div>
                <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: theme.textSecondary }}>Biografia</label>
                <textarea
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  rows={3}
                  className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none resize-none themed-input"
                  style={{ borderColor: theme.border, background: theme.inputBg, color: theme.textPrimary }}
                  placeholder="Especialidades e experiência do profissional..."
                />
              </div>

              {/* Specialties */}
              <div>
                <label className="block text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: theme.textSecondary }}>Especialidades</label>
                <div className="flex flex-wrap gap-2">
                  {SPECIALTIES.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleSpecialty(s)}
                      className="px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
                      style={specialties.includes(s) 
                        ? { background: theme.accentGradient, color: theme.btnPrimaryText, borderColor: theme.accent } 
                        : { background: theme.inputBg, color: theme.textSecondary, borderColor: theme.border }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Atendimento a Domicílio (Professional override) */}
              <div className="rounded-xl p-5" style={{ background: theme.cardBg, border: `1px solid ${theme.border}` }}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="font-bold text-sm" style={{ color: theme.textPrimary }}>Atendimento a Domicílio</h4>
                    <p className="text-xs" style={{ color: theme.textMuted }}>Este profissional faz atendimento na casa do cliente?</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOffersHomeService(!offersHomeService)}
                    className="relative w-12 h-6 rounded-full transition-all shrink-0"
                    style={{ background: offersHomeService ? theme.accent : theme.border }}
                  >
                    <span
                      className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-sm"
                      style={{ left: offersHomeService ? '26px' : '4px' }}
                    />
                  </button>
                </div>

                {offersHomeService && (
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t" style={{ borderColor: theme.border }}>
                    <div>
                      <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: theme.textSecondary }}>Limite Máximo (km)</label>
                      <input 
                        type="number" 
                        min="1" 
                        value={maxHomeDistanceKm} 
                        onChange={e => setMaxHomeDistanceKm(e.target.value)} 
                        className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none themed-input" 
                        style={{ borderColor: theme.border, background: theme.inputBg, color: theme.textPrimary }} 
                        placeholder="Ex: 10" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: theme.textSecondary }}>Taxa Extra (R$)</label>
                      <input 
                        type="number" 
                        min="0" step="0.50" 
                        value={homeFee} 
                        onChange={e => setHomeFee(e.target.value)} 
                        className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none themed-input" 
                        style={{ borderColor: theme.border, background: theme.inputBg, color: theme.textPrimary }} 
                        placeholder="Ex: 0.00" 
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Agenda color + Status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: theme.textSecondary }}>Cor na Agenda</label>
                  <div className="flex flex-wrap gap-2">
                    {COLOR_PALETTE.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setAgendaColor(c)}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${agendaColor === c ? 'border-white scale-110' : 'border-transparent'}`}
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: theme.textSecondary }}>Status</label>
                  <div className="space-y-1.5">
                    {STATUS_OPTS.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setStatus(opt.value)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all"
                        style={{ 
                          background: status === opt.value ? `${opt.color}20` : theme.inputBg,
                          borderColor: status === opt.value ? opt.color : theme.border,
                        }}
                      >
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: opt.color }} />
                        <span style={{ color: status === opt.value ? opt.color : theme.textSecondary }}>{opt.label}</span>
                        {status === opt.value && <Check className="w-3.5 h-3.5 ml-auto" style={{ color: opt.color }} />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── TAB: WORKING HOURS ── */}
          {tab === 'hours' && (
            <div className="relative min-h-[350px]">
              {!engine.hasPermission('equipe.editar_horarios') ? (
                <div className="relative w-full h-full min-h-[350px]">
                  {/* Blurred Background Teaser */}
                  <div className="filter blur-[4px] opacity-40 pointer-events-none select-none space-y-3">
                    <p className="text-xs" style={{ color: theme.textSecondary }}>Configure a jornada de trabalho individual deste profissional.</p>
                    {hours.slice(0, 3).map(h => (
                      <div key={h.weekday} className="rounded-2xl border p-4" style={{ borderColor: theme.border, background: theme.inputBg }}>
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-6 rounded-full relative" style={{ background: theme.accent }} />
                          <span className="font-bold text-sm" style={{ color: theme.textPrimary }}>{WEEKDAYS[h.weekday]}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Lock Overlay */}
                  <div className="absolute inset-0 z-20 flex items-center justify-center p-4">
                    <div className="border rounded-3xl p-6 max-w-xs w-full text-center shadow-[0_0_80px_rgba(0,0,0,0.5)] ring-1 ring-white/10 glass-card animate-scale-in" style={{ borderColor: theme.border, background: theme.cardBg }}>
                      <div className="relative mb-4">
                        <div className="relative w-14 h-14 mx-auto bg-black border rounded-full flex items-center justify-center" style={{ borderColor: theme.accent }}>
                          <Crown className="w-7 h-7" style={{ color: theme.accent }} />
                          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 flex items-center justify-center" style={{ background: theme.cardBg, borderColor: theme.border }}>
                            <Lock className="w-3 h-3" style={{ color: theme.textSecondary }} />
                          </div>
                        </div>
                      </div>
                      <h4 className="font-bold text-base mb-1" style={{ color: theme.textPrimary }}>Jornada Personalizada</h4>
                      <p className="text-xs mb-4" style={{ color: theme.textSecondary }}>Ajustar horários individuais é exclusivo de planos superiores.</p>
                      <button
                        type="button"
                        onClick={() => navigate('/admin/assinatura')}
                        className="w-full py-2.5 px-4 rounded-xl font-bold text-xs transition-all shadow-lg"
                        style={{ background: theme.accentGradient, color: theme.btnPrimaryText }}
                      >
                        Ver planos
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs" style={{ color: theme.textSecondary }}>Configure a jornada de trabalho individual deste profissional.</p>
                  {hours.map(h => (
                    <div key={h.weekday} className="rounded-2xl border p-4" style={{ borderColor: theme.border, background: theme.inputBg }}>
                      <div className="flex items-center gap-3 mb-3">
                        {/* Toggle */}
                        <button
                          type="button"
                          onClick={() => updateHour(h.weekday, 'is_working', !h.is_working)}
                          className="w-10 h-6 rounded-full transition-all relative shrink-0"
                          style={{ background: h.is_working ? theme.accent : theme.border }}
                        >
                          <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${h.is_working ? 'left-5' : 'left-1'}`} />
                        </button>
                        <span className={`font-bold text-sm w-8`} style={{ color: h.is_working ? theme.textPrimary : theme.textSecondary }}>{WEEKDAYS[h.weekday]}</span>
                        {!h.is_working && <span className="text-xs italic" style={{ color: theme.textSecondary }}>Folga</span>}
                      </div>

                      {h.is_working && (
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <label className="font-bold uppercase tracking-wider block mb-1" style={{ color: theme.textSecondary }}>Início</label>
                            <input type="time" value={h.open_time} onChange={e => updateHour(h.weekday, 'open_time', e.target.value)}
                              className="w-full border rounded-lg px-3 py-2 focus:outline-none themed-input" style={{ borderColor: theme.border, background: theme.cardBg, color: theme.textPrimary }} />
                          </div>
                          <div>
                            <label className="font-bold uppercase tracking-wider block mb-1" style={{ color: theme.textSecondary }}>Fim</label>
                            <input type="time" value={h.close_time} onChange={e => updateHour(h.weekday, 'close_time', e.target.value)}
                              className="w-full border rounded-lg px-3 py-2 focus:outline-none themed-input" style={{ borderColor: theme.border, background: theme.cardBg, color: theme.textPrimary }} />
                          </div>
                          <div>
                            <label className="font-bold uppercase tracking-wider block mb-1" style={{ color: theme.textSecondary }}>Almoço início</label>
                            <input type="time" value={h.lunch_start} onChange={e => updateHour(h.weekday, 'lunch_start', e.target.value)}
                              className="w-full border rounded-lg px-3 py-2 focus:outline-none themed-input" style={{ borderColor: theme.border, background: theme.cardBg, color: theme.textPrimary }} />
                          </div>
                          <div>
                            <label className="font-bold uppercase tracking-wider block mb-1" style={{ color: theme.textSecondary }}>Almoço fim</label>
                            <input type="time" value={h.lunch_end} onChange={e => updateHour(h.weekday, 'lunch_end', e.target.value)}
                              className="w-full border rounded-lg px-3 py-2 focus:outline-none themed-input" style={{ borderColor: theme.border, background: theme.cardBg, color: theme.textPrimary }} />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── TAB: SERVICES ── */}
          {tab === 'services' && (
            <div className="space-y-3">
              <p className="text-xs" style={{ color: theme.textSecondary }}>Selecione os serviços que este profissional pode realizar.</p>
              {services.length === 0 && (
                <div className="text-center py-12" style={{ color: theme.textSecondary }}>
                  <Scissors className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Nenhum serviço cadastrado ainda.</p>
                  <p className="text-xs mt-1">Vá em <strong>Serviços</strong> para adicionar.</p>
                </div>
              )}
              {services.map(svc => (
                <div
                  key={svc.id}
                  onClick={() => toggleService(svc.id)}
                  className="flex items-center gap-4 p-4 rounded-2xl border cursor-pointer transition-all"
                  style={selectedServiceIds.includes(svc.id) 
                    ? { borderColor: theme.accent, background: `${theme.accent}10` }
                    : { borderColor: theme.border, background: theme.inputBg }
                  }
                >
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ background: svc.color || theme.accent }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm" style={{ color: theme.textPrimary }}>{svc.name}</p>
                    <p className="text-xs" style={{ color: theme.textSecondary }}>{svc.duration_minutes} min · {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }).format(svc.price)}</p>
                  </div>
                  <div className="w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all"
                    style={selectedServiceIds.includes(svc.id) 
                      ? { borderColor: theme.accent, background: theme.accentGradient } 
                      : { borderColor: theme.border }
                    }>
                    {selectedServiceIds.includes(svc.id) && <Check className="w-3 h-3" style={{ color: theme.btnPrimaryText }} />}
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* ── TAB: ACCESS ── */}
          {tab === 'access' && (
            <div className="space-y-5">
              {!isEditing ? (
                <div className="p-6 text-center border rounded-xl" style={{ borderColor: theme.border, background: theme.bg }}>
                  <Shield className="w-10 h-10 mx-auto mb-3 opacity-50" style={{ color: theme.textSecondary }} />
                  <h3 className="font-bold text-sm" style={{ color: theme.textPrimary }}>Salve o profissional primeiro</h3>
                  <p className="text-xs mt-1" style={{ color: theme.textSecondary }}>Você precisa criar o cadastro deste profissional antes de poder gerar um acesso para ele.</p>
                </div>
              ) : (
                <>
                  <div className="p-4 rounded-xl border" style={{ borderColor: theme.border, background: theme.bg }}>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h3 className="font-bold text-sm flex items-center gap-2" style={{ color: theme.textPrimary }}>
                          <Key className="w-4 h-4" /> Acesso ao Sistema
                        </h3>
                        <p className="text-xs mt-0.5" style={{ color: theme.textSecondary }}>Permite que o profissional faça login com e-mail e senha.</p>
                      </div>
                      <div className="text-right">
                        {professional?.auth_user_id ? (
                          <span className={`text-xs px-2 py-1 rounded-full font-bold ${professional.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {professional.active ? 'ATIVO' : 'BLOQUEADO'}
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-1 rounded-full font-bold bg-gray-100 text-gray-600">SEM ACESSO</span>
                        )}
                      </div>
                    </div>

                    {accessError && (
                      <div className="mt-3 p-3 bg-red-50 text-red-600 text-xs rounded-lg border border-red-100 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0" /> {accessError}
                      </div>
                    )}

                    {!professional?.auth_user_id ? (
                      <div className="mt-4 pt-4 border-t" style={{ borderColor: theme.border }}>
                        <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: theme.textSecondary }}>E-mail de Login *</label>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full p-2.5 rounded-lg border text-sm focus:ring-2 outline-none mb-3"
                          style={{ borderColor: theme.border, background: theme.inputBg, color: theme.textPrimary }}
                          placeholder="profissional@email.com"
                        />
                        <button
                          type="button"
                          onClick={handleCreateAccess}
                          disabled={!email || isManagingAccess}
                          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-50"
                          style={{ background: theme.accent, color: theme.textInverse }}
                        >
                          {isManagingAccess ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar Acesso'}
                        </button>
                      </div>
                    ) : (
                      <div className="mt-4 pt-4 border-t flex gap-2" style={{ borderColor: theme.border }}>
                        <button
                          type="button"
                          onClick={handleResetPassword}
                          disabled={isManagingAccess}
                          className="flex-1 py-2 text-xs font-semibold rounded-lg border transition-opacity disabled:opacity-50"
                          style={{ borderColor: theme.border, color: theme.textPrimary }}
                        >
                          Redefinir Senha
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleAccess(!professional.active)}
                          disabled={isManagingAccess}
                          className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-opacity disabled:opacity-50 ${professional.active ? 'text-red-600 border-red-200 bg-red-50 hover:bg-red-100' : 'text-green-600 border-green-200 bg-green-50 hover:bg-green-100'}`}
                        >
                          {professional.active ? 'Bloquear Acesso' : 'Desbloquear Acesso'}
                        </button>
                      </div>
                    )}

                    {tempPassword && (
                      <div className="mt-4 p-4 rounded-lg bg-yellow-50 border border-yellow-200">
                        <p className="text-xs text-yellow-800 mb-1">Senha temporária gerada! Copie e envie para o profissional:</p>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 p-2 bg-white rounded text-sm font-mono text-center border border-yellow-200 select-all">{tempPassword}</code>
                        </div>
                        <p className="text-[10px] text-yellow-600 mt-2 text-center">Ele será obrigado a trocar no primeiro login.</p>
                      </div>
                    )}
                  </div>

                  <div className="p-4 rounded-xl border" style={{ borderColor: theme.border, background: theme.bg }}>
                    <h3 className="font-bold text-sm mb-3" style={{ color: theme.textPrimary }}>Permissões</h3>
                    
                    <div className="space-y-2">
                      {Object.entries({
                        view_own_schedule: 'Ver própria agenda',
                        edit_own_schedule: 'Editar própria agenda (criar agendamentos)',
                        view_financial: 'Ver próprio financeiro',
                        create_financial_entry: 'Lançar transações no financeiro',
                        view_commission: 'Ver própria comissão',
                        view_clients: 'Ver base de clientes',
                        edit_own_availability: 'Editar próprios horários de trabalho'
                      }).map(([key, label]) => (
                        <label key={key} className="flex items-start gap-3 p-2 hover:bg-black/5 rounded-lg cursor-pointer">
                          <input
                            type="checkbox"
                            checked={accessPermissions[key] || false}
                            onChange={(e) => {
                              const newPerms = { ...accessPermissions, [key]: e.target.checked };
                              setAccessPermissions(newPerms);
                              // Auto-save se já estiver criado
                              if (professional?.auth_user_id) {
                                supabase.from('professionals').update({ permissions: newPerms }).eq('id', professional.id).then();
                              }
                            }}
                            className="mt-0.5 rounded focus:ring-2 transition-all"
                            style={{ accentColor: theme.accent }}
                          />
                          <span className="text-sm select-none" style={{ color: theme.textPrimary }}>{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

