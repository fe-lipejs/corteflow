import { useState, useEffect, useMemo } from 'react';
import { X, Loader2, Check, Search, Calendar, Clock } from 'lucide-react';
import { format, addDays, isBefore, startOfDay, addMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { supabase } from '../../../integrations/supabase/client';
import { useBookingsByDay, generateTimeSlots, type CreateBookingInput } from '../../../hooks/useBookings';
import type { Service } from '../../../hooks/useServices';

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
  tenantId, services, professionals, businessHours, initialDate, onClose, onCreate, isLoading
}: Props) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedPro, setSelectedPro] = useState<any | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(initialDate ?? new Date());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [notes, setNotes] = useState('');
  const [paymentMode, setPaymentMode] = useState('local');
  const [searchingCustomers, setSearchingCustomers] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: dayBookings = [] } = useBookingsByDay(tenantId, selectedDate);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Search customers
  useEffect(() => {
    if (customerSearch.length < 2) { setCustomerResults([]); return; }
    const timer = setTimeout(async () => {
      setSearchingCustomers(true);
      const { data } = await supabase
        .from('customers').select('id, name, phone').eq('tenant_id', tenantId)
        .or(`name.ilike.%${customerSearch}%,phone.ilike.%${customerSearch}%`)
        .limit(8);
      setCustomerResults(data ?? []);
      setSearchingCustomers(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [customerSearch, tenantId]);

  // Days for picker (14 days ahead)
  const availableDays = useMemo(() =>
    Array.from({ length: 14 }, (_, i) => addDays(startOfDay(new Date()), i)),
    []
  );

  // Business hours for selected day
  const todayHours = useMemo(() => {
    const dow = selectedDate.getDay();
    return businessHours.find((h: any) => h.weekday === dow);
  }, [selectedDate, businessHours]);

  // Available time slots
  const availableSlots = useMemo(() => {
    if (!selectedService || !todayHours?.is_open) return [];
    // Filter bookings for selected professional
    const proBookings = selectedPro
      ? dayBookings.filter(b => b.professional_id === selectedPro.id)
      : dayBookings;

    return generateTimeSlots(
      todayHours.open_time?.slice(0, 5) ?? '08:00',
      todayHours.close_time?.slice(0, 5) ?? '20:00',
      selectedService.duration_minutes,
      selectedService.buffer_minutes,
      proBookings as any,
      todayHours.lunch_start,
      todayHours.lunch_end,
    );
  }, [selectedService, selectedPro, todayHours, dayBookings]);

  const handleSubmit = async () => {
    if (!selectedCustomer || !selectedService || !selectedTime) {
      setError('Preencha todos os campos obrigatórios.');
      return;
    }
    const [h, m] = selectedTime.split(':').map(Number);
    const scheduledAt = new Date(selectedDate);
    scheduledAt.setHours(h, m, 0, 0);

    await onCreate({
      customer_id: selectedCustomer.id,
      professional_id: selectedPro?.id ?? null,
      service_id: selectedService.id,
      scheduled_at: scheduledAt.toISOString(),
      payment_mode: paymentMode,
      amount_total: selectedService.price,
      duration_minutes: selectedService.duration_minutes,
      buffer_minutes: selectedService.buffer_minutes,
      pro_color: selectedPro?.agenda_color ?? '#C9963B',
      notes: notes.trim() || undefined,
    });
  };

  const STEPS = ['Serviço', 'Profissional', 'Horário', 'Confirmar'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-3xl border border-[#3A3530] shadow-2xl flex flex-col" style={{ background: '#1C1A17', maxHeight: '92vh' }}>

        {/* Header */}
        <div className="p-6 pb-4 shrink-0 border-b border-[#3A3530]">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="font-serif text-2xl font-bold text-white">Novo Agendamento</h2>
              <p className="text-xs text-[#A09888] mt-0.5">Passo {step} de {STEPS.length} — {STEPS[step - 1]}</p>
            </div>
            <button onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center text-[#A09888] hover:text-white hover:bg-white/10 transition-all">
              <X className="w-5 h-5" />
            </button>
          </div>
          {/* Progress bar */}
          <div className="h-1 w-full rounded-full bg-[#3A3530]">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(step / STEPS.length) * 100}%`, background: 'linear-gradient(90deg, #C9963B, #E8B960)' }} />
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-6">

          {/* Step 1: Service */}
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-xs font-bold text-[#A09888] uppercase tracking-wider mb-3">Escolha o serviço</p>
              {services.filter(s => s.active).map(svc => (
                <div key={svc.id} onClick={() => setSelectedService(svc)} className={`flex items-center gap-4 p-4 rounded-2xl border cursor-pointer transition-all ${selectedService?.id === svc.id ? 'border-[#C9963B]/50 bg-[#C9963B]/5' : 'border-[#3A3530] bg-[#252118]/60 hover:border-[#3A3530]/60'}`}>
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ background: svc.color || '#C9963B' }} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white text-sm">{svc.name}</p>
                    <p className="text-xs text-[#A09888]">{svc.duration_minutes} min {svc.buffer_minutes > 0 && `+ ${svc.buffer_minutes} min buffer`}</p>
                  </div>
                  <p className="font-bold text-[#C9963B] text-sm shrink-0">{fmt.format(svc.price)}</p>
                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${selectedService?.id === svc.id ? 'border-[#C9963B]' : 'border-[#3A3530]'}`} style={selectedService?.id === svc.id ? { background: 'linear-gradient(135deg, #C9963B, #E8B960)' } : {}}>
                    {selectedService?.id === svc.id && <Check className="w-3 h-3 text-[#1A1714]" />}
                  </div>
                </div>
              ))}
              {services.length === 0 && <p className="text-center text-[#A09888] py-8">Nenhum serviço ativo. Cadastre serviços primeiro.</p>}
            </div>
          )}

          {/* Step 2: Professional */}
          {step === 2 && (
            <div className="space-y-3">
              <p className="text-xs font-bold text-[#A09888] uppercase tracking-wider mb-3">Escolha o profissional</p>
              {/* Any */}
              <div onClick={() => setSelectedPro(null)} className={`flex items-center gap-4 p-4 rounded-2xl border cursor-pointer transition-all ${selectedPro === null ? 'border-[#C9963B]/50 bg-[#C9963B]/5' : 'border-[#3A3530] bg-[#252118]/60 hover:border-[#3A3530]/60'}`}>
                <div className="w-10 h-10 rounded-full bg-[#3A3530] flex items-center justify-center text-[#A09888] text-sm font-bold">?</div>
                <div className="flex-1">
                  <p className="font-semibold text-white text-sm">Qualquer profissional</p>
                  <p className="text-xs text-[#A09888]">Primeiro horário disponível</p>
                </div>
                {selectedPro === null && <Check className="w-4 h-4 text-[#C9963B]" />}
              </div>
              {professionals.filter(p => p.status === 'active').map(pro => (
                <div key={pro.id} onClick={() => setSelectedPro(pro)} className={`flex items-center gap-4 p-4 rounded-2xl border cursor-pointer transition-all ${selectedPro?.id === pro.id ? 'border-[#C9963B]/50 bg-[#C9963B]/5' : 'border-[#3A3530] bg-[#252118]/60 hover:border-[#3A3530]/60'}`}>
                  <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center font-bold text-sm shrink-0" style={{ background: `${pro.agenda_color}20`, color: pro.agenda_color }}>
                    {pro.photo_url ? <img src={pro.photo_url} alt={pro.name} className="w-full h-full object-cover" /> : pro.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-white text-sm">{pro.name}</p>
                    <p className="text-xs text-[#A09888]">{pro.role_title}</p>
                  </div>
                  {selectedPro?.id === pro.id && <Check className="w-4 h-4 text-[#C9963B]" />}
                </div>
              ))}
            </div>
          )}

          {/* Step 3: Date + Time */}
          {step === 3 && (
            <div className="space-y-5">
              {/* Day picker */}
              <div>
                <p className="text-xs font-bold text-[#A09888] uppercase tracking-wider mb-3">Escolha a data</p>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {availableDays.map(day => {
                    const dow = day.getDay();
                    const dayHours = businessHours.find((h: any) => h.weekday === dow);
                    const isOpen = dayHours?.is_open;
                    const isSelected = format(day, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
                    return (
                      <button key={day.toISOString()} onClick={() => { if (isOpen) { setSelectedDate(day); setSelectedTime(null); } }}
                        disabled={!isOpen}
                        className={`flex flex-col items-center px-3 py-2.5 rounded-2xl border text-xs font-bold shrink-0 min-w-[52px] transition-all ${isSelected ? 'border-[#C9963B] text-[#1A1714]' : isOpen ? 'border-[#3A3530] text-white hover:border-[#C9963B]/50 bg-[#252118]' : 'border-[#2A2520] text-[#A09888]/40 cursor-not-allowed bg-[#1A1714]'}`}
                        style={isSelected ? { background: 'linear-gradient(135deg, #C9963B, #E8B960)' } : {}}
                      >
                        <span className="text-[10px] opacity-70">{format(day, 'EEE', { locale: ptBR })}</span>
                        <span className="text-base leading-tight">{format(day, 'd')}</span>
                        {!isOpen && <span className="text-[8px] opacity-50">Fechado</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time slots */}
              <div>
                <p className="text-xs font-bold text-[#A09888] uppercase tracking-wider mb-3">Escolha o horário</p>
                {availableSlots.length === 0 ? (
                  <div className="text-center py-8 text-[#A09888]">
                    <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Nenhum horário disponível nesta data.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {availableSlots.map(slot => (
                      <button key={slot} onClick={() => setSelectedTime(slot)}
                        className={`py-2.5 rounded-xl text-sm font-bold border transition-all ${selectedTime === slot ? 'border-[#C9963B] text-[#1A1714]' : 'border-[#3A3530] text-white hover:border-[#C9963B]/50 bg-[#252118]'}`}
                        style={selectedTime === slot ? { background: 'linear-gradient(135deg, #C9963B, #E8B960)' } : {}}
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
            <div className="space-y-5">
              {/* Customer search */}
              <div>
                <label className="block text-xs font-bold text-[#A09888] mb-2 uppercase tracking-wider">Cliente *</label>
                {selectedCustomer ? (
                  <div className="flex items-center gap-3 p-3 rounded-xl border border-[#C9963B]/30 bg-[#C9963B]/5">
                    <div className="w-9 h-9 rounded-full bg-[#C9963B]/20 flex items-center justify-center text-[#C9963B] font-bold text-sm">{selectedCustomer.name.substring(0, 2).toUpperCase()}</div>
                    <div className="flex-1"><p className="font-semibold text-white text-sm">{selectedCustomer.name}</p><p className="text-xs text-[#A09888]">{selectedCustomer.phone}</p></div>
                    <button onClick={() => setSelectedCustomer(null)} className="text-xs text-[#A09888] hover:text-white">Trocar</button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-3.5 w-4 h-4 text-[#A09888]" />
                    <input value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} className="w-full bg-[#252118] border border-[#3A3530] rounded-xl pl-10 pr-4 py-3 text-white text-sm focus:outline-none focus:border-[#C9963B]/60" placeholder="Buscar por nome ou telefone..." />
                    {customerResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-[#1C1A17] border border-[#3A3530] rounded-xl shadow-2xl overflow-hidden z-10">
                        {customerResults.map(c => (
                          <button key={c.id} onClick={() => { setSelectedCustomer(c); setCustomerSearch(''); setCustomerResults([]); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-all text-left">
                            <div className="w-8 h-8 rounded-full bg-[#C9963B]/20 flex items-center justify-center text-[#C9963B] text-xs font-bold">{c.name.substring(0, 2).toUpperCase()}</div>
                            <div><p className="text-sm font-semibold text-white">{c.name}</p><p className="text-xs text-[#A09888]">{c.phone}</p></div>
                          </button>
                        ))}
                      </div>
                    )}
                    {searchingCustomers && <Loader2 className="absolute right-3 top-3.5 w-4 h-4 animate-spin text-[#A09888]" />}
                  </div>
                )}
              </div>

              {/* Summary */}
              <div className="rounded-2xl border border-[#3A3530] p-4 bg-[#252118]/60 space-y-3">
                <p className="text-xs font-bold text-[#A09888] uppercase tracking-wider">Resumo</p>
                {[
                  { label: 'Serviço', value: selectedService?.name },
                  { label: 'Profissional', value: selectedPro?.name ?? 'Qualquer disponível' },
                  { label: 'Data', value: format(selectedDate, "dd 'de' MMMM", { locale: ptBR }) },
                  { label: 'Horário', value: selectedTime },
                  { label: 'Duração', value: selectedService ? `${selectedService.duration_minutes} min` : null },
                  { label: 'Valor', value: selectedService ? fmt.format(selectedService.price) : null },
                ].map(row => row.value && (
                  <div key={row.label} className="flex items-center justify-between text-sm">
                    <span className="text-[#A09888]">{row.label}</span>
                    <span className="text-white font-semibold">{row.value}</span>
                  </div>
                ))}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-[#A09888] mb-2 uppercase tracking-wider">Observações</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full bg-[#252118] border border-[#3A3530] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#C9963B]/60 resize-none" placeholder="Preferências, alergias, detalhes..." />
              </div>

              {/* Payment mode */}
              <div>
                <label className="block text-xs font-bold text-[#A09888] mb-2 uppercase tracking-wider">Pagamento</label>
                <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)} className="w-full bg-[#252118] border border-[#3A3530] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#C9963B]/60">
                  <option value="local">Pagar no local</option>
                  <option value="deposit">Entrada (parcial)</option>
                  <option value="full">Pagamento integral</option>
                </select>
              </div>

              {error && <p className="text-red-400 text-sm">{error}</p>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 pt-4 shrink-0 border-t border-[#3A3530]">
          <button onClick={() => step > 1 ? setStep(s => (s - 1) as any) : onClose()} className="flex-1 py-3 rounded-xl border border-[#3A3530] text-[#A09888] hover:text-white font-semibold text-sm transition-all">
            {step === 1 ? 'Cancelar' : '← Voltar'}
          </button>
          <button
            onClick={() => {
              if (step < 4) setStep(s => (s + 1) as any);
              else handleSubmit();
            }}
            disabled={(step === 1 && !selectedService) || (step === 3 && !selectedTime) || isLoading}
            className="flex-1 py-3 rounded-xl font-bold text-sm text-[#1A1714] transition-all shadow-[0_0_20px_rgba(201,150,59,0.2)] disabled:opacity-40 flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #C9963B, #E8B960)' }}
          >
            {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Criando...</> : step < 4 ? 'Continuar →' : <><Check className="w-4 h-4" /> Confirmar</>}
          </button>
        </div>
      </div>
    </div>
  );
}
