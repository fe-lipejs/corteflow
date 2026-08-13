import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, addMinutes, isBefore } from 'date-fns';
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
  payment_mode?: 'pay_local' | 'partial_50' | 'full_100';
  payment_status?: 'pending' | 'partial_paid' | 'full_paid' | 'refunded' | 'failed';
  amount_paid: number;
  amount_total: number;
  amount_due?: number;
  payment_method?: string;
  notes: string | null;
  access_code: string | null;
  pro_color: string;
  duration_minutes: number;
  buffer_minutes: number;
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
  service?: { id: string; name: string; duration_minutes: number; buffer_minutes: number; color?: string | null; price: number };
}

export interface CreateBookingInput {
  customer_id: string;
  professional_id: string | null;
  service_id: string;
  scheduled_at: string; // ISO string
  payment_mode: string;
  amount_total: number;
  duration_minutes: number;
  buffer_minutes: number;
  notes?: string;
  pro_color?: string;
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

// ─── Fetch bookings for a date range ─────────────────────────────────────────
async function fetchBookings(tenantId: string, from: Date, to: Date): Promise<Booking[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      *,
      customer:customers(id, name, phone, email, segment, total_spent, visit_count, last_visit, past_services),
      professional:professionals(id, name, agenda_color, photo_url),
      service:services(id, name, duration_minutes, buffer_minutes, color, price)
    `)
    .eq('tenant_id', tenantId)
    .gte('scheduled_at', from.toISOString())
    .lte('scheduled_at', to.toISOString())
    .not('status', 'in', '("canceled","no_show")')
    .order('scheduled_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as Booking[];
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
    .select('id, scheduled_at, duration_minutes, buffer_minutes, professional_id')
    .eq('tenant_id', tenantId)
    .gte('scheduled_at', startOfDay(date).toISOString())
    .lte('scheduled_at', endOfDay(date).toISOString())
    .not('status', 'in', '("canceled","no_show")');

  if (professionalId) query = query.eq('professional_id', professionalId);
  if (excludeBookingId) query = query.neq('id', excludeBookingId);

  const { data } = await query;
  return (data ?? []) as unknown as Booking[];
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
export function useBookingsByWeek(tenantId: string | null, weekStart: Date) {
  const from = startOfWeek(weekStart, { weekStartsOn: 0 });
  const to = endOfWeek(weekStart, { weekStartsOn: 0 });
  const dateKey = format(from, 'yyyy-MM-dd');

  return useQuery({
    queryKey: BOOKINGS_KEY(tenantId ?? '', dateKey),
    queryFn: () => fetchBookings(tenantId!, from, to),
    enabled: !!tenantId,
    staleTime: 1000 * 30, // 30s — agenda needs to be fresh
    refetchInterval: 1000 * 60, // auto-refresh every minute
  });
}

// ─── Hook: useBookingsByDay ───────────────────────────────────────────────────
export function useBookingsByDay(tenantId: string | null, day: Date) {
  const from = startOfDay(day);
  const to = endOfDay(day);
  const dateKey = format(day, 'yyyy-MM-dd');

  return useQuery({
    queryKey: BOOKINGS_KEY(tenantId ?? '', dateKey),
    queryFn: () => fetchBookings(tenantId!, from, to),
    enabled: !!tenantId,
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60,
  });
}

// ─── Hook: useCreateBooking ───────────────────────────────────────────────────
export function useCreateBooking(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateBookingInput) => {
      const orderNumber = `BOK-${Date.now().toString(36).toUpperCase()}`;
      const accessCode = Math.random().toString(36).substring(2, 10).toUpperCase();

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
          payment_mode: input.payment_mode,
          amount_total: input.amount_total,
          duration_minutes: input.duration_minutes,
          buffer_minutes: input.buffer_minutes,
          pro_color: input.pro_color ?? '#C9963B',
          notes: input.notes,
          access_code: accessCode,
        } as any)
        .select('*').single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bookings', tenantId] }),
  });
}

// ─── Hook: useUpdateBookingStatus ─────────────────────────────────────────────
export function useUpdateBookingStatus(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, note }: { id: string; status: BookingStatus; note?: string }) => {
      // Get current status for history
      const { data: current } = await supabase
        .from('bookings')
        .select('status')
        .eq('id', id)
        .single();

      const { error } = await supabase
        .from('bookings')
        .update({ status } as any)
        .eq('id', id);
      if (error) throw error;

      // Log history
      await supabase.from('booking_history').insert({
        booking_id: id,
        tenant_id: tenantId,
        action: 'status_changed',
        details: { from_status: (current as any)?.status, to_status: status },
        reason: note ?? null,
        actor_type: 'admin',
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bookings', tenantId] }),
  });
}

// ─── Hook: useUpdateBooking ───────────────────────────────────────────────────
export function useUpdateBooking(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...fields }: Partial<CreateBookingInput> & { id: string }) => {
      const { error } = await supabase.from('bookings').update(fields as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bookings', tenantId] }),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bookings', tenantId] }),
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
      if (tenantId) qc.invalidateQueries({ queryKey: ['bookings', tenantId] });
      // We should also probably invalidate by access_code if the client is using it
      qc.invalidateQueries({ queryKey: ['booking'] });
    },
  });
}

// ─── Hook: useRescheduleBooking (RPC) ─────────────────────────────────────────
export function useRescheduleBooking(tenantId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ bookingId, newTime, newProId, actorType }: { bookingId: string; newTime: string; newProId: string; actorType: 'client' | 'admin' }) => {
      const { data, error } = await supabase.rpc('reschedule_booking', {
        p_booking_id: bookingId,
        p_new_time: newTime,
        p_new_pro_id: newProId,
        p_actor_type: actorType,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      if (tenantId) qc.invalidateQueries({ queryKey: ['bookings', tenantId] });
      qc.invalidateQueries({ queryKey: ['booking'] });
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
  const [oh, om] = openTime.split(':').map(Number);
  const [ch, cm] = closeTime.split(':').map(Number);
  const now = new Date();

  // If the targetDate is in the past (yesterday or earlier), we shouldn't show slots unless allowPast is true
  if (!allowPast && isBefore(startOfDay(targetDate), startOfDay(now))) return [];

  const targetDayStr = format(targetDate, 'yyyy-MM-dd');
  let current = new Date(`${targetDayStr}T${openTime.padStart(5, '0')}:00`);
  const closeDate = new Date(`${targetDayStr}T${closeTime.padStart(5, '0')}:00`);

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
          // 🔔 Play distinct chime on new booking
          if (payload.eventType === 'INSERT') {
            play('booking');
          }
          // 🔕 Play cancel alert when a booking is marked canceled
          if (payload.eventType === 'UPDATE' && (payload.new as any)?.status === 'canceled') {
            play('cancel');
          }
          // Invalidate bookings for this tenant (will match ['bookings', tenantId, ...])
          queryClient.invalidateQueries({ queryKey: ['bookings', tenantId] });
          // Invalidate customer portal bookings as well so it updates in real time for the client
          queryClient.invalidateQueries({ queryKey: ['customer-bookings'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, queryClient, play]);
}

