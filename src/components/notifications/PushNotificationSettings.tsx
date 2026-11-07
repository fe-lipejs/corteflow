import React, { useState } from 'react';
import {
  Bell,
  BellRing,
  BellOff,
  Smartphone,
  Laptop,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Send,
  Loader2,
  CalendarPlus,
  CalendarX2,
  CalendarClock,
  Clock,
  Sun,
  Share2,
  PlusSquare,
  ShieldCheck,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { PWAInstallButton } from '../pwa/PWAInstallButton';

interface PushNotificationSettingsProps {
  accentColor?: string;
}

export function PushNotificationSettings({ accentColor = '#FF2D78' }: PushNotificationSettingsProps) {
  const {
    isSupported,
    permission,
    isIOS,
    isInstalled,
    currentEndpoint,
    currentDeviceRecord,
    isCurrentDeviceActive,
    activeDevicesCount,
    devices,
    isLoadingDevices,
    preferences,
    isSubscribing,
    isTesting,
    subscribeCurrentDevice,
    updatePreferences,
    toggleDeviceActive,
    removeDevice,
    sendTestNotification,
  } = usePushNotifications();

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [busyDeviceId, setBusyDeviceId] = useState<string | null>(null);

  const showMessage = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback((prev) => (prev?.message === message ? null : prev));
    }, 6000);
  };

  const handleActivateCurrentDevice = async () => {
    setFeedback(null);
    try {
      await subscribeCurrentDevice();
      showMessage('success', 'Dispositivo registrado com sucesso! Você já pode receber notificações Push.');
    } catch (err: any) {
      showMessage('error', err?.message || 'Não foi possível ativar as notificações neste dispositivo.');
    }
  };

  const handleDeactivateCurrentDevice = async () => {
    if (!currentDeviceRecord) return;
    setFeedback(null);
    setBusyDeviceId(currentDeviceRecord.id);
    try {
      await toggleDeviceActive({ deviceId: currentDeviceRecord.id, isActive: false });
      showMessage('success', 'Notificações pausadas neste dispositivo.');
    } catch (err: any) {
      showMessage('error', err?.message || 'Erro ao pausar notificações neste dispositivo.');
    } finally {
      setBusyDeviceId(null);
    }
  };

  const handleToggleDevice = async (deviceId: string, nextState: boolean) => {
    setFeedback(null);
    setBusyDeviceId(deviceId);
    try {
      await toggleDeviceActive({ deviceId, isActive: nextState });
      showMessage(
        'success',
        nextState ? 'Dispositivo reativado para receber alertas.' : 'Dispositivo desativado.'
      );
    } catch (err: any) {
      showMessage('error', err?.message || 'Erro ao atualizar status do dispositivo.');
    } finally {
      setBusyDeviceId(null);
    }
  };

  const handleRemoveDevice = async (deviceId: string, endpoint: string, name: string) => {
    setFeedback(null);
    setBusyDeviceId(deviceId);
    try {
      await removeDevice({ deviceId, endpoint });
      showMessage('success', `Dispositivo "${name}" removido com sucesso.`);
    } catch (err: any) {
      showMessage('error', err?.message || 'Erro ao remover dispositivo.');
    } finally {
      setBusyDeviceId(null);
    }
  };

  const handleSendTest = async () => {
    setFeedback(null);
    try {
      const res = await sendTestNotification();
      showMessage(
        'success',
        `Notificação de teste enviada para ${res?.sent || 1} dispositivo(s) ativo(s)! Confira na barra do seu aparelho.`
      );
    } catch (err: any) {
      showMessage('error', err?.message || 'Erro ao enviar notificação de teste.');
    }
  };

  const handleTogglePreference = async (
    key:
      | 'push_enabled'
      | 'notify_new_booking'
      | 'notify_cancellation'
      | 'notify_reschedule'
      | 'notify_reminder'
      | 'notify_daily_summary',
    value: boolean
  ) => {
    try {
      await updatePreferences({ [key]: value });
    } catch (err: any) {
      showMessage('error', err?.message || 'Não foi possível salvar sua preferência.');
    }
  };

  const handleReminderMinutesChange = async (minutes: number) => {
    try {
      await updatePreferences({ reminder_minutes_before: minutes });
      showMessage('success', `Antecedência do lembrete atualizada para ${minutes} minutos.`);
    } catch (err: any) {
      showMessage('error', err?.message || 'Erro ao atualizar antecedência do lembrete.');
    }
  };

  const requiresIOSInstall = isIOS && !isInstalled;

  return (
    <div className="space-y-6">
      {/* CARD PRINCIPAL: STATUS E ATIVAÇÃO DE WEB PUSH */}
      <div
        className="rounded-2xl border p-5 sm:p-6 space-y-5"
        style={{
          background: 'var(--bg-card)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
              style={{
                background: isCurrentDeviceActive ? 'rgba(34,197,94,0.12)' : `${accentColor}18`,
                color: isCurrentDeviceActive ? '#22C55E' : accentColor,
                border: `1px solid ${isCurrentDeviceActive ? 'rgba(34,197,94,0.28)' : `${accentColor}30`}`,
              }}
            >
              {isCurrentDeviceActive ? <BellRing className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Notificações Push em Segundo Plano
                </h3>
                {isCurrentDeviceActive ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                    <CheckCircle2 className="w-3 h-3" /> Ativo neste aparelho
                  </span>
                ) : permission === 'denied' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/25">
                    <BellOff className="w-3 h-3" /> Bloqueado no navegador
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                    Não ativado neste aparelho
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Receba alertas instantâneos no seu celular ou computador quando um cliente agendar, cancelar ou
                reagendar um horário — mesmo quando o aplicativo Raffros estiver fechado.
              </p>
            </div>
          </div>

          {/* Botões de Ação Principal */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {isCurrentDeviceActive ? (
              <>
                <button
                  type="button"
                  onClick={handleSendTest}
                  disabled={isTesting}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer disabled:opacity-50"
                  style={{
                    borderColor: `${accentColor}40`,
                    background: `${accentColor}12`,
                    color: accentColor,
                  }}
                >
                  {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>Testar notificação</span>
                </button>

                <button
                  type="button"
                  onClick={handleDeactivateCurrentDevice}
                  disabled={busyDeviceId === currentDeviceRecord?.id}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-all cursor-pointer disabled:opacity-50"
                >
                  <BellOff className="w-3.5 h-3.5" />
                  <span>Pausar neste aparelho</span>
                </button>
              </>
            ) : (
              !requiresIOSInstall && (
                <button
                  type="button"
                  onClick={handleActivateCurrentDevice}
                  disabled={isSubscribing || !isSupported}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white shadow-md transition-all cursor-pointer disabled:opacity-50"
                  style={{ background: accentColor }}
                >
                  {isSubscribing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <BellRing className="w-4 h-4" />
                  )}
                  <span>
                    {currentDeviceRecord && !currentDeviceRecord.is_active
                      ? 'Reativar notificações neste aparelho'
                      : 'Ativar notificações neste aparelho'}
                  </span>
                </button>
              )
            )}

            {!isCurrentDeviceActive && activeDevicesCount > 0 && (
              <button
                type="button"
                onClick={handleSendTest}
                disabled={isTesting}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-all cursor-pointer disabled:opacity-50"
              >
                {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Testar nos outros aparelhos ({activeDevicesCount})</span>
              </button>
            )}
          </div>
        </div>

        {/* AVISO ESPECÍFICO PARA IPHONE FORA DO MODO STANDALONE (iOS 16.4+) */}
        {requiresIOSInstall && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs sm:text-sm text-slate-800 dark:text-amber-100">
                <p className="font-bold">Como ativar notificações Push no seu iPhone (iOS):</p>
                <p className="text-xs opacity-90 leading-relaxed">
                  No iPhone, a Apple exige que o aplicativo esteja adicionado à sua{' '}
                  <strong>Tela de Início</strong> para liberar notificações em segundo plano:
                </p>
                <ol className="list-decimal list-inside space-y-1 pt-1 text-xs font-medium">
                  <li>
                    No <strong>Safari</strong>, toque em <strong>Compartilhar</strong>{' '}
                    <Share2 className="inline w-3.5 h-3.5 text-sky-400 mx-0.5" /> na barra inferior.
                  </li>
                  <li>
                    Escolha <strong>"Adicionar à Tela de Início"</strong>{' '}
                    <PlusSquare className="inline w-3.5 h-3.5 mx-0.5" /> e confirme em <strong>Adicionar</strong>.
                  </li>
                  <li>
                    Abra o <strong>Raffros</strong> pelo ícone criado na sua Tela de Início e toque em{' '}
                    <strong>Ativar notificações</strong> aqui.
                  </li>
                </ol>
              </div>
            </div>
            <div className="pt-1">
              <PWAInstallButton variant="button" accentColor={accentColor} />
            </div>
          </div>
        )}

        {/* AVISO SE PERMISSÃO FOI BLOQUEADA NO NAVEGADOR */}
        {permission === 'denied' && !requiresIOSInstall && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 flex items-start gap-3 text-xs text-red-700 dark:text-red-300">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
            <div>
              <strong>Permissão bloqueada no navegador:</strong> As notificações foram negadas anteriormente neste
              navegador. Toque no ícone de cadeado ou configurações ao lado do endereço do site no topo do navegador,
              altere <strong>Notificações</strong> para <strong>Permitir</strong> e clique em ativar novamente.
            </div>
          </div>
        )}

        {/* FEEDBACK DE SUCESSO OU ERRO */}
        {feedback && (
          <div
            className={`rounded-xl border p-3.5 flex items-center gap-2.5 text-xs font-medium ${
              feedback.type === 'success'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}
      </div>

      {/* TIPOS DE EVENTOS QUE ENVIAM NOTIFICAÇÃO PUSH */}
      <div
        className="rounded-2xl border p-5 sm:p-6 space-y-4"
        style={{
          background: 'var(--bg-card)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-white/5 pb-3.5">
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Quais notificações você deseja receber?
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Personalize os eventos que disparam alertas nos seus dispositivos conectados.
            </p>
          </div>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-white/5">
          {/* 1. Novo Agendamento */}
          <div className="py-3.5 flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0 mt-0.5">
                <CalendarPlus className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">
                  Novo agendamento
                </p>
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                  Quando um cliente confirma um novo horário na agenda.
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={preferences.notify_new_booking}
              onChange={(e) => handleTogglePreference('notify_new_booking', e.target.checked)}
              className="w-4 h-4 accent-pink-600 rounded cursor-pointer shrink-0"
            />
          </div>

          {/* 2. Cancelamento */}
          <div className="py-3.5 flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center shrink-0 mt-0.5">
                <CalendarX2 className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">
                  Cancelamento de horário
                </p>
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                  Quando um cliente ou profissional cancela um agendamento.
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={preferences.notify_cancellation}
              onChange={(e) => handleTogglePreference('notify_cancellation', e.target.checked)}
              className="w-4 h-4 accent-pink-600 rounded cursor-pointer shrink-0"
            />
          </div>

          {/* 3. Reagendamento */}
          <div className="py-3.5 flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center shrink-0 mt-0.5">
                <CalendarClock className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">
                  Reagendamento
                </p>
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                  Quando o cliente ou a equipe altera a data ou horário de uma reserva.
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={preferences.notify_reschedule}
              onChange={(e) => handleTogglePreference('notify_reschedule', e.target.checked)}
              className="w-4 h-4 accent-pink-600 rounded cursor-pointer shrink-0"
            />
          </div>

          {/* 4. Agendamento Próximo (Lembrete) */}
          <div className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 mt-0.5">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">
                  Agendamento próximo (Lembrete)
                </p>
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                  Receba um aviso minutos antes do início do próximo atendimento.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3">
              {preferences.notify_reminder && (
                <select
                  value={preferences.reminder_minutes_before || 30}
                  onChange={(e) => handleReminderMinutesChange(Number(e.target.value))}
                  className="text-xs rounded-lg border border-slate-200 dark:border-white/10 bg-transparent px-2.5 py-1.5 text-slate-700 dark:text-slate-200"
                >
                  <option value={15} className="bg-slate-900 text-white">
                    15 min antes
                  </option>
                  <option value={30} className="bg-slate-900 text-white">
                    30 min antes
                  </option>
                  <option value={60} className="bg-slate-900 text-white">
                    1 hora antes
                  </option>
                </select>
              )}
              <input
                type="checkbox"
                checked={preferences.notify_reminder}
                onChange={(e) => handleTogglePreference('notify_reminder', e.target.checked)}
                className="w-4 h-4 accent-pink-600 rounded cursor-pointer shrink-0"
              />
            </div>
          </div>

          {/* 5. Resumo Diário */}
          <div className="py-3.5 flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0 mt-0.5">
                <Sun className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">
                  Resumo diário da agenda
                </p>
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                  Resumo com a quantidade de atendimentos confirmados para o seu dia.
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={preferences.notify_daily_summary}
              onChange={(e) => handleTogglePreference('notify_daily_summary', e.target.checked)}
              className="w-4 h-4 accent-pink-600 rounded cursor-pointer shrink-0"
            />
          </div>
        </div>
      </div>

      {/* LISTA DE DISPOSITIVOS CONECTADOS */}
      <div
        className="rounded-2xl border p-5 sm:p-6 space-y-4"
        style={{
          background: 'var(--bg-card)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-white/5 pb-3.5">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Seus Dispositivos Conectados ({devices.length})
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Gerencie os celulares e computadores autorizados a receber notificações da sua conta.
              </p>
            </div>
          </div>
        </div>

        {isLoadingDevices ? (
          <div className="py-6 flex items-center justify-center gap-2 text-xs text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Carregando dispositivos conectados...</span>
          </div>
        ) : devices.length === 0 ? (
          <div className="py-6 text-center space-y-1">
            <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">
              Nenhum dispositivo registrado ainda.
            </p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              Clique em <strong>"Ativar notificações neste aparelho"</strong> acima para conectar seu celular ou
              computador.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {devices.map((device) => {
              const isThisDevice = Boolean(currentEndpoint && device.endpoint === currentEndpoint);
              const isBusy = busyDeviceId === device.id;
              const formattedDate = (() => {
                try {
                  return format(new Date(device.created_at), "dd 'de' MMM, HH:mm", { locale: ptBR });
                } catch {
                  return '';
                }
              })();

              return (
                <div
                  key={device.id}
                  className="p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all"
                  style={{
                    borderColor: isThisDevice ? `${accentColor}40` : 'var(--border-subtle)',
                    background: isThisDevice ? `${accentColor}08` : 'transparent',
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{
                        background: device.is_active ? 'rgba(34,197,94,0.12)' : 'rgba(148,163,184,0.12)',
                        color: device.is_active ? '#22C55E' : '#94A3B8',
                      }}
                    >
                      {device.platform === 'desktop' ? (
                        <Laptop className="w-4 h-4" />
                      ) : (
                        <Smartphone className="w-4 h-4" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                          {device.device_name || 'Dispositivo'}
                        </span>
                        {isThisDevice && (
                          <span
                            className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                            style={{ background: `${accentColor}20`, color: accentColor }}
                          >
                            Este aparelho
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            device.is_active
                              ? 'bg-emerald-500/15 text-emerald-500'
                              : 'bg-slate-500/15 text-slate-400'
                          }`}
                        >
                          {device.is_active ? 'Ativo' : 'Pausado'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Plataforma: <span className="uppercase font-medium">{device.platform}</span>
                        {formattedDate ? ` • Registrado em ${formattedDate}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleToggleDevice(device.id, !device.is_active)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {device.is_active ? 'Desativar' : 'Ativar'}
                    </button>

                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleRemoveDevice(device.id, device.endpoint, device.device_name)}
                      title="Remover dispositivo"
                      className="p-2 rounded-lg border border-red-500/20 text-red-500 hover:bg-red-500/10 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

