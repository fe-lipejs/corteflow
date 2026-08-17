import { useState } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Edit2, Trash2, CheckCircle, Ban, CreditCard,
  X, Save, Users, Package, Clock, Lock, Unlock,
  LayoutDashboard, Calendar, Scissors, DollarSign, BarChart3, Settings
} from 'lucide-react';
import AdminPageHeader from './components/AdminPageHeader';
import AdminEmptyState from './components/AdminEmptyState';
import { AdminCardsSkeleton } from './components/AdminSkeleton';
import type { Database } from '../../types/database';

type Plan = Database['public']['Tables']['plans']['Row'] & {
  plan_prices: Array<{
    id: string;
    country_code: string;
    currency: string;
    amount: number;
  }>;
  subscriptions?: [{ count: number }];
};

interface SysPermission {
  key: string;
  module: string;
  description: string;
}

interface SysFeature {
  key: string;
  module: string;
  description: string;
}

interface PlanFormData {
  name: string;
  key: string;
  description: string;
  trial_days: number;
  sort_order: number;
  price_brl: number;
  is_default: boolean;
  
  // Nova estrutura dinâmica
  permissions: string[];
  features: Record<string, boolean>;
  limits: Record<string, number | 'unlimited'>;
  
  display_features: string[]; // Marketing bullets
}

const EMPTY_FORM: PlanFormData = {
  name: '',
  key: '',
  description: '',
  trial_days: 7,
  sort_order: 0,
  price_brl: 0,
  is_default: false,
  permissions: [],
  features: {},
  limits: { profissionais: 1 },
  display_features: [],
};

// ── Plan Modal ────────────────────────────────────────────────────────────────
function PlanModal({
  plan,
  onClose,
  onSave,
  saving,
  subCount,
  sysPermissions,
  sysFeatures,
}: {
  plan: Plan | null;
  onClose: () => void;
  onSave: (form: PlanFormData, id?: string, isDuplicate?: boolean) => void;
  saving: boolean;
  subCount: number;
  sysPermissions: SysPermission[];
  sysFeatures: SysFeature[];
}) {
  const existingPrice = plan?.plan_prices?.find(p => p.currency === 'BRL');
  
  const initialLimits = (plan?.limits as Record<string, any>) || {};
  if (plan && plan.max_professionals && !initialLimits.profissionais) {
    initialLimits.profissionais = plan.max_professionals;
  }

  const [form, setForm] = useState<PlanFormData>(
    plan ? {
      name: plan.name,
      key: plan.key,
      description: plan.description ?? '',
      trial_days: plan.trial_days,
      sort_order: plan.sort_order,
      price_brl: existingPrice?.amount ?? 0,
      is_default: plan.is_default,
      
      permissions: Array.isArray(plan.permissions) ? plan.permissions : [],
      features: (plan.features as Record<string, boolean>) || {},
      limits: initialLimits,
      
      display_features: Array.isArray((plan.features as any)?.display_features) 
        ? (plan.features as any).display_features 
        : [],
    } : EMPTY_FORM
  );
  
  const [newFeature, setNewFeature] = useState('');
  const [activeTab, setActiveTab] = useState<'geral' | 'limites' | 'permissoes' | 'features'>('geral');
  const hasSubs = subCount > 0;

  // Helpers
  const addMarketingFeature = () => {
    if (newFeature.trim()) {
      setForm(f => ({ ...f, display_features: [...f.display_features, newFeature.trim()] }));
      setNewFeature('');
    }
  };

  const togglePermission = (key: string) => {
    setForm(f => {
      const has = f.permissions.includes(key);
      return {
        ...f,
        permissions: has ? f.permissions.filter(p => p !== key) : [...f.permissions, key]
      };
    });
  };

  const toggleFeature = (key: string) => {
    setForm(f => ({
      ...f,
      features: { ...f.features, [key]: !f.features[key] }
    }));
  };

  const setLimit = (key: string, value: number | 'unlimited') => {
    setForm(f => ({
      ...f,
      limits: { ...f.limits, [key]: value }
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-3xl bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl overflow-hidden max-h-[90vh] flex flex-col shadow-2xl"
      >
        {/* Header */}
        <div className="flex flex-col border-b border-[#1a1a1a]">
          <div className="flex items-center justify-between px-6 py-4">
            <h2 className="text-base font-semibold text-white">
              {plan ? 'Editar Plano' : 'Novo Plano'}
            </h2>
            <button onClick={onClose} className="p-1.5 text-[#444] hover:text-white hover:bg-[#1a1a1a] rounded-lg transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          {/* Tabs */}
          <div className="flex items-center px-6 gap-6">
            {[
              { id: 'geral', label: 'Geral & Preço' },
              { id: 'features', label: 'Features Comerciais' },
              { id: 'permissoes', label: 'Permissões de Tela' },
              { id: 'limites', label: 'Limites de Uso' },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === t.id ? 'border-emerald-500 text-white' : 'border-transparent text-[#666] hover:text-[#999]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          
          {/* Aba: Geral */}
          {activeTab === 'geral' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#555] mb-1.5">Nome do Plano *</label>
                  <input
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2 bg-[#111] border border-[#1a1a1a] rounded-lg text-sm text-white placeholder-[#333] outline-none focus:border-[#333] transition-colors"
                    placeholder="Ex: Growth"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#555] mb-1.5">Chave Interna</label>
                  <input
                    value={form.key}
                    onChange={e => setForm(f => ({ ...f, key: e.target.value.toLowerCase().replace(/\s+/g, '_') }))}
                    className={`w-full px-3 py-2 bg-[#111] border border-[#1a1a1a] rounded-lg text-sm font-mono transition-colors ${hasSubs ? 'text-[#888] cursor-not-allowed opacity-70' : 'text-white placeholder-[#333] focus:border-[#333] outline-none'}`}
                    disabled={hasSubs}
                  />
                </div>
              </div>
              
              <div className="flex items-center gap-2 p-3 bg-violet-500/10 border border-violet-500/20 rounded-lg">
                <input 
                  type="checkbox"
                  id="is_default"
                  checked={form.is_default}
                  onChange={e => setForm(f => ({ ...f, is_default: e.target.checked }))}
                  className="rounded bg-[#111] border-[#1a1a1a] text-violet-500"
                />
                <label htmlFor="is_default" className="text-xs font-medium text-violet-400 cursor-pointer">
                  Plano Padrão (Gratuito/Fallback)
                </label>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#555] mb-1.5">Descrição</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 bg-[#111] border border-[#1a1a1a] rounded-lg text-sm text-white resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#555] mb-1.5">Preço BRL (R$)</label>
                  <input
                    type="number"
                    value={form.price_brl}
                    onChange={e => setForm(f => ({ ...f, price_brl: Number(e.target.value) }))}
                    className="w-full px-3 py-2 bg-[#111] border border-[#1a1a1a] rounded-lg text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#555] mb-1.5">Trial (dias)</label>
                  <input
                    type="number"
                    value={form.trial_days}
                    onChange={e => setForm(f => ({ ...f, trial_days: Number(e.target.value) }))}
                    className="w-full px-3 py-2 bg-[#111] border border-[#1a1a1a] rounded-lg text-sm text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#555] mb-2">Bullets de Marketing</label>
                <div className="space-y-1.5 mb-2">
                  {form.display_features.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 bg-[#111] border border-[#1a1a1a] rounded-lg px-3 py-2">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-sm text-[#bbb] flex-1">{f}</span>
                      <button onClick={() => setForm(form => ({...form, display_features: form.display_features.filter((_, idx) => idx !== i)}))} className="text-[#333] hover:text-red-400">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={newFeature}
                    onChange={e => setNewFeature(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addMarketingFeature()}
                    placeholder="Adicionar bullet..."
                    className="flex-1 px-3 py-2 bg-[#111] border border-[#1a1a1a] rounded-lg text-sm text-white"
                  />
                  <button onClick={addMarketingFeature} className="px-3 py-2 bg-[#1a1a1a] text-[#888] rounded-lg">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Aba: Features Comerciais */}
          {activeTab === 'features' && (
            <div className="space-y-4">
              <p className="text-xs text-[#888] mb-4">Estas chaves representam os gatilhos comerciais (FeatureGates). Se habilitado, a tela de "Faça Upgrade" não aparecerá para o recurso.</p>
              
              {sysFeatures.length === 0 ? (
                <div className="p-4 border border-dashed border-[#1a1a1a] rounded-xl text-center text-sm text-[#555]">
                  Nenhuma feature comercial cadastrada no banco (`sys_features`).
                  (Mas você pode usar as antigas se quiser, o código antigo validava chaves hardcoded).
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {sysFeatures.map(feat => {
                    const enabled = !!form.features[feat.key];
                    return (
                      <div
                        key={feat.key}
                        onClick={() => toggleFeature(feat.key)}
                        className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all select-none ${
                          enabled ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-[#1a1a1a] bg-[#111] opacity-60'
                        }`}
                      >
                        <div>
                          <p className={`text-sm font-medium ${enabled ? 'text-white' : 'text-[#555]'}`}>{feat.key}</p>
                          <p className="text-[10px] text-[#444] mt-0.5">{feat.description}</p>
                        </div>
                        <div className={`w-8 h-4 rounded-full relative flex-shrink-0 ${enabled ? 'bg-emerald-600' : 'bg-[#222]'}`}>
                          <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Aba: Permissões de Tela */}
          {activeTab === 'permissoes' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-[#888]">Controle de acesso restrito (RBAC). O que não estiver marcado, será bloqueado pelo PermissionGate.</p>
                <button 
                  onClick={() => setForm(f => ({...f, permissions: sysPermissions.map(p => p.key)}))}
                  className="text-xs text-emerald-400 hover:text-emerald-300"
                >
                  Selecionar Tudo
                </button>
              </div>

              {sysPermissions.length === 0 ? (
                <div className="text-center p-6 text-[#555] border border-dashed border-[#1a1a1a] rounded-lg">
                  Nenhuma permissão encontrada.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2 max-h-[60vh] overflow-y-auto pr-2">
                  {/* Agrupar por módulo */}
                  {Array.from(new Set(sysPermissions.map(p => p.module))).map(module => (
                    <div key={module} className="mb-4">
                      <h4 className="text-[11px] font-bold text-[#444] uppercase tracking-wider mb-2">{module}</h4>
                      <div className="space-y-1.5">
                        {sysPermissions.filter(p => p.module === module).map(p => {
                          const enabled = form.permissions.includes(p.key);
                          return (
                            <label key={p.key} className="flex items-start gap-3 p-2.5 rounded-lg border border-[#1a1a1a] bg-[#0f0f0f] hover:bg-[#151515] cursor-pointer">
                              <input 
                                type="checkbox" 
                                checked={enabled}
                                onChange={() => togglePermission(p.key)}
                                className="mt-0.5 rounded bg-[#222] border-[#333] text-emerald-500"
                              />
                              <div>
                                <p className="text-sm text-white font-medium">{p.key}</p>
                                <p className="text-[11px] text-[#555]">{p.description}</p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Aba: Limites */}
          {activeTab === 'limites' && (
            <div className="space-y-4">
              <p className="text-xs text-[#888] mb-4">Métricas contáveis que o plano restringe. Digite -1 para ilimitado.</p>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 border border-[#1a1a1a] bg-[#111] rounded-xl">
                  <label className="block text-sm font-medium text-white mb-1">Profissionais</label>
                  <p className="text-[10px] text-[#555] mb-3">Máximo de barbeiros ativos.</p>
                  <input
                    type="number"
                    value={form.limits.profissionais === 'unlimited' ? -1 : (form.limits.profissionais || 0)}
                    onChange={e => setLimit('profissionais', Number(e.target.value) === -1 ? 'unlimited' : Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#222] rounded-lg text-sm text-white"
                  />
                </div>
                
                {/* Você pode adicionar mais limites dinâmicos aqui no futuro */}
                <div className="p-4 border border-dashed border-[#1a1a1a] rounded-xl flex items-center justify-center text-[#555] text-xs text-center">
                  Novos limites (agendamentos, clientes) podem ser adicionados no JSON futuramente.
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="border-t border-[#1a1a1a] px-6 py-4 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[#555] hover:text-white transition-colors">
            Cancelar
          </button>
          <button
            onClick={() => onSave(form, plan?.id)}
            disabled={saving || !form.name || !form.key}
            className="flex items-center gap-2 px-5 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Salvando...' : 'Salvar Plano'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function AdminPlans() {
  const queryClient = useQueryClient();
  const [modalPlan, setModalPlan] = useState<Plan | null | 'new'>('closed' as any);
  const isModalOpen = modalPlan !== 'closed' as any;

  // Carrega Catálogos (Dicts)
  const { data: sysPermissions = [] } = useQuery({
    queryKey: ['sys_permissions'],
    queryFn: async () => {
      const { data } = await supabase.from('sys_permissions').select('*');
      return data as SysPermission[] || [];
    }
  });

  const { data: sysFeatures = [] } = useQuery({
    queryKey: ['sys_features'],
    queryFn: async () => {
      const { data } = await supabase.from('sys_features').select('*');
      return data as SysFeature[] || [];
    }
  });

  // Carrega Planos
  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['admin_plans_v2'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plans')
        .select('*, plan_prices (*), subscriptions(count)');
      if (error) throw error;
      
      const sortedPlans = (data as Plan[]).sort((a, b) => {
        if (a.is_default) return -1;
        if (b.is_default) return 1;
        
        const aPrice = a.plan_prices?.find(p => p.currency === 'BRL')?.amount || 0;
        const bPrice = b.plan_prices?.find(p => p.currency === 'BRL')?.amount || 0;
        return aPrice - bPrice;
      });
      return sortedPlans;
    }
  });

  const savePlan = useMutation({
    mutationFn: async ({ form, id, isDuplicate }: { form: PlanFormData; id?: string, isDuplicate?: boolean }) => {
      
      // Monta JSONs finais
      const featuresJsonb = {
        ...form.features,
        display_features: form.display_features, // backwards compatibility
      };

      const planData = {
        name: form.name,
        key: form.key,
        description: form.description || null,
        max_professionals: form.limits.profissionais === 'unlimited' ? 999 : Number(form.limits.profissionais || 1), // fallback for old column
        allow_products: form.features.produtos ?? false, // fallback
        trial_days: form.trial_days,
        sort_order: form.sort_order,
        features: featuresJsonb,
        permissions: form.permissions,
        limits: form.limits,
        is_default: form.is_default,
        active: true,
      };

      if (form.is_default) {
        await supabase.from('plans').update({ is_default: false }).neq('id', '00000000-0000-0000-0000-000000000000');
      }

      let planId = id;

      if (id && !isDuplicate) {
        const { error } = await supabase.from('plans').update(planData as any).eq('id', id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('plans').insert(planData as any).select().single();
        if (error) throw error;
        planId = data.id;
        
        if (isDuplicate && id) {
          await supabase.from('plans').update({ active: false }).eq('id', id);
        }
      }

      if (planId && form.price_brl >= 0) {
        const existingPlan = plans.find(p => p.id === planId);
        const existingBrlPrice = existingPlan?.plan_prices?.find(p => p.currency === 'BRL');

        if (existingBrlPrice) {
          await supabase.from('plan_prices').update({ amount: form.price_brl } as any).eq('id', existingBrlPrice.id);
        } else {
          await supabase.from('plan_prices').insert({
            plan_id: planId,
            country_code: 'BR',
            currency: 'BRL',
            amount: form.price_brl,
          } as any);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_plans_v2'] });
      queryClient.invalidateQueries({ queryKey: ['plan_features'] });
      setModalPlan('closed' as any);
    }
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from('plans').update({ active } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_plans_v2'] });
    }
  });

  const deletePlan = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('plans').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin_plans_v2'] })
  });

  const money = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Planos & Permissões"
        subtitle="Configure as regras e limites do SaaS via Permission Engine"
        icon={<Settings className="w-5 h-5" />}
        actions={
          <button
            onClick={() => setModalPlan('new' as any)}
            className="flex items-center gap-2 px-4 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-zinc-200 transition-colors"
          >
            <Plus className="w-4 h-4" /> Novo Plano
          </button>
        }
      />

      {!isLoading && !plans.some(p => p.is_default) && (
        <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-6 flex items-center justify-between">
          <div>
            <h3 className="text-violet-400 font-bold text-lg mb-1">Nenhum Plano Padrão</h3>
            <p className="text-[#888] text-sm">Crie o fallback gratuito.</p>
          </div>
          <button onClick={() => setModalPlan('new' as any)} className="bg-violet-600 px-4 py-2 text-white font-bold rounded-lg">Criar Agora</button>
        </div>
      )}

      {isLoading ? (
        <AdminCardsSkeleton cols={3} />
      ) : plans.length === 0 ? (
        <AdminEmptyState title="Sem planos" description="Adicione seu primeiro pacote." icon={<CreditCard className="w-6 h-6"/>} action={null} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map((plan, i) => {
            const brlPrice = plan.plan_prices?.find(p => p.currency === 'BRL');
            const subCount = plan.subscriptions?.[0]?.count || 0;
            const profLimit = (plan.limits as any)?.profissionais || plan.max_professionals;

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className={`bg-[#0a0a0a] border rounded-xl overflow-hidden flex flex-col ${plan.active ? 'border-[#1a1a1a]' : 'border-[#111] opacity-60'}`}
              >
                <div className="p-5 border-b border-[#111] flex-1">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-white font-bold">{plan.name}</h3>
                    <div className="flex gap-1.5">
                      {plan.is_default && <span className="text-[9px] text-violet-400 border border-violet-500/20 bg-violet-500/5 px-1.5 py-0.5 rounded font-mono">PADRÃO</span>}
                      {(!plan.active && subCount > 0) ? (
                        <span className="text-[9px] text-amber-400 border border-amber-500/20 bg-amber-500/5 px-1.5 py-0.5 rounded font-mono">LEGADO</span>
                      ) : (
                        <span className={`text-[9px] border px-1.5 py-0.5 rounded font-mono ${plan.active ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5' : 'text-[#555] border-[#222]'}`}>{plan.active ? 'ATIVO' : 'INATIVO'}</span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-[#666] min-h-[32px]">{plan.description}</p>
                  
                  <div className="mt-4 mb-4">
                    {brlPrice ? (
                      <div><span className="text-xl font-black text-white">{money(brlPrice.amount)}</span><span className="text-xs text-[#555]">/mês</span></div>
                    ) : <span className="text-xs text-[#444]">Sem preço</span>}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-[#777]">
                    <Users className="w-3.5 h-3.5" />
                    Limite: {profLimit === 'unlimited' ? 'Ilimitado' : `${profLimit} profissional(is)`}
                  </div>
                </div>

                <div className="bg-[#0f0f0f] p-3 flex gap-2">
                  <button onClick={() => setModalPlan(plan)} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-white bg-[#1a1a1a] hover:bg-[#222] rounded-lg">
                    <Edit2 className="w-3.5 h-3.5" /> Editar
                  </button>
                  <button onClick={() => toggleActive.mutate({ id: plan.id, active: !plan.active })} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-white bg-[#1a1a1a] hover:bg-[#222] rounded-lg">
                    {plan.active ? <Ban className="w-3.5 h-3.5 text-amber-400"/> : <CheckCircle className="w-3.5 h-3.5 text-emerald-400"/>}
                    {plan.active ? 'Desativar' : 'Ativar'}
                  </button>
                  <button onClick={() => { if(window.confirm('Excluir?')) deletePlan.mutate(plan.id); }} disabled={subCount > 0} className="w-10 flex items-center justify-center bg-[#1a1a1a] hover:bg-red-500/20 text-[#555] hover:text-red-400 rounded-lg disabled:opacity-30">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {isModalOpen && (
          <PlanModal
            plan={modalPlan === 'new' ? null : modalPlan}
            onClose={() => setModalPlan('closed' as any)}
            onSave={(form, id) => savePlan.mutate({ form, id })}
            saving={savePlan.isPending}
            subCount={modalPlan !== 'new' && modalPlan?.subscriptions?.[0]?.count ? modalPlan.subscriptions[0].count : 0}
            sysPermissions={sysPermissions}
            sysFeatures={sysFeatures}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
