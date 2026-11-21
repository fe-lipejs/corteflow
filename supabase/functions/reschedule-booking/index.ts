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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { bookingId, newTime, newProId, actorType = 'client' } = await req.json();

    if (!bookingId || !newTime) {
      throw new Error('Campos obrigatórios ausentes para reagendar.');
    }

    const newAppointment = new Date(newTime);
    if (Number.isNaN(newAppointment.getTime())) {
      throw new Error('Nova data ou horário inválido.');
    }

    if (newAppointment.getTime() < Date.now() - 5 * 60 * 1000) {
      throw new Error('Não é possível reagendar para um horário que já passou.');
    }

    // 1. Buscar agendamento atual
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      throw new Error('Agendamento não encontrado.');
    }

    let actorUserId: string | null = null;
    if (actorType !== 'client') {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        throw new Error('Sessão administrativa necessária para reagendar.');
      }
      const supabaseAuth = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user } } = await supabaseAuth.auth.getUser();
      if (!user) {
        throw new Error('Usuário não autenticado para reagendamento administrativo.');
      }
      const { data: callerProfile } = await supabase
        .from('profiles')
        .select('tenant_id, role')
        .eq('id', user.id)
        .maybeSingle();

      const isAllowed =
        callerProfile?.role === 'super_admin' ||
        (callerProfile?.tenant_id === booking.tenant_id && callerProfile?.role !== 'customer');
      if (!isAllowed) {
        throw new Error('Permissão negada para reagendar este agendamento.');
      }
      actorUserId = user.id;
    }

    // 2. Validar status atual
    const nonReschedulableStatuses = ['canceled', 'completed', 'no_show', 'in_progress', 'arrived'];
    if (nonReschedulableStatuses.includes(booking.status)) {
      throw new Error('Este agendamento não pode ser reagendado no status atual.');
    }

    // 3. Políticas do salão e antecedência máxima
    const { data: settings } = await supabase
      .from('tenant_settings')
      .select('allow_reschedule, reschedule_deadline_hours, max_reschedules, max_advance_days')
      .eq('tenant_id', booking.tenant_id)
      .maybeSingle();

    const effectiveMaxAdvanceDays: number | null = settings ? settings.max_advance_days : 30;
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
      if (settings?.allow_reschedule === false) {
        throw new Error('O salão não permite reagendamentos pelo portal.');
      }

      const maxReschedules = settings?.max_reschedules ?? null;
      const currentCount = booking.reschedule_count ?? 0;
      if (maxReschedules !== null && currentCount >= maxReschedules) {
        throw new Error(`Limite atingido: este agendamento já foi reagendado ${maxReschedules}x.`);
      }

      const deadlineHours = settings?.reschedule_deadline_hours ?? null;
      if (deadlineHours !== null) {
        const oldAppointment = new Date(booking.scheduled_at);
        const hoursUntilOld = (oldAppointment.getTime() - Date.now()) / (1000 * 60 * 60);
        if (hoursUntilOld < deadlineHours) {
          throw new Error(
            `Prazo esgotado. O reagendamento deve ser feito com pelo menos ${deadlineHours}h de antecedência.`
          );
        }
      }
    }

    // 4. Profissional final + checagem de conflito (bloqueios e outros agendamentos)
    const rawPro = newProId === 'any' ? null : (newProId ?? booking.professional_id);
    const finalProId = rawPro || booking.professional_id || null;

    const slotDurationMin = (booking.duration_minutes ?? 30) + (booking.buffer_minutes ?? 0);
    const slotEnd = new Date(newAppointment.getTime() + slotDurationMin * 60 * 1000);

    let blockQuery = supabase
      .from('professional_blocked_times')
      .select('id')
      .eq('tenant_id', booking.tenant_id)
      .lt('starts_at', slotEnd.toISOString())
      .gt('ends_at', newAppointment.toISOString());

    if (finalProId) {
      blockQuery = blockQuery.or(`professional_id.eq.${finalProId},professional_id.is.null`);
    }

    const { data: activeBlocks } = await blockQuery.limit(1);
    if (activeBlocks && activeBlocks.length > 0) {
      throw new Error('Este horário está bloqueado na agenda do salão. Por favor, escolha outro horário.');
    }

    if (finalProId) {
      const searchWindowStart = new Date(newAppointment.getTime() - 240 * 60 * 1000).toISOString();
      const fifteenMinAgoMs = Date.now() - 15 * 60 * 1000;
      const { data: existingBookings } = await supabase
        .from('bookings')
        .select('id, scheduled_at, duration_minutes, buffer_minutes, status, payment_mode, created_at')
        .eq('tenant_id', booking.tenant_id)
        .eq('professional_id', finalProId)
        .neq('id', bookingId)
        .in('status', ['confirmed', 'pending', 'arrived', 'in_progress'])
        .lt('scheduled_at', slotEnd.toISOString())
        .gt('scheduled_at', searchWindowStart);

      const hasCollision = (existingBookings || []).some((b: any) => {
        if (
          b.status === 'pending' &&
          b.payment_mode !== 'local' &&
          b.created_at &&
          new Date(b.created_at).getTime() < fifteenMinAgoMs
        ) {
          return false;
        }
        const bStart = new Date(b.scheduled_at);
        const bDur = (b.duration_minutes ?? 30) + (b.buffer_minutes ?? 0);
        const bEnd = new Date(bStart.getTime() + bDur * 60 * 1000);
        return newAppointment.getTime() < bEnd.getTime() && slotEnd.getTime() > bStart.getTime();
      });

      if (hasCollision) {
        throw new Error('Este horário acabou de ser preenchido por outro cliente. Por favor, escolha outro horário.');
      }
    }

    // 5. Histórico e atualização
    let action = 'rescheduled';
    if (booking.scheduled_at !== newTime && booking.professional_id === finalProId) {
      action = 'time_changed';
    } else if (booking.scheduled_at === newTime && booking.professional_id !== finalProId) {
      action = 'pro_changed';
    }

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

    try {
      await supabase.from('booking_history').insert({
        tenant_id: booking.tenant_id,
        booking_id: bookingId,
        from_status: booking.status,
        to_status: booking.status,
        changed_by: actorUserId,
        note: `${actorType === 'client' ? 'Cliente (Portal)' : 'Admin'} (${action}): ${booking.scheduled_at} -> ${newTime}`,
      });
    } catch (_) {}

    await dispatchBookingPushEvent(supabase, bookingId, 'booking_rescheduled').catch(() => {});

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error('Error processing reschedule:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }
});
