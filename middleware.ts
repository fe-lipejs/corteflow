export default async function middleware(request) {
  const url = new URL(request.url);
  const pathParts = url.pathname.split("/").filter(Boolean);

  if (pathParts.length !== 1) {
    return;
  }

  const slug = pathParts[0];
  const ignoredSlugs = ["api", "admin", "platform", "app", "images", "assets", "favicon.ico"];

  if (ignoredSlugs.includes(slug) || slug.includes(".")) {
    return;
  }

  const indexUrl = new URL("/index.html", request.url);
  const indexRes = await fetch(indexUrl.toString());

  if (!indexRes.ok) {
    return;
  }

  let html = await indexRes.text();

  let title = "Raffros | Gestão e Agendamento para Barbearias e Salões";
  let desc = "Garanta seu atendimento. Faça seu agendamento agora.";
  let logoUrl = "https://raffros.com/images/RaffrosLogo.png";

  if (slug === "playlist") {
    title = "Raffros | Som da Casa";
    desc = "D� um play, respire e leve uma Palavra para o seu dia.";
  } else {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://paefckmkawocjxzuoclq.supabase.co";
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

    if (supabaseKey) {
      try {
        const res = await fetch(`${supabaseUrl}/rest/v1/tenants?slug=eq.${slug}&select=name,business_type,tenant_settings(logo_url,short_description)`, {
          headers: {
            "apikey": supabaseKey,
            "Authorization": `Bearer ${supabaseKey}`,
          }
        });

        if (res.ok) {
          const data = await res.json();
          const tenant = data && data.length > 0 ? data[0] : null;

          if (tenant) {
            title = `${tenant.name} | Agende agora.`;
            desc = tenant.tenant_settings?.short_description || `Garanta seu atendimento. Fa�a seu agendamento agora. ??`;
            logoUrl = tenant.tenant_settings?.logo_url || logoUrl;
          }
        }
      } catch (err) {
        console.error("Edge Function Error:", err);
      }
    }
  }

  html = html.replace(/<title>[\s\S]*?<\/title>/g, `<title>${title}<\/title>`);
  html = html.replace(/<meta property="og:title"[\s\S]*?>/g, `<meta property="og:title" content="${title}">`);
  html = html.replace(/<meta property="og:description"[\s\S]*?>/g, `<meta property="og:description" content="${desc}">`);
  html = html.replace(/<meta property="og:image"[\s\S]*?>/g, `<meta property="og:image" content="${logoUrl}">`);
  html = html.replace(/<meta property="twitter:title"[\s\S]*?>/g, `<meta property="twitter:title" content="${title}">`);
  html = html.replace(/<meta property="twitter:description"[\s\S]*?>/g, `<meta property="twitter:description" content="${desc}">`);
  html = html.replace(/<meta property="twitter:image"[\s\S]*?>/g, `<meta property="twitter:image" content="${logoUrl}">`);
  html = html.replace(/<meta name="description"[\s\S]*?>/g, `<meta name="description" content="${desc}">`);

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=0, must-revalidate"
    }
  });
}
