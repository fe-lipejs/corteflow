import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from '../_shared/cors.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Usuário não autenticado");

    const { planId, returnUrl } = await req.json();

    // Buscar plano
    const { data: plan } = await supabase.from('plans').select('*').eq('id', planId).single();
    if (!plan) throw new Error("Plano não encontrado");

    // Buscar tenant associado ao usuário
    const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single();
    if (!profile?.tenant_id) throw new Error("Salão não encontrado para este usuário");

    // Criar a sessão no Stripe
    // Vamos assumir que os preços do Stripe já estão configurados ou criaremos um preço on the fly (apenas para exemplo)
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: 'brl',
            product_data: {
              name: `Plano ${plan.name} - Navalha SaaS`,
              description: plan.description,
            },
            unit_amount: 10000, // Substitua pelo valor real vindo do banco depois
            recurring: { interval: 'month' },
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${returnUrl}`,
      metadata: {
        tenant_id: profile.tenant_id,
        plan_id: plan.id,
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
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
