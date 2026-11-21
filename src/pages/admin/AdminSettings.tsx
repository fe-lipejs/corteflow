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
  Webhook,
  Link2
} from 'lucide-react';

interface PlatformSettingsData {
  id: string;
  mp_mode: 'test' | 'live';
  mp_test_public_key: string;
  mp_test_access_token: string;
  mp_live_public_key: string;
  mp_live_access_token: string;
  mp_client_id: string;
  mp_client_secret: string;
  mp_webhook_secret: string;
  mp_application_fee_percent: number;
  stripe_notes: string;
  whatsapp_enabled: boolean;
  email_enabled: boolean;
  sms_enabled: boolean;
  updated_at?: string;
}

const WEBHOOK_URL = 'https://paefckmkawocjxzuoclq.supabase.co/functions/v1/stripe-webhook';
const OAUTH_CALLBACK_URL = 'https://paefckmkawocjxzuoclq.supabase.co/functions/v1/connect-onboarding-link';

function extractMpClientIdFromToken(token?: string): string {
  if (!token) return '';
  const match = token.trim().match(/^(?:APP_USR|TEST)-(\d+)-/);
  return match ? match[1] : '';
}

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState<'finance' | 'notifications'>('finance');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [copiedRedirect, setCopiedRedirect] = useState(false);

  const [settings, setSettings] = useState<PlatformSettingsData>({
    id: 'singleton',
    mp_mode: 'live',
    mp_test_public_key: '',
    mp_test_access_token: '',
    mp_live_public_key: '',
    mp_live_access_token: '',
    mp_client_id: '',
    mp_client_secret: '',
    mp_webhook_secret: '',
    mp_application_fee_percent: 0,
    stripe_notes: '',
    whatsapp_enabled: true,
    email_enabled: true,
    sms_enabled: false
  });

  const [showTestSecret, setShowTestSecret] = useState(false);
  const [showLiveSecret, setShowLiveSecret] = useState(false);
  const [showClientSecret, setShowClientSecret] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);

  const oauthRedirectUrl = OAUTH_CALLBACK_URL;

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
        const feeVal =
          data.mp_application_fee_percent != null && !isNaN(Number(data.mp_application_fee_percent))
            ? Number(data.mp_application_fee_percent)
            : data.stripe_application_fee_percent != null && !isNaN(Number(data.stripe_application_fee_percent))
              ? Number(data.stripe_application_fee_percent)
              : 0;

        setSettings({
          id: data.id || 'singleton',
          mp_mode: (data.mp_mode || data.stripe_mode || 'live') as 'test' | 'live',
          mp_test_public_key: data.mp_test_public_key || '',
          mp_test_access_token: data.mp_test_access_token || '',
          mp_live_public_key: data.mp_live_public_key || '',
          mp_live_access_token: data.mp_live_access_token || '',
          mp_client_id: data.mp_client_id || '',
          mp_client_secret: data.mp_client_secret || '',
          mp_webhook_secret: data.mp_webhook_secret || '',
          mp_application_fee_percent: feeVal,
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

  const handleSave = async () => {
    try {
      setSaving(true);
      const feeNum =
        settings.mp_application_fee_percent != null && !isNaN(Number(settings.mp_application_fee_percent))
          ? Number(settings.mp_application_fee_percent)
          : 0;

      const liveTokenTrimmed = settings.mp_live_access_token.trim();
      const livePubTrimmed = settings.mp_live_public_key.trim();
      let testTokenTrimmed = settings.mp_test_access_token.trim();
      let testPubTrimmed = settings.mp_test_public_key.trim();

      if (!testTokenTrimmed && liveTokenTrimmed.startsWith('TEST-')) {
        testTokenTrimmed = liveTokenTrimmed;
      }
      if (!testPubTrimmed && livePubTrimmed.startsWith('TEST-')) {
        testPubTrimmed = livePubTrimmed;
      }

      const autoClientId =
        settings.mp_client_id.trim() ||
        extractMpClientIdFromToken(liveTokenTrimmed) ||
        extractMpClientIdFromToken(testTokenTrimmed);

      const payload = {
        id: 'singleton',
        mp_mode: settings.mp_mode,
        stripe_mode: settings.mp_mode,
        mp_test_public_key: testPubTrimmed,
        mp_test_access_token: testTokenTrimmed,
        mp_live_public_key: livePubTrimmed,
        mp_live_access_token: liveTokenTrimmed,
        mp_client_id: autoClientId,
        mp_client_secret: settings.mp_client_secret.trim(),
        mp_webhook_secret: settings.mp_webhook_secret.trim(),
        mp_application_fee_percent: feeNum,
        stripe_application_fee_percent: feeNum,
        stripe_notes: settings.stripe_notes.trim(),
        whatsapp_enabled: settings.whatsapp_enabled,
        email_enabled: settings.email_enabled,
        sms_enabled: settings.sms_enabled,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('platform_settings')
        .upsert(payload as any, { onConflict: 'id' });

      if (error) throw error;

      toast.success(
        settings.mp_mode === 'live'
          ? 'Configurações Mercado Pago salvas! Modo PRODUÇÃO ativo.'
          : 'Configurações Mercado Pago salvas! Modo TESTE ativo.'
      );
      fetchSettings();
    } catch (err: any) {
      console.error('Erro ao salvar configurações:', err);
      toast.error('Erro ao salvar: ' + (err.message || ''));
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string, type: 'webhook' | 'redirect') => {
    navigator.clipboard.writeText(text);
    if (type === 'webhook') {
      setCopiedWebhook(true);
      setTimeout(() => setCopiedWebhook(false), 2500);
    } else {
      setCopiedRedirect(true);
      setTimeout(() => setCopiedRedirect(false), 2500);
    }
    toast.success('URL copiada para a área de transferência!');
  };

  const hasLiveToken = settings.mp_live_access_token.trim().length > 10;
  const hasLivePublic = settings.mp_live_public_key.trim().length > 10;
  const hasTestToken = settings.mp_test_access_token.trim().length > 10;
  const activeModeTokenReady = settings.mp_mode === 'test' ? hasTestToken : hasLiveToken;
  const resolvedClientId =
    settings.mp_client_id.trim() ||
    extractMpClientIdFromToken(settings.mp_live_access_token) ||
    extractMpClientIdFromToken(settings.mp_test_access_token);
  const hasOAuth =
    resolvedClientId.length > 0 &&
    (settings.mp_client_secret.trim().length > 0 || activeModeTokenReady);

  return (
    <div className="space-y-6 pb-20 font-sans text-zinc-100">
      <AdminPageHeader
        title="Configurações Globais"
        subtitle="Gerenciamento do Mercado Pago (assinaturas dos salões + repasse direto aos estabelecimentos) e notificações."
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
            Mercado Pago &amp; Meios de Pagamento
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
            Notificações &amp; Canais
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
                      <Zap className="w-5 h-5 text-[#00BCFF]" />
                      <h4 className="text-base font-bold text-white">Ambiente do Mercado Pago</h4>
                    </div>
                    <p className="text-xs text-zinc-400 mt-1">
                      Alterne entre as credenciais de teste (Sandbox) e as credenciais oficiais de produção.
                    </p>
                  </div>

                  {/* Mode Toggle Pills */}
                  <div className="flex items-center p-1 bg-[#090C0A] border border-white/10 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, mp_mode: 'test' })}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        settings.mp_mode === 'test'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      Modo Teste (Sandbox)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, mp_mode: 'live' })}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        settings.mp_mode === 'live'
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
                {settings.mp_mode === 'test' ? (
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-2">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-amber-300">Modo de Testes (Sandbox) ATIVO</div>
                        <p className="text-[11px] text-amber-200/80 mt-0.5">
                          A plataforma utilizará o <code>Access Token de Teste</code> (<code>TEST-...</code>).
                          Um aviso discreto será exibido na tela de assinaturas dos salões indicando ambiente de testes.
                        </p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-amber-500/20 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${hasTestToken || hasLiveToken ? 'bg-emerald-400' : 'bg-rose-500'}`} />
                        <span>Access Token (Teste): {hasTestToken || hasLiveToken ? 'Configurado' : 'Pendente (TEST-...)'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${settings.mp_test_public_key.trim() || hasLivePublic ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                        <span>Public Key (Teste): {settings.mp_test_public_key.trim() || hasLivePublic ? 'Configurada' : 'Opcional (TEST-...)'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${hasOAuth ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                        <span>Conexão Salões: {hasOAuth ? 'OAuth Automático Pronta' : 'Pendente Client ID'}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-xs space-y-2">
                    <div className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-emerald-300">Modo Produção Oficial (LIVE) SELECIONADO</div>
                        <p className="text-[11px] text-emerald-200/80 mt-0.5">
                          As assinaturas dos salões (Pix e Cartão) serão recebidas na sua conta Mercado Pago abaixo, e cada agendamento pago online cairá direto no Mercado Pago do respectivo salão.
                        </p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-emerald-500/20 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${hasLiveToken ? 'bg-emerald-400' : 'bg-rose-500'}`} />
                        <span>Access Token (Live): {hasLiveToken ? 'Configurado' : 'Pendente (APP_USR-...)'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${hasLivePublic ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                        <span>Public Key (Live): {hasLivePublic ? 'Configurada' : 'Opcional (APP_USR-...)'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${hasOAuth ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                        <span>Conexão Salões: {hasOAuth ? 'OAuth Automático Ativo' : 'Pendente Client Secret'}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Webhook Configuration Guide Card */}
              <div className="p-4 rounded-2xl bg-[#13131A] border border-white/10 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Webhook className="w-4 h-4 text-[#00BCFF]" />
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Webhook Oficial do Mercado Pago
                    </h4>
                  </div>
                  <a
                    href="https://www.mercadopago.com.br/developers/panel/app"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-[#00BCFF] hover:underline flex items-center gap-1 font-semibold"
                  >
                    Abrir Mercado Pago Developers <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <p className="text-[11px] text-zinc-400">
                  No painel da sua aplicação no Mercado Pago Developers, vá em <strong>Webhooks → Configurar notificações → Modo Produção</strong> e cole esta URL marcando o evento <strong>Pagamentos (payment)</strong>:
                </p>
                <div className="flex items-center gap-2 bg-[#090C0A] border border-white/10 rounded-xl p-2.5">
                  <code className="text-xs text-emerald-400 font-mono flex-1 break-all select-all">
                    {WEBHOOK_URL}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(WEBHOOK_URL, 'webhook')}
                    className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    {copiedWebhook ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedWebhook ? 'Copiado!' : 'Copiar URL'}
                  </button>
                </div>
              </div>

              {/* Mercado Pago Live Keys Section */}
              <div className="space-y-4 pt-2">
                <div className="border-b border-white/10 pb-2">
                  <h4 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" />
                    1. Credenciais da Plataforma Raffros — Produção (Live)
                  </h4>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Sua conta Mercado Pago que receberá as assinaturas mensais dos salões (Solo, Studio, Business).
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center justify-between">
                      <span>Access Token (Produção) *</span>
                      {hasLiveToken && <span className="text-[10px] text-emerald-400 font-bold">Válido</span>}
                    </label>
                    <div className="relative">
                      <input
                        type={showLiveSecret ? 'text' : 'password'}
                        placeholder="APP_USR-..."
                        value={settings.mp_live_access_token}
                        onChange={e => {
                          const val = e.target.value;
                          const extractedId = extractMpClientIdFromToken(val);
                          setSettings(prev => ({
                            ...prev,
                            mp_live_access_token: val,
                            mp_client_id: prev.mp_client_id.trim() ? prev.mp_client_id : extractedId,
                          }));
                        }}
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

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center justify-between">
                      <span>Public Key (Produção)</span>
                      {hasLivePublic && <span className="text-[10px] text-emerald-400 font-bold">Válida</span>}
                    </label>
                    <input
                      type="text"
                      placeholder="APP_USR-..."
                      value={settings.mp_live_public_key}
                      onChange={e => setSettings({ ...settings, mp_live_public_key: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-white/10 bg-[#13131A] rounded-xl text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-xs font-mono transition-all placeholder-zinc-600"
                    />
                  </div>
                </div>
              </div>

              {/* Mercado Pago OAuth App (1-clique para os salões conectarem) */}
              <div className="space-y-4 pt-2">
                <div className="border-b border-white/10 pb-2">
                  <h4 className="text-sm font-bold text-[#00BCFF] flex items-center gap-2">
                    <Link2 className="w-4 h-4" />
                    2. Conexão dos Salões (Redirecionamento Automático OAuth + Taxa da Plataforma)
                  </h4>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Preencha o <b>Client ID</b> (auto-preenchido ao colar seu Access Token), o <b>Client Secret</b> e cadastre a <b>Redirect URI</b> abaixo no seu App no Mercado Pago Developers. Assim as donas de salão clicam em "Conectar Mercado Pago", entram/autorizam no próprio Mercado Pago e voltam com tudo ativo automaticamente, sem precisar copiar nenhuma chave.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-[#13131A] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="text-[11px] text-zinc-400">
                    <span className="font-semibold text-zinc-200 block">Redirect URI para cadastrar no Mercado Pago Developers:</span>
                    <code className="text-[#00BCFF] font-mono break-all select-all">{oauthRedirectUrl}</code>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(oauthRedirectUrl, 'redirect')}
                    className="px-3 py-1.5 bg-[#009EE3]/15 hover:bg-[#009EE3]/25 text-[#00BCFF] text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shrink-0 self-start sm:self-center"
                  >
                    {copiedRedirect ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedRedirect ? 'Copiado!' : 'Copiar Redirect URI'}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                      Client ID (App ID)
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: 1234567890123456"
                      value={settings.mp_client_id}
                      onChange={e => setSettings({ ...settings, mp_client_id: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-white/10 bg-[#13131A] rounded-xl text-white focus:border-[#00BCFF] outline-none text-xs font-mono transition-all placeholder-zinc-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                      Client Secret (Opcional — usa Access Token se vazio)
                    </label>
                    <div className="relative">
                      <input
                        type={showClientSecret ? 'text' : 'password'}
                        placeholder="Chave secreta do App"
                        value={settings.mp_client_secret}
                        onChange={e => setSettings({ ...settings, mp_client_secret: e.target.value })}
                        className="w-full px-3.5 py-2.5 pr-10 border border-white/10 bg-[#13131A] rounded-xl text-white focus:border-[#00BCFF] outline-none text-xs font-mono transition-all placeholder-zinc-600"
                      />
                      <button
                        type="button"
                        onClick={() => setShowClientSecret(!showClientSecret)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white cursor-pointer"
                      >
                        {showClientSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                      Assinatura Webhook (Opcional)
                    </label>
                    <div className="relative">
                      <input
                        type={showWebhookSecret ? 'text' : 'password'}
                        placeholder="Chave secreta do Webhook"
                        value={settings.mp_webhook_secret}
                        onChange={e => setSettings({ ...settings, mp_webhook_secret: e.target.value })}
                        className="w-full px-3.5 py-2.5 pr-10 border border-white/10 bg-[#13131A] rounded-xl text-white focus:border-[#00BCFF] outline-none text-xs font-mono transition-all placeholder-zinc-600"
                      />
                      <button
                        type="button"
                        onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white cursor-pointer"
                      >
                        {showWebhookSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Mercado Pago Test Keys Section */}
              <div className="space-y-4 pt-2">
                <div className="border-b border-white/10 pb-2">
                  <h4 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    3. Credenciais de Teste (Sandbox) — Opcional
                  </h4>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Utilizadas apenas quando o Modo Teste estiver selecionado no topo.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                      Access Token (Teste)
                    </label>
                    <div className="relative">
                      <input
                        type={showTestSecret ? 'text' : 'password'}
                        placeholder="TEST-..."
                        value={settings.mp_test_access_token}
                        onChange={e => {
                          const val = e.target.value;
                          const extractedId = extractMpClientIdFromToken(val);
                          setSettings(prev => ({
                            ...prev,
                            mp_test_access_token: val,
                            mp_client_id: prev.mp_client_id.trim() ? prev.mp_client_id : extractedId,
                          }));
                        }}
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

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                      Public Key (Teste)
                    </label>
                    <input
                      type="text"
                      placeholder="TEST-..."
                      value={settings.mp_test_public_key}
                      onChange={e => setSettings({ ...settings, mp_test_public_key: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-white/10 bg-[#13131A] rounded-xl text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none text-xs font-mono transition-all placeholder-zinc-600"
                    />
                  </div>
                </div>
              </div>

              {/* Application Fee & Notes */}
              <div className="space-y-4 pt-4 border-t border-white/10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                      Taxa da Plataforma por Agendamento (%) — OAuth
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={settings.mp_application_fee_percent}
                        onChange={e => setSettings({ ...settings, mp_application_fee_percent: Number(e.target.value) })}
                        className="w-full px-3.5 py-2.5 border border-white/10 bg-[#13131A] rounded-xl text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-xs transition-all font-mono"
                      />
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 text-xs font-bold">%</span>
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-1">
                      Aplicada apenas em contas conectadas via OAuth Marketplace (deixe 0 para não descontar taxa nos repasses).
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                      Anotações Internas Financeiras (Livre)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Ex: Conta Mercado Pago CNPJ da Raffros, responsável financeiro..."
                      value={settings.stripe_notes}
                      onChange={e => setSettings({ ...settings, stripe_notes: e.target.value })}
                      className="w-full px-3.5 py-2 border border-white/10 bg-[#13131A] rounded-xl text-white focus:border-emerald-500 outline-none text-xs placeholder-zinc-600"
                    />
                    <p className="text-[11px] text-zinc-500 mt-1">
                      Os saques e transferências Pix são gerenciados diretamente pelo app/site do Mercado Pago.
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
                    <b className={settings.mp_mode === 'live' ? 'text-emerald-400' : 'text-amber-400'}>
                      {settings.mp_mode === 'live' ? 'PRODUÇÃO OFICIAL (LIVE)' : 'TESTES (SANDBOX)'}
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
                  {saving ? 'Salvando...' : 'Salvar Configurações do Mercado Pago'}
                </button>
              </div>
            </div>
          ) : (
            <div className="max-w-2xl space-y-6">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Bell className="w-5 h-5 text-emerald-400" />
                  Notificações &amp; Canais de Envio Globais
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
