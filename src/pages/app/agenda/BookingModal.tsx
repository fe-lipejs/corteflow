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

  // New Customer Form State
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [creatingCustomer, setCreatingCustomer] = useState(false);

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

  // Days for picker (14 days ahead, but start from initialDate if it's in the past)
  const availableDays = useMemo(() => {
    const today = startOfDay(new Date());
    const start = (initialDate && isBefore(startOfDay(initialDate), today)) ? startOfDay(initialDate) : today;
    return Array.from({ length: 14 }, (_, i) => addDays(start, i));
  }, [initialDate]);

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
      selectedDate,
      (typeof todayHours.open_time === 'string' ? todayHours.open_time : '08:00').slice(0, 5),
      (typeof todayHours.close_time === 'string' ? todayHours.close_time : '20:00').slice(0, 5),
      selectedService.duration_minutes,
      selectedService.buffer_minutes,
      proBookings as any,
      todayHours.lunch_start,
      todayHours.lunch_end,
      false // Não permitir agendamentos no passado, conforme pedido
    );
  }, [selectedService, selectedPro, todayHours, dayBookings]);

  const handleCreateCustomer = async () => {
    if (!newCustomerName.trim() || !newCustomerPhone.trim()) {
      setError('Preencha nome e telefone do cliente.');
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
          phone: newCustomerPhone.trim(),
        } as any)
        .select('*').single();

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
    setError(null);
    try {
      const [h, m] = selectedTime.split(':').map(Number);
      const scheduledAt = new Date(selectedDate);
      scheduledAt.setHours(h, m, 0, 0);

      await onCreate({
        customer_id: selectedCustomer.id,
        professional_id: selectedPro?.id ?? null,
        service_id: selectedService.id,
        scheduled_at: scheduledAt.toISOString(),
        payment_mode: 'local', // Dono do salão agendando manualmente não precisa escolher pagamento
        amount_total: selectedService.price,
        duration_minutes: selectedService.duration_minutes,
        buffer_minutes: selectedService.buffer_minutes,
        pro_color: selectedPro?.agenda_color ?? 'var(--theme-accent)',
        notes: notes.trim() || undefined,
      });
    } catch (err: any) {
      console.error("Erro ao criar agendamento:", err);
      setError(err.message || "Erro ao criar agendamento. Verifique os dados e tente novamente.");
    }
  };

  const STEPS = ['Serviço', 'Profissional', 'Horário', 'Confirmar'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-3xl border shadow-2xl flex flex-col" style={{ background: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)', maxHeight: '85vh' }}>

        {/* Header */}
        <div className="p-6 pb-4 shrink-0 border-b" style={{ borderColor: 'var(--theme-border)' }}>
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="font-serif text-2xl font-bold" style={{ color: 'var(--theme-text-primary)' }}>Novo Agendamento</h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--theme-text-secondary)' }}>Passo {step} de {STEPS.length} — {STEPS[step - 1]}</p>
            </div>
            <button onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:bg-black/10" style={{ color: 'var(--theme-text-secondary)' }}>
              <X className="w-5 h-5" />
            </button>
          </div>
          {/* Progress bar */}
          <div className="h-1 w-full rounded-full" style={{ background: 'var(--theme-border)' }}>
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(step / STEPS.length) * 100}%`, background: 'var(--theme-accent-gradient)' }} />
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-6">

          {/* Step 1: Service */}
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--theme-text-secondary)' }}>Escolha o serviço</p>
              {services.filter(s => s.active).map(svc => {
                const isSelected = selectedService?.id === svc.id;
                return (
                <div key={svc.id} onClick={() => setSelectedService(svc)} className="flex items-center gap-4 p-4 rounded-2xl border cursor-pointer transition-all" style={{
                  borderColor: isSelected ? 'var(--theme-accent)' : 'var(--theme-border)',
                  background: isSelected ? 'var(--theme-calendar-available-bg)' : 'var(--theme-bg-hover)'
                }}>
                  {svc.photo_url ? (
                    <img src={svc.photo_url} alt={svc.name} className="w-10 h-10 rounded-xl object-cover shrink-0" />
                  ) : (
                    <div className="w-3 h-3 rounded-full shrink-0 ml-3" style={{ background: svc.color || 'var(--theme-accent)' }} />
                  )}
                  <div className="flex-1 min-w-0 ml-2">
                    <p className="font-semibold text-sm" style={{ color: 'var(--theme-text-primary)' }}>{svc.name}</p>
                    <p className="text-xs" style={{ color: 'var(--theme-text-secondary)' }}>{svc.duration_minutes} min {svc.buffer_minutes > 0 && `+ ${svc.buffer_minutes} min buffer`}</p>
                  </div>
                  <p className="font-bold text-sm shrink-0" style={{ color: 'var(--theme-accent)' }}>{fmt.format(svc.price)}</p>
                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all`} style={{
                    borderColor: isSelected ? 'transparent' : 'var(--theme-border)',
                    background: isSelected ? 'var(--theme-accent-gradient)' : 'transparent'
                  }}>
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                </div>
              )})}
              {services.length === 0 && <p className="text-center py-8" style={{ color: 'var(--theme-text-secondary)' }}>Nenhum serviço ativo. Cadastre serviços primeiro.</p>}
            </div>
          )}

          {/* Step 2: Professional */}
          {step === 2 && (
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--theme-text-secondary)' }}>Escolha o profissional</p>
              {/* Any */}
              <div onClick={() => setSelectedPro(null)} className="flex items-center gap-4 p-4 rounded-2xl border cursor-pointer transition-all" style={{
                borderColor: selectedPro === null ? 'var(--theme-accent)' : 'var(--theme-border)',
                background: selectedPro === null ? 'var(--theme-calendar-available-bg)' : 'var(--theme-bg-hover)'
              }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: 'var(--theme-border)', color: 'var(--theme-text-secondary)' }}>?</div>
                <div className="flex-1">
                  <p className="font-semibold text-sm" style={{ color: 'var(--theme-text-primary)' }}>Qualquer profissional</p>
                  <p className="text-xs" style={{ color: 'var(--theme-text-secondary)' }}>Primeiro horário disponível</p>
                </div>
                {selectedPro === null && <Check className="w-4 h-4" style={{ color: 'var(--theme-accent)' }} />}
              </div>
              {professionals.filter(p => p.status === 'active').map(pro => {
                const isSelected = selectedPro?.id === pro.id;
                return (
                <div key={pro.id} onClick={() => setSelectedPro(pro)} className="flex items-center gap-4 p-4 rounded-2xl border cursor-pointer transition-all" style={{
                  borderColor: isSelected ? 'var(--theme-accent)' : 'var(--theme-border)',
                  background: isSelected ? 'var(--theme-calendar-available-bg)' : 'var(--theme-bg-hover)'
                }}>
                  <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center font-bold text-sm shrink-0" style={{ background: `${pro.agenda_color}20`, color: pro.agenda_color }}>
                    {pro.photo_url ? <img src={pro.photo_url} alt={pro.name} className="w-full h-full object-cover" /> : pro.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm" style={{ color: 'var(--theme-text-primary)' }}>{pro.name}</p>
                    <p className="text-xs" style={{ color: 'var(--theme-text-secondary)' }}>{pro.role_title}</p>
                  </div>
                  {isSelected && <Check className="w-4 h-4" style={{ color: 'var(--theme-accent)' }} />}
                </div>
              )})}
            </div>
          )}

          {/* Step 3: Date + Time */}
          {step === 3 && (
            <div className="space-y-5">
              {/* Day picker */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--theme-text-secondary)' }}>Escolha a data</p>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {availableDays.map(day => {
                    const dow = day.getDay();
                    const dayHours = businessHours.find((h: any) => h.weekday === dow);
                    const isOpen = dayHours?.is_open;
                    const isSelected = format(day, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
                    return (
                      <button key={day.toISOString()} onClick={() => { if (isOpen) { setSelectedDate(day); setSelectedTime(null); } }}
                        disabled={!isOpen}
                        className={`flex flex-col items-center px-3 py-2.5 rounded-2xl border text-xs font-bold shrink-0 min-w-[52px] transition-all`}
                        style={{
                          borderColor: isSelected ? 'var(--theme-accent)' : (isOpen ? 'var(--theme-border)' : 'var(--theme-border)'),
                          background: isSelected ? 'var(--theme-accent-gradient)' : (isOpen ? 'var(--theme-bg-hover)' : 'transparent'),
                          color: isSelected ? 'var(--theme-btn-primary-text)' : (isOpen ? 'var(--theme-text-primary)' : 'var(--theme-text-secondary)'),
                          opacity: isOpen ? 1 : 0.4
                        }}
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
                <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--theme-text-secondary)' }}>Escolha o horário</p>
                {availableSlots.length === 0 ? (
                  <div className="text-center py-8 px-4" style={{ color: 'var(--theme-text-secondary)' }}>
                    <Clock className="w-8 h-8 mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-semibold mb-1">Nenhum horário disponível.</p>
                    <p className="text-xs opacity-70">Os horários desta data já passaram ou estão lotados. Escolha outro dia.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {availableSlots.map(slot => (
                      <button key={slot} onClick={() => setSelectedTime(slot)}
                        className={`py-2.5 rounded-xl text-sm font-bold border transition-all`}
                        style={{
                          borderColor: selectedTime === slot ? 'transparent' : 'var(--theme-border)',
                          background: selectedTime === slot ? 'var(--theme-accent-gradient)' : 'var(--theme-bg-hover)',
                          color: selectedTime === slot ? 'var(--theme-btn-primary-text)' : 'var(--theme-text-primary)'
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
            <div className="space-y-5">
              {/* Customer search / create */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--theme-text-secondary)' }}>Cliente *</label>
                  {!selectedCustomer && (
                    <button onClick={() => setIsCreatingCustomer(!isCreatingCustomer)} className="text-xs font-bold underline" style={{ color: 'var(--theme-accent)' }}>
                      {isCreatingCustomer ? 'Buscar existente' : 'Novo Cliente'}
                    </button>
                  )}
                </div>

                {selectedCustomer ? (
                  <div className="flex items-center gap-3 p-3 rounded-xl border" style={{ borderColor: 'var(--theme-accent)', background: 'var(--theme-calendar-available-bg)' }}>
                    <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm" style={{ background: 'var(--theme-calendar-available-bg)', color: 'var(--theme-accent)' }}>{selectedCustomer.name.substring(0, 2).toUpperCase()}</div>
                    <div className="flex-1"><p className="font-semibold text-sm" style={{ color: 'var(--theme-text-primary)' }}>{selectedCustomer.name}</p><p className="text-xs" style={{ color: 'var(--theme-text-secondary)' }}>{selectedCustomer.phone}</p></div>
                    <button onClick={() => setSelectedCustomer(null)} className="text-xs font-bold underline" style={{ color: 'var(--theme-text-secondary)' }}>Trocar</button>
                  </div>
                ) : isCreatingCustomer ? (
                  <div className="space-y-3 p-4 rounded-xl border" style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-bg-hover)' }}>
                    <div>
                      <input value={newCustomerName} onChange={e => setNewCustomerName(e.target.value)} className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none" style={{ background: 'var(--theme-input-bg)', borderColor: 'var(--theme-input-border)', color: 'var(--theme-input-text)', border: '1px solid var(--theme-input-border)' }} placeholder="Nome completo..." />
                    </div>
                    <div>
                      <input value={newCustomerPhone} onChange={e => setNewCustomerPhone(e.target.value)} className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none" style={{ background: 'var(--theme-input-bg)', borderColor: 'var(--theme-input-border)', color: 'var(--theme-input-text)', border: '1px solid var(--theme-input-border)' }} placeholder="Telefone ou WhatsApp..." />
                    </div>
                    <button onClick={handleCreateCustomer} disabled={creatingCustomer} className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2" style={{ background: 'var(--theme-accent-gradient)', color: 'var(--theme-btn-primary-text)' }}>
                      {creatingCustomer ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Cadastrar e Selecionar'}
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-3.5 w-4 h-4" style={{ color: 'var(--theme-text-secondary)' }} />
                    <input value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} className="w-full rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none border" style={{ background: 'var(--theme-input-bg)', borderColor: 'var(--theme-input-border)', color: 'var(--theme-input-text)' }} placeholder="Buscar por nome ou telefone..." />
                    {customerResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 border rounded-xl shadow-2xl overflow-hidden z-10" style={{ background: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)' }}>
                        {customerResults.map(c => (
                          <button key={c.id} onClick={() => { setSelectedCustomer(c); setCustomerSearch(''); setCustomerResults([]); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-black/5 transition-all text-left">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'var(--theme-calendar-available-bg)', color: 'var(--theme-accent)' }}>{c.name.substring(0, 2).toUpperCase()}</div>
                            <div><p className="text-sm font-semibold" style={{ color: 'var(--theme-text-primary)' }}>{c.name}</p><p className="text-xs" style={{ color: 'var(--theme-text-secondary)' }}>{c.phone}</p></div>
                          </button>
                        ))}
                      </div>
                    )}
                    {searchingCustomers && <Loader2 className="absolute right-3 top-3.5 w-4 h-4 animate-spin" style={{ color: 'var(--theme-text-secondary)' }} />}
                  </div>
                )}
              </div>

              {/* Summary */}
              <div className="rounded-2xl border p-4 space-y-3" style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-bg-hover)' }}>
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--theme-text-secondary)' }}>Resumo</p>
                {[
                  { label: 'Serviço', value: selectedService?.name },
                  { label: 'Profissional', value: selectedPro?.name ?? 'Qualquer disponível' },
                  { label: 'Data', value: format(selectedDate, "dd 'de' MMMM", { locale: ptBR }) },
                  { label: 'Horário', value: selectedTime },
                  { label: 'Duração', value: selectedService ? `${selectedService.duration_minutes} min` : null },
                  { label: 'Valor', value: selectedService ? fmt.format(selectedService.price) : null },
                ].map(row => row.value && (
                  <div key={row.label} className="flex items-center justify-between text-sm">
                    <span style={{ color: 'var(--theme-text-secondary)' }}>{row.label}</span>
                    <span className="font-semibold" style={{ color: 'var(--theme-text-primary)' }}>{row.value}</span>
                  </div>
                ))}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: 'var(--theme-text-secondary)' }}>Observações</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none resize-none" style={{ background: 'var(--theme-input-bg)', borderColor: 'var(--theme-input-border)', color: 'var(--theme-input-text)' }} placeholder="Preferências, alergias, detalhes..." />
              </div>

              {error && <p className="text-red-400 text-sm">{error}</p>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-3 p-6 pt-4 shrink-0 border-t" style={{ borderColor: 'var(--theme-border)' }}>
          {error && <p className="text-red-500 text-xs text-center">{error}</p>}
          <div className="flex gap-3 w-full">
            <button onClick={() => step > 1 ? setStep(s => (s - 1) as any) : onClose()} className="flex-1 py-3 rounded-xl border font-semibold text-sm transition-all hover:opacity-80" style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-secondary)' }}>
              {step === 1 ? 'Cancelar' : '← Voltar'}
            </button>
            <button
              onClick={() => {
                if (step < 4) setStep(s => (s + 1) as any);
                else handleSubmit();
              }}
              disabled={(step === 1 && !selectedService) || (step === 3 && !selectedTime) || isLoading}
              className="flex-1 py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-40 flex items-center justify-center gap-2"
              style={{ background: 'var(--theme-accent-gradient)', color: 'var(--theme-btn-primary-text)' }}
            >
              {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Criando...</> : step < 4 ? 'Continuar →' : <><Check className="w-4 h-4" /> Confirmar</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

