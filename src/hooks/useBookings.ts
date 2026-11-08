import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, startOfDay, endOfDay, addMinutes, isBefore, addDays } from 'date-fns';
import { supabase } from '../integrations/supabase/client';
import { useBarberSound } from './useBarberSound';

// ─── Types ────────────────────────────────────────────────────────────────────
export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'arrived'
  | 'in_progress'
  | 'completed'
  | 'canceled'
  | 'no_show';

export interface Booking {
  id: string;
  tenant_id: string;
  customer_id: string;
  professional_id: string | null;
  service_id: string;
  order_number: string;
  scheduled_at: string;
  status: BookingStatus;
  confirmation_status?: 'pending' | 'confirmed';
  confirmed_at?: string | null;
  booking_source?: 'manual' | 'online';
  payment_mode?: 'local' | 'deposit' | 'full';
  payment_status?: 'pending' | 'partial_paid' | 'paid' | 'full_paid' | 'refunded' | 'failed';

  amount_paid: number;
  amount_total: number;
  amount_due?: number;
  payment_method?: string;
  notes: string | null;
  access_code: string | null;
  pro_color: string;
  duration_minutes: number;
  buffer_minutes: number;
  // Hybrid Location (Migration 0046)
  service_location?: 'instore' | 'home';
  client_address?: string | null;
  client_lat?: number | null;
  client_lng?: number | null;
  travel_fee?: number;

  created_at: string;
  updated_at: string;
  // Joined
  customer?: { 
    id: string; 
    name: string; 
    phone: string; 
    email?: string | null;
    segment?: string | null;
    total_spent?: number;
    visit_count?: number;
    last_visit?: string | null;
    past_services?: string[] | null;
  };
  professional?: { id: string; name: string; agenda_color: string; photo_url?: string | null };
  service?: { id: string; name: string; duration_minutes: number; buffer_minutes: number; color?: string | null; price: number; commission_pct?: number };
}

export interface CreateBookingInput {
  customer_id: string;
  professional_id: string | null;
  service_id: string;
  scheduled_at: string; // ISO string
  payment_mode: string;
  payment_method?: string;
  confirmation_status?: 'pending' | 'confirmed';
  booking_source?: 'manual' | 'online';
  amount_total: number;
  duration_minutes: number;
  buffer_minutes: number;
  notes?: string;
  pro_color?: string;
  
  // Hybrid Location (Migration 0046)
  service_location?: 'instore' | 'home';
  client_address?: string | null;
  client_lat?: number | null;
  client_lng?: number | null;
  travel_fee?: number;
}

// ─── Status config ────────────────────────────────────────────────────────────
export const BOOKING_STATUS_CONFIG: Record<BookingStatus, { label: string; color: string; bg: string }> = {
  pending:     { label: 'Aguardando',    color: '#facc15', bg: '#facc1520' },
  confirmed:   { label: 'Confirmado',    color: '#4ade80', bg: '#4ade8020' },
  arrived:     { label: 'Cliente chegou',color: '#60a5fa', bg: '#60a5fa20' },
  in_progress: { label: 'Em atendimento',color: '#a78bfa', bg: '#a78bfa20' },
  completed:   { label: 'Finalizado',    color: '#94a3b8', bg: '#94a3b820' },
  canceled:    { label: 'Cancelado',     color: '#f87171', bg: '#f8717120' },
  no_show:     { label: 'Não compareceu',color: '#fb923c', bg: '#fb923c20' },
};

// ─── Query Key ────────────────────────────────────────────────────────────────
export const BOOKINGS_KEY = (tenantId: string, dateKey: string) => ['bookings', tenantId, dateKey];

// ─── Helper: filter out unpaid online checkout drafts ─────────────────────────
function isUnpaidOnlineDraft(b: Booking): boolean {
  return (
    b.status === 'pending' &&
    (b.payment_mode === 'deposit' || b.payment_mode === 'full') &&
    (!b.payment_status || b.payment_status === 'pending')
  );
}

// ─── Fetch bookings for a date range ─────────────────────────────────────────
async function fetchBookings(tenantId: string, from: Date, to: Date, professionalId?: string | null): Promise<Booking[]> {
  let query = supabase
    .from('bookings')
    .select(`
      *,
      customer:customers(id, name, phone, email, segment, total_spent, visit_count, last_visit, past_services),
      professional:professionals(id, name, agenda_color, photo_url),
      service:services(id, name, duration_minutes, buffer_minutes, color, price, commission_pct)
    `)
    .eq('tenant_id', tenantId)
    .gte('scheduled_at', from.toISOString())
    .lte('scheduled_at', to.toISOString())
    .not('status', 'in', '(canceled,no_show)')
    .order('scheduled_at', { ascending: true });

  if (professionalId) {
    query = query.eq('professional_id', professionalId);
  }

  const { data, error } = await query;

  if (error) throw error;
  const rows = (data ?? []) as unknown as Booking[];
  return rows.filter((b) => !isUnpaidOnlineDraft(b));
}

// ─── Fetch bookings for the Upcoming & Confirmations Center ───────────────────
async function fetchUpcomingCenterBookings(tenantId: string, professionalId?: string | null): Promise<Booking[]> {
  const now = new Date();
  const pastLookback = startOfDay(addDays(now, -30));
  const futureHorizon = endOfDay(addDays(now, 60));

  let query = supabase
    .from('bookings')
    .select(`
      *,
      customer:customers(id, name, phone, email, segment, total_spent, visit_count, last_visit, past_services),
      professional:professionals(id, name, agenda_color, photo_url),
      service:services(id, name, duration_minutes, buffer_minutes, color, price, commission_pct)
    `)
    .eq('tenant_id', tenantId)
    .gte('scheduled_at', pastLookback.toISOString())
    .lte('scheduled_at', futureHorizon.toISOString())
    .not('status', 'in', '(canceled,no_show)')
    .order('scheduled_at', { ascending: true });

  if (professionalId) {
    query = query.eq('professional_id', professionalId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as unknown as Booking[];

  return rows.filter((b) => {
    if (isUnpaidOnlineDraft(b)) return false;
    // Agendamentos já finalizados, cancelados ou no_show não entram na central
    if (b.status === 'completed' || b.status === 'canceled' || b.status === 'no_show') return false;

    // Retorna TODOS os agendamentos ativos em aberto: atrasados/esquecidos passados, hoje e futuros
    return true;
  });
}

// ─── Fetch ALL bookings for a date (for conflict check) ───────────────────────
async function fetchBookingsForConflict(
  tenantId: string,
  professionalId: string | null,
  date: Date,
  excludeBookingId?: string
): Promise<Booking[]> {
  let query = supabase
    .from('bookings')
    .select('id, scheduled_at, duration_minutes, buffer_minutes, professional_id, status, payment_mode, payment_status')
    .eq('tenant_id', tenantId)
    .gte('scheduled_at', startOfDay(date).toISOString())
    .lte('scheduled_at', endOfDay(date).toISOString())
    .not('status', 'in', '(canceled,no_show)');

  if (professionalId) query = query.eq('professional_id', professionalId);
  if (excludeBookingId) query = query.neq('id', excludeBookingId);

  const { data } = await query;
  const rows = (data ?? []) as unknown as Booking[];
  return rows.filter((b) => !isUnpaidOnlineDraft(b));
}

// ─── Check time slot availability ────────────────────────────────────────────
export async function checkSlotAvailability(
  tenantId: string,
  professionalId: string | null,
  scheduledAt: Date,
  durationMinutes: number,
  bufferMinutes: number,
  excludeBookingId?: string
): Promise<boolean> {
  const existing = await fetchBookingsForConflict(tenantId, professionalId, scheduledAt, excludeBookingId);
  const newEnd = addMinutes(scheduledAt, durationMinutes + bufferMinutes);

  for (const b of existing) {
    const bStart = new Date(b.scheduled_at);
    const bEnd = addMinutes(bStart, b.duration_minutes + b.buffer_minutes);
    // Overlap check
    if (scheduledAt < bEnd && newEnd > bStart) return false;
  }
  return true;
}

// ─── Hook: useBookingsByWeek ──────────────────────────────────────────────────
export function useBookingsByWeek(tenantId: string | null, weekStart: Date, professionalId?: string | null) {
  const from = startOfDay(addDays(weekStart, -7));
  const to = endOfDay(addDays(weekStart, 7));
  const dateKey = format(weekStart, 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['bookings', tenantId ?? '', 'week', dateKey, professionalId],
    queryFn: () => fetchBookings(tenantId!, from, to, professionalId),
    enabled: !!tenantId,
    staleTime: 1000 * 30, // 30s — agenda needs to be fresh
    refetchInterval: 1000 * 60, // auto-refresh every minute
  });
}

// ─── Hook: useBookingsByDay ───────────────────────────────────────────────────
export function useBookingsByDay(tenantId: string | null, day: Date, professionalId?: string | null) {
  const from = startOfDay(day);
  const to = endOfDay(day);
  const dateKey = format(day, 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['bookings', tenantId ?? '', 'day', dateKey, professionalId],
    queryFn: () => fetchBookings(tenantId!, from, to, professionalId),
    enabled: !!tenantId,
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60,
  });
}

// ─── Hook: useUpcomingCenterBookings ──────────────────────────────────────────
export function useUpcomingCenterBookings(tenantId: string | null, professionalId?: string | null) {
  return useQuery({
    queryKey: ['upcoming-center-bookings', tenantId ?? '', professionalId ?? 'all'],
    queryFn: () => fetchUpcomingCenterBookings(tenantId!, professionalId),
    enabled: !!tenantId,
    staleTime: 1000 * 20,
    refetchInterval: 1000 * 45,
  });
}

// ─── Hook: useCreateBooking ───────────────────────────────────────────────────
export function useCreateBooking(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateBookingInput) => {
      const orderNumber = `BOK-${Date.now().toString(36).toUpperCase()}`;
      const accessCode = Math.random().toString(36).substring(2, 10).toUpperCase();
      const confStatus = input.confirmation_status ?? 'confirmed';
      const nowIso = new Date().toISOString();

      const { data, error } = await supabase
        .from('bookings')
        .insert({
          tenant_id: tenantId,
          customer_id: input.customer_id,
          professional_id: input.professional_id,
          service_id: input.service_id,
          order_number: orderNumber,
          scheduled_at: input.scheduled_at,
          status: 'confirmed',
          confirmation_status: confStatus,
          confirmed_at: confStatus === 'confirmed' ? nowIso : null,
          booking_source: input.booking_source ?? 'manual',
          payment_mode: input.payment_mode,
          payment_method: input.payment_method ?? 'local',
          amount_total: input.amount_total,
          duration_minutes: input.duration_minutes,
          buffer_minutes: input.buffer_minutes,
          pro_color: input.pro_color ?? '#C9963B',
          notes: input.notes,
          access_code: accessCode,
        } as any)
        .select('*').single();
      if (error) throw error;
      if (data?.id) {
        supabase.functions
          .invoke('push-notifications', {
            body: {
              action: 'dispatch_booking_event',
              bookingId: data.id,
              eventType: 'booking_new',
            },
          })
          .catch((err) => console.warn('[useCreateBooking] Web Push error:', err));
      }
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings', tenantId] });
      qc.invalidateQueries({ queryKey: ['upcoming-center-bookings', tenantId] });
      qc.invalidateQueries({ queryKey: ['forgotten-bookings', tenantId] });
      qc.invalidateQueries({ queryKey: ['financials_full', tenantId] });
      qc.invalidateQueries({ queryKey: ['commissions', tenantId] });
      qc.invalidateQueries({ queryKey: ['clientes', tenantId] });
      qc.invalidateQueries({ queryKey: ['customer_history', tenantId] });
      qc.invalidateQueries({ queryKey: ['customer_history_bookings'] });
      qc.invalidateQueries({ queryKey: ['bookings', tenantId, 'dashboard_today'] });
      qc.invalidateQueries({ queryKey: ['bookings', tenantId, 'dashboard_recent'] });
      qc.invalidateQueries({ queryKey: ['bookings', tenantId, 'dashboard_upcoming'] });
    },
  });
}

// ─── Hook: useConfirmBooking (Single Source of Truth Confirmation) ────────────
export function useConfirmBooking(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, note }: { id: string; note?: string }) => {
      const nowIso = new Date().toISOString();

      const { data: current } = await supabase
        .from('bookings')
        .select('id, status, confirmation_status')
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      const updatePayload: Record<string, any> = {
        confirmation_status: 'confirmed',
        confirmed_at: nowIso,
      };

      if (current && (current as any).status === 'pending') {
        updatePayload.status = 'confirmed';
      }

      const { data, error } = await supabase
        .from('bookings')
        .update(updatePayload as any)
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .select('*')
        .single();

      if (error) throw error;

      // Log history non-blocking (usa exatamente as colunas reais da tabela booking_history)
      supabase
        .from('booking_history')
        .insert({
          booking_id: id,
          tenant_id: tenantId,
          from_status: (current as any)?.status ?? 'pending',
          to_status: 'confirmed',
          note: note ?? 'Confirmação de agendamento',
        })
        .then(() => {});

      return data as unknown as Booking;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings', tenantId] });
      qc.invalidateQueries({ queryKey: ['upcoming-center-bookings', tenantId] });
      qc.invalidateQueries({ queryKey: ['forgotten-bookings', tenantId] });
      qc.invalidateQueries({ queryKey: ['bookings', tenantId, 'dashboard_today'] });
      qc.invalidateQueries({ queryKey: ['bookings', tenantId, 'dashboard_recent'] });
      qc.invalidateQueries({ queryKey: ['bookings', tenantId, 'dashboard_upcoming'] });
    },
  });
}

// ─── Hook: useUpdateBookingStatus ─────────────────────────────────────────────
export function useUpdateBookingStatus(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, note }: { id: string; status: BookingStatus; note?: string }) => {
      // Get current booking for history & amount calculation
      const { data: current } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', id)
        .single();

      const updateFields: any = { status };
      if (status === 'confirmed' || status === 'arrived' || status === 'in_progress' || status === 'completed') {
        updateFields.confirmation_status = 'confirmed';
        if (!(current as any)?.confirmed_at) {
          updateFields.confirmed_at = new Date().toISOString();
        }
      }
      if (status === 'completed') {
        updateFields.amount_paid = current?.amount_total || 0;
        updateFields.amount_due = 0;
        updateFields.payment_status = 'paid';
      }

      const { error } = await supabase
        .from('bookings')
        .update(updateFields as any)
        .eq('id', id);

      if (error) {
        if (status === 'completed') {
          const fallbackFields = { ...updateFields, payment_status: 'full_paid' };
          const { error: retryErr } = await supabase
            .from('bookings')
            .update(fallbackFields as any)
            .eq('id', id);
          if (retryErr) throw retryErr;
        } else {
          throw error;
        }
      }

      // Log history (usa exatamente as colunas reais da tabela booking_history)
      supabase
        .from('booking_history')
        .insert({
          booking_id: id,
          tenant_id: tenantId,
          from_status: (current as any)?.status ?? null,
          to_status: status,
          note: note ?? null,
        })
        .then(() => {});

      if (status === 'canceled') {
        supabase.functions
          .invoke('push-notifications', {
            body: {
              action: 'dispatch_booking_event',
              bookingId: id,
              eventType: 'booking_canceled',
            },
          })
          .catch((err) => console.warn('[useUpdateBookingStatus] Web Push error:', err));
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings', tenantId] });
      qc.invalidateQueries({ queryKey: ['upcoming-center-bookings', tenantId] });
      qc.invalidateQueries({ queryKey: ['forgotten-bookings', tenantId] });
      qc.invalidateQueries({ queryKey: ['financials_full', tenantId] });
      qc.invalidateQueries({ queryKey: ['commissions', tenantId] });
      qc.invalidateQueries({ queryKey: ['clientes', tenantId] });
      qc.invalidateQueries({ queryKey: ['customer_history', tenantId] });
      qc.invalidateQueries({ queryKey: ['customer_history_bookings'] });
      qc.invalidateQueries({ queryKey: ['bookings', tenantId, 'dashboard_today'] });
      qc.invalidateQueries({ queryKey: ['bookings', tenantId, 'dashboard_recent'] });
      qc.invalidateQueries({ queryKey: ['bookings', tenantId, 'dashboard_upcoming'] });
    },
  });
}

// ─── Hook: useUpdateBooking ───────────────────────────────────────────────────
export function useUpdateBooking(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...fields }: Partial<CreateBookingInput> & { id: string }) => {
      const { error } = await supabase.from('bookings').update(fields as any).eq('id', id);
      if (error) throw error;
      if (fields.scheduled_at) {
        supabase.functions
          .invoke('push-notifications', {
            body: {
              action: 'dispatch_booking_event',
              bookingId: id,
              eventType: 'booking_rescheduled',
            },
          })
          .catch((err) => console.warn('[useUpdateBooking] Web Push error:', err));
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings', tenantId] });
      qc.invalidateQueries({ queryKey: ['upcoming-center-bookings', tenantId] });
      qc.invalidateQueries({ queryKey: ['forgotten-bookings', tenantId] });
      qc.invalidateQueries({ queryKey: ['financials_full', tenantId] });
      qc.invalidateQueries({ queryKey: ['commissions', tenantId] });
      qc.invalidateQueries({ queryKey: ['clientes', tenantId] });
      qc.invalidateQueries({ queryKey: ['bookings', tenantId, 'dashboard_today'] });
      qc.invalidateQueries({ queryKey: ['bookings', tenantId, 'dashboard_recent'] });
      qc.invalidateQueries({ queryKey: ['bookings', tenantId, 'dashboard_upcoming'] });
    },
  });
}

// ─── Hook: useDeleteBooking ───────────────────────────────────────────────────
export function useDeleteBooking(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('bookings').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings', tenantId] });
      qc.invalidateQueries({ queryKey: ['upcoming-center-bookings', tenantId] });
      qc.invalidateQueries({ queryKey: ['forgotten-bookings', tenantId] });
      qc.invalidateQueries({ queryKey: ['financials_full', tenantId] });
      qc.invalidateQueries({ queryKey: ['commissions', tenantId] });
      qc.invalidateQueries({ queryKey: ['clientes', tenantId] });
      qc.invalidateQueries({ queryKey: ['bookings', tenantId, 'dashboard_today'] });
      qc.invalidateQueries({ queryKey: ['bookings', tenantId, 'dashboard_recent'] });
      qc.invalidateQueries({ queryKey: ['bookings', tenantId, 'dashboard_upcoming'] });
    },
  });
}

// ─── Hook: useCancelBooking (RPC) ─────────────────────────────────────────────
export function useCancelBooking(tenantId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ bookingId, reason, actorType }: { bookingId: string; reason: string; actorType: 'client' | 'admin' }) => {
      const { data, error } = await supabase.functions.invoke('cancel-booking-financials', {
        body: { bookingId, reason, actorType }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      if (tenantId) {
        qc.invalidateQueries({ queryKey: ['bookings', tenantId] });
        qc.invalidateQueries({ queryKey: ['upcoming-center-bookings', tenantId] });
        qc.invalidateQueries({ queryKey: ['forgotten-bookings', tenantId] });
        qc.invalidateQueries({ queryKey: ['financials_full', tenantId] });
        qc.invalidateQueries({ queryKey: ['commissions', tenantId] });
      }
      qc.invalidateQueries({ queryKey: ['booking'] });
    },
  });
}

// ─── Hook: useRescheduleBooking (Edge Function) ────────────────────────────────
export function useRescheduleBooking(tenantId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ bookingId, newTime, newProId, actorType }: { bookingId: string; newTime: string; newProId: string | null; actorType: 'client' | 'admin' }) => {
      const { data, error } = await supabase.functions.invoke('reschedule-booking', {
        body: { bookingId, newTime, newProId, actorType },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      if (tenantId) {
        qc.invalidateQueries({ queryKey: ['bookings', tenantId] });
        qc.invalidateQueries({ queryKey: ['upcoming-center-bookings', tenantId] });
        qc.invalidateQueries({ queryKey: ['forgotten-bookings', tenantId] });
      }
      qc.invalidateQueries({ queryKey: ['booking'] });
      qc.invalidateQueries({ queryKey: ['customer-bookings'] });
    },
  });
}

// ─── Utility: generate time slots for a day ───────────────────────────────────
export function generateTimeSlots(
  targetDate: Date,
  openTime: string,   // "HH:mm"
  closeTime: string,  // "HH:mm"
  durationMinutes: number,
  bufferMinutes: number,
  existingBookings: Booking[],
  lunchStart?: string | null,
  lunchEnd?: string | null,
  allowPast: boolean = false
): string[] {
  const slots: string[] = [];
  const now = new Date();

  // If the targetDate is in the past (yesterday or earlier), we shouldn't show slots unless allowPast is true
  if (!allowPast && isBefore(startOfDay(targetDate), startOfDay(now))) return [];

  const targetDayStr = format(targetDate, 'yyyy-MM-dd');
  let current = new Date(`${targetDayStr}T${openTime.slice(0, 5).padStart(5, '0')}:00`);
  const closeDate = new Date(`${targetDayStr}T${closeTime.slice(0, 5).padStart(5, '0')}:00`);

  const serviceTotal = durationMinutes + bufferMinutes;

  while (isBefore(addMinutes(current, serviceTotal), closeDate) || +addMinutes(current, serviceTotal) === +closeDate) {
    const slotEnd = addMinutes(current, serviceTotal);

    // Skip past times if allowPast is false
    if (!allowPast && isBefore(current, now)) {
      current = addMinutes(current, 15);
      continue;
    }

    // Skip lunch
    let isLunch = false;
    if (lunchStart && lunchEnd) {
      const ls = new Date(`${targetDayStr}T${lunchStart.slice(0, 5)}:00`);
      const le = new Date(`${targetDayStr}T${lunchEnd.slice(0, 5)}:00`);
      if (current < le && slotEnd > ls) isLunch = true;
    }

    // Check conflicts with existing bookings
    let hasConflict = false;
    for (const b of existingBookings) {
      const bStart = new Date(b.scheduled_at);
      const bEnd = addMinutes(bStart, b.duration_minutes + b.buffer_minutes);
      if (current < bEnd && slotEnd > bStart) { hasConflict = true; break; }
    }

    if (!isLunch && !hasConflict) {
      slots.push(format(current, 'HH:mm'));
    }

    current = addMinutes(current, 15); // 15-min grid
  }

  return slots;
}

// ─── Realtime Hook ────────────────────────────────────────────────────────────
export function useBookingsRealtime(tenantId: string | null) {
  const queryClient = useQueryClient();
  const { play } = useBarberSound();

  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase.channel(`realtime-bookings-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          const newRow = payload.new as any;
          const oldRow = payload.old as any;
          // 🔔 Tocar campainha quando um novo agendamento já entra confirmado (local)
          // ou quando um agendamento online (PIX/Cartão) muda de 'pending' para 'confirmed'
          if (payload.eventType === 'INSERT' && newRow?.status === 'confirmed') {
            play('booking');
          } else if (
            payload.eventType === 'UPDATE' &&
            newRow?.status === 'confirmed' &&
            oldRow?.status &&
            oldRow.status !== 'confirmed'
          ) {
            play('booking');
          }
          // 🔕 Play cancel alert when a booking is marked canceled
          if (payload.eventType === 'UPDATE' && newRow?.status === 'canceled') {
            play('cancel');
          }
          // Invalidate bookings and related financial/customer queries for this tenant
          queryClient.invalidateQueries({ queryKey: ['bookings', tenantId] });
          queryClient.invalidateQueries({ queryKey: ['upcoming-center-bookings', tenantId] });
          queryClient.invalidateQueries({ queryKey: ['forgotten-bookings', tenantId] });
          queryClient.invalidateQueries({ queryKey: ['financials_full', tenantId] });
          queryClient.invalidateQueries({ queryKey: ['commissions', tenantId] });
          queryClient.invalidateQueries({ queryKey: ['clientes', tenantId] });
          queryClient.invalidateQueries({ queryKey: ['customer-bookings'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, queryClient, play]);
}
