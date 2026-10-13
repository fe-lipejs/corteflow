const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://paefckmkawocjxzuoclq.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhZWZja21rYXdvY2p4enVvY2xxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5ODM5MDUsImV4cCI6MjEwMDU1OTkwNX0.9_FCFsaktXqmAyFcQi4jENaxj2TF2xRNREREwUN8Pio';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhZWZja21rYXdvY2p4enVvY2xxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDk4MzkwNSwiZXhwIjoyMTAwNTU5OTA1fQ.LoKvxQr-POJwRHCKKH5ZiBLAkliWflfNKlD-v4WrlFQ';

const supabaseAnon = createClient(supabaseUrl, anonKey);
const supabaseAdmin = createClient(supabaseUrl, serviceKey);

async function test() {
  console.log('--- TEST: CRIANDO DEMO PORTAL ---');
  const slug = 'barbearia-do-joao-x7k2';
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  // 1. Inserir demo
  const { data: created, error: insertError } = await supabaseAdmin
    .from('demo_portals')
    .upsert({
      slug,
      business_name: 'Barbearia do João',
      logo_url: null,
      primary_color: '#D4AF37',
      services: [
        { id: '1', name: 'Corte Degradê & Navalha', price: 45, duration_minutes: 40 },
        { id: '2', name: 'Barboterapia', price: 35, duration_minutes: 30 }
      ],
      professionals: [
        { id: '1', name: 'João Mestre' },
        { id: '2', name: 'Lucas Barbeiro' }
      ],
      owner_whatsapp: '27997303135',
      active: true,
      expires_at: expiresAt.toISOString(),
      views: 0
    }, { onConflict: 'slug' })
    .select()
    .single();

  if (insertError) {
    console.error('Erro ao inserir:', insertError);
    return;
  }
  console.log('Demo inserido com sucesso:', created.slug, created.business_name);

  // 2. Leitura pública via anon (RLS test)
  console.log('--- TEST: LEITURA PÚBLICA (ANON) ---');
  const { data: anonRead, error: anonError } = await supabaseAnon
    .from('demo_portals')
    .select('*')
    .eq('slug', slug)
    .single();

  if (anonError) {
    console.error('Erro na leitura anon:', anonError);
  } else {
    console.log('Leitura pública permitida via RLS:', anonRead.business_name, 'Views:', anonRead.views);
  }

  // 3. Testar incremento de views via RPC
  console.log('--- TEST: INCREMENTO DE VIEWS ---');
  const { error: rpcError } = await supabaseAnon.rpc('increment_demo_portal_views', { p_slug: slug });
  if (rpcError) {
    console.error('Erro RPC increment_demo_portal_views:', rpcError);
  } else {
    const { data: afterRpc } = await supabaseAnon.from('demo_portals').select('views').eq('slug', slug).single();
    console.log('Visualizações após RPC:', afterRpc.views);
  }

  console.log('--- TEST CONCLUÍDO COM SUCESSO ---');
}

test().catch(console.error);
