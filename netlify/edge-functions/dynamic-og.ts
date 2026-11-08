import { Context } from "@netlify/edge-functions";

export default async (request: Request, context: Context) => {
  const url = new URL(request.url);
  const pathParts = url.pathname.split("/").filter(Boolean);

  // Se for a raiz (/), deixa passar normal para a landing page do Raffros
  if (pathParts.length === 0) {
    return context.next();
  }

  const first = pathParts[0].toLowerCase();

  // Ignorar arquivos estáticos e rotas de sistema do Raffros
  const systemRoutes = [
    "api",
    "admin",
    "platform",
    "app",
    "login",
    "cadastro",
    "register",
    "redefinir-senha",
    "reset-password",
    "onboarding",
    "select-tenant",
    "planos",
    "images",
    "assets",
    "icons",
    "favicon.ico",
    "favicon.svg",
    "robots.txt",
    "sitemap.xml",
    "manifest.json",
    "service-worker.js",
  ];

  if (systemRoutes.includes(first) || first.includes(".")) {
    return context.next();
  }

  let slug = "";
  let isDemo = false;

  if (first === "paginas" || first === "testepaginas") {
    if (pathParts.length < 2) return context.next();
    isDemo = true;
    slug = pathParts[1];
  } else {
    slug = pathParts[0];
  }

  if (!slug || slug.includes(".")) {
    return context.next();
  }

  // Get env vars. Netlify Edge Functions use Deno.env
  const supabaseUrl =
    Deno.env.get("VITE_SUPABASE_URL") ||
    "https://paefckmkawocjxzuoclq.supabase.co";
  const supabaseKey =
    Deno.env.get("VITE_SUPABASE_ANON_KEY") ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhZWZja21rYXdvY2p4enVvY2xxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5ODM5MDUsImV4cCI6MjEwMDU1OTkwNX0.9_FCFsaktXqmAyFcQi4jENaxj2TF2xRNREREwUN8Pio";

  try {
    let salonName = "Raffros";
    let title = "Raffros | Agendamento e Gestão para Barbearias e Salões";
    let desc = "Garanta seu atendimento. Faça seu agendamento agora.";
    let logoUrl = "https://agendenow.netlify.app/images/RaffrosLogo.png";

    if (slug === "playlist") {
      salonName = "Raffros";
      title = "Raffros | Som da Casa";
      desc = "Dê um play, respire e leve uma Palavra para o seu dia.";
    } else if (isDemo) {
      const demoRes = await fetch(
        `${supabaseUrl}/rest/v1/demo_portals?slug=eq.${encodeURIComponent(slug)}&select=business_name,business_type,logo_url,banner_url`,
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
          salonName = demo.business_name?.trim() || "Salão";
          title = `${salonName} | Agendamento Online`;
          desc = `Agende seu horário online em ${salonName}. Rápido e prático pelo celular. 📱`;
          logoUrl = demo.logo_url || demo.banner_url || logoUrl;
        } else {
          return context.next();
        }
      } else {
        return context.next();
      }
    } else {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/tenants?slug=eq.${encodeURIComponent(slug)}&select=name,business_type,tenant_settings(logo_url,banner_url,short_description,fantasy_name)`,
        {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
        }
      );

      if (!res.ok) {
        return context.next();
      }

      const data = await res.json();
      const tenant = data && data.length > 0 ? data[0] : null;

      if (tenant) {
        const rawSettings = tenant.tenant_settings;
        const settings = Array.isArray(rawSettings) ? rawSettings[0] : rawSettings;
        const fantasy = settings?.fantasy_name?.trim();
        const officialName = tenant.name?.trim();
        salonName = fantasy || officialName || "Salão";

        title = `${salonName} | Agendamento Online`;
        desc =
          settings?.short_description?.trim() ||
          `Agende seu horário online em ${salonName}. Rápido, prático e sem complicação. 📱`;
        logoUrl =
          settings?.logo_url ||
          settings?.banner_url ||
          logoUrl;
      } else {
        // Fallback: verificar se é demo acessado na raiz
        const fallbackDemoRes = await fetch(
          `${supabaseUrl}/rest/v1/demo_portals?slug=eq.${encodeURIComponent(slug)}&select=business_name,business_type,logo_url,banner_url`,
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
            salonName = demo.business_name?.trim() || "Salão";
            title = `${salonName} | Agendamento Online`;
            desc = `Agende seu horário online em ${salonName}. Rápido e prático pelo celular. 📱`;
            logoUrl = demo.logo_url || demo.banner_url || logoUrl;
          } else {
            return context.next();
          }
        } else {
          return context.next();
        }
      }
    }

    // Fetch the base index.html
    const indexUrl = new URL("/index.html", request.url);
    const indexRes = await fetch(indexUrl.toString());

    if (!indexRes.ok) {
      return context.next();
    }

    let html = await indexRes.text();

    const imageType = logoUrl.toLowerCase().endsWith(".png")
      ? "image/png"
      : logoUrl.toLowerCase().endsWith(".webp")
        ? "image/webp"
        : "image/jpeg";

    html = html.replace(/<title>[\s\S]*?<\/title>/gi, `<title>${title}</title>`);
    html = html.replace(/<meta name="title"[\s\S]*?>/gi, `<meta name="title" content="${title}">`);
    html = html.replace(/<meta property="og:title"[\s\S]*?>/gi, `<meta property="og:title" content="${title}">`);

    if (html.includes('property="og:site_name"')) {
      html = html.replace(/<meta property="og:site_name"[\s\S]*?>/gi, `<meta property="og:site_name" content="${salonName}">`);
    } else {
      html = html.replace(/<meta property="og:title"/i, `<meta property="og:site_name" content="${salonName}">\n  <meta property="og:title"`);
    }

    html = html.replace(/<meta property="og:description"[\s\S]*?>/gi, `<meta property="og:description" content="${desc}">`);
    html = html.replace(
      /<meta property="og:image"[\s\S]*?>/gi,
      `<meta property="og:image" content="${logoUrl}">\n  <meta property="og:image:secure_url" content="${logoUrl}">\n  <meta property="og:image:type" content="${imageType}">\n  <meta property="og:image:width" content="600">\n  <meta property="og:image:height" content="600">`
    );
    html = html.replace(/<meta property="og:url"[\s\S]*?>/gi, `<meta property="og:url" content="${url.href}">`);
    html = html.replace(/<link rel="canonical"[\s\S]*?>/gi, `<link rel="canonical" href="${url.href}">`);
    html = html.replace(/<meta name="apple-mobile-web-app-title"[\s\S]*?>/gi, `<meta name="apple-mobile-web-app-title" content="${salonName}">`);
    html = html.replace(/<meta property="twitter:title"[\s\S]*?>/gi, `<meta property="twitter:title" content="${title}">`);
    html = html.replace(/<meta property="twitter:description"[\s\S]*?>/gi, `<meta property="twitter:description" content="${desc}">`);
    html = html.replace(/<meta property="twitter:image"[\s\S]*?>/gi, `<meta property="twitter:image" content="${logoUrl}">`);
    html = html.replace(/<meta property="twitter:url"[\s\S]*?>/gi, `<meta property="twitter:url" content="${url.href}">`);
    html = html.replace(/<meta name="description"[\s\S]*?>/gi, `<meta name="description" content="${desc}">`);

    return new Response(html, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, max-age=0, must-revalidate",
      },
    });
  } catch (err) {
    console.error("Edge Function Error:", err);
    return context.next();
  }
};
