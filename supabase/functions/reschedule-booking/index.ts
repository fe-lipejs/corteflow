import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from '../_shared/cors.ts';
import { dispatchBookingPushEvent } from '../_shared/webpush.ts';

function getSaoPauloDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

function computeMaxDateKey(todayKey: string, maxAdvanceDays: number): string {
  const anchor = new Date(`${todayKey}T12:00:00Z`);
  anchor.setUTCDate(anchor.getUTCDate() + (maxAdvanceDays - 1));
  return anchor.toISOString().slice(0, 10);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Use service role to bypass RLS (same pattern as cancel-booking-financials)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { bookingId, newTime, newProId, actorType } = await req.json();

    if (!bookingId || !newTime) {
      throw new Error('Missing required fields: bookingId, newTime');
    }

    const newAppointment = new Date(newTime);
    if (Number.isNaN(newAppointment.getTime())) {
      throw new Error('Nova data ou horário inválido.');
    }

    // 1. Fetch the current booking
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      throw new Error('Booking not found');
    }

    // 2. Check booking can be rescheduled
    const nonReschedulableStatuses = ['canceled', 'completed', 'no_show', 'in_progress', 'arrived'];
    if (nonReschedulableStatuses.includes(booking.status)) {
      throw new Error('Este agendamento não pode ser reagendado no status atual.');
    }

    // 3. Fetch tenant_settings for global horizon + client-side policy validation
    const { data: settings } = await supabase
      .from('tenant_settings')
      .select('allow_reschedule, reschedule_deadline_hours, max_reschedules, max_advance_days')
      .eq('tenant_id', booking.tenant_id)
      .maybeSingle();

    // Global Rule: Antecedência Máxima de Agendamento (aplica para cliente e proprietário ao mudar de dia)
    const effectiveMaxAdvanceDays: number | null = settings
      ? settings.max_advance_days
      : 30;

    const oldDateKey = getSaoPauloDateKey(new Date(booking.scheduled_at));
    const targetDateKey = getSaoPauloDateKey(newAppointment);

    if (targetDateKey !== oldDateKey && effectiveMaxAdvanceDays !== null && effectiveMaxAdvanceDays >= 1) {
      const todayKey = getSaoPauloDateKey(new Date());
      const maxDateKey = computeMaxDateKey(todayKey, effectiveMaxAdvanceDays);
      if (targetDateKey > maxDateKey) {
        const maxDateBR = maxDateKey.split('-').reverse().join('/');
        throw new Error(
          `Data fora da antecedência máxima permitida (${effectiveMaxAdvanceDays} ${
            effectiveMaxAdvanceDays === 1 ? 'dia' : 'dias'
          }, disponível até ${maxDateBR}).`
        );
      }
    }

    if (actorType === 'client') {
      // allow_reschedule check (null = allow by default)
      if (settings?.allow_reschedule === false) {
        throw new Error('O salão não permite reagendamentos pelo portal.');
      }

      // max_reschedules check (null = unlimited)
      const maxReschedules = settings?.max_reschedules ?? null;
      const currentCount = booking.reschedule_count ?? 0;
      if (maxReschedules !== null && currentCount >= maxReschedules) {
        throw new Error(`Limite atingido: este agendamento já foi reagendado ${maxReschedules}x.`);
      }

      // Deadline check: null = no deadline
      const deadlineHours = settings?.reschedule_deadline_hours ?? null;
      if (deadlineHours !== null) {
        const oldAppointment = new Date(booking.scheduled_at);
        const hoursUntilOld = (oldAppointment.getTime() - Date.now()) / (1000 * 60 * 60);
        if (hoursUntilOld < deadlineHours) {
          throw new Error(`Prazo esgotado. O reagendamento deve ser feito com pelo menos ${deadlineHours}h de antecedência.`);
        }
      }
    }

    // 4. Determine the professional to use (keep existing if not provided)
    const finalProId = newProId ?? booking.professional_id;

    // 5. Determine history action
    let action = 'rescheduled';
    if (booking.scheduled_at !== newTime && booking.professional_id === finalProId) {
      action = 'time_changed';
    } else if (booking.scheduled_at === newTime && booking.professional_id !== finalProId) {
      action = 'pro_changed';
    }

    // 6. Update the booking
    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        scheduled_at: newTime,
        professional_id: finalProId,
        reschedule_count: (booking.reschedule_count ?? 0) + 1,
      })
      .eq('id', bookingId);

    if (updateError) {
      throw new Error(`Erro ao atualizar agendamento: ${updateError.message}`);
    }

    // 7. Insert booking history
    await supabase.from('booking_history').insert({
      tenant_id: booking.tenant_id,
      booking_id: bookingId,
      action,
      details: {
        old_time: booking.scheduled_at,
        new_time: newTime,
        old_pro: booking.professional_id,
        new_pro: finalProId,
      },
      actor_type: actorType ?? 'client',
    });

    await dispatchBookingPushEvent(supabase, bookingId, 'booking_rescheduled').catch(() => {});

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Error processing reschedule:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
