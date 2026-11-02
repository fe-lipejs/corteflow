// Simulação do usePermissionEngine (lógica pura, idêntica ao hook) contra os dados reais do banco.
import { createClient } from '@supabase/supabase-js';

const sb = createClient('https://paefckmkawocjxzuoclq.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhZWZja21rYXdvY2p4enVvY2xxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDk4MzkwNSwiZXhwIjoyMTAwNTU5OTA1fQ.LoKvxQr-POJwRHCKKH5ZiBLAkliWflfNKlD-v4WrlFQ', { auth: { persistSession: false } });

const INACTIVE = ['canceled', 'incomplete_expired', 'unpaid', 'expired'];
const trialExpired = s => s && (s.status === 'trial' || s.status === 'trialing') && s.trial_ends_at && new Date(s.trial_ends_at) < new Date();
const grants = s => !!s && !INACTIVE.includes(s.status) && !trialExpired(s);

function engine({ role, rolePermissions, sub, subPlan, defaultPlan }) {
  const source = grants(sub) ? subPlan : defaultPlan;
  const perms = Array.isArray(source?.permissions) ? source.permissions : [];
  const planHas = k => perms.includes('*') || perms.includes(k);
  const roleHas = k => role === 'owner' || role === 'admin' || rolePermissions.includes('*') || rolePermissions.includes(k);
  const hasPermission = k => roleHas(k) && planHas(k);
  const hasAnyPermission = prefix => {
    const p0 = prefix.replace(/\.$/, '');
    if (!perms.length) return false;
    const m = p => p === p0 || p.startsWith(p0 + '.');
    if (perms.includes('*')) return role === 'owner' || role === 'admin' || rolePermissions.includes('*') ? true : rolePermissions.some(m);
    return perms.some(p => m(p) && roleHas(p));
  };
  return { source, hasPermission, hasAnyPermission };
}

const { data: sysPerms } = await sb.from('sys_permissions').select('key').order('key');
const { data: rp } = await sb.from('sys_role_permissions').select('role,permission_key');
const { data: plans } = await sb.from('plans').select('*').order('sort_order');
const rolePerms = r => rp.filter(x => x.role === r).map(x => x.permission_key);
const fallback = plans.find(p => p.is_default) || plans.find(p => p.is_trial_plan) || null;

const ROUTES = { agenda: 'agenda', equipe: 'equipe', servicos: 'catalogo', clientes: 'clientes', financeiro: 'financeiro', 'produtos(aba)': 'produto' };
const issues = [];

console.log('Plano de fallback (sem assinatura válida):', fallback?.key);

for (const plan of plans) {
  for (const role of ['admin', 'owner']) {
    const e = engine({ role, rolePermissions: rolePerms(role), sub: { status: 'active' }, subPlan: plan, defaultPlan: fallback });
    const routes = Object.entries(ROUTES).map(([n, p]) => `${n}:${e.hasAnyPermission(p) ? '✅' : '🔒'}`).join(' ');
    const allowed = sysPerms.filter(s => e.hasPermission(s.key)).map(s => s.key);
    const blocked = sysPerms.filter(s => !e.hasPermission(s.key)).map(s => s.key);
    if (role === 'admin') {
      console.log(`\n[${plan.key}] role=${role}\n  rotas: ${routes} configuracoes:✅(sempre)`);
      console.log(`  liberadas (${allowed.length}): ${allowed.join(', ')}`);
      console.log(`  bloqueadas (${blocked.length}): ${blocked.join(', ') || '-'}`);
    }
    // Consistência: cada chave salva no plano deve resultar em acesso
    for (const k of (plan.permissions || [])) {
      if (k !== '*' && !e.hasPermission(k)) issues.push(`[${plan.key}/${role}] chave ${k} salva no plano mas NEGADA`);
      if (k !== '*' && !sysPerms.find(s => s.key === k)) issues.push(`[${plan.key}] chave ${k} não existe em sys_permissions`);
    }
    // Rota acessível porém sem nenhuma ação útil (ex.: entra na Agenda mas não pode ver nada)
    if (e.hasAnyPermission('agenda') && !e.hasPermission('agenda.visualizar_todos') && !e.hasPermission('agenda.visualizar_minha'))
      issues.push(`[${plan.key}/${role}] entra na Agenda mas sem visualizar_todos/visualizar_minha → tela "Acesso Restrito"`);
    if (e.hasAnyPermission('equipe') && !e.hasPermission('equipe.visualizar'))
      issues.push(`[${plan.key}/${role}] entra em Equipe mas sem equipe.visualizar → tela "Acesso Restrito"`);
  }
}

// Cenário real: tenant com assinatura cancelada
const { data: subs } = await sb.from('subscriptions').select('*, tenants(name), plans(*)');
console.log('\n=== Cenários reais de tenants ===');
for (const s of subs) {
  const before = (() => { // lógica ANTIGA: cancelada + sem is_default = zero permissões
    if (s.status !== 'canceled') return (s.plans?.permissions || []).length;
    const dp = plans.find(p => p.is_default);
    return dp ? (dp.permissions || []).length : 0;
  })();
  const e = engine({ role: 'admin', rolePermissions: rolePerms('admin'), sub: s, subPlan: s.plans, defaultPlan: fallback });
  const now = sysPerms.filter(x => e.hasPermission(x.key)).length;
  console.log(`${s.tenants?.name} | status=${s.status} | plano usado=${e.source?.key} | permissões ANTES=${before} DEPOIS=${now}`);
  console.log(`  configuracoes.editar_layout: ${e.hasPermission('configuracoes.editar_layout') ? '✅' : '🔒'} | rotas: ` +
    Object.entries(ROUTES).map(([n, p]) => `${n}:${e.hasAnyPermission(p) ? '✅' : '🔒'}`).join(' '));
}

console.log('\n=== Inconsistências encontradas ===');
console.log(issues.length ? issues.join('\n') : 'Nenhuma ✅');
