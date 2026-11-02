import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from '../_shared/cors.ts';
import { getStripeContext } from '../_shared/stripe.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { tenantId, serviceId, customerId } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { stripe, applicationFeePercent } = await getStripeContext(supabase);

    // Buscar o salão
    const { data: tenant } = await supabase.from('tenants').select('*').eq('id', tenantId).single();
    if (!tenant) throw new Error("Salão não encontrado");

    // Buscar a conta conectada do salão (Stripe Connect)
    const { data: connectAccount } = await supabase
      .from('stripe_connect_accounts')
      .select('stripe_account_id')
      .eq('tenant_id', tenantId)
      .single();
      
    if (!connectAccount || !connectAccount.stripe_account_id) {
      throw new Error("Salão não possui configuração de pagamento ativa");
    }

    // Buscar o serviço
    const { data: service } = await supabase.from('services').select('*').eq('id', serviceId).single();
    if (!service) throw new Error("Serviço não encontrado");

    const amount = Math.round(service.price * 100);
    const platformFeePercentage = (applicationFeePercent || 2) / 100;
    const applicationFeeAmount = Math.round(amount * platformFeePercentage);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: 'brl',
      metadata: {
        tenant_id: tenantId,
        service_id: serviceId,
        customer_id: customerId,
      },
      application_fee_amount: applicationFeeAmount,
      transfer_data: { 
        destination: connectAccount.stripe_account_id 
      },
    });

    return new Response(JSON.stringify({ clientSecret: paymentIntent.client_secret }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
