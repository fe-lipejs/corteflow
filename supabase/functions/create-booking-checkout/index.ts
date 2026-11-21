import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from '../_shared/cors.ts';
import {
  getMercadoPagoContext,
  getTenantMercadoPagoAccount,
  refreshTenantMercadoPagoToken,
  mpRequest,
} from '../_shared/stripe.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabase = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const mpContext = await getMercadoPagoContext(supabase);
    const { bookingId, returnUrl } = await req.json();

    const { data: booking } = await supabase
      .from('bookings')
      .select('*, tenants(name), services(name, price)')
      .eq('id', bookingId)
      .single();

    if (!booking) throw new Error("Agendamento não encontrado");

    const tenantMp = await getTenantMercadoPagoAccount(supabase, booking.tenant_id, mpContext);
    if (!tenantMp || !tenantMp.chargesEnabled) {
      throw new Error("O salão ainda não conectou sua conta Mercado Pago. Por favor, escolha a opção de pagamento no local.");
    }

    if (mpContext.mode === 'live' && tenantMp.isTestUser) {
      throw new Error(
        "Este salão ainda está com uma conta de testes do Mercado Pago conectada. Solicite que reconecte sua conta real em Configurações ou escolha 'Pagar no local'."
      );
    }

    const amountTotal = Number(booking.amount_total);
    const amountToCharge = Number(
      (booking.payment_mode === 'deposit' ? Number(booking.amount_paid) : amountTotal).toFixed(2)
    );

    if (amountToCharge < 0.5) {
      throw new Error("O valor mínimo para pagamento online é de R$ 0,50.");
    }

    const rawFeeBRL =
      tenantMp.isOAuth && mpContext.applicationFeePercent > 0
        ? Number(((amountToCharge * mpContext.applicationFeePercent) / 100).toFixed(2))
        : 0;
    const applicationFeeBRL =
      rawFeeBRL > 0 && rawFeeBRL < amountToCharge && !tenantMp.isTestUser
        ? rawFeeBRL
        : 0;

    const serviceName = (booking.services as any)?.name || 'Serviço';
    const salonName = (booking.tenants as any)?.name || 'Salão';
    const description = booking.payment_mode === 'deposit'
      ? `Sinal/Entrada (R$ ${booking.amount_paid} de R$ ${amountTotal}) - ${serviceName}`
      : `Agendamento de ${serviceName} no ${salonName}`;

    let safeReturnUrl = returnUrl || '';
    if (!safeReturnUrl.startsWith('http://') && !safeReturnUrl.startsWith('https://')) {
      const origin = req.headers.get('origin') || req.headers.get('referer') || 'https://raffros.com';
      const cleanOrigin = origin.replace(/\/$/, '');
      safeReturnUrl = `${cleanOrigin}${safeReturnUrl.startsWith('/') ? '' : '/'}${safeReturnUrl}`;
    }
    const baseReturn = safeReturnUrl.split('?')[0];
    const successUrl = `${baseReturn}?order=${booking.order_number}&booking_id=${booking.id}`;
    const pendingUrl = `${baseReturn}?order=${booking.order_number}&booking_id=${booking.id}&mp_pending=true`;
    const cancelUrl = `${baseReturn}?cancel=true&booking_id=${booking.id}`;

    const prefBody: Record<string, any> = {
      items: [
        {
          id: booking.service_id || booking.id,
          title: `${serviceName} - ${salonName}`,
          description,
          quantity: 1,
          currency_id: 'BRL',
          unit_price: amountToCharge,
        },
      ],
      payment_methods: {
        excluded_payment_types: [
          { id: 'ticket' },
          { id: 'atm' },
        ],
        excluded_payment_methods: [
          { id: 'bolbradesco' },
          { id: 'meliplace' },
          { id: 'pec' },
        ],
      },
      external_reference: booking.id,
      notification_url: `${supabaseUrl}/functions/v1/stripe-webhook?tenant_id=${booking.tenant_id}`,
      back_urls: {
        success: successUrl,
        pending: pendingUrl,
        failure: cancelUrl,
      },
      statement_descriptor: salonName.slice(0, 22),
      metadata: {
        type: 'booking',
        booking_id: booking.id,
        tenant_id: booking.tenant_id,
        order_number: booking.order_number,
      },
    };

    if (successUrl.startsWith('https://') && !successUrl.includes('localhost') && !successUrl.includes('127.0.0.1')) {
      prefBody.auto_return = 'approved';
    }

    if (applicationFeeBRL > 0) {
      prefBody.marketplace_fee = applicationFeeBRL;
    }

    let pref: any;
    try {
      pref = await mpRequest<any>('/checkout/preferences', tenantMp.accessToken, {
        method: 'POST',
        body: prefBody,
      });
    } catch (prefErr: any) {
      const errMsg = String(prefErr?.message || '');
      if (errMsg.includes('unauthorized') || errMsg.includes('401') || errMsg.includes('invalid')) {
        const refreshedTok = await refreshTenantMercadoPagoToken(supabase, booking.tenant_id, mpContext);
        if (refreshedTok) {
          pref = await mpRequest<any>('/checkout/preferences', refreshedTok, {
            method: 'POST',
            body: prefBody,
          });
        } else {
          throw prefErr;
        }
      } else if (
        (mpContext.mode === 'test' || tenantMp.isTestUser) &&
        errMsg.includes('user_allowed_only_in_test') &&
        mpContext.testAccessToken &&
        mpContext.testAccessToken !== tenantMp.accessToken
      ) {
        delete prefBody.marketplace_fee;
        pref = await mpRequest<any>('/checkout/preferences', mpContext.testAccessToken, {
          method: 'POST',
          body: prefBody,
        });
      } else {
        throw prefErr;
      }
    }

    await supabase.from('payments').insert({
      tenant_id: booking.tenant_id,
      booking_id: booking.id,
      stripe_payment_intent_id: pref.id,
      mp_preference_id: pref.id,
      mp_collector_id: tenantMp.mpUserId,
      amount: amountToCharge,
      platform_fee: applicationFeeBRL,
      net_amount: Math.max(0, amountToCharge - applicationFeeBRL),
      payment_method: 'card',
      status: 'pending',
    });

    const url = pref.init_point || pref.sandbox_init_point;

    return new Response(JSON.stringify({ url, preferenceId: pref.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error("Create Booking Checkout (MP) Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
