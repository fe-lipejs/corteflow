import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url || typeof url !== 'string' || !url.trim().startsWith('http')) {
      return new Response(
        JSON.stringify({ error: 'URL do mapa inválida ou não fornecida.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let currentUrl = url.trim();
    let depth = 0;

    // Follow redirects for shortened URLs (maps.app.goo.gl, goo.gl/maps, etc.)
    while (depth < 6) {
      depth++;
      try {
        const res = await fetch(currentUrl, { method: 'HEAD', redirect: 'manual' });
        const loc = res.headers.get('location');
        if (
          loc &&
          (res.status === 301 ||
            res.status === 302 ||
            res.status === 303 ||
            res.status === 307 ||
            res.status === 308)
        ) {
          currentUrl = new URL(loc, currentUrl).toString();
        } else {
          break;
        }
      } catch (_e) {
        break;
      }
    }

    let latitude: number | null = null;
    let longitude: number | null = null;
    let placeName: string | null = null;

    // 1. Exact coordinates from !3d(lat)!4d(lng) in URL data parameter
    const data3dMatch = currentUrl.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
    if (data3dMatch) {
      latitude = parseFloat(data3dMatch[1]);
      longitude = parseFloat(data3dMatch[2]);
    }

    // 2. Center / viewport coordinates from @(lat),(lng)
    if (latitude === null) {
      const atMatch = currentUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (atMatch) {
        latitude = parseFloat(atMatch[1]);
        longitude = parseFloat(atMatch[2]);
      }
    }

    // 3. Query coordinates from q=(lat),(lng) or ll=(lat),(lng)
    if (latitude === null) {
      const qMatch = currentUrl.match(/[?&](?:q|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (qMatch) {
        latitude = parseFloat(qMatch[1]);
        longitude = parseFloat(qMatch[2]);
      }
    }

    // Place name from /place/([^\/@?]+)
    const placeMatch = currentUrl.match(/\/place\/([^\/@?]+)/);
    if (placeMatch) {
      try {
        placeName = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '));
      } catch (_e) {
        placeName = placeMatch[1];
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        resolvedUrl: currentUrl,
        latitude,
        longitude,
        placeName,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Erro ao resolver link do Google Maps.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
