import { useState, useEffect } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { Search, MoreVertical, ExternalLink } from 'lucide-react';
import type { Database } from '../../types/database';

type Tenant = Database['public']['Tables']['tenants']['Row'];

export default function AdminTenants() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    const { data, error } = await supabase.from('tenants').select('*').order('created_at', { ascending: false });
    if (!error && data) {
      setTenants(data);
    }
    setLoading(false);
  };

  const filteredTenants = tenants.filter(t => t.name.toLowerCase().includes(search.toLowerCase()) || t.slug.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl shadow-sm overflow-hidden backdrop-blur-sm">
      <div className="p-6 border-b border-zinc-800/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-zinc-100 tracking-tight">Inquilinos (Salões)</h2>
        <div className="relative">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input 
            type="text" 
            placeholder="Buscar por nome ou slug..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 pr-4 py-2 bg-zinc-950/50 border border-zinc-800/50 rounded-xl focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 outline-none w-full md:w-72 text-zinc-100 placeholder-zinc-600 transition-all"
          />
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-zinc-950/50 border-b border-zinc-800/50 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              <th className="p-4 pl-6">Nome</th>
              <th className="p-4">Slug</th>
              <th className="p-4">Tipo</th>
              <th className="p-4">Status</th>
              <th className="p-4">Criado em</th>
              <th className="p-4 text-right pr-6">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50 text-sm text-zinc-300">
            {loading ? (
              <tr><td colSpan={6} className="p-8 text-center text-zinc-500">Carregando...</td></tr>
            ) : filteredTenants.map(tenant => (
              <tr key={tenant.id} className="hover:bg-zinc-800/20 transition-colors group">
                <td className="p-4 pl-6 font-semibold text-zinc-100">{tenant.name}</td>
                <td className="p-4 text-zinc-500 group-hover:text-amber-500 transition-colors">/{tenant.slug}</td>
                <td className="p-4 capitalize">{tenant.business_type}</td>
                <td className="p-4">
                  <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wide border ${
                    tenant.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                    tenant.status === 'trial' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                    'bg-red-500/10 text-red-400 border-red-500/20'
                  }`}>
                    {tenant.status}
                  </span>
                </td>
                <td className="p-4 text-zinc-500">{new Date(tenant.created_at).toLocaleDateString()}</td>
                <td className="p-4 pr-6">
                  <div className="flex items-center justify-end space-x-2 opacity-50 group-hover:opacity-100 transition-opacity">
                    <button className="p-2 bg-zinc-800/50 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-amber-500 transition-colors" title="Ver página pública">
                      <ExternalLink className="w-4 h-4" />
                    </button>
                    <button className="p-2 bg-zinc-800/50 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-100 transition-colors">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
