import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://paefckmkawocjxzuoclq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhZWZja21rYXdvY2p4enVvY2xxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDk4MzkwNSwiZXhwIjoyMTAwNTU5OTA1fQ.LoKvxQr-POJwRHCKKH5ZiBLAkliWflfNKlD-v4WrlFQ';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function evaluatePermissions(plan, role = 'owner', rolePermissions = []) {
  const permissionsArr = Array.isArray(plan?.permissions) ? plan.permissions : [];
  const limitsObj = plan?.limits || {};

  const planHas = (key) => permissionsArr.includes('*') || permissionsArr.includes(key);
  const roleHas = (key) => role === 'owner' || role === 'admin' || rolePermissions.includes('*') || rolePermissions.includes(key);

  const hasPermission = (key) => roleHas(key) && planHas(key);
  const hasFeature = (key) => {
    if (key === 'produtos') {
      if (hasPermission('produto.criar') || hasPermission('produto.editar') || hasPermission('produto.excluir')) return true;
      return !!plan?.allow_products || !!plan?.features?.produtos;
    }
    return !!plan?.features?.[key];
  };

  const getPlanLimit = (key) => {
    const val = limitsObj[key];
    if (val === undefined || val === null || val === '') return 'unlimited';
    if (val === -1 || val === '-1' || val === 'unlimited') return 'unlimited';
    return Number(val);
  };

  return { hasPermission, hasFeature, getPlanLimit, permissionsArr, limitsObj };
}

async function runAudit() {
  console.log('=====================================================');
  console.log('           AUDITORIA GERAL DE PLANOS E RBAC          ');
  console.log('=====================================================\n');

  let passedAll = true;
  function assert(condition, message) {
    if (condition) {
      console.log(`  [OK] ${message}`);
    } else {
      console.error(`  [FALHA] ${message}`);
      passedAll = false;
    }
  }

  // 1. Buscar todos os planos
  const { data: plans, error: errPlans } = await supabase.from('plans').select('*');
  if (errPlans) throw errPlans;

  const solo = plans.find(p => p.key === 'solo_tier');
  const studio = plans.find(p => p.key === 'studio_tier');
  const business = plans.find(p => p.key === 'business_tier');
  const trial = plans.find(p => p.key === 'expired_tier');
  const fallback = plans.find(p => p.key === 'fallback_tier' || p.is_default);

  console.log('--- 1. AUDITORIA: PLANO SOLO (solo_tier) ---');
  assert(solo !== undefined, 'Plano Solo existe no banco');
  const soloEval = evaluatePermissions(solo);
  assert(!soloEval.permissionsArr.includes('*'), 'Solo NÃO possui curinga "*"');
  assert(soloEval.hasPermission('agenda.visualizar_todos') === true, 'Solo pode visualizar agenda');
  assert(soloEval.hasPermission('agenda.criar') === true, 'Solo pode criar agendamentos');
  assert(soloEval.hasPermission('agenda.editar') === true, 'Solo pode reagendar/editar agendamentos (agenda.editar)');
  assert(soloEval.hasPermission('agenda.cancelar') === true, 'Solo pode cancelar agendamentos');
  assert(soloEval.hasPermission('clientes.visualizar') === true, 'Solo pode ver clientes');
  assert(soloEval.hasPermission('financeiro.visualizar_caixa_geral') === true, 'Solo pode ver financeiro');
  assert(soloEval.hasPermission('produto.criar') === false, 'Solo NÃO pode cadastrar produtos');
  assert(soloEval.hasPermission('produto.editar') === false, 'Solo NÃO pode editar produtos');
  assert(soloEval.hasPermission('catalogo.domicilio') === false, 'Solo NÃO possui atendimento a domicílio');
  assert(soloEval.hasPermission('equipe.domicilio') === false, 'Solo equipe NÃO possui atendimento a domicílio');
  assert(soloEval.getPlanLimit('profissionais') === 1, 'Solo limita a exatamente 1 profissional');
  assert(soloEval.getPlanLimit('produtos') === 0, 'Solo limita produtos a 0');

  console.log('\n--- 2. AUDITORIA: PLANO BUSINESS (business_tier) ---');
  assert(business !== undefined, 'Plano Business existe no banco');
  const bizEval = evaluatePermissions(business);
  assert(bizEval.hasPermission('catalogo.domicilio') === true, 'Business POSSUI catalogo.domicilio');
  assert(bizEval.hasPermission('equipe.domicilio') === true, 'Business POSSUI equipe.domicilio');
  assert(bizEval.hasPermission('produto.criar') === true, 'Business pode cadastrar produtos');
  assert(bizEval.hasPermission('agenda.editar') === true, 'Business pode reagendar/editar (agenda.editar)');
  assert(bizEval.getPlanLimit('profissionais') === 'unlimited', 'Business possui profissionais ilimitados');

  console.log('\n--- 3. AUDITORIA: PLANO STUDIO (studio_tier) ---');
  assert(studio !== undefined, 'Plano Studio existe no banco');
  const studioEval = evaluatePermissions(studio);
  assert(studioEval.hasPermission('catalogo.domicilio') === true, 'Studio possui catalogo.domicilio');
  assert(studioEval.hasPermission('equipe.domicilio') === true, 'Studio possui equipe.domicilio');
  assert(studioEval.getPlanLimit('profissionais') === 5, 'Studio limita a 5 profissionais');

  console.log('\n--- 4. AUDITORIA: PLANO TRIAL (expired_tier) ---');
  assert(trial !== undefined, 'Plano Trial existe no banco');
  assert(trial.is_trial_plan === true, 'Trial está marcado como is_trial_plan = true');
  assert(trial.is_default === false, 'Trial NÃO está marcado como is_default (não polui o fallback)');
  const trialEval = evaluatePermissions(trial);
  assert(trialEval.hasPermission('agenda.criar') === true, 'Trial pode criar agendamentos para testar o sistema');
  assert(trialEval.hasPermission('agenda.editar') === true, 'Trial pode reagendar/editar agendamentos');
  assert(trialEval.hasPermission('agenda.cancelar') === true, 'Trial pode cancelar agendamentos');
  assert(trialEval.hasPermission('agenda.mudar_status') === true, 'Trial pode mudar status');
  assert(trialEval.hasPermission('clientes.visualizar') === true, 'Trial pode visualizar clientes');
  assert(trialEval.hasPermission('financeiro.visualizar_caixa_geral') === true, 'Trial pode visualizar financeiro');
  assert(trialEval.hasPermission('produto.criar') === false, 'Trial restringe criação de produtos');
  assert(trialEval.getPlanLimit('profissionais') === 2, 'Trial limita a 2 profissionais');

  console.log('\n--- 5. AUDITORIA: PLANO PADRÃO FALLBACK (is_default) ---');
  assert(fallback !== undefined, 'Plano Fallback Gratuito existe no banco');
  assert(fallback.is_default === true, 'Plano Fallback possui is_default = true');
  assert(fallback.is_trial_plan === false, 'Plano Fallback NÃO é trial');
  const fallbackEval = evaluatePermissions(fallback);
  assert(fallbackEval.permissionsArr.length === 0, 'Plano Fallback zera todas as permissões (estaca zero)');
  assert(fallbackEval.hasPermission('agenda.criar') === false, 'Fallback bloqueia agenda.criar');
  assert(fallbackEval.hasPermission('clientes.visualizar') === false, 'Fallback bloqueia clientes.visualizar');
  assert(fallbackEval.hasPermission('financeiro.visualizar_caixa_geral') === false, 'Fallback bloqueia financeiro');
  assert(fallbackEval.hasPermission('catalogo.criar') === false, 'Fallback bloqueia catalogo.criar');

  console.log('\n--- 6. AUDITORIA: SIMULAÇÃO DE ASSINATURA CANCELADA / VENCIDA ---');
  // Simular sub cancelada
  const canceledSub = { status: 'canceled', trial_ends_at: null };
  const INACTIVE_STATUSES = ['canceled', 'incomplete_expired', 'unpaid', 'expired'];
  function isTrialExpired(sub) {
    if (!sub) return false;
    if (sub.status !== 'trial' && sub.status !== 'trialing') return false;
    if (!sub.trial_ends_at) return false;
    return new Date(sub.trial_ends_at) < new Date();
  }
  function grants(sub) {
    if (!sub) return false;
    if (INACTIVE_STATUSES.includes(sub.status)) return false;
    if (isTrialExpired(sub)) return false;
    return true;
  }

  assert(grants(canceledSub) === false, 'Assinatura cancelada NÃO concede plano');
  const pastTrialSub = { status: 'trial', trial_ends_at: new Date(Date.now() - 86400000).toISOString() };
  assert(grants(pastTrialSub) === false, 'Teste com dias vencidos NÃO concede plano');

  const activeTrialSub = { status: 'trial', trial_ends_at: new Date(Date.now() + 86400000 * 5).toISOString() };
  assert(grants(activeTrialSub) === true, 'Teste dentro do prazo CONCEDE plano normalmente');

  const activePaidSub = { status: 'active', trial_ends_at: null };
  assert(grants(activePaidSub) === true, 'Assinatura ativa CONCEDE plano normalmente');

  console.log('\n=====================================================');
  if (passedAll) {
    console.log('   RESULTADO DA AUDITORIA: 100% SUCESSO (0 ERROS)   ');
  } else {
    console.error('   RESULTADO DA AUDITORIA: FORAM DETECTADOS ERROS!   ');
  }
  console.log('=====================================================');
}

runAudit();
