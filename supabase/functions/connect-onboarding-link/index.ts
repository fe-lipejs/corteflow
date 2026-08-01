import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from "https://esm.sh/stripe@12.1.1?target=deno"

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2022-11-15',
  httpClient: Stripe.createFetchHttpClient(),
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  
  try {
    const { account_id } = await req.json()
    
    if (!account_id) {
      throw new Error('account_id is required')
    }

    const accountLink = await stripe.accountLinks.create({
      account: account_id,
      refresh_url: `${req.headers.get('origin') ?? 'http://localhost:5173'}/app/financeiro?setup_status=refresh`,
      return_url: `${req.headers.get('origin') ?? 'http://localhost:5173'}/app/financeiro?setup_status=complete`,
      type: 'account_onboarding',
    });

    return new Response(
      JSON.stringify({ url: accountLink.url }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } },
    )
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }
})
