import { Context } from "@netlify/edge-functions";

export default async (request: Request, context: Context) => {
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  
  // We only care about root level slugs like /kauan
  // It shouldn't have multiple parts like /kauan/algo
  if (pathParts.length !== 1) {
    return context.next();
  }

  const slug = pathParts[0];

  // Ignore standard static paths and files
  const ignoredSlugs = ['api', 'admin', 'app', 'playlist', 'images', 'assets', 'favicon.ico'];
  if (ignoredSlugs.includes(slug) || slug.includes('.')) {
    return context.next();
  }

  // Get env vars. Netlify Edge Functions use Deno.env or Netlify.env
  // Deno.env is the standard for Netlify Edge Functions
  const supabaseUrl = Deno.env.get("VITE_SUPABASE_URL") || 'https://paefckmkawocjxzuoclq.supabase.co';
  const supabaseKey = Deno.env.get("VITE_SUPABASE_ANON_KEY");

  if (!supabaseKey) {
    console.warn("VITE_SUPABASE_ANON_KEY not found in Edge Function environment.");
    return context.next();
  }

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/tenants?slug=eq.${slug}&select=name,tenant_settings(logo_url,short_description)`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      }
    });

    if (!res.ok) {
      return context.next();
    }

    const data = await res.json();
    const tenant = data && data.length > 0 ? data[0] : null;

    if (!tenant) {
      return context.next();
    }

    // Get the actual HTML response that Netlify would normally serve (index.html)
    const response = await context.next();
    
    // Only process HTML responses
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("text/html")) {
      return response;
    }

    let html = await response.text();

    const logoUrl = tenant.tenant_settings?.logo_url || 'https://raffros.com.br/images/RaffrosLogo.png';
    const title = `${tenant.name} | Agendamento Online`;
    const desc = tenant.tenant_settings?.short_description || `Agende seu horário na ${tenant.name} de forma rápida e prática.`;

    html = html.replace(/<title>(.*?)<\/title>/g, `<title>${title}</title>`);
    html = html.replace(/<meta property="og:title" content="(.*?)">/g, `<meta property="og:title" content="${title}">`);
    html = html.replace(/<meta property="og:description" content="(.*?)">/g, `<meta property="og:description" content="${desc}">`);
    html = html.replace(/<meta property="og:image" content="(.*?)">/g, `<meta property="og:image" content="${logoUrl}">`);
    html = html.replace(/<meta property="twitter:title" content="(.*?)">/g, `<meta property="twitter:title" content="${title}">`);
    html = html.replace(/<meta property="twitter:description" content="(.*?)">/g, `<meta property="twitter:description" content="${desc}">`);
    html = html.replace(/<meta property="twitter:image" content="(.*?)">/g, `<meta property="twitter:image" content="${logoUrl}">`);
    html = html.replace(/<meta name="description" content="(.*?)">/g, `<meta name="description" content="${desc}">`);

    const newResponse = new Response(html, response);
    // Explicitly set the headers again just to be safe
    newResponse.headers.set("content-type", "text/html; charset=utf-8");
    return newResponse;

  } catch (err) {
    console.error('Edge Function Error:', err);
    return context.next();
  }
};
