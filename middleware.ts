export default async function middleware(request) {
  const url = new URL(request.url);
  const pathParts = url.pathname.split("/").filter(Boolean);

  let slug = "";
  let isDemo = false;

  if (pathParts.length === 2 && (pathParts[0] === "paginas" || pathParts[0] === "testepaginas")) {
    isDemo = true;
    slug = pathParts[1];
  } else if (pathParts.length === 1) {
    slug = pathParts[0];
  } else {
    return;
  }

  const ignoredSlugs = ["api", "admin", "platform", "app", "images", "assets", "favicon.ico", "favicon.svg", "robots.txt", "sitemap.xml"];

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
    desc = "Dê um play, respire e leve uma Palavra para o seu dia.";
  } else {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://paefckmkawocjxzuoclq.supabase.co";
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

    if (supabaseKey) {
      try {
        if (isDemo) {
          // Busca dados do portal demo
          const demoRes = await fetch(
            `${supabaseUrl}/rest/v1/demo_portals?slug=eq.${slug}&select=business_name,business_type,logo_url,banner_url`,
            {
              headers: {
                apikey: supabaseKey,
                Authorization: `Bearer ${supabaseKey}`,
              },
            }
          );

          if (demoRes.ok) {
            const demos = await demoRes.json();
            const demo = demos && demos.length > 0 ? demos[0] : null;

            if (demo) {
              const typeLabel =
                demo.business_type === "esmalteria"
                  ? "Esmalteria"
                  : demo.business_type === "salao"
                    ? "Salão de Beleza"
                    : "Barbearia";

              title = `${demo.business_name} | ${typeLabel}`;
              desc = `Agende seu horário online em ${demo.business_name}. Rápido e prático pelo celular. 📱`;
              logoUrl = demo.logo_url || demo.banner_url || logoUrl;
            }
          }
        } else {
          // Busca tenant normal
          const res = await fetch(
            `${supabaseUrl}/rest/v1/tenants?slug=eq.${slug}&select=name,business_type,tenant_settings(logo_url,banner_url,short_description)`,
            {
              headers: {
                apikey: supabaseKey,
                Authorization: `Bearer ${supabaseKey}`,
              },
            }
          );

          if (res.ok) {
            const data = await res.json();
            const tenant = data && data.length > 0 ? data[0] : null;

            if (tenant) {
              title = `${tenant.name} | Agende agora.`;
              desc =
                tenant.tenant_settings?.short_description ||
                `Garanta seu atendimento. Faça seu agendamento agora. 📱`;
              logoUrl =
                tenant.tenant_settings?.logo_url ||
                tenant.tenant_settings?.banner_url ||
                logoUrl;
            } else {
              // Fallback: pode ser um demo acessado via /:slug
              const fallbackDemoRes = await fetch(
                `${supabaseUrl}/rest/v1/demo_portals?slug=eq.${slug}&select=business_name,business_type,logo_url,banner_url`,
                {
                  headers: {
                    apikey: supabaseKey,
                    Authorization: `Bearer ${supabaseKey}`,
                  },
                }
              );

              if (fallbackDemoRes.ok) {
                const demos = await fallbackDemoRes.json();
                const demo = demos && demos.length > 0 ? demos[0] : null;
                if (demo) {
                  const typeLabel =
                    demo.business_type === "esmalteria"
                      ? "Esmalteria"
                      : demo.business_type === "salao"
                        ? "Salão de Beleza"
                        : "Barbearia";

                  title = `${demo.business_name} | ${typeLabel}`;
                  desc = `Agende seu horário online em ${demo.business_name}. Rápido e prático pelo celular. 📱`;
                  logoUrl = demo.logo_url || demo.banner_url || logoUrl;
                }
              }
            }
          }
        }
      } catch (err) {
        console.error("Middleware OG Fetch Error:", err);
      }
    }
  }

  html = html.replace(/<title>[\s\S]*?<\/title>/g, `<title>${title}</title>`);
  html = html.replace(/<meta property="og:title"[\s\S]*?>/g, `<meta property="og:title" content="${title}">`);
  html = html.replace(/<meta property="og:description"[\s\S]*?>/g, `<meta property="og:description" content="${desc}">`);
  html = html.replace(
    /<meta property="og:image"[\s\S]*?>/g,
    `<meta property="og:image" content="${logoUrl}"><meta property="og:image:secure_url" content="${logoUrl}"><meta property="og:image:width" content="600"><meta property="og:image:height" content="600">`
  );
  html = html.replace(/<meta property="og:url"[\s\S]*?>/g, `<meta property="og:url" content="${url.href}">`);
  html = html.replace(/<meta property="twitter:title"[\s\S]*?>/g, `<meta property="twitter:title" content="${title}">`);
  html = html.replace(/<meta property="twitter:description"[\s\S]*?>/g, `<meta property="twitter:description" content="${desc}">`);
  html = html.replace(/<meta property="twitter:image"[\s\S]*?>/g, `<meta property="twitter:image" content="${logoUrl}">`);
  html = html.replace(/<meta name="description"[\s\S]*?>/g, `<meta name="description" content="${desc}">`);

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=0, must-revalidate",
    },
  });
}
