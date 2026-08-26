import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, Store, LogOut, RefreshCw, Shield, Mail,
  ChevronRight, AlertTriangle, Loader2, Check, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

export default function MinhaArea() {
  const { theme } = useTheme();
  const { profile, professionalProfile, memberships, tenant, signOut, switchTenantContext, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [unlinkTarget, setUnlinkTarget] = useState<{ id: string; name: string } | null>(null);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [unlinkSuccess, setUnlinkSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayName = professionalProfile?.name || profile?.full_name || 'Profissional';
  const initials = displayName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const handleUnlink = async () => {
    if (!unlinkTarget || !profile?.id) return;
    setIsUnlinking(true);
    setError(null);

    try {
      // Set this membership as inactive
      const { error: unlinkError } = await supabase
        .from('tenant_users')
        .update({ status: 'inactive' })
        .match({ user_id: profile.id, tenant_id: unlinkTarget.id });

      if (unlinkError) throw unlinkError;

      // Also deactivate the professional record in that tenant
      await supabase
        .from('professionals')
        .update({ active: false, auth_user_id: null })
        .match({ auth_user_id: profile.id, tenant_id: unlinkTarget.id });

      setUnlinkSuccess(true);
      await refreshProfile();

      // After short delay, redirect to tenant selection
      setTimeout(() => {
        queryClient.clear();
        navigate('/select-tenant');
      }, 2000);

    } catch (err: any) {
      setError(err.message || 'Erro ao se desvincular. Tente novamente.');
    } finally {
      setIsUnlinking(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: theme.textPrimary }}>Minha Área</h1>
        <p className="text-sm mt-1" style={{ color: theme.textMuted }}>
          Gerencie seu perfil e vínculos com estabelecimentos.
        </p>
      </div>

      {/* Profile Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-6 border"
        style={{ background: theme.card, borderColor: theme.border }}
      >
        <div className="flex items-center gap-5">
          {professionalProfile?.photo_url ? (
            <img
              src={professionalProfile.photo_url}
              alt={displayName}
              className="w-20 h-20 rounded-full object-cover border-2"
              style={{ borderColor: theme.accent }}
            />
          ) : (
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold shrink-0"
              style={{ background: theme.accentGradient, color: theme.btnPrimaryText }}
            >
              {initials}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold truncate" style={{ color: theme.textPrimary }}>{displayName}</h2>
            {professionalProfile?.role_title && (
              <p className="text-sm" style={{ color: theme.textMuted }}>{professionalProfile.role_title}</p>
            )}
            {profile && (
              <div className="flex items-center gap-1.5 mt-2">
                <Mail className="w-3.5 h-3.5" style={{ color: theme.textMuted }} />
                <span className="text-xs truncate" style={{ color: theme.textSecondary }}>
                  {/* E-mail vem do auth.user, não do profile */}
                  Conta vinculada ao sistema
                </span>
              </div>
            )}
          </div>
          <div
            className="px-3 py-1 rounded-full text-xs font-semibold"
            style={{ background: `${theme.accent}20`, color: theme.accent }}
          >
            Profissional
          </div>
        </div>
      </motion.div>

      {/* Establishments */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl border overflow-hidden"
        style={{ background: theme.card, borderColor: theme.border }}
      >
        <div className="px-6 py-4 border-b flex items-center gap-3" style={{ borderColor: theme.border }}>
          <Store className="w-5 h-5" style={{ color: theme.accent }} />
          <div>
            <h3 className="font-semibold text-sm" style={{ color: theme.textPrimary }}>
              Meus Estabelecimentos
            </h3>
            <p className="text-xs mt-0.5" style={{ color: theme.textMuted }}>
              Barbearias / salões onde você está vinculado
            </p>
          </div>
        </div>

        <div className="divide-y" style={{ borderColor: theme.border }}>
          {memberships.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <Store className="w-10 h-10 mx-auto mb-3 opacity-30" style={{ color: theme.textMuted }} />
              <p className="text-sm" style={{ color: theme.textMuted }}>Nenhum estabelecimento vinculado</p>
            </div>
          ) : (
            memberships.map((mem) => {
              const t = mem.tenants;
              if (!t) return null;
              const isCurrent = tenant?.id === t.id;
              const isActive = mem.status === 'active';

              return (
                <div key={t.id} className="px-6 py-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    {t.logo_url ? (
                      <img src={t.logo_url} alt={t.name} className="w-10 h-10 rounded-xl object-cover border" style={{ borderColor: theme.border }} />
                    ) : (
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0"
                        style={{ background: theme.accentGradient, color: theme.btnPrimaryText }}
                      >
                        {t.name?.[0]?.toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm truncate" style={{ color: theme.textPrimary }}>{t.name}</p>
                        {isCurrent && (
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{ background: `${theme.accent}25`, color: theme.accent }}
                          >
                            Ativa agora
                          </span>
                        )}
                        {!isActive && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">
                            Inativa
                          </span>
                        )}
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: theme.textMuted }}>
                        {mem.role === 'owner' ? 'Proprietário' : mem.role === 'manager' ? 'Gerente' : 'Profissional'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {!isCurrent && isActive && (
                      <button
                        onClick={() => switchTenantContext(t.id).then(() => navigate('/admin'))}
                        className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all hover:opacity-90"
                        style={{ background: theme.accentGradient, color: theme.btnPrimaryText }}
                      >
                        Entrar
                      </button>
                    )}
                    {isActive && (
                      <button
                        onClick={() => setUnlinkTarget({ id: t.id, name: t.name })}
                        className="text-xs px-3 py-1.5 rounded-lg font-medium border transition-all hover:bg-red-500/10 hover:text-red-400 hover:border-red-400/40"
                        style={{ color: theme.textMuted, borderColor: theme.border }}
                      >
                        Sair
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </motion.div>

      {/* Security Info */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-2xl p-5 border flex gap-4"
        style={{ background: theme.card, borderColor: theme.border }}
      >
        <Shield className="w-5 h-5 shrink-0 mt-0.5" style={{ color: theme.accent }} />
        <div>
          <h3 className="font-semibold text-sm mb-1" style={{ color: theme.textPrimary }}>Segurança da Conta</h3>
          <p className="text-xs leading-relaxed" style={{ color: theme.textMuted }}>
            Sua conta é <strong>global</strong>: o mesmo login e senha funcionam em todos os estabelecimentos onde você está vinculado.
            Ao se desvincular de um estabelecimento, você perde acesso apenas àquela barbearia, mas sua conta permanece ativa nas demais.
          </p>
        </div>
      </motion.div>

      {/* Sign Out */}
      <button
        onClick={async () => { await signOut(); navigate('/login'); }}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-medium transition-all hover:opacity-80"
        style={{ borderColor: theme.border, color: theme.textMuted }}
      >
        <LogOut className="w-4 h-4" />
        Sair da conta
      </button>

      {/* Unlink Confirmation Modal */}
      <AnimatePresence>
        {unlinkTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => !isUnlinking && setUnlinkTarget(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm rounded-2xl p-6 border z-10"
              style={{ background: theme.card, borderColor: theme.border }}
            >
              {unlinkSuccess ? (
                <div className="text-center py-4">
                  <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                    <Check className="w-7 h-7 text-green-400" />
                  </div>
                  <h3 className="font-bold text-lg mb-2" style={{ color: theme.textPrimary }}>Desvinculado!</h3>
                  <p className="text-sm" style={{ color: theme.textMuted }}>
                    Você saiu de <strong>{unlinkTarget.name}</strong>. Redirecionando...
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-start gap-3 mb-5">
                    <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-5 h-5 text-red-400" />
                    </div>
                    <div>
                      <h3 className="font-bold" style={{ color: theme.textPrimary }}>Sair de {unlinkTarget.name}?</h3>
                      <p className="text-sm mt-1 leading-relaxed" style={{ color: theme.textMuted }}>
                        Você perderá acesso a este estabelecimento. Para recuperar o acesso, um administrador precisará te convidar novamente.
                        Sua conta nos demais estabelecimentos <strong>não será afetada</strong>.
                      </p>
                    </div>
                  </div>

                  {error && (
                    <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 text-red-400 text-sm border border-red-500/20">
                      {error}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => setUnlinkTarget(null)}
                      disabled={isUnlinking}
                      className="flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all hover:opacity-80"
                      style={{ borderColor: theme.border, color: theme.textPrimary }}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleUnlink}
                      disabled={isUnlinking}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90 flex items-center justify-center gap-2 bg-red-500 text-white"
                    >
                      {isUnlinking ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <X className="w-4 h-4" />
                          Sim, sair
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
