import { useState, useEffect, useMemo } from 'react';
import { X, Loader2, Check, Calendar, Clock, Scissors, User } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { useBookingsByDay, generateTimeSlots, type Booking, type CreateBookingInput } from '../../../hooks/useBookings';
import type { Service } from '../../../hooks/useServices';

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
  isLoading
}: Props) {
  const initialDate = new Date(booking.scheduled_at);
  const initialTimeStr = format(initialDate, 'HH:mm');

  const [selectedService, setSelectedService] = useState<Service | null>(() => {
    return services.find(s => s.id === booking.service_id) || (booking.service as any) || null;
  });

  const [selectedPro, setSelectedPro] = useState<any | null>(() => {
    if (!booking.professional_id) return null;
    return professionals.find(p => p.id === booking.professional_id) || (booking.professional as any) || null;
  });

  const [selectedDate, setSelectedDate] = useState<Date>(initialDate);
  const [selectedTime, setSelectedTime] = useState<string | null>(initialTimeStr);
  const [notes, setNotes] = useState(booking.notes || '');
  const [error, setError] = useState<string | null>(null);

  const { data: dayBookings = [] } = useBookingsByDay(tenantId, selectedDate);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const availableDays = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => addDays(new Date(), i));
  }, []);

  const timeSlots = useMemo(() => {
    if (!selectedService) return [];
    const dow = selectedDate.getDay();
    const dayHours = businessHours.find((h: any) => h.weekday === dow);
    if (!dayHours || !dayHours.is_open) return [];

    const otherBookings = dayBookings.filter(b => b.id !== booking.id);
    const proBookings = selectedPro
      ? otherBookings.filter(b => b.professional_id === selectedPro.id)
      : otherBookings;

    return generateTimeSlots(
      selectedDate,
      (typeof dayHours.open_time === 'string' ? dayHours.open_time : '08:00').slice(0, 5),
      (typeof dayHours.close_time === 'string' ? dayHours.close_time : '20:00').slice(0, 5),
      selectedService.duration_minutes,
      selectedService.buffer_minutes || 0,
      proBookings as any,
      dayHours.lunch_start,
      dayHours.lunch_end,
      false
    );
  }, [businessHours, selectedDate, dayBookings, selectedService, selectedPro, booking.id]);

  const activeOrCurrentProfessionals = useMemo(
    () =>
      professionals.filter(
        p => (p.active !== false && (!p.status || p.status === 'active')) || p.id === booking.professional_id
      ),
    [professionals, booking.professional_id]
  );

  const handleSave = async () => {
    if (!selectedService || !selectedTime) {
      setError('Selecione o serviço e o horário.');
      return;
    }
    setError(null);
    try {
      const [h, m] = selectedTime.split(':').map(Number);
      const scheduledAt = new Date(selectedDate);
      scheduledAt.setHours(h, m, 0, 0);

      await onSave({
        id: booking.id,
        service_id: selectedService.id,
        professional_id: selectedPro?.id ?? null,
        scheduled_at: scheduledAt.toISOString(),
        duration_minutes: selectedService.duration_minutes,
        buffer_minutes: selectedService.buffer_minutes,
        amount_total: selectedService.price,
        pro_color: selectedPro?.agenda_color ?? 'var(--theme-accent)',
        notes: notes.trim() || undefined,
      });

      onClose();
    } catch (err: any) {
      console.error('Erro ao atualizar agendamento:', err);
      const msg = err?.message || err?.error_description || 'Erro ao reagendar. Tente novamente.';
      setError(msg);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm">
      <div
        className="relative w-full max-w-lg sm:rounded-3xl rounded-t-3xl border shadow-xl flex flex-col"
        style={{
          background: 'var(--theme-card-bg)',
          borderColor: 'var(--theme-border)',
          maxHeight: '92vh',
        }}
      >
        {/* Header */}
        <div className="p-6 pb-4 shrink-0 border-b" style={{ borderColor: 'var(--theme-border)' }}>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider opacity-60" style={{ color: 'var(--theme-text-secondary)' }}>
                Reagendamento #{booking.order_number}
              </p>
              <h2 className="font-serif text-2xl font-bold mt-0.5" style={{ color: 'var(--theme-text-primary)' }}>
                Editar Agendamento
              </h2>
              <p className="text-xs mt-1 font-medium opacity-75" style={{ color: 'var(--theme-text-secondary)' }}>
                Cliente: <span className="font-bold" style={{ color: 'var(--theme-text-primary)' }}>{booking.customer?.name}</span>
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
              {services.filter(s => s.active || s.id === booking.service_id).map(svc => {
                const isSelected = selectedService?.id === svc.id;
                return (
                  <div
                    key={svc.id}
                    onClick={() => {
                      setSelectedService(svc);
                      setSelectedTime(null);
                    }}
                    className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all"
                    style={{
                      borderColor: isSelected ? 'var(--theme-accent)' : 'var(--theme-border)',
                      background: isSelected ? 'var(--theme-calendar-available-bg)' : 'var(--theme-bg-hover)',
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-xs truncate" style={{ color: 'var(--theme-text-primary)' }}>{svc.name}</p>
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
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: 'var(--theme-border)', color: 'var(--theme-text-secondary)' }}>
                  ?
                </div>
                <div className="truncate flex-1">
                  <p className="text-xs font-semibold truncate" style={{ color: 'var(--theme-text-primary)' }}>Qualquer um</p>
                </div>
              </div>

              {activeOrCurrentProfessionals.map(pro => {
                const isSelected = selectedPro?.id === pro.id;
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
                      style={{ background: `${pro.agenda_color}25`, color: pro.agenda_color }}
                    >
                      {pro.photo_url ? (
                        <img src={pro.photo_url} alt={pro.name} className="w-full h-full object-cover" />
                      ) : (
                        pro.name.substring(0, 2).toUpperCase()
                      )}
                    </div>
                    <div className="truncate flex-1">
                      <p className="text-xs font-semibold truncate" style={{ color: 'var(--theme-text-primary)' }}>{pro.name}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. Data & Horário */}
          <div>
            <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider mb-2.5 opacity-80" style={{ color: 'var(--theme-text-secondary)' }}>
              <Calendar className="w-3.5 h-3.5" /> Escolha o Novo Dia
            </label>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {availableDays.map(day => {
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
                    className="flex flex-col items-center gap-0.5 px-3 py-2.5 rounded-xl border text-xs font-bold shrink-0 min-w-[50px] transition-all cursor-pointer disabled:opacity-40"
                    style={{
                      borderColor: isSelected ? 'var(--theme-accent)' : 'var(--theme-border)',
                      background: isSelected ? 'var(--theme-accent)' : (isOpen ? 'var(--theme-bg-hover)' : 'transparent'),
                      color: isSelected ? 'var(--theme-btn-primary-text)' : (isOpen ? 'var(--theme-text-primary)' : 'var(--theme-text-secondary)'),
                    }}
                  >
                    <span className="text-[10px] opacity-70 font-semibold">{format(day, 'EEE', { locale: ptBR })}</span>
                    <span className="text-sm font-bold leading-tight">{format(day, 'd')}</span>
                  </button>
                );
              })}
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
                {timeSlots.map(time => {
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
              onChange={e => setNotes(e.target.value)}
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
    </div>
  );
}
