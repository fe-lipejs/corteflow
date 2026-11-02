import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://paefckmkawocjxzuoclq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhZWZja21rYXdvY2p4enVvY2xxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDk4MzkwNSwiZXhwIjoyMTAwNTU5OTA1fQ.LoKvxQr-POJwRHCKKH5ZiBLAkliWflfNKlD-v4WrlFQ';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log('1. Atualizando plano Solo (solo_tier)...');
  const soloPermissions = [
    'agenda.visualizar_todos',
    'agenda.visualizar_minha',
    'agenda.criar',
    'agenda.editar',
    'agenda.cancelar',
    'agenda.mudar_status',
    'agenda.bloquear_horario',
    'equipe.visualizar',
    'equipe.editar_perfil',
    'equipe.editar_horarios',
    'catalogo.visualizar',
    'catalogo.criar',
    'catalogo.editar',
    'catalogo.excluir',
    'clientes.visualizar',
    'clientes.exportar',
    'financeiro.visualizar_caixa_geral',
    'financeiro.visualizar_meu_caixa',
    'financeiro.criar_lancamento',
    'financeiro.editar_lancamento',
    'financeiro.excluir_lancamento',
    'financeiro.exportar',
    'configuracoes.editar_layout'
  ];

  const { error: errSolo } = await supabase
    .from('plans')
    .update({
      permissions: soloPermissions,
      allow_products: false,
      limits: { produtos: 0, servicos: 10, profissionais: 1 },
      features: {
        agenda: true,
        equipe: false,
        clientes: true,
        produtos: false,
        servicos: true,
        financeiro: true,
        relatorios: false,
        display_features: []
      }
    })
    .eq('key', 'solo_tier');
  if (errSolo) console.error('Erro solo:', errSolo);
  else console.log('Plano Solo atualizado com permissões explícitas!');

  console.log('2. Atualizando plano Business (business_tier)...');
  const businessPermissions = [
    'produto.criar',
    'produto.editar',
    'produto.excluir',
    'agenda.visualizar_todos',
    'agenda.visualizar_minha',
    'agenda.criar',
    'agenda.editar',
    'agenda.cancelar',
    'agenda.mudar_status',
    'agenda.bloquear_horario',
    'equipe.visualizar',
    'equipe.criar',
    'equipe.editar_perfil',
    'equipe.editar_horarios',
    'equipe.inativar',
    'equipe.ver_comissoes',
    'equipe.domicilio',
    'catalogo.visualizar',
    'catalogo.criar',
    'catalogo.editar',
    'catalogo.excluir',
    'catalogo.domicilio',
    'clientes.visualizar',
    'clientes.exportar',
    'financeiro.visualizar_caixa_geral',
    'financeiro.visualizar_meu_caixa',
    'financeiro.criar_lancamento',
    'financeiro.editar_lancamento',
    'financeiro.excluir_lancamento',
    'financeiro.exportar',
    'configuracoes.editar_layout'
  ];

  const { error: errBusiness } = await supabase
    .from('plans')
    .update({
      permissions: businessPermissions
    })
    .eq('key', 'business_tier');
  if (errBusiness) console.error('Erro business:', errBusiness);
  else console.log('Plano Business atualizado com catalogo.domicilio e equipe.domicilio!');

  console.log('3. Atualizando plano Trial (expired_tier)...');
  const trialPermissions = [
    'agenda.visualizar_todos',
    'agenda.visualizar_minha',
    'agenda.criar',
    'agenda.editar',
    'agenda.cancelar',
    'agenda.mudar_status',
    'agenda.bloquear_horario',
    'equipe.visualizar',
    'equipe.criar',
    'equipe.editar_perfil',
    'equipe.editar_horarios',
    'equipe.inativar',
    'catalogo.visualizar',
    'catalogo.criar',
    'catalogo.editar',
    'catalogo.excluir',
    'clientes.visualizar',
    'clientes.exportar',
    'financeiro.visualizar_caixa_geral',
    'financeiro.visualizar_meu_caixa',
    'financeiro.criar_lancamento',
    'financeiro.editar_lancamento',
    'financeiro.excluir_lancamento',
    'financeiro.exportar',
    'configuracoes.editar_layout'
  ];

  const { error: errTrial } = await supabase
    .from('plans')
    .update({
      name: 'Trial (Período de Teste)',
      description: 'Plano gratuito ativado automaticamente para novos salões durante os 7 dias de teste.',
      permissions: trialPermissions,
      allow_products: false,
      trial_days: 7,
      limits: { produtos: 0, servicos: 5, profissionais: 2 },
      features: {
        agenda: true,
        equipe: true,
        clientes: true,
        produtos: false,
        servicos: true,
        financeiro: true,
        relatorios: false,
        display_features: []
      },
      is_trial_plan: true,
      is_default: false
    })
    .eq('key', 'expired_tier');
  if (errTrial) console.error('Erro trial:', errTrial);
  else console.log('Plano Trial atualizado com permissões completas de teste!');

  console.log('4. Verificando / Criando plano padrão de fallback (is_default)...');
  const { data: existingFallback } = await supabase
    .from('plans')
    .select('id, key, is_default')
    .eq('key', 'fallback_tier')
    .maybeSingle();

  if (existingFallback) {
    await supabase
      .from('plans')
      .update({
        name: 'Plano Padrão (Sem Assinatura / Cancelado)',
        description: 'Plano de fallback automático quando o salão não possui assinatura ativa ou quando a assinatura foi cancelada/expirada. Configure aqui o que um salão cancelado pode ver (deixe vazio para estaca zero).',
        is_default: true,
        is_trial_plan: false,
        permissions: [],
        limits: { produtos: 0, servicos: 0, profissionais: 0 },
        features: {
          agenda: false,
          equipe: false,
          clientes: false,
          produtos: false,
          servicos: false,
          financeiro: false,
          relatorios: false,
          display_features: []
        }
      })
      .eq('id', existingFallback.id);
    console.log('Plano de fallback atualizado!');
  } else {
    const { data: newFallback, error: errInsert } = await supabase
      .from('plans')
      .insert({
        key: 'fallback_tier',
        name: 'Plano Padrão (Sem Assinatura / Cancelado)',
        description: 'Plano de fallback automático quando o salão não possui assinatura ativa ou quando a assinatura foi cancelada/expirada. Configure aqui o que um salão cancelado pode ver (deixe vazio para estaca zero).',
        max_professionals: 0,
        allow_products: false,
        trial_days: 0,
        active: true,
        sort_order: 10,
        is_default: true,
        is_trial_plan: false,
        permissions: [],
        limits: { produtos: 0, servicos: 0, profissionais: 0 },
        features: {
          agenda: false,
          equipe: false,
          clientes: false,
          produtos: false,
          servicos: false,
          financeiro: false,
          relatorios: false,
          display_features: []
        }
      })
      .select()
      .single();
    if (errInsert) console.error('Erro ao criar fallback_tier:', errInsert);
    else console.log('Plano de fallback criado com sucesso:', newFallback.id);
  }

  // Verificar todos os planos
  const { data: allPlans } = await supabase.from('plans').select('key, name, is_default, is_trial_plan, permissions, limits');
  console.log('\n--- Planos Finais no Banco de Dados ---');
  allPlans?.forEach(p => {
    console.log(`- [${p.key}] "${p.name}" | is_default: ${p.is_default} | is_trial: ${p.is_trial_plan} | perm count: ${p.permissions?.length} | limits: ${JSON.stringify(p.limits)}`);
  });
}

main();
