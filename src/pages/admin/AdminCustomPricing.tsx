import { useState } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, DollarSign, Plus, Trash2, Edit2, Loader2, Save, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AdminCustomPricing() {
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  
  // Form State
  const [formId, setFormId] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState('');
  const [planId, setPlanId] = useState('');
  const [amountOverride, setAmountOverride] = useState<string>('');
  const [note, setNote] = useState('');
  
  const queryClient = useQueryClient();

  // Queries
  const { data: customPrices = [], isLoading } = useQuery({
    queryKey: ['admin_custom_pricing'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('custom_pricing')
        .select(`
          *,
          tenants (name, slug),
          plans (name)
        `)
        .order('tenant_id', { ascending: true });
        
      if (error) throw error;
      return data;
    }
  });

  const { data: tenants = [] } = useQuery({
    queryKey: ['admin_tenants_lookup'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tenants').select('id, name, slug').order('name');
      if (error) throw error;
      return data;
    }
  });

  const { data: plans = [] } = useQuery({
    queryKey: ['admin_plans_lookup'],
    queryFn: async () => {
      const { data, error } = await supabase.from('plans').select('id, name').order('sort_order');
      if (error) throw error;
      return data;
    }
  });

  // Mutations
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        tenant_id: tenantId,
        plan_id: planId,
        amount_override: parseFloat(amountOverride),
        note: note || null
      };

      if (formId) {
        const { error } = await supabase.from('custom_pricing').update(payload as any).eq('id', formId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('custom_pricing').insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_custom_pricing'] });
      closeModal();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('custom_pricing').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin_custom_pricing'] })
  });

  // Actions
  const openNewModal = () => {
    setFormId(null);
    setTenantId('');
    setPlanId('');
    setAmountOverride('');
    setNote('');
    setModalOpen(true);
  };

  const openEditModal = (item: any) => {
    setFormId(item.id);
    setTenantId(item.tenant_id);
    setPlanId(item.plan_id);
    setAmountOverride(item.amount_override.toString());
    setNote(item.note || '');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setFormId(null);
  };

  const money = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const filteredPrices = customPrices.filter((p: any) => 
    p.tenants?.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.tenants?.slug?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Preços Personalizados</h1>
          <p className="text-slate-500 text-sm mt-0.5">Defina valores de exceção e acordos especiais para tenants específicos.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Buscar por salão..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:border-blue-500 outline-none w-full md:w-64 text-slate-900 text-sm shadow-xs transition-colors"
            />
          </div>
          <button
            onClick={openNewModal}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" /> Nova Exceção
          </button>
        </div>
      </div>
      
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider">
                <th className="p-4 pl-6">Salão (Tenant)</th>
                <th className="p-4">Plano</th>
                <th className="p-4">Valor Especial</th>
                <th className="p-4">Nota/Justificativa</th>
                <th className="p-4 text-right pr-6">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {isLoading ? (
                <tr><td colSpan={5} className="p-8 text-center text-slate-400"><Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600" /></td></tr>
              ) : filteredPrices.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <DollarSign className="w-10 h-10 mb-3 opacity-30 text-blue-600" />
                      <p>Nenhuma exceção encontrada.</p>
                    </div>
                  </td>
                </tr>
              ) : filteredPrices.map((price: any) => (
                <tr key={price.id} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="p-4 pl-6">
                    <p className="font-semibold text-slate-900">{price.tenants?.name}</p>
                    <p className="text-xs text-slate-400">/{price.tenants?.slug}</p>
                  </td>
                  <td className="p-4 text-slate-600">{price.plans?.name}</td>
                  <td className="p-4 text-emerald-600 font-bold">{money(price.amount_override)}</td>
                  <td className="p-4 text-slate-500 max-w-[200px] truncate">{price.note || '--'}</td>
                  <td className="p-4 text-right pr-6">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEditModal(price)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => { if(confirm('Remover essa exceção? O salão voltará a pagar o preço padrão.')) deleteMutation.mutate(price.id); }} 
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-5 border-b border-slate-100">
                <h3 className="text-lg font-bold text-slate-900">{formId ? 'Editar Exceção' : 'Nova Exceção de Preço'}</h3>
                <button onClick={closeModal} className="p-1 text-slate-400 hover:text-slate-800 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Empresa (Tenant) *</label>
                  <select
                    value={tenantId}
                    onChange={e => setTenantId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-blue-500"
                  >
                    <option value="">Selecione um salão...</option>
                    {tenants.map((t: any) => (
                      <option key={t.id} value={t.id}>{t.name} (/{t.slug})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Plano Associado *</label>
                  <select
                    value={planId}
                    onChange={e => setPlanId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-blue-500"
                  >
                    <option value="">Selecione o plano...</option>
                    {plans.map((p: any) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Valor Personalizado (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={amountOverride}
                    onChange={e => setAmountOverride(e.target.value)}
                    placeholder="Ex: 49.90"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Nota/Justificativa (Opcional)</label>
                  <input
                    type="text"
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="Ex: Promocional primeiros meses..."
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="p-5 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/70">
                <button onClick={closeModal} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 font-medium transition-colors">
                  Cancelar
                </button>
                <button
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending || !tenantId || !planId || !amountOverride}
                  className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl disabled:opacity-40 transition-colors shadow-xs"
                >
                  {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Salvar Exceção
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
