export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images, assets, admin, app, playlist
     * 
     * E.g. we want to match /kauan but ignore /images/RaffrosLogo.png
     */
    '/((?!api|_next/static|_next/image|favicon.ico|images|assets|admin|app|playlist|.*\\.).*)',
  ],
};

export default async function middleware(request: Request) {
  try {
    const url = new URL(request.url);
    const slug = url.pathname.split('/')[1];

    if (!slug) {
      return; // Skip root path
    }

    // Get Supabase credentials from the environment
    const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://paefckmkawocjxzuoclq.supabase.co';
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseKey) {
      console.warn('VITE_SUPABASE_ANON_KEY is not defined in the edge environment.');
      return; // Let the normal SPA load
    }

    // Fetch the tenant from Supabase using the REST API
    const res = await fetch(`${supabaseUrl}/rest/v1/tenants?slug=eq.${slug}&select=name,tenant_settings(logo_url,short_description)`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      }
    });

    if (!res.ok) {
      return; // If DB query fails, fallback to standard Vercel SPA routing
    }

    const data = await res.json();
    const tenant = data && data.length > 0 ? data[0] : null;

    if (!tenant) {
      return; // Tenant not found, let the standard SPA handle 404
    }

    // Fetch the original index.html
    const indexUrl = new URL('/index.html', request.url);
    const indexRes = await fetch(indexUrl);
    
    if (!indexRes.ok) {
      return;
    }

    let html = await indexRes.text();

    const logoUrl = tenant.tenant_settings?.logo_url || 'https://raffros.com.br/images/RaffrosLogo.png';
    const title = `${tenant.name} | Agendamento Online`;
    const desc = tenant.tenant_settings?.short_description || `Agende seu horário na ${tenant.name} de forma rápida e prática.`;

    // Replace the standard meta tags with tenant-specific tags
    html = html.replace(/<title>(.*?)<\/title>/g, `<title>${title}</title>`);
    
    html = html.replace(/<meta property="og:title" content="(.*?)">/g, `<meta property="og:title" content="${title}">`);
    html = html.replace(/<meta property="og:description" content="(.*?)">/g, `<meta property="og:description" content="${desc}">`);
    html = html.replace(/<meta property="og:image" content="(.*?)">/g, `<meta property="og:image" content="${logoUrl}">`);

    html = html.replace(/<meta property="twitter:title" content="(.*?)">/g, `<meta property="twitter:title" content="${title}">`);
    html = html.replace(/<meta property="twitter:description" content="(.*?)">/g, `<meta property="twitter:description" content="${desc}">`);
    html = html.replace(/<meta property="twitter:image" content="(.*?)">/g, `<meta property="twitter:image" content="${logoUrl}">`);

    html = html.replace(/<meta name="description" content="(.*?)">/g, `<meta name="description" content="${desc}">`);

    // Return the modified HTML to the user/crawler
    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 's-maxage=60, stale-while-revalidate=300' // Cache for 60s at the edge to speed up requests
      },
    });

  } catch (err) {
    console.error('Middleware error:', err);
    // Fail gracefully: don't break the site if the edge function crashes
    return;
  }
}
