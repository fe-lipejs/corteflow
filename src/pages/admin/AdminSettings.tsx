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
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="flex border-b border-slate-200 bg-slate-50/50">
          <button 
            onClick={() => setActiveTab('finance')}
            className={`px-6 py-4 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'finance' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
          >
            Financeiro
          </button>
          <button 
            onClick={() => setActiveTab('notifications')}
            className={`px-6 py-4 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'notifications' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
          >
            Notificações
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'finance' && (
            <div className="max-w-2xl space-y-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Configurações do Stripe</h3>
                <p className="text-slate-500 text-sm">Configure as chaves da conta mestre do Stripe que receberá as assinaturas e taxas de aplicação.</p>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Stripe Public Key (Live)</label>
                  <input type="text" className="w-full px-4 py-2 border border-slate-200 bg-slate-50 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none text-sm transition-all shadow-xs" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Stripe Secret Key (Live)</label>
                  <input type="password" className="w-full px-4 py-2 border border-slate-200 bg-slate-50 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none text-sm transition-all shadow-xs" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Taxa de Aplicação Padrão (%)</label>
                  <input type="number" defaultValue="2" className="w-full px-4 py-2 border border-slate-200 bg-slate-50 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none text-sm transition-all shadow-xs" />
                  <p className="text-xs text-slate-400 mt-1">Taxa cobrada sobre as transações via Stripe Connect.</p>
                </div>
                <button className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm shadow-xs transition-colors">Salvar Configurações</button>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="max-w-2xl space-y-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Notificações Globais</h3>
                <p className="text-slate-500 text-sm">Controle as regras de notificação por país e plataforma.</p>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-slate-200 rounded-xl bg-slate-50/50">
                  <div>
                    <h4 className="font-semibold text-slate-900 text-sm">WhatsApp</h4>
                    <p className="text-xs text-slate-500">Ativar envios via WhatsApp (API Oficial)</p>
                  </div>
                  <div className="w-11 h-6 bg-blue-600 rounded-full relative cursor-pointer shadow-inner">
                    <div className="w-4 h-4 bg-white rounded-full absolute right-1 top-1 shadow-xs"></div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 border border-slate-200 rounded-xl bg-slate-50/50">
                  <div>
                    <h4 className="font-semibold text-slate-900 text-sm">E-mail</h4>
                    <p className="text-xs text-slate-500">Notificações transacionais via e-mail</p>
                  </div>
                  <div className="w-11 h-6 bg-blue-600 rounded-full relative cursor-pointer shadow-inner">
                    <div className="w-4 h-4 bg-white rounded-full absolute right-1 top-1 shadow-xs"></div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 border border-slate-200 rounded-xl bg-slate-50/30 opacity-60">
                  <div>
                    <h4 className="font-semibold text-slate-900 text-sm">SMS</h4>
                    <p className="text-xs text-slate-400">Em breve</p>
                  </div>
                  <div className="w-11 h-6 bg-slate-200 rounded-full relative shadow-inner">
                    <div className="w-4 h-4 bg-white rounded-full absolute left-1 top-1 shadow-xs"></div>
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
