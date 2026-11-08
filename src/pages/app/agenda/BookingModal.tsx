import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, Check, Search, Clock, Calendar, Plus } from 'lucide-react';
import { format, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { supabase } from '../../../integrations/supabase/client';
import { useBookingsByDay, type CreateBookingInput } from '../../../hooks/useBookings';
import type { Service } from '../../../hooks/useServices';
import { useTheme } from '../../../contexts/ThemeContext';
import { generateAvailableSlots } from '../../../lib/availability';
import {
  buildHorizonDateList,
  CAROUSEL_LOAD_MORE_STEP,
  INITIAL_CAROUSEL_DAYS_CAP,
  isDateWithinBookingHorizon,
  sanitizeHexColor,
} from '../../../lib/bookingHorizon';
import {
  useTenantAvailabilityMeta,
  useTenantBookingHorizon,
  useTenantDayBlocks,
} from '../../../hooks/useBookingHorizon';
import { formatBrPhoneMask, validateBrPhone } from '../../../lib/phoneValidation';
import { useLockBodyScroll } from '../../../hooks/useLockBodyScroll';

interface Props {
  tenantId: string;
  services: Service[];
  professionals: any[];
  businessHours: any[];
  initialDate?: Date;
  onClose: () => void;
  onCreate: (input: CreateBookingInput) => Promise<void>;
  isLoading?: boolean;
}

const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });

export default function BookingModal({
  tenantId,
  services,
  professionals,
  businessHours,
  initialDate,
  onClose,
  onCreate,
  isLoading,
}: Props) {
  useLockBodyScroll(true);

  const { theme } = useTheme();
  const { maxAdvanceDays } = useTenantBookingHorizon(tenantId);
  const { data: availabilityMeta } = useTenantAvailabilityMeta(tenantId);

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedPro, setSelectedPro] = useState<any | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const today = startOfDay(new Date());
    if (!initialDate) return today;
    return isDateWithinBookingHorizon(initialDate, maxAdvanceDays) ? startOfDay(initialDate) : today;
  });
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [visibleDaysLimit, setVisibleDaysLimit] = useState(INITIAL_CAROUSEL_DAYS_CAP);

  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'local' | 'pix' | 'card'>('local');
  const [confirmationStatus, setConfirmationStatus] = useState<'confirmed' | 'pending'>('confirmed');
  const [searchingCustomers, setSearchingCustomers] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New Customer Form State
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [creatingCustomer, setCreatingCustomer] = useState(false);

  // Caso o limite carregue/atualize e a data inicial esteja fora do horizonte permitido, ajusta para hoje
  useEffect(() => {
    if (!isDateWithinBookingHorizon(selectedDate, maxAdvanceDays)) {
      setSelectedDate(startOfDay(new Date()));
      setSelectedTime(null);
    }
  }, [selectedDate, maxAdvanceDays]);

  const { data: dayBookings = [] } = useBookingsByDay(tenantId, selectedDate);
  const { data: dayBlocks = [] } = useTenantDayBlocks(tenantId, selectedDate);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Search customers
  useEffect(() => {
    if (customerSearch.length < 2) {
      setCustomerResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchingCustomers(true);
      const { data } = await supabase
        .from('customers')
        .select('id, name, phone')
        .eq('tenant_id', tenantId)
        .or(`name.ilike.%${customerSearch}%,phone.ilike.%${customerSearch}%`)
        .limit(8);
      setCustomerResults(data ?? []);
      setSearchingCustomers(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [customerSearch, tenantId]);

  const horizonData = useMemo(
    () =>
      buildHorizonDateList({
        maxAdvanceDays,
        visibleCount: visibleDaysLimit,
        selectedDate,
      }),
    [maxAdvanceDays, visibleDaysLimit, selectedDate]
  );

  const availableDays = horizonData.dates;

  const activeProfessionals = useMemo(() => {
    let list = professionals.filter((p) => p.active !== false && (!p.status || p.status === 'active'));
    const proServices = availabilityMeta?.professionalServices ?? [];
    if (selectedService && proServices.length > 0) {
      const allowedProIds = proServices
        .filter((ps: any) => ps.service_id === selectedService.id)
        .map((ps: any) => ps.professional_id);
      const proIdsWithAnyMapping = [...new Set(proServices.map((ps: any) => ps.professional_id))];
      list = list.filter((p: any) => {
        if (!proIdsWithAnyMapping.includes(p.id)) return true;
        return allowedProIds.includes(p.id);
      });
    }
    return list;
  }, [professionals, selectedService, availabilityMeta?.professionalServices]);

  // Se o profissional selecionado não executa o novo serviço escolhido, volta para "Qualquer profissional"
  useEffect(() => {
    if (selectedPro && !activeProfessionals.some((p) => p.id === selectedPro.id)) {
      setSelectedPro(null);
      setSelectedTime(null);
    }
  }, [selectedPro, activeProfessionals]);

  // Slots unificados via motor central generateAvailableSlots (respeita expediente, almoço, bloqueios, folgas e conflitos)
  const rawSlots = useMemo(() => {
    if (!selectedService) return [];
    if (!isDateWithinBookingHorizon(selectedDate, maxAdvanceDays)) return [];

    return generateAvailableSlots(
      selectedDate,
      selectedService,
      selectedPro ? selectedPro.id : 'any',
      activeProfessionals,
      services,
      businessHours,
      availabilityMeta?.professionalWorkingHours ?? [],
      dayBlocks,
      dayBookings,
      availabilityMeta?.professionalServices ?? [],
      [selectedService],
      'instore'
    );
  }, [
    selectedDate,
    selectedService,
    selectedPro,
    activeProfessionals,
    services,
    businessHours,
    availabilityMeta,
    dayBlocks,
    dayBookings,
    maxAdvanceDays,
  ]);

  const availableSlots = useMemo(
    () => rawSlots.filter((s) => s.available).map((s) => s.time),
    [rawSlots]
  );

  // Se o dono clicou num horário específico da grade (initialDate), pré-seleciona o slot daquela hora
  useEffect(() => {
    if (!initialDate || selectedTime || availableSlots.length === 0) return;
    const sameDay = format(initialDate, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
    if (!sameDay) return;
    const targetPrefix = `${String(initialDate.getHours()).padStart(2, '0')}:`;
    const match = availableSlots.find((s) => s.startsWith(targetPrefix));
    if (match) {
      setSelectedTime(match);
    }
  }, [initialDate, selectedDate, availableSlots, selectedTime]);

  const handleCreateCustomer = async () => {
    if (!newCustomerName.trim() || !newCustomerPhone.trim()) {
      setError('Preencha nome e telefone do cliente.');
      return;
    }

    const phoneValidation = validateBrPhone(newCustomerPhone);
    if (!phoneValidation.valid) {
      setError(phoneValidation.error || 'Informe um telefone válido com DDD. Ex: (27) 99999-9999');
      return;
    }

    setCreatingCustomer(true);
    setError(null);
    try {
      const { data, error: insertError } = await supabase
        .from('customers')
        .insert({
          tenant_id: tenantId,
          name: newCustomerName.trim(),
          phone: phoneValidation.digits,
        } as any)
        .select('*')
        .single();

      if (insertError) throw insertError;

      setSelectedCustomer(data);
      setIsCreatingCustomer(false);
      setNewCustomerName('');
      setNewCustomerPhone('');
    } catch (err: any) {
      setError(err.message || 'Erro ao criar cliente');
    } finally {
      setCreatingCustomer(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedCustomer || !selectedService || !selectedTime) {
      setError('Preencha todos os campos obrigatórios.');
      return;
    }
    if (!isDateWithinBookingHorizon(selectedDate, maxAdvanceDays)) {
      setError('A data selecionada está fora da antecedência máxima configurada.');
      return;
    }

    setError(null);
    try {
      const [h, m] = selectedTime.split(':').map(Number);
      const scheduledAt = new Date(selectedDate);
      scheduledAt.setHours(h, m, 0, 0);

      let resolvedPro = selectedPro;
      if (!resolvedPro) {
        const chosenSlot = rawSlots.find((s) => s.time === selectedTime && s.available);
        if (chosenSlot?.availableProIds?.length) {
          const pickedId = chosenSlot.availableProIds[0];
          resolvedPro = activeProfessionals.find((p) => p.id === pickedId) ?? null;
        } else if (activeProfessionals.length > 0) {
          resolvedPro = activeProfessionals[0];
        }
      }

      const safeProColor = sanitizeHexColor(resolvedPro?.agenda_color, theme.accent);

      await onCreate({
        customer_id: selectedCustomer.id,
        professional_id: resolvedPro?.id ?? null,
        service_id: selectedService.id,
        scheduled_at: scheduledAt.toISOString(),
        payment_mode: 'local',
        payment_method: paymentMethod,
        confirmation_status: confirmationStatus,
        booking_source: 'manual',
        amount_total: selectedService.price,
        duration_minutes: selectedService.duration_minutes,
        buffer_minutes: selectedService.buffer_minutes,
        pro_color: safeProColor,
        notes: notes.trim() || undefined,
      });
    } catch (err: any) {
      console.error('Erro ao criar agendamento:', err);
      const msg = err?.message || err?.error_description || 'Erro ao criar agendamento. Tente novamente.';
      setError(msg);
    }
  };

  const STEPS = ['Serviço', 'Profissional', 'Horário', 'Confirmar'];

  return createPortal(
    <div className="fixed inset-x-0 top-16 bottom-0 md:inset-0 z-[100] flex items-end md:items-center justify-center pt-6 md:p-4 bg-black/55 backdrop-blur-[2px]">
      <div
        className="relative w-full max-w-lg md:rounded-3xl rounded-t-[28px] border shadow-2xl flex flex-col h-full max-h-full md:h-auto md:max-h-[90dvh] overflow-hidden"
        style={{
          background: 'var(--theme-card-bg)',
          borderColor: 'var(--theme-border)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {/* Handle bar (mobile) */}
        <div className="flex justify-center pt-3 pb-1 md:hidden shrink-0">
          <div className="w-12 h-1.5 rounded-full opacity-45" style={{ background: 'var(--theme-text-secondary)' }} />
        </div>

        {/* Header */}
        <div className="px-6 py-4 sm:p-6 sm:pb-5 shrink-0 border-b" style={{ borderColor: 'var(--theme-border)' }}>
          <div className="flex justify-between items-start mb-3 sm:mb-5">
            <div>
              <h2 className="font-serif text-xl sm:text-2xl font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                Novo agendamento
              </h2>
              <p className="text-xs mt-0.5 sm:mt-1 font-medium opacity-70" style={{ color: 'var(--theme-text-secondary)' }}>
                Passo {step} de {STEPS.length} — {STEPS[step - 1]}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full flex items-center justify-center transition-colors hover:bg-black/10 shrink-0"
              style={{ color: 'var(--theme-text-secondary)' }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          {/* Step indicator */}
          <div className="flex items-center gap-2">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className="h-1 flex-1 rounded-full transition-all duration-300"
                style={{ background: i < step ? 'var(--theme-accent-gradient)' : 'var(--theme-border)' }}
              />
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto overscroll-contain flex-1 p-6">
          {/* Step 1: Service */}
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider mb-1 opacity-70" style={{ color: 'var(--theme-text-secondary)' }}>
                Escolha o serviço
              </p>
              {services
                .filter((s) => s.active)
                .map((svc) => {
                  const isSelected = selectedService?.id === svc.id;
                  const svcHex = sanitizeHexColor(svc.color, theme.accent);
                  return (
                    <div
                      key={svc.id}
                      onClick={() => {
                        setSelectedService(svc);
                        setSelectedTime(null);
                      }}
                      className="flex items-center gap-4 p-4 rounded-2xl border cursor-pointer transition-colors"
                      style={{
                        borderColor: isSelected ? 'var(--theme-accent)' : 'var(--theme-border)',
                        background: isSelected ? 'var(--theme-calendar-available-bg)' : 'var(--theme-bg-hover)',
                      }}
                    >
                      {svc.photo_url ? (
                        <img src={svc.photo_url} alt={svc.name} className="w-11 h-11 rounded-xl object-cover shrink-0" />
                      ) : (
                        <div
                          className="w-11 h-11 rounded-xl shrink-0 flex items-center justify-center"
                          style={{ background: `${svcHex}20` }}
                        >
                          <div className="w-3 h-3 rounded-full" style={{ background: svcHex }} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm" style={{ color: 'var(--theme-text-primary)' }}>
                          {svc.name}
                        </p>
                        <p className="text-xs mt-0.5 opacity-75" style={{ color: 'var(--theme-text-secondary)' }}>
                          {svc.duration_minutes} min {svc.buffer_minutes > 0 && `+ ${svc.buffer_minutes} min buffer`}
                        </p>
                      </div>
                      <p className="font-bold text-sm shrink-0" style={{ color: 'var(--theme-accent)' }}>
                        {fmt.format(svc.price)}
                      </p>
                      <div
                        className="w-5 h-5 rounded-full border flex items-center justify-center transition-colors shrink-0"
                        style={{
                          borderColor: isSelected ? 'transparent' : 'var(--theme-border)',
                          background: isSelected ? 'var(--theme-accent-gradient)' : 'transparent',
                        }}
                      >
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                    </div>
                  );
                })}
              {services.length === 0 && (
                <p className="text-center py-10 text-sm" style={{ color: 'var(--theme-text-secondary)' }}>
                  Nenhum serviço ativo. Cadastre serviços primeiro.
                </p>
              )}
            </div>
          )}

          {/* Step 2: Professional */}
          {step === 2 && (
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider mb-1 opacity-70" style={{ color: 'var(--theme-text-secondary)' }}>
                Escolha o profissional
              </p>
              {/* Any */}
              <div
                onClick={() => {
                  setSelectedPro(null);
                  setSelectedTime(null);
                }}
                className="flex items-center gap-4 p-4 rounded-2xl border cursor-pointer transition-colors"
                style={{
                  borderColor: selectedPro === null ? 'var(--theme-accent)' : 'var(--theme-border)',
                  background: selectedPro === null ? 'var(--theme-calendar-available-bg)' : 'var(--theme-bg-hover)',
                }}
              >
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                  style={{ background: 'var(--theme-border)', color: 'var(--theme-text-secondary)' }}
                >
                  ?
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm" style={{ color: 'var(--theme-text-primary)' }}>
                    Qualquer profissional
                  </p>
                  <p className="text-xs mt-0.5 opacity-75" style={{ color: 'var(--theme-text-secondary)' }}>
                    Primeiro horário disponível
                  </p>
                </div>
                {selectedPro === null && <Check className="w-4 h-4 shrink-0" style={{ color: 'var(--theme-accent)' }} />}
              </div>
              {activeProfessionals.map((pro) => {
                const isSelected = selectedPro?.id === pro.id;
                const proHex = sanitizeHexColor(pro.agenda_color, theme.accent);
                return (
                  <div
                    key={pro.id}
                    onClick={() => {
                      setSelectedPro(pro);
                      setSelectedTime(null);
                    }}
                    className="flex items-center gap-4 p-4 rounded-2xl border cursor-pointer transition-colors"
                    style={{
                      borderColor: isSelected ? 'var(--theme-accent)' : 'var(--theme-border)',
                      background: isSelected ? 'var(--theme-calendar-available-bg)' : 'var(--theme-bg-hover)',
                    }}
                  >
                    <div
                      className="w-11 h-11 rounded-full overflow-hidden flex items-center justify-center font-bold text-sm shrink-0"
                      style={{ background: `${proHex}20`, color: proHex }}
                    >
                      {pro.photo_url ? (
                        <img src={pro.photo_url} alt={pro.name} className="w-full h-full object-cover" />
                      ) : (
                        pro.name.substring(0, 2).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm" style={{ color: 'var(--theme-text-primary)' }}>
                        {pro.name}
                      </p>
                      <p className="text-xs mt-0.5 opacity-75" style={{ color: 'var(--theme-text-secondary)' }}>
                        {pro.role_title}
                      </p>
                    </div>
                    {isSelected && <Check className="w-4 h-4 shrink-0" style={{ color: 'var(--theme-accent)' }} />}
                  </div>
                );
              })}
            </div>
          )}

          {/* Step 3: Date + Time */}
          {step === 3 && (
            <div className="space-y-6">
              {/* Day picker */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <p className="text-xs font-bold uppercase tracking-wider opacity-70" style={{ color: 'var(--theme-text-secondary)' }}>
                    Escolha a data
                  </p>
                  {(maxAdvanceDays === null || maxAdvanceDays > 15) && (
                    <label
                      className="relative inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[11px] font-bold cursor-pointer"
                      style={{
                        borderColor: 'var(--theme-border)',
                        background: 'var(--theme-bg-hover)',
                        color: 'var(--theme-accent)',
                      }}
                    >
                      <Calendar className="w-3.5 h-3.5 shrink-0" />
                      <span>Escolher data</span>
                      <input
                        type="date"
                        min={horizonData.minDateISO}
                        max={horizonData.maxDateISO}
                        value={format(selectedDate, 'yyyy-MM-dd')}
                        onChange={(e) => {
                          if (!e.target.value) return;
                          const [yy, mm, dd] = e.target.value.split('-').map(Number);
                          const picked = startOfDay(new Date(yy, mm - 1, dd));
                          if (!isDateWithinBookingHorizon(picked, maxAdvanceDays)) return;
                          setSelectedDate(picked);
                          setSelectedTime(null);
                        }}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                    </label>
                  )}
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {availableDays.map((day) => {
                    const dow = day.getDay();
                    const dayHours = businessHours.find((h: any) => h.weekday === dow);
                    const isOpen = dayHours?.is_open;
                    const isSelected = format(day, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
                    return (
                      <button
                        key={day.toISOString()}
                        type="button"
                        onClick={() => {
                          if (isOpen) {
                            setSelectedDate(day);
                            setSelectedTime(null);
                          }
                        }}
                        disabled={!isOpen}
                        className="flex flex-col items-center gap-0.5 px-3 py-3 rounded-2xl border text-xs font-bold shrink-0 min-w-[54px] transition-colors cursor-pointer disabled:cursor-not-allowed"
                        style={{
                          borderColor: isSelected ? 'var(--theme-accent)' : 'var(--theme-border)',
                          background: isSelected
                            ? 'var(--theme-accent-gradient)'
                            : isOpen
                              ? 'var(--theme-bg-hover)'
                              : 'transparent',
                          color: isSelected
                            ? 'var(--theme-btn-primary-text)'
                            : isOpen
                              ? 'var(--theme-text-primary)'
                              : 'var(--theme-text-secondary)',
                          opacity: isOpen ? 1 : 0.4,
                        }}
                      >
                        <span className="text-[10px] opacity-70 font-semibold">{format(day, 'EEE', { locale: ptBR })}</span>
                        <span className="text-base leading-tight">{format(day, 'd')}</span>
                        <span className="text-[9px] uppercase opacity-70">{format(day, 'MMM', { locale: ptBR })}</span>
                        {!isOpen && <span className="text-[8px] opacity-70">Fechado</span>}
                      </button>
                    );
                  })}
                  {horizonData.hasMore && (
                    <button
                      type="button"
                      onClick={() => setVisibleDaysLimit((prev) => prev + CAROUSEL_LOAD_MORE_STEP)}
                      className="flex flex-col items-center justify-center gap-1 px-3.5 py-3 rounded-2xl border text-xs font-bold shrink-0 transition-colors cursor-pointer"
                      style={{
                        borderColor: 'var(--theme-border)',
                        background: 'var(--theme-bg-hover)',
                        color: 'var(--theme-accent)',
                      }}
                    >
                      <Plus className="w-4 h-4" />
                      <span className="text-[9px] uppercase whitespace-nowrap">Mais datas</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Time slots */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider mb-3 opacity-70" style={{ color: 'var(--theme-text-secondary)' }}>
                  Escolha o horário em {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
                </p>
                {availableSlots.length === 0 ? (
                  <div
                    className="text-center py-10 px-4 rounded-2xl"
                    style={{ background: 'var(--theme-bg-hover)', color: 'var(--theme-text-secondary)' }}
                  >
                    <Clock className="w-7 h-7 mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-semibold mb-1">Nenhum horário disponível.</p>
                    <p className="text-xs opacity-70">
                      Os horários desta data já passaram, estão bloqueados ou lotados. Escolha outro dia.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-2.5">
                    {availableSlots.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setSelectedTime(slot)}
                        className="py-3 rounded-xl text-sm font-bold border transition-colors cursor-pointer"
                        style={{
                          borderColor: selectedTime === slot ? 'transparent' : 'var(--theme-border)',
                          background: selectedTime === slot ? 'var(--theme-accent-gradient)' : 'var(--theme-bg-hover)',
                          color: selectedTime === slot ? 'var(--theme-btn-primary-text)' : 'var(--theme-text-primary)',
                        }}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Confirm */}
          {step === 4 && (
            <div className="space-y-6">
              {/* Customer search / create */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-bold uppercase tracking-wider opacity-70" style={{ color: 'var(--theme-text-secondary)' }}>
                    Cliente *
                  </label>
                  {!selectedCustomer && (
                    <button
                      onClick={() => setIsCreatingCustomer(!isCreatingCustomer)}
                      className="text-xs font-bold"
                      style={{ color: 'var(--theme-accent)' }}
                    >
                      {isCreatingCustomer ? 'Buscar existente' : '+ Novo cliente'}
                    </button>
                  )}
                </div>

                {selectedCustomer ? (
                  <div
                    className="flex items-center gap-3 p-4 rounded-2xl border"
                    style={{ borderColor: 'var(--theme-accent)', background: 'var(--theme-calendar-available-bg)' }}
                  >
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
                      style={{ background: 'var(--theme-calendar-available-bg)', color: 'var(--theme-accent)' }}
                    >
                      {selectedCustomer.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm" style={{ color: 'var(--theme-text-primary)' }}>
                        {selectedCustomer.name}
                      </p>
                      <p className="text-xs mt-0.5 opacity-75" style={{ color: 'var(--theme-text-secondary)' }}>
                        {formatBrPhoneMask(selectedCustomer.phone)}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedCustomer(null)}
                      className="text-xs font-bold shrink-0"
                      style={{ color: 'var(--theme-text-secondary)' }}
                    >
                      Trocar
                    </button>
                  </div>
                ) : isCreatingCustomer ? (
                  <div
                    className="space-y-3 p-4 rounded-2xl border"
                    style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-bg-hover)' }}
                  >
                    <input
                      value={newCustomerName}
                      onChange={(e) => setNewCustomerName(e.target.value)}
                      className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none"
                      style={{
                        background: 'var(--theme-input-bg)',
                        color: 'var(--theme-input-text)',
                        border: '1px solid var(--theme-input-border)',
                      }}
                      placeholder="Nome completo..."
                    />
                    <div>
                      <input
                        value={newCustomerPhone}
                        onChange={(e) => setNewCustomerPhone(formatBrPhoneMask(e.target.value))}
                        className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none"
                        style={{
                          background: 'var(--theme-input-bg)',
                          color: 'var(--theme-input-text)',
                          border: '1px solid var(--theme-input-border)',
                        }}
                        placeholder="(27) 99999-9999"
                      />
                      <p className="text-[11px] mt-1 opacity-70" style={{ color: 'var(--theme-text-secondary)' }}>
                        Ex: (27) 99999-9999 — informe com DDD
                      </p>
                    </div>
                    <button
                      onClick={handleCreateCustomer}
                      disabled={creatingCustomer}
                      className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
                      style={{ background: 'var(--theme-accent-gradient)', color: 'var(--theme-btn-primary-text)' }}
                    >
                      {creatingCustomer ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Cadastrar e selecionar'}
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3.5 top-3.5 w-4 h-4" style={{ color: 'var(--theme-text-secondary)' }} />
                    <input
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      className="w-full rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-none border"
                      style={{
                        background: 'var(--theme-input-bg)',
                        borderColor: 'var(--theme-input-border)',
                        color: 'var(--theme-input-text)',
                      }}
                      placeholder="Buscar por nome ou telefone..."
                    />
                    {customerResults.length > 0 && (
                      <div
                        className="absolute top-full left-0 right-0 mt-2 border rounded-2xl shadow-lg overflow-hidden z-10"
                        style={{ background: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)' }}
                      >
                        {customerResults.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => {
                              setSelectedCustomer(c);
                              setCustomerSearch('');
                              setCustomerResults([]);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-black/5 transition-colors text-left"
                          >
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                              style={{ background: 'var(--theme-calendar-available-bg)', color: 'var(--theme-accent)' }}
                            >
                              {c.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold" style={{ color: 'var(--theme-text-primary)' }}>
                                {c.name}
                              </p>
                              <p className="text-xs opacity-75" style={{ color: 'var(--theme-text-secondary)' }}>
                                {formatBrPhoneMask(c.phone)}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {searchingCustomers && (
                      <Loader2 className="absolute right-3.5 top-3.5 w-4 h-4 animate-spin" style={{ color: 'var(--theme-text-secondary)' }} />
                    )}
                  </div>
                )}
              </div>

              {/* Payment Method & Confirmation Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-2 uppercase tracking-wider opacity-70" style={{ color: 'var(--theme-text-secondary)' }}>
                    Forma de pagamento
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {([
                      { id: 'local', label: 'No local' },
                      { id: 'pix', label: 'PIX' },
                      { id: 'card', label: 'Cartão' },
                    ] as const).map((opt) => {
                      const active = paymentMethod === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setPaymentMethod(opt.id)}
                          className="py-2 px-2 rounded-xl border text-xs font-bold transition-all cursor-pointer"
                          style={{
                            borderColor: active ? 'var(--theme-accent)' : 'var(--theme-border)',
                            background: active ? 'var(--theme-accent-gradient)' : 'var(--theme-bg-hover)',
                            color: active ? 'var(--theme-btn-primary-text)' : 'var(--theme-text-secondary)',
                          }}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-2 uppercase tracking-wider opacity-70" style={{ color: 'var(--theme-text-secondary)' }}>
                    Status de confirmação
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {([
                      { id: 'confirmed', label: 'Confirmado' },
                      { id: 'pending', label: 'Aguardando' },
                    ] as const).map((opt) => {
                      const active = confirmationStatus === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setConfirmationStatus(opt.id)}
                          className="py-2 px-2 rounded-xl border text-xs font-bold transition-all cursor-pointer"
                          style={{
                            borderColor: active ? 'var(--theme-accent)' : 'var(--theme-border)',
                            background: active ? 'var(--theme-accent-gradient)' : 'var(--theme-bg-hover)',
                            color: active ? 'var(--theme-btn-primary-text)' : 'var(--theme-text-secondary)',
                          }}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div
                className="rounded-2xl border p-5 space-y-3"
                style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-bg-hover)' }}
              >
                <p className="text-xs font-bold uppercase tracking-wider opacity-70" style={{ color: 'var(--theme-text-secondary)' }}>
                  Resumo
                </p>
                {[
                  { label: 'Serviço', value: selectedService?.name },
                  { label: 'Profissional', value: selectedPro?.name ?? 'Qualquer disponível' },
                  { label: 'Data', value: format(selectedDate, "dd 'de' MMMM", { locale: ptBR }) },
                  { label: 'Horário', value: selectedTime },
                  { label: 'Duração', value: selectedService ? `${selectedService.duration_minutes} min` : null },
                  { label: 'Origem', value: 'Manual' },
                  {
                    label: 'Pagamento',
                    value: paymentMethod === 'pix' ? 'PIX' : paymentMethod === 'card' ? 'Cartão' : 'No local',
                  },
                  { label: 'Valor', value: selectedService ? fmt.format(selectedService.price) : null },
                ].map(
                  (row) =>
                    row.value && (
                      <div key={row.label} className="flex items-center justify-between text-sm">
                        <span style={{ color: 'var(--theme-text-secondary)' }}>{row.label}</span>
                        <span className="font-semibold" style={{ color: 'var(--theme-text-primary)' }}>
                          {row.value}
                        </span>
                      </div>
                    )
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold mb-2.5 uppercase tracking-wider opacity-70" style={{ color: 'var(--theme-text-secondary)' }}>
                  Observações
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none resize-none"
                  style={{
                    background: 'var(--theme-input-bg)',
                    borderColor: 'var(--theme-input-border)',
                    color: 'var(--theme-input-text)',
                  }}
                  placeholder="Preferências, alergias, detalhes..."
                />
              </div>

              {error && <p className="text-red-400 text-sm">{error}</p>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-3 p-6 pt-4 shrink-0 border-t" style={{ borderColor: 'var(--theme-border)' }}>
          {error && <p className="text-red-500 text-xs text-center">{error}</p>}
          <div className="flex gap-3 w-full">
            <button
              onClick={() => (step > 1 ? setStep((s) => (s - 1) as any) : onClose())}
              className="flex-1 py-3.5 rounded-xl border font-semibold text-sm transition-opacity hover:opacity-80"
              style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-secondary)' }}
            >
              {step === 1 ? 'Cancelar' : 'Voltar'}
            </button>
            <button
              onClick={() => {
                if (step < 4) setStep((s) => (s + 1) as any);
                else handleSubmit();
              }}
              disabled={(step === 1 && !selectedService) || (step === 3 && !selectedTime) || isLoading}
              className="flex-1 py-3.5 rounded-xl font-bold text-sm transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
              style={{ background: 'var(--theme-accent-gradient)', color: 'var(--theme-btn-primary-text)' }}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Criando...
                </>
              ) : step < 4 ? (
                'Continuar'
              ) : (
                <>
                  <Check className="w-4 h-4" /> Confirmar
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
