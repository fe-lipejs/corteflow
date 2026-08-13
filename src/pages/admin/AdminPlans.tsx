import { useState } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Edit2, Trash2, CheckCircle, Ban, CreditCard,
  X, Save, Users, Package, Clock, Lock, Unlock,
  LayoutDashboard, Calendar, Scissors, DollarSign, BarChart3
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
};

// Feature flags that can be toggled per plan
interface FeatureFlags {
  agenda: boolean;
  clientes: boolean;
  equipe: boolean;
  servicos: boolean;
  financeiro: boolean;
  relatorios: boolean;
  produtos: boolean;
}

const DEFAULT_FLAGS: FeatureFlags = {
  agenda: true,
  clientes: true,
  equipe: true,
  servicos: true,
  financeiro: false,
  relatorios: false,
  produtos: false,
};

const FEATURE_META: { key: keyof FeatureFlags; label: string; icon: React.ElementType; description: string }[] = [
  { key: 'agenda', label: 'Agenda', icon: Calendar, description: 'Visualização e gestão de agendamentos' },
  { key: 'clientes', label: 'Clientes', icon: Users, description: 'Lista e ficha de clientes' },
  { key: 'equipe', label: 'Equipe', icon: Users, description: 'Cadastro de profissionais' },
  { key: 'servicos', label: 'Serviços', icon: Scissors, description: 'Catálogo de serviços' },
  { key: 'financeiro', label: 'Financeiro', icon: DollarSign, description: 'Fluxo de caixa e relatórios financeiros' },
  { key: 'relatorios', label: 'Relatórios', icon: BarChart3, description: 'Dashboards e métricas avançadas' },
  { key: 'produtos', label: 'Produtos', icon: Package, description: 'Venda e gestão de estoque' },
];

interface PlanFormData {
  name: string;
  key: string;
  description: string;
  max_professionals: number;
  allow_products: boolean;
  trial_days: number;
  sort_order: number;
  feature_flags: FeatureFlags;
  display_features: string[]; // Marketing bullet points
  price_brl: number;
}

const EMPTY_FORM: PlanFormData = {
  name: '',
  key: '',
  description: '',
  max_professionals: 1,
  allow_products: false,
  trial_days: 7,
  sort_order: 0,
  feature_flags: DEFAULT_FLAGS,
  display_features: [],
  price_brl: 0,
};

function parsePlanFeatures(plan: Plan): { flags: FeatureFlags; displayFeatures: string[] } {
  if (!plan.features) return { flags: DEFAULT_FLAGS, displayFeatures: [] };

  const f = plan.features as any;

  // Detect old format (array of strings) vs new format (object with flags)
  if (Array.isArray(f)) {
    return { flags: DEFAULT_FLAGS, displayFeatures: f as string[] };
  }

  if (typeof f === 'object') {
    const flags: FeatureFlags = {
      agenda: f.agenda ?? true,
      clientes: f.clientes ?? true,
      equipe: f.equipe ?? true,
      servicos: f.servicos ?? true,
      financeiro: f.financeiro ?? false,
      relatorios: f.relatorios ?? false,
      produtos: f.produtos ?? false,
    };
    const displayFeatures: string[] = Array.isArray(f.display_features) ? f.display_features : [];
    return { flags, displayFeatures };
  }

  return { flags: DEFAULT_FLAGS, displayFeatures: [] };
}

// ── Plan Modal ────────────────────────────────────────────────────────────────
function PlanModal({
  plan,
  onClose,
  onSave,
  saving,
}: {
  plan: Plan | null;
  onClose: () => void;
  onSave: (form: PlanFormData, id?: string) => void;
  saving: boolean;
}) {
  const existingPrice = plan?.plan_prices?.find(p => p.currency === 'BRL');
  const parsedFeatures = plan ? parsePlanFeatures(plan) : { flags: DEFAULT_FLAGS, displayFeatures: [] };

  const [form, setForm] = useState<PlanFormData>(
    plan ? {
      name: plan.name,
      key: plan.key,
      description: plan.description ?? '',
      max_professionals: plan.max_professionals,
      allow_products: plan.allow_products,
      trial_days: plan.trial_days,
      sort_order: plan.sort_order,
      feature_flags: parsedFeatures.flags,
      display_features: parsedFeatures.displayFeatures,
      price_brl: existingPrice?.amount ?? 0,
    } : EMPTY_FORM
  );
  const [newFeature, setNewFeature] = useState('');

  const addFeature = () => {
    if (newFeature.trim()) {
      setForm(f => ({ ...f, display_features: [...f.display_features, newFeature.trim()] }));
      setNewFeature('');
    }
  };

  const removeFeature = (i: number) =>
    setForm(f => ({ ...f, display_features: f.display_features.filter((_, idx) => idx !== i) }));

  const toggleFlag = (key: keyof FeatureFlags) => {
    setForm(f => ({
      ...f,
      feature_flags: { ...f.feature_flags, [key]: !f.feature_flags[key] },
      // Sync allow_products with produtos flag
      allow_products: key === 'produtos' ? !f.feature_flags.produtos : f.allow_products,
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-2xl bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl overflow-hidden max-h-[90vh] flex flex-col shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a1a1a]">
          <h2 className="text-base font-semibold text-white">
            {plan ? 'Editar Plano' : 'Novo Plano'}
          </h2>
          <button onClick={onClose} className="p-1.5 text-[#444] hover:text-white hover:bg-[#1a1a1a] rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Basic info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#555] mb-1.5">Nome do Plano *</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 bg-[#111] border border-[#1a1a1a] rounded-lg text-sm text-white placeholder-[#333] outline-none focus:border-[#333] transition-colors"
                placeholder="Ex: Starter, Growth, Pro"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#555] mb-1.5">Chave (key) *</label>
              <input
                value={form.key}
                onChange={e => setForm(f => ({ ...f, key: e.target.value.toLowerCase().replace(/\s+/g, '_') }))}
                className="w-full px-3 py-2 bg-[#111] border border-[#1a1a1a] rounded-lg text-sm text-white placeholder-[#333] outline-none focus:border-[#333] transition-colors font-mono"
                placeholder="starter, growth, pro"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#555] mb-1.5">Descrição</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 bg-[#111] border border-[#1a1a1a] rounded-lg text-sm text-white placeholder-[#333] outline-none focus:border-[#333] transition-colors resize-none"
              placeholder="Descrição breve para os clientes"
            />
          </div>

          {/* Numeric fields */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#555] mb-1.5">Preço BRL (R$)</label>
              <input
                type="number"
                value={form.price_brl}
                onChange={e => setForm(f => ({ ...f, price_brl: Number(e.target.value) }))}
                className="w-full px-3 py-2 bg-[#111] border border-[#1a1a1a] rounded-lg text-sm text-white placeholder-[#333] outline-none focus:border-[#333] transition-colors"
                min={0}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#555] mb-1.5">Trial (dias)</label>
              <input
                type="number"
                value={form.trial_days}
                onChange={e => setForm(f => ({ ...f, trial_days: Number(e.target.value) }))}
                className="w-full px-3 py-2 bg-[#111] border border-[#1a1a1a] rounded-lg text-sm text-white outline-none focus:border-[#333] transition-colors"
                min={0}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#555] mb-1.5">Profissionais (máx.)</label>
              <input
                type="number"
                value={form.max_professionals}
                onChange={e => setForm(f => ({ ...f, max_professionals: Number(e.target.value) }))}
                className="w-full px-3 py-2 bg-[#111] border border-[#1a1a1a] rounded-lg text-sm text-white outline-none focus:border-[#333] transition-colors"
                min={1}
              />
            </div>
          </div>

          {/* ── Feature Flags (new — from DB) ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <label className="text-xs font-medium text-[#555]">Telas/Recursos Liberados</label>
              <span className="text-[10px] px-2 py-0.5 rounded border border-violet-500/20 bg-violet-500/5 text-violet-400 font-mono">salvo no banco</span>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {FEATURE_META.map(({ key, label, icon: Icon, description }) => {
                const enabled = form.feature_flags[key];
                return (
                  <div
                    key={key}
                    onClick={() => toggleFlag(key)}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all select-none ${
                      enabled
                        ? 'border-emerald-500/30 bg-emerald-500/5'
                        : 'border-[#1a1a1a] bg-[#111] opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 flex-shrink-0 ${enabled ? 'text-emerald-400' : 'text-[#333]'}`} />
                      <div>
                        <p className={`text-sm font-medium ${enabled ? 'text-white' : 'text-[#555]'}`}>{label}</p>
                        <p className="text-[11px] text-[#444]">{description}</p>
                      </div>
                    </div>
                    <div className={`w-8 h-4 rounded-full transition-colors relative flex-shrink-0 ${enabled ? 'bg-emerald-600' : 'bg-[#222]'}`}>
                      <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Display features (marketing bullets) */}
          <div>
            <label className="block text-xs font-medium text-[#555] mb-2">Bullets de Marketing (exibidos na Landing Page)</label>
            <div className="space-y-1.5 mb-2">
              {form.display_features.map((f, i) => (
                <div key={i} className="flex items-center gap-2 bg-[#111] border border-[#1a1a1a] rounded-lg px-3 py-2">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                  <span className="text-sm text-[#bbb] flex-1">{f}</span>
                  <button onClick={() => removeFeature(i)} className="text-[#333] hover:text-red-400 transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={newFeature}
                onChange={e => setNewFeature(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addFeature()}
                placeholder="Ex: Agenda online ilimitada"
                className="flex-1 px-3 py-2 bg-[#111] border border-[#1a1a1a] rounded-lg text-sm text-white placeholder-[#333] outline-none focus:border-[#333] transition-colors"
              />
              <button onClick={addFeature} className="px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] text-[#888] hover:text-white rounded-lg transition-colors">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-[#1a1a1a] px-6 py-4 flex justify-end gap-3">
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

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['admin_plans_v2'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plans')
        .select('*, plan_prices (*)')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data as Plan[];
    }
  });

  const savePlan = useMutation({
    mutationFn: async ({ form, id }: { form: PlanFormData; id?: string }) => {
      // Build the features JSONB: flags + display_features combined
      const featuresJsonb = {
        ...form.feature_flags,
        allow_products: form.feature_flags.produtos,
        display_features: form.display_features,
      };

      const planData = {
        name: form.name,
        key: form.key,
        description: form.description || null,
        max_professionals: form.max_professionals,
        allow_products: form.feature_flags.produtos, // sync with feature flag
        trial_days: form.trial_days,
        sort_order: form.sort_order,
        features: featuresJsonb,
        active: true,
      };

      let planId = id;

      if (id) {
        const { error } = await supabase.from('plans').update(planData as any).eq('id', id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('plans').insert(planData as any).select().single();
        if (error) throw error;
        planId = data.id;
      }

      // Upsert BRL price
      if (planId && form.price_brl > 0) {
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
      queryClient.invalidateQueries({ queryKey: ['plan_features'] });
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
        title="Planos"
        subtitle="Gerencie os pacotes oferecidos às empresas"
        icon={<CreditCard className="w-5 h-5" />}
        actions={
          <button
            onClick={() => setModalPlan('new' as any)}
            className="flex items-center gap-2 px-4 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-zinc-200 transition-colors"
          >
            <Plus className="w-4 h-4" /> Novo Plano
          </button>
        }
      />

      {isLoading ? (
        <AdminCardsSkeleton cols={3} />
      ) : plans.length === 0 ? (
        <AdminEmptyState
          title="Nenhum plano cadastrado"
          description="Crie o primeiro plano para oferecer aos salões."
          icon={<CreditCard className="w-6 h-6" />}
          action={
            <button onClick={() => setModalPlan('new' as any)} className="flex items-center gap-2 px-4 py-2 bg-white text-black text-sm font-medium rounded-lg">
              <Plus className="w-4 h-4" /> Criar Plano
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map((plan, i) => {
            const brlPrice = plan.plan_prices?.find(p => p.currency === 'BRL');
            const { flags, displayFeatures } = parsePlanFeatures(plan);
            const enabledCount = Object.values(flags).filter(Boolean).length;

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className={`bg-[#0a0a0a] border rounded-xl overflow-hidden flex flex-col transition-colors ${plan.active ? 'border-[#1a1a1a]' : 'border-[#111] opacity-60'}`}
              >
                {/* Plan header */}
                <div className="p-5 border-b border-[#111] flex-1">
                  <div className="flex items-start justify-between mb-1">
                    <h3 className="text-base font-bold text-white">{plan.name}</h3>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${plan.active ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5' : 'text-[#444] border-[#1a1a1a] bg-[#111]'}`}>
                      {plan.active ? 'ATIVO' : 'INATIVO'}
                    </span>
                  </div>
                  <p className="text-xs text-[#555] mb-4 min-h-[32px]">{plan.description}</p>

                  {/* Price */}
                  <div className="mb-4">
                    {brlPrice ? (
                      <div className="flex items-end gap-1">
                        <span className="text-2xl font-black text-white">{money(brlPrice.amount)}</span>
                        <span className="text-xs text-[#444] mb-1">/mês</span>
                      </div>
                    ) : (
                      <span className="text-sm text-[#333]">Sem preço cadastrado</span>
                    )}
                  </div>

                  {/* Limits */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-xs text-[#666]">
                      <Users className="w-3.5 h-3.5 text-[#333]" />
                      Até {plan.max_professionals} profissional{plan.max_professionals !== 1 ? 'is' : ''}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[#666]">
                      <Clock className="w-3.5 h-3.5 text-[#333]" />
                      {plan.trial_days} dias de trial
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[#666]">
                      {flags.financeiro ? (
                        <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Lock className="w-3.5 h-3.5 text-[#333]" />
                      )}
                      <span>{enabledCount} de {FEATURE_META.length} recursos liberados</span>
                    </div>
                  </div>

                  {/* Feature badges */}
                  <div className="flex flex-wrap gap-1">
                    {FEATURE_META.map(({ key, label }) => (
                      <span
                        key={key}
                        className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${
                          flags[key]
                            ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5'
                            : 'text-[#333] border-[#111] bg-transparent line-through'
                        }`}
                      >
                        {label}
                      </span>
                    ))}
                  </div>

                  {/* Marketing bullets */}
                  {displayFeatures.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {displayFeatures.slice(0, 3).map((f, fi) => (
                        <div key={fi} className="flex items-center gap-2 text-xs text-[#666]">
                          <CheckCircle className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                          {f}
                        </div>
                      ))}
                      {displayFeatures.length > 3 && (
                        <p className="text-xs text-[#333] pl-5">+{displayFeatures.length - 3} itens</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 px-4 py-3 border-t border-[#0d0d0d] bg-[#080808]">
                  <button
                    onClick={() => setModalPlan(plan)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#666] hover:text-white hover:bg-[#1a1a1a] rounded-lg transition-colors"
                  >
                    <Edit2 className="w-3 h-3" /> Editar
                  </button>
                  <button
                    onClick={() => toggleActive.mutate({ id: plan.id, active: !plan.active })}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors ${plan.active ? 'text-orange-400 hover:bg-orange-500/10' : 'text-emerald-400 hover:bg-emerald-500/10'}`}
                  >
                    {plan.active ? <><Ban className="w-3 h-3" /> Desativar</> : <><CheckCircle className="w-3 h-3" /> Ativar</>}
                  </button>
                  <button
                    onClick={() => window.confirm('Tem certeza? Isso pode afetar assinaturas ativas.') && deletePlan.mutate(plan.id)}
                    className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#333] hover:text-red-400 hover:bg-red-500/5 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <PlanModal
            plan={modalPlan === 'new' as any ? null : modalPlan as Plan}
            onClose={() => setModalPlan('closed' as any)}
            onSave={(form, id) => savePlan.mutate({ form, id })}
            saving={savePlan.isPending}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
