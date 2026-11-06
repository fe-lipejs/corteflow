import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, Check, Calendar, Clock, Scissors, User, Plus } from 'lucide-react';
import { format, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { useBookingsByDay, type Booking, type CreateBookingInput } from '../../../hooks/useBookings';
import type { Service } from '../../../hooks/useServices';
import { useTheme } from '../../../contexts/ThemeContext';
import { generateAvailableSlots } from '../../../lib/availability';
import {
  buildHorizonDateList,
  CAROUSEL_LOAD_MORE_STEP,
  INITIAL_CAROUSEL_DAYS_CAP,
  isDateWithinBookingHorizon,
  isSameCalendarDate,
  sanitizeHexColor,
} from '../../../lib/bookingHorizon';
import {
  useTenantAvailabilityMeta,
  useTenantBookingHorizon,
  useTenantDayBlocks,
} from '../../../hooks/useBookingHorizon';

interface Props {
  tenantId: string;
  booking: Booking;
  services: Service[];
  professionals: any[];
  businessHours: any[];
  onClose: () => void;
  onSave: (fields: Partial<CreateBookingInput> & { id: string }) => Promise<void>;
  isLoading?: boolean;
}

const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });

export default function EditBookingModal({
  tenantId,
  booking,
  services,
  professionals,
  businessHours,
  onClose,
  onSave,
  isLoading,
}: Props) {
  const { theme } = useTheme();
  const { maxAdvanceDays } = useTenantBookingHorizon(tenantId);
  const { data: availabilityMeta } = useTenantAvailabilityMeta(tenantId);

  const initialDate = useMemo(() => new Date(booking.scheduled_at), [booking.scheduled_at]);
  const initialCalendarDay = useMemo(() => startOfDay(initialDate), [initialDate]);
  const initialTimeStr = useMemo(() => format(initialDate, 'HH:mm'), [initialDate]);

  const [selectedService, setSelectedService] = useState<Service | null>(() => {
    return services.find((s) => s.id === booking.service_id) || (booking.service as any) || null;
  });

  const [selectedPro, setSelectedPro] = useState<any | null>(() => {
    if (!booking.professional_id) return null;
    return professionals.find((p) => p.id === booking.professional_id) || (booking.professional as any) || null;
  });

  const [selectedDate, setSelectedDate] = useState<Date>(initialCalendarDay);
  const [selectedTime, setSelectedTime] = useState<string | null>(initialTimeStr);
  const [visibleDaysLimit, setVisibleDaysLimit] = useState(INITIAL_CAROUSEL_DAYS_CAP);
  const [notes, setNotes] = useState(booking.notes || '');
  const [error, setError] = useState<string | null>(null);

  const { data: dayBookings = [] } = useBookingsByDay(tenantId, selectedDate);
  const { data: dayBlocks = [] } = useTenantDayBlocks(tenantId, selectedDate);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const horizonData = useMemo(
    () =>
      buildHorizonDateList({
        maxAdvanceDays,
        visibleCount: visibleDaysLimit,
        selectedDate,
        preserveExtraDate: initialCalendarDay,
      }),
    [maxAdvanceDays, visibleDaysLimit, selectedDate, initialCalendarDay]
  );

  const availableDays = horizonData.dates;

  const activeOrCurrentProfessionals = useMemo(() => {
    let list = professionals.filter(
      (p) => (p.active !== false && (!p.status || p.status === 'active')) || p.id === booking.professional_id
    );
    if (booking.professional_id && !list.some((p: any) => p.id === booking.professional_id) && booking.professional) {
      list = [...list, { id: booking.professional_id, ...booking.professional }];
    }
    const proServices = availabilityMeta?.professionalServices ?? [];
    if (selectedService && proServices.length > 0) {
      const allowedProIds = proServices
        .filter((ps: any) => ps.service_id === selectedService.id)
        .map((ps: any) => ps.professional_id);
      const proIdsWithAnyMapping = [...new Set(proServices.map((ps: any) => ps.professional_id))];
      list = list.filter((p: any) => {
        if (p.id === booking.professional_id) return true;
        if (!proIdsWithAnyMapping.includes(p.id)) return true;
        return allowedProIds.includes(p.id);
      });
    }
    return list;
  }, [professionals, booking.professional_id, booking.professional, selectedService, availabilityMeta?.professionalServices]);

  const isDateAllowedForEdit = (d: Date) =>
    isSameCalendarDate(d, initialCalendarDay) || isDateWithinBookingHorizon(d, maxAdvanceDays);

  const rawSlots = useMemo(() => {
    if (!selectedService) return [];
    if (!isDateAllowedForEdit(selectedDate)) return [];

    const otherBookings = dayBookings.filter((b) => b.id !== booking.id);

    return generateAvailableSlots(
      selectedDate,
      selectedService,
      selectedPro ? selectedPro.id : 'any',
      activeOrCurrentProfessionals,
      services,
      businessHours,
      availabilityMeta?.professionalWorkingHours ?? [],
      dayBlocks,
      otherBookings,
      availabilityMeta?.professionalServices ?? [],
      [selectedService],
      'instore'
    );
  }, [
    selectedService,
    selectedDate,
    selectedPro,
    activeOrCurrentProfessionals,
    services,
    businessHours,
    availabilityMeta,
    dayBlocks,
    dayBookings,
    booking.id,
    maxAdvanceDays,
    initialCalendarDay,
  ]);

  const timeSlots = useMemo(() => {
    const free = rawSlots.filter((s) => s.available).map((s) => s.time);
    // Se o usuário estiver na data original do agendamento, garante que o horário original permaneça selecionável
    if (isSameCalendarDate(selectedDate, initialCalendarDay) && !free.includes(initialTimeStr)) {
      return [...free, initialTimeStr].sort();
    }
    return free;
  }, [rawSlots, selectedDate, initialCalendarDay, initialTimeStr]);

  const handleSave = async () => {
    if (!selectedService || !selectedTime) {
      setError('Selecione o serviço e o horário.');
      return;
    }
    if (!isDateAllowedForEdit(selectedDate)) {
      setError('A nova data selecionada está fora da antecedência máxima configurada.');
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
          resolvedPro = activeOrCurrentProfessionals.find((p) => p.id === pickedId) ?? null;
        } else if (activeOrCurrentProfessionals.length > 0) {
          resolvedPro = activeOrCurrentProfessionals[0];
        }
      }

      const safeProColor = sanitizeHexColor(resolvedPro?.agenda_color, theme.accent);

      await onSave({
        id: booking.id,
        service_id: selectedService.id,
        professional_id: resolvedPro?.id ?? null,
        scheduled_at: scheduledAt.toISOString(),
        duration_minutes: selectedService.duration_minutes,
        buffer_minutes: selectedService.buffer_minutes,
        amount_total: selectedService.price,
        pro_color: safeProColor,
        notes: notes.trim() || undefined,
      });

      onClose();
    } catch (err: any) {
      console.error('Erro ao atualizar agendamento:', err);
      const msg = err?.message || err?.error_description || 'Erro ao reagendar. Tente novamente.';
      setError(msg);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
      <div
        className="relative w-full max-w-lg sm:rounded-3xl rounded-t-3xl border shadow-2xl flex flex-col h-[82dvh] sm:h-auto max-h-[calc(100dvh-1rem)] sm:max-h-[90dvh]"
        style={{
          background: 'var(--theme-card-bg)',
          borderColor: 'var(--theme-border)',
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {/* Handle bar (mobile) */}
        <div className="flex justify-center pt-2.5 pb-1 sm:hidden shrink-0">
          <div className="w-12 h-1 rounded-full opacity-60" style={{ background: 'var(--theme-text-secondary)' }} />
        </div>

        {/* Header */}
        <div className="px-6 py-4 sm:p-6 sm:pb-4 shrink-0 border-b" style={{ borderColor: 'var(--theme-border)' }}>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider opacity-60" style={{ color: 'var(--theme-text-secondary)' }}>
                Reagendamento #{booking.order_number}
              </p>
              <h2 className="font-serif text-xl sm:text-2xl font-bold mt-0.5" style={{ color: 'var(--theme-text-primary)' }}>
                Editar Agendamento
              </h2>
              <p className="text-xs mt-0.5 sm:mt-1 font-medium opacity-75" style={{ color: 'var(--theme-text-secondary)' }}>
                Cliente:{' '}
                <span className="font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                  {booking.customer?.name}
                </span>
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full flex items-center justify-center transition-colors hover:bg-black/10 shrink-0 cursor-pointer"
              style={{ color: 'var(--theme-text-secondary)' }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {error && (
            <div className="p-3.5 rounded-xl text-xs font-semibold bg-red-500/10 border border-red-500/20 text-red-500">
              {error}
            </div>
          )}

          {/* 1. Serviço */}
          <div>
            <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider mb-2.5 opacity-80" style={{ color: 'var(--theme-text-secondary)' }}>
              <Scissors className="w-3.5 h-3.5" /> Serviço Selecionado
            </label>
            <div className="space-y-2">
              {services
                .filter((s) => s.active || s.id === booking.service_id)
                .map((svc) => {
                  const isSelected = selectedService?.id === svc.id;
                  return (
                    <div
                      key={svc.id}
                      onClick={() => {
                        setSelectedService(svc);
                        if (!isSameCalendarDate(selectedDate, initialCalendarDay)) {
                          setSelectedTime(null);
                        }
                      }}
                      className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all"
                      style={{
                        borderColor: isSelected ? 'var(--theme-accent)' : 'var(--theme-border)',
                        background: isSelected ? 'var(--theme-calendar-available-bg)' : 'var(--theme-bg-hover)',
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-xs truncate" style={{ color: 'var(--theme-text-primary)' }}>
                          {svc.name}
                        </p>
                        <p className="text-[11px] opacity-70" style={{ color: 'var(--theme-text-secondary)' }}>
                          {svc.duration_minutes} min {svc.buffer_minutes > 0 ? `+ ${svc.buffer_minutes}m buffer` : ''}
                        </p>
                      </div>
                      <span className="font-bold text-xs shrink-0" style={{ color: 'var(--theme-accent)' }}>
                        {fmt.format(svc.price)}
                      </span>
                      <div
                        className="w-4 h-4 rounded-full border flex items-center justify-center shrink-0"
                        style={{
                          borderColor: isSelected ? 'transparent' : 'var(--theme-border)',
                          background: isSelected ? 'var(--theme-accent)' : 'transparent',
                        }}
                      >
                        {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* 2. Profissional */}
          <div>
            <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider mb-2.5 opacity-80" style={{ color: 'var(--theme-text-secondary)' }}>
              <User className="w-3.5 h-3.5" /> Profissional Responsável
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div
                onClick={() => setSelectedPro(null)}
                className="flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all"
                style={{
                  borderColor: selectedPro === null ? 'var(--theme-accent)' : 'var(--theme-border)',
                  background: selectedPro === null ? 'var(--theme-calendar-available-bg)' : 'var(--theme-bg-hover)',
                }}
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: 'var(--theme-border)', color: 'var(--theme-text-secondary)' }}
                >
                  ?
                </div>
                <div className="truncate flex-1">
                  <p className="text-xs font-semibold truncate" style={{ color: 'var(--theme-text-primary)' }}>
                    Qualquer um
                  </p>
                </div>
              </div>

              {activeOrCurrentProfessionals.map((pro) => {
                const isSelected = selectedPro?.id === pro.id;
                const proHex = sanitizeHexColor(pro.agenda_color, theme.accent);
                return (
                  <div
                    key={pro.id}
                    onClick={() => setSelectedPro(pro)}
                    className="flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all"
                    style={{
                      borderColor: isSelected ? 'var(--theme-accent)' : 'var(--theme-border)',
                      background: isSelected ? 'var(--theme-calendar-available-bg)' : 'var(--theme-bg-hover)',
                    }}
                  >
                    <div
                      className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center font-bold text-[10px] shrink-0"
                      style={{ background: `${proHex}25`, color: proHex }}
                    >
                      {pro.photo_url ? (
                        <img src={pro.photo_url} alt={pro.name} className="w-full h-full object-cover" />
                      ) : (
                        pro.name.substring(0, 2).toUpperCase()
                      )}
                    </div>
                    <div className="truncate flex-1">
                      <p className="text-xs font-semibold truncate" style={{ color: 'var(--theme-text-primary)' }}>
                        {pro.name}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. Data & Horário */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider opacity-80" style={{ color: 'var(--theme-text-secondary)' }}>
                <Calendar className="w-3.5 h-3.5" /> Escolha o Novo Dia
              </label>
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
                      if (!isDateAllowedForEdit(picked)) return;
                      setSelectedDate(picked);
                      setSelectedTime(null);
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                </label>
              )}
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2">
              {availableDays.map((day) => {
                const dow = day.getDay();
                const dayHours = businessHours.find((h: any) => h.weekday === dow);
                const isOriginalDay = isSameCalendarDate(day, initialCalendarDay);
                const isOpen = (dayHours?.is_open || isOriginalDay) && isDateAllowedForEdit(day);
                const isSelected = format(day, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => {
                      if (isOpen) {
                        setSelectedDate(day);
                        setSelectedTime(isOriginalDay ? initialTimeStr : null);
                      }
                    }}
                    disabled={!isOpen}
                    className="flex flex-col items-center gap-0.5 px-3 py-2.5 rounded-xl border text-xs font-bold shrink-0 min-w-[52px] transition-all cursor-pointer disabled:opacity-40"
                    style={{
                      borderColor: isSelected ? 'var(--theme-accent)' : 'var(--theme-border)',
                      background: isSelected ? 'var(--theme-accent)' : isOpen ? 'var(--theme-bg-hover)' : 'transparent',
                      color: isSelected
                        ? 'var(--theme-btn-primary-text)'
                        : isOpen
                          ? 'var(--theme-text-primary)'
                          : 'var(--theme-text-secondary)',
                    }}
                  >
                    <span className="text-[10px] opacity-70 font-semibold">{format(day, 'EEE', { locale: ptBR })}</span>
                    <span className="text-sm font-bold leading-tight">{format(day, 'd')}</span>
                    <span className="text-[9px] uppercase opacity-70">{format(day, 'MMM', { locale: ptBR })}</span>
                  </button>
                );
              })}
              {horizonData.hasMore && (
                <button
                  type="button"
                  onClick={() => setVisibleDaysLimit((prev) => prev + CAROUSEL_LOAD_MORE_STEP)}
                  className="flex flex-col items-center justify-center gap-1 px-3 py-2.5 rounded-xl border text-xs font-bold shrink-0 transition-all cursor-pointer"
                  style={{
                    borderColor: 'var(--theme-border)',
                    background: 'var(--theme-bg-hover)',
                    color: 'var(--theme-accent)',
                  }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span className="text-[9px] uppercase whitespace-nowrap">Mais datas</span>
                </button>
              )}
            </div>

            <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider mt-4 mb-2.5 opacity-80" style={{ color: 'var(--theme-text-secondary)' }}>
              <Clock className="w-3.5 h-3.5" /> Horário Disponível
            </label>
            {timeSlots.length === 0 ? (
              <p className="text-xs text-center py-4 opacity-70" style={{ color: 'var(--theme-text-secondary)' }}>
                Nenhum horário disponível para esta data ou profissional.
              </p>
            ) : (
              <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto pr-1">
                {timeSlots.map((time) => {
                  const isSelected = selectedTime === time;
                  return (
                    <button
                      key={time}
                      type="button"
                      onClick={() => setSelectedTime(time)}
                      className="py-2 px-2 text-xs font-bold rounded-lg border transition-all text-center cursor-pointer"
                      style={{
                        borderColor: isSelected ? 'var(--theme-accent)' : 'var(--theme-border)',
                        background: isSelected ? 'var(--theme-accent)' : 'var(--theme-bg-hover)',
                        color: isSelected ? 'var(--theme-btn-primary-text)' : 'var(--theme-text-primary)',
                      }}
                    >
                      {time}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 4. Observações */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-2 opacity-80" style={{ color: 'var(--theme-text-secondary)' }}>
              Observações (Opcional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Ex: Cliente prefere tesoura, corte rápido..."
              className="w-full px-3 py-2 rounded-xl text-xs border outline-none resize-none transition-colors"
              style={{
                borderColor: 'var(--theme-border)',
                background: 'var(--theme-bg-hover)',
                color: 'var(--theme-text-primary)',
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 px-6 border-t flex items-center justify-between gap-3 shrink-0" style={{ borderColor: 'var(--theme-border)' }}>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-xs font-bold rounded-xl border transition-colors cursor-pointer"
            style={{
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-text-secondary)',
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isLoading || !selectedService || !selectedTime}
            className="flex-1 py-3 px-4 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            style={{
              background: 'var(--theme-accent)',
              color: 'var(--theme-btn-primary-text)',
            }}
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Confirmar Reagendamento
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
