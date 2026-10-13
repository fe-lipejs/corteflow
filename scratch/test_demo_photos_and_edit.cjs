const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://paefckmkawocjxzuoclq.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhZWZja21rYXdvY2p4enVvY2xxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDk4MzkwNSwiZXhwIjoyMTAwNTU5OTA1fQ.LoKvxQr-POJwRHCKKH5ZiBLAkliWflfNKlD-v4WrlFQ';

const supabase = createClient(supabaseUrl, serviceKey);

async function test() {
  console.log('--- TEST: CRIANDO DEMO COM FOTO NO SERVIÇO ---');
  const slug = 'teste-servico-foto-k9x1';
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const { data: created, error: createError } = await supabase
    .from('demo_portals')
    .upsert({
      slug,
      business_name: 'Studio Teste Foto',
      logo_url: null,
      primary_color: '#D4AF37',
      services: [
        {
          id: 'srv_1',
          name: 'Corte Degradê',
          price: 50,
          duration_minutes: 35,
          photo_url: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=400'
        }
      ],
      professionals: [
        {
          id: 'pro_1',
          name: 'Renato Barbeiro',
          photo_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
          role_title: 'Master Barber'
        }
      ],
      owner_whatsapp: '27997303135',
      active: true,
      expires_at: expiresAt.toISOString(),
      views: 0
    }, { onConflict: 'slug' })
    .select()
    .single();

  if (createError) {
    console.error('Erro ao criar:', createError);
    return;
  }
  console.log('Criado:', created.slug, 'Service photo:', created.services[0].photo_url);

  console.log('--- TEST: EDITANDO SERVIÇOS E PROFISSIONAIS ---');
  const { data: updated, error: updateError } = await supabase
    .from('demo_portals')
    .update({
      business_name: 'Studio Teste Foto (Atualizado)',
      services: [
        {
          id: 'srv_1',
          name: 'Corte Degradê Navalhado VIP',
          price: 65,
          duration_minutes: 45,
          photo_url: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=400'
        },
        {
          id: 'srv_2',
          name: 'Barba Terapia com Toalha Quente',
          price: 40,
          duration_minutes: 30,
          photo_url: null
        }
      ],
      professionals: [
        {
          id: 'pro_1',
          name: 'Renato Mestre',
          photo_url: null,
          role_title: 'Fundador'
        }
      ]
    })
    .eq('id', created.id)
    .select()
    .single();

  if (updateError) {
    console.error('Erro ao atualizar:', updateError);
    return;
  }
  console.log('Atualizado com sucesso!');
  console.log('Novo nome:', updated.business_name);
  console.log('Qtd serviços:', updated.services.length, updated.services.map(s => `${s.name} (R$ ${s.price}) [Foto: ${Boolean(s.photo_url)}]`));
  console.log('Qtd profissionais:', updated.professionals.length, updated.professionals.map(p => `${p.name} - ${p.role_title}`));

  // Limpeza
  await supabase.from('demo_portals').delete().eq('id', created.id);
  console.log('--- TEST CONCLUÍDO E REGISTRO DE TESTE LIMPO ---');
}

test().catch(console.error);
