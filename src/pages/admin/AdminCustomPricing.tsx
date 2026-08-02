import { useState } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Search, DollarSign } from 'lucide-react';
import type { Database } from '../../types/database';

export default function AdminCustomPricing() {
  const [search, setSearch] = useState('');

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

  const money = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl shadow-sm overflow-hidden backdrop-blur-sm animate-fade-in pb-20">
      <div className="p-6 border-b border-zinc-800/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-100 tracking-tight">Preços Personalizados</h2>
          <p className="text-zinc-500 text-sm mt-1">Exceções de preços para inquilinos específicos</p>
        </div>
        <div className="relative">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input 
            type="text" 
            placeholder="Buscar por salão..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 pr-4 py-2 bg-zinc-950/50 border border-zinc-800/50 rounded-xl focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 outline-none w-full md:w-72 text-zinc-100 placeholder-zinc-600 transition-all"
          />
        </div>
      </div>
      
      <div className="overflow-x-auto min-h-[300px]">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-zinc-950/50 border-b border-zinc-800/50 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              <th className="p-4 pl-6">Salão (Tenant)</th>
              <th className="p-4">Plano</th>
              <th className="p-4">Valor Especial</th>
              <th className="p-4">Nota/Justificativa</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50 text-sm text-zinc-300">
            {isLoading ? (
              <tr><td colSpan={4} className="p-8 text-center text-zinc-500">Carregando exceções...</td></tr>
            ) : customPrices.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-12 text-center">
                  <div className="flex flex-col items-center justify-center text-zinc-500">
                    <DollarSign className="w-10 h-10 mb-3 opacity-50" />
                    <p>Nenhuma exceção de preço configurada.</p>
                    <p className="text-xs mt-1">Todos os salões estão usando o preço padrão dos planos.</p>
                  </div>
                </td>
              </tr>
            ) : customPrices.map((price: any) => (
              <tr key={price.id} className="hover:bg-zinc-800/20 transition-colors">
                <td className="p-4 pl-6 font-semibold text-zinc-100">{price.tenants?.name}</td>
                <td className="p-4 text-zinc-400">{price.plans?.name}</td>
                <td className="p-4 text-[#C9963B] font-bold">{money(price.amount_override)}</td>
                <td className="p-4 text-zinc-500">{price.note || '--'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
