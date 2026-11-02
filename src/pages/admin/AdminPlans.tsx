import { useState } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Edit2, Trash2, CheckCircle, Ban, CreditCard,
  X, Save, Users, Settings, Sparkles, ShieldCheck, AlertTriangle
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
    stripe_price_id: string | null;
    stripe_price_id_test?: string | null;
    stripe_price_id_live?: string | null;
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
  stripe_price_brl_test: string;
  stripe_price_brl_live: string;
  
  price_usd: number;
  stripe_price_usd_test: string;
  stripe_price_usd_live: string;
  
  price_eur: number;
  stripe_price_eur_test: string;
  stripe_price_eur_live: string;
  
  is_default: boolean;
  is_trial_plan: boolean;
  
  permissions: string[];
  features: Record<string, boolean>;
  limits: Record<string, number | 'unlimited'>;
  
  display_features: string[];
}

const EMPTY_FORM: PlanFormData = {
  name: '',
  key: '',
  description: '',
  trial_days: 7,
  sort_order: 0,
  
  price_brl: 0,
  stripe_price_brl_test: '',
  stripe_price_brl_live: '',
  
  price_usd: 0,
  stripe_price_usd_test: '',
  stripe_price_usd_live: '',
  
  price_eur: 0,
  stripe_price_eur_test: '',
  stripe_price_eur_live: '',
  
  is_default: false,
  is_trial_plan: false,
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
  const initialLimits = (plan?.limits as Record<string, any>) || {};
  if (plan && plan.max_professionals && !initialLimits.profissionais) {
    initialLimits.profissionais = plan.max_professionals;
  }

  const brl = plan?.plan_prices?.find(p => p.currency === 'BRL');
  const usd = plan?.plan_prices?.find(p => p.currency === 'USD');
  const eur = plan?.plan_prices?.find(p => p.currency === 'EUR');

  const [form, setForm] = useState<PlanFormData>(
    plan ? {
      name: plan.name,
      key: plan.key,
      description: plan.description ?? '',
      trial_days: plan.trial_days,
      sort_order: plan.sort_order,
      
      price_brl: brl?.amount ?? 0,
      stripe_price_brl_test: brl?.stripe_price_id_test || brl?.stripe_price_id || '',
      stripe_price_brl_live: brl?.stripe_price_id_live || '',
      
      price_usd: usd?.amount ?? 0,
      stripe_price_usd_test: usd?.stripe_price_id_test || usd?.stripe_price_id || '',
      stripe_price_usd_live: usd?.stripe_price_id_live || '',
      
      price_eur: eur?.amount ?? 0,
      stripe_price_eur_test: eur?.stripe_price_id_test || eur?.stripe_price_id || '',
      stripe_price_eur_live: eur?.stripe_price_id_live || '',
      
      is_default: !!plan.is_default,
      is_trial_plan: !!(plan as any).is_trial_plan,
      
      permissions: Array.isArray(plan.permissions) ? (plan.permissions as string[]) : [],
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-3xl bg-[#0B0B0E] border border-white/10 rounded-2xl overflow-hidden max-h-[90vh] flex flex-col shadow-2xl text-zinc-100"
      >
        {/* Header */}
        <div className="flex flex-col border-b border-white/10 bg-[#0E0E14]">
          <div className="flex items-center justify-between px-6 py-4">
            <h2 className="text-base font-bold text-white">
              {plan ? 'Editar Plano' : 'Novo Plano'}
            </h2>
            <button onClick={onClose} className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer">
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
                className={`py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                  activeTab === t.id ? 'border-emerald-400 text-emerald-400 font-semibold' : 'border-transparent text-zinc-400 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Aba: Geral */}
          {activeTab === 'geral' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Nome do Plano *</label>
                  <input
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2 bg-[#13131A] border border-white/10 rounded-xl text-sm text-white placeholder-zinc-500 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                    placeholder="Ex: Growth"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Chave Interna</label>
                  <input
                    value={form.key}
                    onChange={e => setForm(f => ({ ...f, key: e.target.value.toLowerCase().replace(/\s+/g, '_') }))}
                    className={`w-full px-3 py-2 bg-[#13131A] border border-white/10 rounded-xl text-sm font-mono transition-colors ${hasSubs ? 'text-zinc-500 cursor-not-allowed opacity-60' : 'text-white placeholder-zinc-500 focus:border-emerald-500 outline-none'}`}
                    disabled={hasSubs}
                  />
                </div>
              </div>
              
              {/* Configurações de Papel do Plano */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-center justify-between p-3.5 bg-amber-500/10 border border-amber-500/25 rounded-xl">
                  <div>
                    <label htmlFor="is_trial_plan" className="text-xs font-bold text-amber-400 cursor-pointer flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" /> Plano Padrão de Trial
                    </label>
                    <p className="text-[10px] text-amber-300/70 mt-0.5">
                      Novos cadastros iniciarão neste plano durante os dias de teste.
                    </p>
                  </div>
                  <input 
                    type="checkbox"
                    id="is_trial_plan"
                    checked={form.is_trial_plan}
                    onChange={e => setForm(f => ({ ...f, is_trial_plan: e.target.checked }))}
                    className="w-4 h-4 rounded accent-emerald-500 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-3.5 bg-emerald-500/10 border border-emerald-500/25 rounded-xl">
                  <div>
                    <label htmlFor="is_default" className="text-xs font-bold text-emerald-400 cursor-pointer">
                      Plano Fallback Gratuito
                    </label>
                    <p className="text-[10px] text-emerald-300/70 mt-0.5">
                      Usado quando a conta não possui assinatura ativa.
                    </p>
                  </div>
                  <input 
                    type="checkbox"
                    id="is_default"
                    checked={form.is_default}
                    onChange={e => setForm(f => ({ ...f, is_default: e.target.checked }))}
                    className="w-4 h-4 rounded accent-emerald-500 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Descrição</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 bg-[#13131A] border border-white/10 rounded-xl text-sm text-white resize-none outline-none focus:border-emerald-500 placeholder-zinc-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Trial (dias)</label>
                  <input
                    type="number"
                    value={form.trial_days}
                    onChange={e => setForm(f => ({ ...f, trial_days: Number(e.target.value) }))}
                    className="w-full px-3 py-2 bg-[#13131A] border border-white/10 rounded-xl text-sm text-white outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Ordem de Exibição</label>
                  <input
                    type="number"
                    value={form.sort_order}
                    onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))}
                    className="w-full px-3 py-2 bg-[#13131A] border border-white/10 rounded-xl text-sm text-white outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Preços e Stripe IDs (Multi-Moedas com suporte a Teste e Live) */}
              <div className="space-y-4 mt-4 pt-4 border-t border-white/10">
                <div>
                  <h4 className="text-sm font-semibold text-white">Preços e Identificadores do Stripe (Teste &amp; Produção)</h4>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Cadastre os IDs do Stripe para cada ambiente. Quando a plataforma estiver em Modo Teste, usará o ID de Teste. Quando você alternar para Modo Produção (Live), usará o ID de Produção.
                  </p>
                </div>
                
                {/* BRL */}
                <div className="p-3.5 bg-white/[0.02] border border-white/10 rounded-xl space-y-3">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      🇧🇷 Real Brasileiro (BRL)
                    </span>
                    <div className="w-32">
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400">R$</span>
                        <input
                          type="number"
                          value={form.price_brl}
                          onChange={e => setForm(f => ({ ...f, price_brl: Number(e.target.value) }))}
                          className="w-full pl-8 pr-2.5 py-1 bg-[#13131A] border border-white/10 rounded-lg text-xs font-bold text-white outline-none focus:border-emerald-500"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-amber-400 mb-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Stripe Price ID (Modo Teste)
                      </label>
                      <input
                        value={form.stripe_price_brl_test}
                        onChange={e => setForm(f => ({ ...f, stripe_price_brl_test: e.target.value }))}
                        className="w-full px-2.5 py-1.5 bg-[#13131A] border border-white/10 rounded-lg text-xs text-white font-mono placeholder-zinc-600 outline-none focus:border-amber-500"
                        placeholder="price_1U8... (test)"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-emerald-400 mb-1 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" /> Stripe Price ID (Modo Live)
                      </label>
                      <input
                        value={form.stripe_price_brl_live}
                        onChange={e => setForm(f => ({ ...f, stripe_price_brl_live: e.target.value }))}
                        className="w-full px-2.5 py-1.5 bg-[#13131A] border border-white/10 rounded-lg text-xs text-white font-mono placeholder-zinc-600 outline-none focus:border-emerald-500"
                        placeholder="price_1U8... (live)"
                      />
                    </div>
                  </div>
                </div>

                {/* USD */}
                <div className="p-3.5 bg-white/[0.02] border border-white/10 rounded-xl space-y-3">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      🇺🇸 Dólar Americano (USD)
                    </span>
                    <div className="w-32">
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400">$</span>
                        <input
                          type="number"
                          value={form.price_usd}
                          onChange={e => setForm(f => ({ ...f, price_usd: Number(e.target.value) }))}
                          className="w-full pl-8 pr-2.5 py-1 bg-[#13131A] border border-white/10 rounded-lg text-xs font-bold text-white outline-none focus:border-emerald-500"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-amber-400 mb-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Stripe Price ID (Modo Teste)
                      </label>
                      <input
                        value={form.stripe_price_usd_test}
                        onChange={e => setForm(f => ({ ...f, stripe_price_usd_test: e.target.value }))}
                        className="w-full px-2.5 py-1.5 bg-[#13131A] border border-white/10 rounded-lg text-xs text-white font-mono placeholder-zinc-600 outline-none focus:border-amber-500"
                        placeholder="price_1U8... (test)"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-emerald-400 mb-1 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" /> Stripe Price ID (Modo Live)
                      </label>
                      <input
                        value={form.stripe_price_usd_live}
                        onChange={e => setForm(f => ({ ...f, stripe_price_usd_live: e.target.value }))}
                        className="w-full px-2.5 py-1.5 bg-[#13131A] border border-white/10 rounded-lg text-xs text-white font-mono placeholder-zinc-600 outline-none focus:border-emerald-500"
                        placeholder="price_1U8... (live)"
                      />
                    </div>
                  </div>
                </div>

                {/* EUR */}
                <div className="p-3.5 bg-white/[0.02] border border-white/10 rounded-xl space-y-3">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      🇪🇺 Euro (EUR)
                    </span>
                    <div className="w-32">
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400">€</span>
                        <input
                          type="number"
                          value={form.price_eur}
                          onChange={e => setForm(f => ({ ...f, price_eur: Number(e.target.value) }))}
                          className="w-full pl-8 pr-2.5 py-1 bg-[#13131A] border border-white/10 rounded-lg text-xs font-bold text-white outline-none focus:border-emerald-500"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-amber-400 mb-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Stripe Price ID (Modo Teste)
                      </label>
                      <input
                        value={form.stripe_price_eur_test}
                        onChange={e => setForm(f => ({ ...f, stripe_price_eur_test: e.target.value }))}
                        className="w-full px-2.5 py-1.5 bg-[#13131A] border border-white/10 rounded-lg text-xs text-white font-mono placeholder-zinc-600 outline-none focus:border-amber-500"
                        placeholder="price_1U8... (test)"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-emerald-400 mb-1 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" /> Stripe Price ID (Modo Live)
                      </label>
                      <input
                        value={form.stripe_price_eur_live}
                        onChange={e => setForm(f => ({ ...f, stripe_price_eur_live: e.target.value }))}
                        className="w-full px-2.5 py-1.5 bg-[#13131A] border border-white/10 rounded-lg text-xs text-white font-mono placeholder-zinc-600 outline-none focus:border-emerald-500"
                        placeholder="price_1U8... (live)"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-2">Bullets de Marketing</label>
                <div className="space-y-1.5 mb-2">
                  {form.display_features.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-sm text-zinc-200 flex-1">{f}</span>
                      <button onClick={() => setForm(form => ({...form, display_features: form.display_features.filter((_, idx) => idx !== i)}))} className="text-zinc-500 hover:text-red-400 cursor-pointer">
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
                    className="flex-1 px-3 py-2 bg-[#13131A] border border-white/10 rounded-xl text-sm text-white placeholder-zinc-500 outline-none focus:border-emerald-500"
                  />
                  <button onClick={addMarketingFeature} className="px-3 py-2 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-xl hover:bg-emerald-500/25 transition-colors cursor-pointer">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Aba: Features Comerciais */}
          {activeTab === 'features' && (
            <div className="space-y-4">
              <p className="text-xs text-zinc-400 mb-4">Estas chaves representam os gatilhos comerciais (FeatureGates). Se habilitado, a tela de &quot;Faça Upgrade&quot; não aparecerá para o recurso.</p>
              
              {sysFeatures.length === 0 ? (
                <div className="p-4 border border-dashed border-white/10 rounded-xl text-center text-sm text-zinc-500">
                  Nenhuma feature comercial cadastrada no banco (`sys_features`).
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {sysFeatures.map(feat => {
                    const enabled = !!form.features[feat.key];
                    return (
                      <div
                        key={feat.key}
                        onClick={() => toggleFeature(feat.key)}
                        className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all select-none ${
                          enabled ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-white/10 bg-white/[0.02] opacity-60'
                        }`}
                      >
                        <div>
                          <p className={`text-sm font-semibold ${enabled ? 'text-emerald-300' : 'text-zinc-300'}`}>{feat.key}</p>
                          <p className="text-[10px] text-zinc-400 mt-0.5">{feat.description}</p>
                        </div>
                        <div className={`w-8 h-4 rounded-full relative flex-shrink-0 transition-colors ${enabled ? 'bg-emerald-500' : 'bg-zinc-800 border border-white/10'}`}>
                          <div className={`absolute top-0.5 w-3 h-3 bg-black rounded-full shadow transition-transform ${enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-2">
                <p className="text-xs text-zinc-400">Controle de acesso restrito (RBAC). O que não estiver marcado, será bloqueado pelo PermissionGate.</p>
                <div className="flex gap-4">
                  <button 
                    onClick={() => setForm(f => ({...f, permissions: sysPermissions.map(p => p.key)}))}
                    className="text-xs text-emerald-400 hover:text-emerald-300 font-bold cursor-pointer"
                  >
                    Selecionar Tudo
                  </button>
                  <button 
                    onClick={() => setForm(f => ({...f, permissions: []}))}
                    className="text-xs text-rose-400 hover:text-rose-300 font-bold cursor-pointer"
                  >
                    Desmarcar Tudo
                  </button>
                </div>
              </div>

              {sysPermissions.length === 0 ? (
                <div className="text-center p-6 text-zinc-500 border border-dashed border-white/10 rounded-xl">
                  Nenhuma permissão encontrada.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2 max-h-[60vh] overflow-y-auto pr-2">
                  {Array.from(new Set(sysPermissions.map(p => p.module))).map(module => (
                    <div key={module} className="mb-4">
                      <h4 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2">{module}</h4>
                      <div className="space-y-1.5">
                        {sysPermissions.filter(p => p.module === module).map(p => {
                          const enabled = form.permissions.includes(p.key);
                          return (
                            <label key={p.key} className="flex items-start gap-3 p-3 rounded-xl border border-white/10 bg-[#0E0E14] hover:bg-white/[0.03] cursor-pointer shadow-xs transition-colors">
                              <input 
                                type="checkbox" 
                                checked={enabled}
                                onChange={() => togglePermission(p.key)}
                                className="mt-0.5 rounded accent-emerald-500 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                              />
                              <div>
                                <p className="text-sm text-zinc-200 font-medium">{p.key}</p>
                                <p className="text-[11px] text-zinc-400">{p.description}</p>
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
              <p className="text-xs text-zinc-400 mb-4">Métricas contáveis que o plano restringe. Digite -1 para ilimitado.</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 border border-white/10 bg-[#0E0E14] rounded-xl">
                  <label className="block text-sm font-semibold text-zinc-200 mb-1">Profissionais</label>
                  <p className="text-[10px] text-zinc-400 mb-3">Máximo de profissionais ativos.</p>
                  <input
                    type="number"
                    value={form.limits.profissionais === 'unlimited' ? -1 : (form.limits.profissionais || 0)}
                    onChange={e => setLimit('profissionais', Number(e.target.value) === -1 ? 'unlimited' : Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#13131A] border border-white/10 rounded-lg text-sm text-white outline-none focus:border-emerald-500"
                  />
                </div>
                
                <div className="p-4 border border-white/10 bg-[#0E0E14] rounded-xl">
                  <label className="block text-sm font-semibold text-zinc-200 mb-1">Serviços</label>
                  <p className="text-[10px] text-zinc-400 mb-3">Máximo de serviços no catálogo.</p>
                  <input
                    type="number"
                    value={form.limits.servicos === 'unlimited' ? -1 : (form.limits.servicos ?? 0)}
                    onChange={e => setLimit('servicos', Number(e.target.value) === -1 ? 'unlimited' : Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#13131A] border border-white/10 rounded-lg text-sm text-white outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="p-4 border border-white/10 bg-[#0E0E14] rounded-xl">
                  <label className="block text-sm font-semibold text-zinc-200 mb-1">Produtos</label>
                  <p className="text-[10px] text-zinc-400 mb-3">Máximo de produtos de revenda.</p>
                  <input
                    type="number"
                    value={form.limits.produtos === 'unlimited' ? -1 : (form.limits.produtos ?? 0)}
                    onChange={e => setLimit('produtos', Number(e.target.value) === -1 ? 'unlimited' : Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#13131A] border border-white/10 rounded-lg text-sm text-white outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="border-t border-white/10 px-6 py-4 flex items-center justify-end gap-3 bg-[#0E0E14]">
          <button onClick={onClose} className="px-4 py-2 text-sm text-zinc-400 hover:text-white font-medium transition-colors cursor-pointer">
            Cancelar
          </button>
          <button
            onClick={() => onSave(form, plan?.id)}
            disabled={saving || !form.name || !form.key}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-500/20 cursor-pointer active:scale-95"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Salvando...' : 'Salvar Plano'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function AdminPlans() {
  const [modalPlan, setModalPlan] = useState<Plan | 'new' | 'closed'>('closed');
  const isModalOpen = modalPlan !== 'closed';
  const queryClient = useQueryClient();

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['admin_plans_v2'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plans')
        .select(`
          *,
          plan_prices (*),
          subscriptions (count)
        `)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Plan[];
    }
  });

  const { data: sysPermissions = [] } = useQuery({
    queryKey: ['sys_permissions'],
    queryFn: async () => {
      const { data } = await supabase.from('sys_permissions').select('*').order('module');
      return (data ?? []) as SysPermission[];
    }
  });

  const { data: sysFeatures = [] } = useQuery({
    queryKey: ['sys_features'],
    queryFn: async () => {
      const { data } = await supabase.from('sys_features').select('*').order('module');
      return (data ?? []) as SysFeature[];
    }
  });

  const savePlan = useMutation({
    mutationFn: async ({ form, id }: { form: PlanFormData; id?: string }) => {
      const planPayload: any = {
        name: form.name,
        key: form.key,
        description: form.description,
        trial_days: form.trial_days,
        sort_order: form.sort_order,
        is_default: form.is_default,
        is_trial_plan: form.is_trial_plan,
        permissions: form.permissions,
        features: {
          ...form.features,
          display_features: form.display_features,
        },
        limits: form.limits,
        max_professionals: typeof form.limits.profissionais === 'number' ? form.limits.profissionais : null,
      };

      let planId = id;

      if (id) {
        const { error } = await supabase.from('plans').update(planPayload).eq('id', id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('plans').insert(planPayload).select().single();
        if (error) throw error;
        planId = data.id;
      }

      if (form.is_default && planId) {
        await supabase.from('plans').update({ is_default: false } as any).neq('id', planId);
      }
      if (form.is_trial_plan && planId) {
        await supabase.from('plans').update({ is_trial_plan: false } as any).neq('id', planId);
      }

      if (planId) {
        const syncPrice = async (
          currency: string,
          country: string,
          amount: number,
          stripeTestId?: string,
          stripeLiveId?: string
        ) => {
          const existingPrice = plans.find(p => p.id === planId)?.plan_prices?.find(p => p.currency === currency);
          const testId = stripeTestId?.trim() || null;
          const liveId = stripeLiveId?.trim() || null;
          const legacyId = liveId || testId;

          if (existingPrice) {
            await supabase.from('plan_prices').update({ 
              amount, 
              stripe_price_id: legacyId,
              stripe_price_id_test: testId,
              stripe_price_id_live: liveId,
            } as any).eq('id', existingPrice.id);
          } else if (amount >= 0) {
            await supabase.from('plan_prices').insert({
              plan_id: planId,
              country_code: country,
              currency: currency,
              amount: amount,
              stripe_price_id: legacyId,
              stripe_price_id_test: testId,
              stripe_price_id_live: liveId,
            } as any);
          }
        };

        await syncPrice('BRL', 'BR', form.price_brl, form.stripe_price_brl_test, form.stripe_price_brl_live);
        await syncPrice('USD', 'US', form.price_usd, form.stripe_price_usd_test, form.stripe_price_usd_live);
        await syncPrice('EUR', 'ES', form.price_eur, form.stripe_price_eur_test, form.stripe_price_eur_live);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_plans_v2'] });
      queryClient.invalidateQueries({ queryKey: ['plan_features'] });
      queryClient.invalidateQueries({ queryKey: ['permission_engine'] });
      queryClient.invalidateQueries({ queryKey: ['active_subscription_contract'] });
      queryClient.invalidateQueries({ queryKey: ['sys_role_permissions'] });
      queryClient.invalidateQueries({ queryKey: ['plans'] });
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
        title="Planos &amp; Permissões"
        subtitle="Configure as regras, limites e identificadores Stripe de Teste e Live via Permission Engine"
        icon={<Settings className="w-5 h-5 text-emerald-400" />}
        actions={
          <button
            onClick={() => setModalPlan('new' as any)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20 cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" /> Novo Plano
          </button>
        }
      />

      {!isLoading && !plans.some(p => p.is_default) && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-6 flex items-center justify-between">
          <div>
            <h3 className="text-amber-400 font-bold text-lg mb-1">Nenhum Plano Padrão</h3>
            <p className="text-zinc-400 text-sm">Crie o fallback gratuito.</p>
          </div>
          <button onClick={() => setModalPlan('new' as any)} className="bg-emerald-500 hover:bg-emerald-400 px-4 py-2 text-black font-bold rounded-xl transition-all cursor-pointer">Criar Agora</button>
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
                className={`bg-[#0B0B0E] border rounded-2xl overflow-hidden flex flex-col shadow-xl hover:shadow-2xl hover:border-emerald-500/30 transition-all ${plan.active ? 'border-white/10' : 'border-white/5 opacity-50'}`}
              >
                <div className="p-5 border-b border-white/5 flex-1">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-white font-bold text-base">{plan.name}</h3>
                    <div className="flex flex-wrap gap-1.5 justify-end">
                      {(plan as any).is_trial_plan && (
                        <span className="text-[9px] text-amber-300 border border-amber-500/30 bg-amber-500/15 px-1.5 py-0.5 rounded font-mono font-bold flex items-center gap-1">
                          <Sparkles className="w-2.5 h-2.5 text-amber-400" /> TRIAL ({plan.trial_days}D)
                        </span>
                      )}
                      {plan.is_default && <span className="text-[9px] text-emerald-300 border border-emerald-500/30 bg-emerald-500/15 px-1.5 py-0.5 rounded font-mono font-bold">FALLBACK</span>}
                      {(!plan.active && subCount > 0) ? (
                        <span className="text-[9px] text-amber-300 border border-amber-500/30 bg-amber-500/15 px-1.5 py-0.5 rounded font-mono">LEGADO</span>
                      ) : (
                        <span className={`text-[9px] border px-1.5 py-0.5 rounded font-mono font-semibold ${plan.active ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/15' : 'text-zinc-500 border-white/10 bg-white/5'}`}>{plan.active ? 'ATIVO' : 'INATIVO'}</span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-zinc-400 min-h-[32px]">{plan.description}</p>
                  
                  <div className="mt-4 mb-4">
                    {brlPrice ? (
                      <div><span className="text-xl font-black text-white">{money(brlPrice.amount)}</span><span className="text-xs text-zinc-500">/mês</span></div>
                    ) : <span className="text-xs text-zinc-500">Sem preço</span>}
                  </div>

                  {/* Status das chaves Stripe */}
                  <div className="py-2 px-2.5 bg-white/[0.02] border border-white/5 rounded-xl mb-3 space-y-1 text-[10px]">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400 flex items-center gap-1">
                        <AlertTriangle className="w-2.5 h-2.5 text-amber-400" /> Preço Teste:
                      </span>
                      <span className="font-mono text-zinc-300">
                        {brlPrice?.stripe_price_id_test || brlPrice?.stripe_price_id ? 'Configurado' : 'Automático'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400 flex items-center gap-1">
                        <ShieldCheck className="w-2.5 h-2.5 text-emerald-400" /> Preço Live:
                      </span>
                      <span className="font-mono text-zinc-300">
                        {brlPrice?.stripe_price_id_live ? 'Configurado' : 'Automático'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-zinc-400">
                    <Users className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Limite: <strong className="text-zinc-200">{profLimit === 'unlimited' ? 'Ilimitado' : `${profLimit} profissional(is)`}</strong></span>
                  </div>
                </div>

                <div className="bg-white/[0.02] p-3 flex gap-2 border-t border-white/5">
                  <button onClick={() => setModalPlan(plan)} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-zinc-200 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-emerald-400 hover:border-emerald-500/30 rounded-xl transition-colors cursor-pointer">
                    <Edit2 className="w-3.5 h-3.5" /> Editar
                  </button>
                  <button onClick={() => toggleActive.mutate({ id: plan.id, active: !plan.active })} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-zinc-200 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl transition-colors cursor-pointer">
                    {plan.active ? <Ban className="w-3.5 h-3.5 text-amber-400"/> : <CheckCircle className="w-3.5 h-3.5 text-emerald-400"/>}
                    {plan.active ? 'Desativar' : 'Ativar'}
                  </button>
                  <button onClick={() => { if(window.confirm('Excluir?')) deletePlan.mutate(plan.id); }} disabled={subCount > 0} className="w-10 flex items-center justify-center bg-white/5 border border-white/10 hover:bg-red-500/15 text-zinc-400 hover:text-red-400 rounded-xl disabled:opacity-30 transition-colors cursor-pointer">
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
