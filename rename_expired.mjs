import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''; 

async function main() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await supabase
    .from('plans')
    .update({ 
      name: 'Trial (Período de Teste)',
      description: 'Plano gratuito ativado automaticamente para novos salões. Use esta tela para configurar os acessos e limites que os usuários em Trial terão.',
      active: true
    })
    .ilike('name', '%expirado%')
    .select();

  console.log('Update result:', data, error);
}

main();
