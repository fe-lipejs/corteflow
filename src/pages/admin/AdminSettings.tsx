import { useState } from 'react';
import AdminPageHeader from './components/AdminPageHeader';
import { Settings } from 'lucide-react';

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState('finance');

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Configurações"
        subtitle="Configurações globais da plataforma"
        icon={<Settings className="w-5 h-5" />}
      />
    <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl overflow-hidden">
      <div className="flex border-b border-[#1a1a1a]">
        <button 
          onClick={() => setActiveTab('finance')}
          className={`px-6 py-4 text-sm font-medium border-b-2 ${activeTab === 'finance' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-zinc-500 hover:text-zinc-700'}`}
        >
          Financeiro
        </button>
        <button 
          onClick={() => setActiveTab('notifications')}
          className={`px-6 py-4 text-sm font-medium border-b-2 ${activeTab === 'notifications' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-zinc-500 hover:text-zinc-700'}`}
        >
          Notificações
        </button>
      </div>

      <div className="p-6">
        {activeTab === 'finance' && (
          <div className="max-w-2xl space-y-6">
            <h3 className="text-lg font-bold text-zinc-900">Configurações do Stripe</h3>
            <p className="text-zinc-500 text-sm">Configure as chaves da conta mestre do Stripe que receberá as assinaturas e taxas de aplicação.</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Stripe Public Key (Live)</label>
                <input type="text" className="w-full px-4 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Stripe Secret Key (Live)</label>
                <input type="password" className="w-full px-4 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Taxa de Aplicação Padrão (%)</label>
                <input type="number" defaultValue="2" className="w-full px-4 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                <p className="text-xs text-zinc-500 mt-1">Taxa cobrada sobre as transações via Stripe Connect.</p>
              </div>
              <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700">Salvar Configurações</button>
            </div>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="max-w-2xl space-y-6">
            <h3 className="text-lg font-bold text-zinc-900">Notificações Globais</h3>
            <p className="text-zinc-500 text-sm">Controle as regras de notificação por país e plataforma.</p>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border border-zinc-200 rounded-lg">
                <div>
                  <h4 className="font-medium text-zinc-900">WhatsApp</h4>
                  <p className="text-sm text-zinc-500">Ativar envios via WhatsApp (API Oficial)</p>
                </div>
                <div className="w-12 h-6 bg-emerald-500 rounded-full relative cursor-pointer">
                  <div className="w-4 h-4 bg-white rounded-full absolute right-1 top-1"></div>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 border border-zinc-200 rounded-lg">
                <div>
                  <h4 className="font-medium text-zinc-900">E-mail</h4>
                  <p className="text-sm text-zinc-500">Notificações transacionais via e-mail</p>
                </div>
                <div className="w-12 h-6 bg-emerald-500 rounded-full relative cursor-pointer">
                  <div className="w-4 h-4 bg-white rounded-full absolute right-1 top-1"></div>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 border border-zinc-200 rounded-lg opacity-50">
                <div>
                  <h4 className="font-medium text-zinc-900">SMS</h4>
                  <p className="text-sm text-zinc-500">Em breve</p>
                </div>
                <div className="w-12 h-6 bg-zinc-300 rounded-full relative">
                  <div className="w-4 h-4 bg-white rounded-full absolute left-1 top-1"></div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </div>
  );
}

