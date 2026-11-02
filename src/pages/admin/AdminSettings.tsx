import { useState, useEffect } from 'react';
import AdminPageHeader from './components/AdminPageHeader';
import { supabase } from '../../integrations/supabase/client';
import toast from 'react-hot-toast';
import {
  Settings,
  CreditCard,
  ShieldCheck,
  AlertTriangle,
  Eye,
  EyeOff,
  CheckCircle2,
  Bell,
  RefreshCw,
  Zap,
  Info,
  Copy,
  ExternalLink,
  Check,
  Webhook
} from 'lucide-react';

interface PlatformSettingsData {
  id: string;
  stripe_mode: 'test' | 'live';
  stripe_test_public_key: string;
  stripe_test_secret_key: string;
  stripe_test_webhook_secret: string;
  stripe_live_public_key: string;
  stripe_live_secret_key: string;
  stripe_live_webhook_secret: string;
  stripe_application_fee_percent: number;
  stripe_test_account_id: string;
  stripe_live_account_id: string;
  stripe_notes: string;
  whatsapp_enabled: boolean;
  email_enabled: boolean;
  sms_enabled: boolean;
  updated_at?: string;
}

const WEBHOOK_URL = 'https://paefckmkawocjxzuoclq.supabase.co/functions/v1/stripe-webhook';

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState<'finance' | 'notifications'>('finance');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  const [settings, setSettings] = useState<PlatformSettingsData>({
    id: 'singleton',
    stripe_mode: 'test',
    stripe_test_public_key: '',
    stripe_test_secret_key: '',
    stripe_test_webhook_secret: '',
    stripe_live_public_key: '',
    stripe_live_secret_key: '',
    stripe_live_webhook_secret: '',
    stripe_application_fee_percent: 2,
    stripe_test_account_id: '',
    stripe_live_account_id: '',
    stripe_notes: '',
    whatsapp_enabled: true,
    email_enabled: true,
    sms_enabled: false
  });

  const [showTestSecret, setShowTestSecret] = useState(false);
  const [showLiveSecret, setShowLiveSecret] = useState(false);
  const [showTestWebhook, setShowTestWebhook] = useState(false);
  const [showLiveWebhook, setShowLiveWebhook] = useState(false);

  // Fetch settings from database
  const fetchSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('platform_settings')
        .select('*')
        .eq('id', 'singleton')
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings({
          id: data.id || 'singleton',
          stripe_mode: data.stripe_mode || 'test',
          stripe_test_public_key: data.stripe_test_public_key || '',
          stripe_test_secret_key: data.stripe_test_secret_key || '',
          stripe_test_webhook_secret: data.stripe_test_webhook_secret || '',
          stripe_live_public_key: data.stripe_live_public_key || '',
          stripe_live_secret_key: data.stripe_live_secret_key || '',
          stripe_live_webhook_secret: data.stripe_live_webhook_secret || '',
          stripe_application_fee_percent: Number(data.stripe_application_fee_percent) || 2,
          stripe_test_account_id: data.stripe_test_account_id || '',
          stripe_live_account_id: data.stripe_live_account_id || '',
          stripe_notes: data.stripe_notes || '',
          whatsapp_enabled: data.whatsapp_enabled ?? true,
          email_enabled: data.email_enabled ?? true,
          sms_enabled: data.sms_enabled ?? false,
          updated_at: data.updated_at
        });
      }
    } catch (err: any) {
      console.error('Erro ao buscar configurações globais:', err);
      toast.error('Erro ao carregar configurações: ' + (err.message || ''));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // Save settings
  const handleSave = async () => {
    try {
      setSaving(true);
      const payload = {
        id: 'singleton',
        stripe_mode: settings.stripe_mode,
        stripe_test_public_key: settings.stripe_test_public_key.trim(),
        stripe_test_secret_key: settings.stripe_test_secret_key.trim(),
        stripe_test_webhook_secret: settings.stripe_test_webhook_secret.trim(),
        stripe_live_public_key: settings.stripe_live_public_key.trim(),
        stripe_live_secret_key: settings.stripe_live_secret_key.trim(),
        stripe_live_webhook_secret: settings.stripe_live_webhook_secret.trim(),
        stripe_application_fee_percent: Number(settings.stripe_application_fee_percent) || 2,
        stripe_test_account_id: settings.stripe_test_account_id.trim(),
        stripe_live_account_id: settings.stripe_live_account_id.trim(),
        stripe_notes: settings.stripe_notes.trim(),
        whatsapp_enabled: settings.whatsapp_enabled,
        email_enabled: settings.email_enabled,
        sms_enabled: settings.sms_enabled,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('platform_settings')
        .upsert(payload, { onConflict: 'id' });

      if (error) throw error;

      toast.success(
        settings.stripe_mode === 'live'
          ? 'Configurações salvas! Modo PRODUÇÃO (LIVE) ativo na plataforma.'
          : 'Configurações salvas! Modo TESTE (SANDBOX) ativo na plataforma.'
      );
      fetchSettings();
    } catch (err: any) {
      console.error('Erro ao salvar configurações:', err);
      toast.error('Erro ao salvar: ' + (err.message || ''));
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedWebhook(true);
    toast.success('URL copiada para a área de transferência!');
    setTimeout(() => setCopiedWebhook(false), 2500);
  };

  // Readiness validation
  const hasLivePublic = settings.stripe_live_public_key.startsWith('pk_live_');
  const hasLiveSecret = settings.stripe_live_secret_key.startsWith('sk_live_') || settings.stripe_live_secret_key.startsWith('rk_live_');
  const hasLiveWebhook = settings.stripe_live_webhook_secret.startsWith('whsec_');
  const isLiveReady = hasLivePublic && hasLiveSecret;

  return (
    <div className="space-y-6 pb-20 font-sans text-zinc-100">
      <AdminPageHeader
        title="Configurações Globais"
        subtitle="Gerenciamento da conta mestre do Stripe, alternância entre Modo Teste e Modo Live, e notificações da plataforma."
        icon={<Settings className="w-5 h-5 text-emerald-400" />}
        actions={
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all cursor-pointer active:scale-95 disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        }
      />

      <div className="bg-[#0B0B0E] border border-white/10 rounded-2xl overflow-hidden shadow-xl">
        {/* Tabs Bar */}
        <div className="flex border-b border-white/10 bg-[#0E0E14]">
          <button
            onClick={() => setActiveTab('finance')}
            className={`px-6 py-4 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'finance'
                ? 'border-emerald-400 text-emerald-400 bg-white/[0.02]'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            Stripe & Meios de Pagamento
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`px-6 py-4 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'notifications'
                ? 'border-emerald-400 text-emerald-400 bg-white/[0.02]'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <Bell className="w-4 h-4" />
            Notificações & Canais
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="py-16 text-center text-zinc-500 flex flex-col items-center justify-center">
              <RefreshCw className="w-8 h-8 animate-spin text-emerald-400 mb-3" />
              <p className="text-sm font-semibold">Carregando configurações globais...</p>
            </div>
          ) : activeTab === 'finance' ? (
            <div className="max-w-4xl space-y-8">
              {/* Mode Selector Card */}
              <div className="p-5 rounded-2xl bg-[#13131A] border border-white/10 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Zap className="w-5 h-5 text-emerald-400" />
                      <h4 className="text-base font-bold text-white">Ambiente do Stripe em Operação</h4>
                    </div>
                    <p className="text-xs text-zinc-400 mt-1">
                      Alterne entre o ambiente de testes (cartões fictícios) e o ambiente oficial de cobranças reais.
                    </p>
                  </div>

                  {/* Mode Toggle Pills */}
                  <div className="flex items-center p-1 bg-[#090C0A] border border-white/10 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, stripe_mode: 'test' })}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        settings.stripe_mode === 'test'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      Modo Teste (Sandbox)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, stripe_mode: 'live' })}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        settings.stripe_mode === 'live'
                          ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20 font-black'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Modo Produção (Live)
                    </button>
                  </div>
                </div>

                {/* Status Notice Banner */}
                {settings.stripe_mode === 'test' ? (
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-amber-300">Modo de Homologação / Testes ATIVO</div>
                      <p className="text-[11px] text-amber-200/80 mt-0.5">
                        Toda a plataforma operará com chaves de teste (<code>pk_test_...</code> / <code>sk_test_...</code>).
                        Na tela de <b>Assinaturas</b> do salão, será exibido aos clientes um aviso informando que o sistema está em modo de testes para que saibam que nenhuma cobrança real será feita.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-xs space-y-2">
                    <div className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-emerald-300">Modo de Produção Oficial (LIVE) SELECIONADO</div>
                        <p className="text-[11px] text-emerald-200/80 mt-0.5">
                          Todas as transações e assinaturas serão cobradas <b>em cartões reais</b> via Stripe Billing e Stripe Connect.
                          O aviso de modo teste na tela de assinaturas dos salões ficará oculto automaticamente.
                        </p>
                      </div>
                    </div>

                    {/* Readiness checklist */}
                    <div className="pt-2 border-t border-emerald-500/20 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${hasLivePublic ? 'bg-emerald-400' : 'bg-rose-500'}`} />
                        <span>Public Key: {hasLivePublic ? 'Configurada' : 'Pendente (pk_live_...)'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${hasLiveSecret ? 'bg-emerald-400' : 'bg-rose-500'}`} />
                        <span>Secret Key: {hasLiveSecret ? 'Configurada' : 'Pendente (sk_live_...)'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${hasLiveWebhook ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                        <span>Webhook: {hasLiveWebhook ? 'Configurado' : 'Opcional (whsec_...)'}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Webhook Configuration Guide Card */}
              <div className="p-4 rounded-2xl bg-[#13131A] border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Webhook className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Webhook Oficial do Stripe
                    </h4>
                  </div>
                  <a
                    href="https://dashboard.stripe.com/webhooks"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-semibold"
                  >
                    Abrir Stripe Webhooks <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <p className="text-[11px] text-zinc-400">
                  Cadastre esta URL no seu painel Stripe (tanto em Modo Teste quanto em Modo Live) para sincronização automática de faturas, assinaturas e status de pagamentos:
                </p>
                <div className="flex items-center gap-2 bg-[#090C0A] border border-white/10 rounded-xl p-2.5">
                  <code className="text-xs text-emerald-400 font-mono flex-1 break-all select-all">
                    {WEBHOOK_URL}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(WEBHOOK_URL)}
                    className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    {copiedWebhook ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedWebhook ? 'Copiado!' : 'Copiar URL'}
                  </button>
                </div>
                <div className="text-[11px] text-zinc-500">
                  Eventos recomendados para selecionar: <code className="text-zinc-300">checkout.session.completed</code>, <code className="text-zinc-300">customer.subscription.*</code>, <code className="text-zinc-300">invoice.payment_*</code>, <code className="text-zinc-300">payment_intent.succeeded</code>.
                </div>
              </div>

              {/* Stripe Test Keys Section */}
              <div className="space-y-4 pt-2">
                <div className="border-b border-white/10 pb-2">
                  <h4 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    1. Chaves de Acesso — Modo Teste (Sandbox)
                  </h4>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Utilizadas quando o modo de testes estiver selecionado acima.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                      Stripe Public Key (Test)
                    </label>
                    <input
                      type="text"
                      placeholder="pk_test_..."
                      value={settings.stripe_test_public_key}
                      onChange={e => setSettings({ ...settings, stripe_test_public_key: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-white/10 bg-[#13131A] rounded-xl text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none text-xs font-mono transition-all placeholder-zinc-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                      Stripe Secret Key (Test)
                    </label>
                    <div className="relative">
                      <input
                        type={showTestSecret ? 'text' : 'password'}
                        placeholder="sk_test_..."
                        value={settings.stripe_test_secret_key}
                        onChange={e => setSettings({ ...settings, stripe_test_secret_key: e.target.value })}
                        className="w-full px-3.5 py-2.5 pr-10 border border-white/10 bg-[#13131A] rounded-xl text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none text-xs font-mono transition-all placeholder-zinc-600"
                      />
                      <button
                        type="button"
                        onClick={() => setShowTestSecret(!showTestSecret)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white cursor-pointer"
                      >
                        {showTestSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                      Stripe Webhook Secret (Test)
                    </label>
                    <div className="relative">
                      <input
                        type={showTestWebhook ? 'text' : 'password'}
                        placeholder="whsec_..."
                        value={settings.stripe_test_webhook_secret}
                        onChange={e => setSettings({ ...settings, stripe_test_webhook_secret: e.target.value })}
                        className="w-full px-3.5 py-2.5 pr-10 border border-white/10 bg-[#13131A] rounded-xl text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none text-xs font-mono transition-all placeholder-zinc-600"
                      />
                      <button
                        type="button"
                        onClick={() => setShowTestWebhook(!showTestWebhook)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white cursor-pointer"
                      >
                        {showTestWebhook ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                      Stripe Connect Master Account ID / Client ID (Test)
                    </label>
                    <input
                      type="text"
                      placeholder="ca_... ou acct_..."
                      value={settings.stripe_test_account_id}
                      onChange={e => setSettings({ ...settings, stripe_test_account_id: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-white/10 bg-[#13131A] rounded-xl text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none text-xs font-mono transition-all placeholder-zinc-600"
                    />
                  </div>
                </div>
              </div>

              {/* Stripe Live Keys Section */}
              <div className="space-y-4 pt-4">
                <div className="border-b border-white/10 pb-2">
                  <h4 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" />
                    2. Chaves de Acesso — Modo Produção (Live)
                  </h4>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Utilizadas quando o modo de produção oficial estiver selecionado acima.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center justify-between">
                      <span>Stripe Public Key (Live)</span>
                      {hasLivePublic && <span className="text-[10px] text-emerald-400 font-bold">Válida</span>}
                    </label>
                    <input
                      type="text"
                      placeholder="pk_live_..."
                      value={settings.stripe_live_public_key}
                      onChange={e => setSettings({ ...settings, stripe_live_public_key: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-white/10 bg-[#13131A] rounded-xl text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-xs font-mono transition-all placeholder-zinc-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center justify-between">
                      <span>Stripe Secret Key (Live)</span>
                      {hasLiveSecret && <span className="text-[10px] text-emerald-400 font-bold">Válida</span>}
                    </label>
                    <div className="relative">
                      <input
                        type={showLiveSecret ? 'text' : 'password'}
                        placeholder="sk_live_..."
                        value={settings.stripe_live_secret_key}
                        onChange={e => setSettings({ ...settings, stripe_live_secret_key: e.target.value })}
                        className="w-full px-3.5 py-2.5 pr-10 border border-white/10 bg-[#13131A] rounded-xl text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-xs font-mono transition-all placeholder-zinc-600"
                      />
                      <button
                        type="button"
                        onClick={() => setShowLiveSecret(!showLiveSecret)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white cursor-pointer"
                      >
                        {showLiveSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center justify-between">
                      <span>Stripe Webhook Secret (Live)</span>
                      {hasLiveWebhook && <span className="text-[10px] text-emerald-400 font-bold">Válido</span>}
                    </label>
                    <div className="relative">
                      <input
                        type={showLiveWebhook ? 'text' : 'password'}
                        placeholder="whsec_..."
                        value={settings.stripe_live_webhook_secret}
                        onChange={e => setSettings({ ...settings, stripe_live_webhook_secret: e.target.value })}
                        className="w-full px-3.5 py-2.5 pr-10 border border-white/10 bg-[#13131A] rounded-xl text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-xs font-mono transition-all placeholder-zinc-600"
                      />
                      <button
                        type="button"
                        onClick={() => setShowLiveWebhook(!showLiveWebhook)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white cursor-pointer"
                      >
                        {showLiveWebhook ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                      Stripe Connect Master Account ID / Client ID (Live)
                    </label>
                    <input
                      type="text"
                      placeholder="ca_... ou acct_..."
                      value={settings.stripe_live_account_id}
                      onChange={e => setSettings({ ...settings, stripe_live_account_id: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-white/10 bg-[#13131A] rounded-xl text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-xs font-mono transition-all placeholder-zinc-600"
                    />
                  </div>
                </div>
              </div>

              {/* Application Fee & Notes */}
              <div className="space-y-4 pt-4 border-t border-white/10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                      Taxa de Aplicação Padrão da Plataforma (%)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={settings.stripe_application_fee_percent}
                        onChange={e => setSettings({ ...settings, stripe_application_fee_percent: Number(e.target.value) })}
                        className="w-full px-3.5 py-2.5 border border-white/10 bg-[#13131A] rounded-xl text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-xs transition-all font-mono"
                      />
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 text-xs font-bold">%</span>
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-1">
                      Taxa cobrada pela Raffros sobre cada agendamento/venda dos salões via Stripe Connect.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                      Anotações Internas das Contas Stripe (Livre)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Ex: Conta jurídica Banco Inter, agência 0001, CNPJ xx.xxx.xxx/0001-xx, responsável financeiro..."
                      value={settings.stripe_notes}
                      onChange={e => setSettings({ ...settings, stripe_notes: e.target.value })}
                      className="w-full px-3.5 py-2 border border-white/10 bg-[#13131A] rounded-xl text-white focus:border-emerald-500 outline-none text-xs placeholder-zinc-600"
                    />
                    <p className="text-[11px] text-zinc-500 mt-1">
                      Lembrete: os saques para a conta corrente são gerenciados diretamente pelo painel do Stripe.
                    </p>
                  </div>
                </div>
              </div>

              {/* Save Bar */}
              <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/10">
                <div className="text-xs text-zinc-400 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    Ambiente ativo atualmente:{' '}
                    <b className={settings.stripe_mode === 'live' ? 'text-emerald-400' : 'text-amber-400'}>
                      {settings.stripe_mode === 'live' ? 'PRODUÇÃO OFICIAL (LIVE)' : 'TESTES (SANDBOX)'}
                    </b>
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full sm:w-auto px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all cursor-pointer active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {saving ? 'Salvando...' : 'Salvar Configurações do Stripe'}
                </button>
              </div>
            </div>
          ) : (
            <div className="max-w-2xl space-y-6">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Bell className="w-5 h-5 text-emerald-400" />
                  Notificações & Canais de Envio Globais
                </h3>
                <p className="text-zinc-400 text-xs mt-0.5">
                  Controle as políticas de notificação transacionais por WhatsApp e E-mail.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 border border-white/10 rounded-2xl bg-[#13131A]">
                  <div>
                    <h4 className="font-semibold text-white text-xs">WhatsApp Transacional</h4>
                    <p className="text-[11px] text-zinc-400">Ativar envios de agendamentos e lembretes via WhatsApp</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, whatsapp_enabled: !settings.whatsapp_enabled })}
                    className={`w-11 h-6 rounded-full relative transition-colors cursor-pointer ${
                      settings.whatsapp_enabled ? 'bg-emerald-500' : 'bg-zinc-800'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full absolute top-1 transition-transform ${
                        settings.whatsapp_enabled ? 'right-1 bg-black' : 'left-1 bg-zinc-400'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 border border-white/10 rounded-2xl bg-[#13131A]">
                  <div>
                    <h4 className="font-semibold text-white text-xs">E-mail Transacional</h4>
                    <p className="text-[11px] text-zinc-400">Confirmação de agendamentos e faturas de planos por e-mail</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, email_enabled: !settings.email_enabled })}
                    className={`w-11 h-6 rounded-full relative transition-colors cursor-pointer ${
                      settings.email_enabled ? 'bg-emerald-500' : 'bg-zinc-800'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full absolute top-1 transition-transform ${
                        settings.email_enabled ? 'right-1 bg-black' : 'left-1 bg-zinc-400'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 border border-white/10 rounded-2xl bg-[#13131A] opacity-60">
                  <div>
                    <h4 className="font-semibold text-zinc-400 text-xs">SMS Transacional</h4>
                    <p className="text-[11px] text-zinc-500">Módulo em desenvolvimento (integração futura com Twilio/Zenvia)</p>
                  </div>
                  <div className="w-11 h-6 bg-zinc-800 rounded-full relative">
                    <div className="w-4 h-4 bg-zinc-500 rounded-full absolute left-1 top-1" />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : 'Salvar Notificações'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
