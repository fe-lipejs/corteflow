import { useEffect, useState, useRef } from 'react';
import { Outlet, NavLink, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { trackEvent, ActiveDwellTracker } from '../../lib/analytics';
import {
  LayoutDashboard, Calendar, Users, Scissors,
  DollarSign, Settings, LogOut, Bell, CreditCard, Shield, Loader2, Menu, X,
  AlertTriangle, Clock, LifeBuoy, UserCircle, ArrowRight, Star
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../integrations/supabase/client';
import { NotificationBell } from '../../components/notifications/NotificationBell';
import { ConnectionStatus } from '../../components/notifications/ConnectionStatus';
import { usePermissionEngine } from '../../hooks/usePermissionEngine';
import { RefreshCw } from 'lucide-react';
import { TenantSelectorModal } from '../../components/TenantSelectorModal';
import { Toaster } from 'react-hot-toast';

export default function AppLayout() {
  const { signOut, tenant, profile, loading, role, professionalPermissions, professionalProfile, memberships, pendingTenantSelection } = useAuth();
  const { i18n } = useTranslation();
  const { theme, setThemeId, setCustomPalette } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [tenantSettings, setTenantSettings] = useState<any>(null);

  // ── Raffros Analytics: Admin Panel Session, Page Views & Active Dwell Time ──
  const adminDwellRef = useRef<ActiveDwellTracker>(new ActiveDwellTracker(60000));
  const lastAdminPathRef = useRef<string>(location.pathname);

  const resolveAdminAreaMeta = (pathname: string) => {
    if (pathname === '/admin' || pathname === '/admin/') return { key: 'visao_geral', label: 'Visão Geral' };
    if (pathname.startsWith('/admin/agenda')) return { key: 'agenda', label: 'Agenda' };
    if (pathname.startsWith('/admin/equipe')) return { key: 'equipe', label: 'Profissionais / Equipe' };
    if (pathname.startsWith('/admin/servicos')) return { key: 'servicos', label: 'Serviços & Catálogo' };
    if (pathname.startsWith('/admin/clientes')) return { key: 'clientes', label: 'Clientes' };
    if (pathname.startsWith('/admin/financeiro')) return { key: 'financeiro', label: 'Financeiro' };
    if (pathname.startsWith('/admin/configuracoes')) return { key: 'configuracoes', label: 'Configurações' };
    if (pathname.startsWith('/admin/assinatura')) return { key: 'assinatura', label: 'Assinatura' };
    if (pathname.startsWith('/admin/suporte')) return { key: 'suporte', label: 'Suporte' };
    if (pathname.startsWith('/admin/minha-comissao')) return { key: 'minha_comissao', label: 'Minha Comissão' };
    if (pathname.startsWith('/admin/minha-area')) return { key: 'minha_area', label: 'Minha Área' };
    return { key: 'outros', label: pathname };
  };

  useEffect(() => {
    if (!tenant?.id || role === 'super_admin') return;
    const onInteract = () => adminDwellRef.current.recordInteraction();
    window.addEventListener('pointerdown', onInteract, { passive: true });
    window.addEventListener('keydown', onInteract, { passive: true });
    window.addEventListener('scroll', onInteract, { passive: true });

    trackEvent('admin_session_started', {
      eventType: 'page_view',
      source: 'admin',
      tenantId: tenant.id,
      userId: profile?.id || null,
      userRole: role || 'owner',
      stepName: resolveAdminAreaMeta(location.pathname).key,
      metadata: {
        label: 'Sessão Administrativa Iniciada',
        area_label: resolveAdminAreaMeta(location.pathname).label,
      },
      dedupeWindowMs: 60000,
    });

    return () => {
      window.removeEventListener('pointerdown', onInteract);
      window.removeEventListener('keydown', onInteract);
      window.removeEventListener('scroll', onInteract);
    };
  }, [tenant?.id, role, profile?.id]);

  useEffect(() => {
    if (!tenant?.id || role === 'super_admin') return;
    const prevPath = lastAdminPathRef.current;
    if (prevPath && prevPath !== location.pathname) {
      const prevMeta = resolveAdminAreaMeta(prevPath);
      const dwellMs = adminDwellRef.current.reset();
      if (dwellMs > 500) {
        trackEvent('admin_page_dwell', {
          eventType: 'click',
          source: 'admin',
          tenantId: tenant.id,
          userId: profile?.id || null,
          userRole: role || 'owner',
          pagePath: prevPath,
          stepName: prevMeta.key,
          durationMs: dwellMs,
          metadata: { label: `Tempo em ${prevMeta.label}`, area_label: prevMeta.label },
          dedupeWindowMs: 100,
        });
      }
    } else {
      adminDwellRef.current.reset();
    }
    lastAdminPathRef.current = location.pathname;

    const currMeta = resolveAdminAreaMeta(location.pathname);
    trackEvent('admin_page_view', {
      eventType: 'page_view',
      source: 'admin',
      tenantId: tenant.id,
      userId: profile?.id || null,
      userRole: role || 'owner',
      pagePath: location.pathname,
      stepName: currMeta.key,
      metadata: { label: currMeta.label, area_label: currMeta.label },
    });
  }, [location.pathname, tenant?.id, role, profile?.id]);

  const engine = usePermissionEngine();
  const features = {
    subscription_status: engine.subscription?.status,
    grace_period_ends_at: null,
    suspension_reason: (tenant as any)?.suspension_reason || engine.subscription?.suspension_reason,
  };

  // Pages always accessible regardless of subscription status
  const publicAppPaths = ['/admin/assinatura', '/admin/configuracoes', '/admin/suporte'];

  // Sync theme with tenant settings from DB
  useEffect(() => {
    if (tenant?.id) {
      supabase
        .from('tenant_settings')
        .select('*')
        .eq('tenant_id', tenant.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setTenantSettings(data);
            if (data.theme_preset) setThemeId(data.theme_preset);
            if (data.custom_palette) setCustomPalette(data.custom_palette);
            else setCustomPalette(undefined);
          }
        });
    }
  }, [tenant?.id, setThemeId, setCustomPalette]);

  useEffect(() => {
    if (tenant?.language && i18n.language !== tenant.language) {
      i18n.changeLanguage(tenant.language);
    }
  }, [tenant?.language, i18n]);

  // Garantir Safe Area no iOS (evita que o topo misture com relógio, bateria, Dynamic Island e notch)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
    if (isIOS) {
      document.documentElement.style.setProperty(
        '--app-safe-top',
        isStandalone ? 'max(env(safe-area-inset-top, 0px), 48px)' : 'env(safe-area-inset-top, 0px)'
      );
    }
  }, []);

  // Escutar cliques em notificações Web Push quando o Raffros já estiver aberto (reutiliza a janela atual)
  // e forçar atualização silenciosa do Service Worker para usuários que já tinham o app instalado antes
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker
      .getRegistration()
      .then((reg) => {
        if (reg) {
          reg.update().catch(() => {});
        } else {
          navigator.serviceWorker.register('/service-worker.js', { scope: '/' }).catch(() => {});
        }
      })
      .catch(() => {});

    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === 'RAFFROS_NOTIFICATION_CLICK' && event.data?.url) {
        navigate(event.data.url);
      }
    };

    navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
    };
  }, [navigate]);

  // Processar lembretes de agendamentos próximos e resumo diário de forma idempotente
  useEffect(() => {
    if (!tenant?.id) return;

    const triggerScheduledNotifications = () => {
      supabase.functions
        .invoke('push-notifications', {
          body: {
            action: 'process_scheduled_notifications',
            tenantId: tenant.id,
          },
        })
        .catch(() => {});
    };

    const initialTimer = setTimeout(triggerScheduledNotifications, 4000);
    const interval = setInterval(triggerScheduledNotifications, 10 * 60 * 1000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [tenant?.id]);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    await signOut();
    navigate('/login');
  };

  const [unreadSupport, setUnreadSupport] = useState(false);

  useEffect(() => {
    if (!tenant) return;

    const fetchUnread = async () => {
      const { count } = await supabase
        .from('support_messages')
        .select('*', { count: 'exact', head: true })
        .eq('read_by_owner', false)
        .neq('sender_role', 'owner');
      setUnreadSupport((count || 0) > 0);
    };

    fetchUnread();

    const channel = supabase.channel('app_support_unread')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages' }, () => {
        fetchUnread();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'support_messages' }, () => {
        fetchUnread();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tenant]);

  const hasActivePaidSub =
    engine.subscriptionStatus === 'active' &&
    Boolean(engine.subscription?.stripe_subscription_id);

  let navItems = [
    { to: '/admin', icon: LayoutDashboard, label: 'Visão geral', end: true, permission: 'view_dashboard' },
    { to: '/admin/agenda', icon: Calendar, label: 'Agenda', end: false, permission: 'view_agenda' },
    { to: '/admin/equipe', icon: Users, label: 'Equipe', end: false, permission: 'view_equipe' },
    { to: '/admin/servicos', icon: Scissors, label: 'Serviços', end: false, permission: 'view_servicos' },
    { to: '/admin/clientes', icon: Users, label: 'Clientes', end: false, permission: 'view_clientes' },
    { to: '/admin/financeiro', icon: DollarSign, label: 'Financeiro', end: false, permission: 'view_financeiro' },
    { to: '/admin/assinatura', icon: CreditCard, label: 'Assinatura', end: false, permission: null, showStar: !hasActivePaidSub },
    { to: '/admin/suporte', icon: LifeBuoy, label: 'Suporte', end: false, badge: unreadSupport, permission: null },
    { to: '/admin/configuracoes', icon: Settings, label: 'Configurações', end: false, permission: null },
  ];

  if (role === 'professional') {
    navItems = [];
    navItems.push({ to: '/admin', icon: LayoutDashboard, label: 'Visão geral', end: true, permission: null } as any);
    navItems.push({ to: '/admin/minha-area', icon: UserCircle, label: 'Minha Área', end: false, permission: null } as any);
    if (professionalPermissions?.view_own_schedule) {
      navItems.push({ to: '/admin/agenda', icon: Calendar, label: 'Agenda', end: false, permission: null } as any);
    }
    if (professionalPermissions?.view_financial) {
      navItems.push({ to: '/admin/financeiro', icon: DollarSign, label: 'Financeiro', end: false, permission: null } as any);
    }
    if (professionalPermissions?.view_commission) {
      navItems.push({ to: '/admin/minha-comissao', icon: DollarSign, label: 'Minha Comissão', end: false, permission: null } as any);
    }
  }

  // Show tenant selector for professionals with multiple active salons
  if (pendingTenantSelection.length > 0) {
    return <TenantSelectorModal options={pendingTenantSelection} />;
  }

  // Super Admin não tem tenant -> deve ir para /platform
  if (role === 'super_admin' && !tenant) {
    return <Navigate to="/platform" replace />;
  }

  if (loading || !tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: theme.bg }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: theme.accent }} />
      </div>
    );
  }

  const displayName = role === 'professional' && professionalProfile?.name 
    ? professionalProfile.name 
    : profile?.full_name || 'Usuário';

  const initials = displayName
    ? displayName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()
    : 'CF';

  // Subscription guard — allow access to /app/assinatura and /app/configuracoes always
  const isPublicAppPath = publicAppPaths.some(p => location.pathname.startsWith(p));
  const tenantStatus = (tenant as any).status as string | undefined;

  const isEffectivelySuspended = tenantStatus === 'blocked' || tenantStatus === 'suspended';
  const displaySuspensionReason = features.suspension_reason || 'Sua conta foi suspensa. Entre em contato com o suporte.';

  // Blocked or suspended by admin: hard block
  if (isEffectivelySuspended && !isPublicAppPath) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: theme.bg }}>
        <div className="max-w-sm text-center px-8">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-bold mb-2" style={{ color: theme.textPrimary }}>Conta Suspensa</h2>
          <p className="text-sm mb-6" style={{ color: theme.textSecondary }}>{displaySuspensionReason}</p>
          <div className="flex flex-col gap-3">
            {features.subscription_status === 'past_due' && (
              <button onClick={() => navigate('/admin/assinatura')} className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl w-full cursor-pointer" style={{ background: theme.accentGradient, color: theme.btnPrimaryText }}>
                <CreditCard className="w-4 h-4" /> Regularizar Assinatura
              </button>
            )}
            <button onClick={handleSignOut} className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl w-full border cursor-pointer" style={{ borderColor: theme.border, color: theme.textPrimary }}>
              <LogOut className="w-4 h-4" /> Sair
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex overflow-x-hidden max-w-full" style={{ background: theme.bg }}>
      <Toaster
        position="top-center"
        containerStyle={{
          top: 'calc(var(--app-safe-top, 0px) + 14px)',
          zIndex: 99999,
        }}
      />

      {/* Mobile Top Bar (respeita Safe Area da barra de status/bateria/relógio do iPhone e Android) */}
      <div 
        className="app-mobile-topbar md:hidden fixed top-0 left-0 right-0 backdrop-blur-xl z-40 flex items-center justify-between px-4"
        style={{
          background: theme.sidebarBg,
          borderBottom: `1px solid ${theme.border}`,
          paddingTop: 'var(--app-safe-top, env(safe-area-inset-top, 0px))',
          height: 'calc(4rem + var(--app-safe-top, env(safe-area-inset-top, 0px)))',
        }}
      >
        <div 
          onClick={() => {
            setIsMobileMenuOpen(false);
            navigate('/admin');
          }}
          className="flex items-center gap-2 cursor-pointer hover:opacity-85 transition-opacity"
          title="Ir para a tela inicial do Admin (Visão Geral)"
        >
          {tenantSettings?.logo_url ? (
            <img src={tenantSettings.logo_url} alt="Logo do Salão" className="w-8 h-8 rounded-full object-cover border" style={{ borderColor: theme.border }} />
          ) : (
            <div 
              className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0"
              style={{ background: theme.accent, color: theme.textInverse }}
            >
              {initials}
            </div>
          )}
          <img src="/logo.svg" alt="Raffros Corteflow" className="h-5 w-auto" />
        </div>
        <div className="flex items-center gap-3">
          <NotificationBell align="right" />
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} style={{ color: theme.textPrimary }} className="p-2 -mr-2 cursor-pointer">
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Backdrop Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 z-40 backdrop-blur-sm transition-opacity"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar (Desktop fixed & Mobile Drawer) */}
      <aside 
        className={`flex flex-col fixed top-0 left-0 md:top-4 md:left-4 h-full md:h-[calc(100vh-32px)] z-50 md:z-50 transition-all duration-500 backdrop-blur-2xl md:rounded-3xl shadow-2xl ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
        style={{ 
          width: '260px', 
          background: `color-mix(in srgb, ${theme.sidebarBg} 95%, transparent)`, 
          border: `1px solid ${theme.sidebarBorder}`,
          boxShadow: `0 25px 50px -12px rgba(0,0,0,0.25)`
        }}
      >
        {/* Logo & Tenant Area - Clicável para voltar a /admin */}
        <div 
          className="app-mobile-drawer-header md:pt-6 p-6 border-b flex items-center justify-between gap-3" 
          style={{ 
            borderColor: theme.sidebarBorder,
            paddingTop: 'calc(1.25rem + var(--app-safe-top, env(safe-area-inset-top, 0px)))',
          }}
        >
          <div 
            onClick={() => {
              setIsMobileMenuOpen(false);
              navigate('/admin');
            }}
            className="flex items-center gap-3 truncate flex-1 cursor-pointer group hover:opacity-85 transition-opacity"
            title="Ir para a tela inicial do Admin (Visão Geral)"
          >
            {tenantSettings?.logo_url ? (
              <img src={tenantSettings.logo_url} alt="Logo do Salão" className="w-9 h-9 rounded-full object-cover border group-hover:scale-105 transition-transform" style={{ borderColor: theme.border }} />
            ) : (
              <div 
                className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 group-hover:scale-105 transition-transform"
                style={{ background: theme.accent, color: theme.textInverse }}
              >
                {initials}
              </div>
            )}
            <div className="truncate flex-1">
              <h2 className="font-bold text-sm leading-tight truncate group-hover:underline" style={{ color: theme.textPrimary }}>{tenant.name}</h2>
              <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded tracking-wide inline-block mt-0.5" style={{ background: `${theme.accent}15`, color: theme.accent }}>
                {tenant.business_type === 'salao' ? 'Salão' : tenant.business_type === 'esmalteria' ? 'Esmalteria' : tenant.business_type === 'barbearia' ? 'Barbearia' : tenant.business_type}
              </span>
            </div>
          </div>
          {/* Close button for mobile inside drawer */}
          <button 
            onClick={() => setIsMobileMenuOpen(false)} 
            className="md:hidden p-1 rounded-lg hover:opacity-80 transition-opacity cursor-pointer"
            style={{ color: theme.textMuted }}
          >
            <X className="w-5 h-5" />
          </button>
          <div className="hidden md:block">
            <NotificationBell align="sidebar" />
          </div>
        </div>
        
        {/* Switch Tenant Button */}
        {memberships && memberships.length > 1 && (
          <div className="px-4 py-3 border-b" style={{ borderColor: theme.sidebarBorder }}>
            <button 
              onClick={() => navigate('/select-tenant')}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-colors cursor-pointer"
              style={{ background: 'rgba(255,255,255,0.05)', color: theme.textSecondary, border: `1px solid ${theme.border}` }}
            >
              <RefreshCw className="w-4 h-4" />
              Trocar Estabelecimento
            </button>
          </div>
        )}

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all ${
                  isActive ? 'font-bold shadow-sm' : 'opacity-80 hover:opacity-100'
                }`
              }
              style={({ isActive }) => ({
                background: isActive ? theme.sidebarActiveItemBg : 'transparent',
                color: isActive ? theme.sidebarActiveItemText : theme.textPrimary,
              })}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span className="flex-1 flex items-center gap-1.5 min-w-0">
                <span className="truncate">{item.label}</span>
                {(item as any).showStar && (
                  <Star
                    className="w-3.5 h-3.5 shrink-0"
                    style={{ color: theme.accent, fill: theme.accent }}
                  />
                )}
              </span>
              {(item as any).badge && (
                <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-pulse"></span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User profile footer - Clicável para voltar a /admin */}
        <div className="p-4 border-t" style={{ borderColor: theme.sidebarBorder }}>
          <div className="flex items-center justify-between">
            <div 
              onClick={() => {
                setIsMobileMenuOpen(false);
                navigate('/admin');
              }}
              className="flex items-center gap-2 truncate cursor-pointer group hover:opacity-85 transition-opacity"
              title="Ir para a tela inicial do Admin (Visão Geral)"
            >
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 group-hover:scale-105 transition-transform"
                style={{ background: theme.accent, color: theme.textInverse }}
              >
                {initials}
              </div>
              <div className="truncate w-24">
                <p className="text-xs font-semibold leading-tight truncate group-hover:underline" style={{ color: theme.textPrimary }}>{displayName.split(' ')[0]}</p>
                <p className="text-xs leading-tight truncate" style={{ color: theme.textMuted }}>{role === 'professional' ? 'Profissional' : tenant.name}</p>
              </div>
            </div>
            <button 
              onClick={handleSignOut} 
              className="ml-2 transition-opacity hover:opacity-80 cursor-pointer"
              style={{ color: theme.textMuted }}
            >
              {isSigningOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main 
        className="app-main-content flex-1 min-w-0 max-w-full overflow-x-hidden min-h-screen md:pt-4 md:ml-[280px] md:pr-4 md:pb-4 transition-all flex flex-col"
        style={{
          paddingTop: 'calc(4.25rem + var(--app-safe-top, env(safe-area-inset-top, 0px)))',
        }}
      >
        <div className="p-4 md:p-8 max-w-7xl mx-auto w-full min-w-0 overflow-x-hidden flex-1 flex flex-col rounded-none md:rounded-3xl border border-transparent md:border-[color-mix(in_srgb,var(--theme-card-border)_50%,transparent)]"
             style={{ 
               background: `color-mix(in srgb, ${theme.cardBg} 40%, transparent)`, 
               boxShadow: `0 8px 32px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.05)`
             }}>

          {/* Banner Discreto, Compacto e Elegante de Assinatura */}
          {(() => {
            const subStatus = engine.subscriptionStatus;
            const isAlertStatus = (subStatus === 'canceled' || subStatus === 'trial_expired' || subStatus === 'past_due' || subStatus === 'unpaid') && location.pathname !== '/admin/assinatura';

            if (!isAlertStatus) return null;

            const alertConfig = {
              canceled: {
                badge: 'Assinatura Inativa',
                dotColor: 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.7)]',
                text: 'Reative seu plano para desbloquear todos os recursos.',
                action: 'Reativar Plano',
              },
              trial_expired: {
                badge: 'Teste Finalizado',
                dotColor: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.7)]',
                text: 'Escolha um plano para continuar aproveitando as ferramentas.',
                action: 'Escolher Plano',
              },
              past_due: {
                badge: 'Pagamento Pendente',
                dotColor: 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.7)]',
                text: 'Regularize sua fatura para evitar pausas no salão.',
                action: 'Regularizar Fatura',
              },
              unpaid: {
                badge: 'Pagamento Pendente',
                dotColor: 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.7)]',
                text: 'Regularize sua fatura para evitar pausas no salão.',
                action: 'Regularizar Fatura',
              },
            }[subStatus] || null;

            if (!alertConfig) return null;

            return (
              <div
                className="p-2.5 sm:px-4 sm:py-2 rounded-2xl border mb-4 flex items-center justify-between gap-3 text-xs shadow-sm transition-all"
                style={{
                  background: `color-mix(in srgb, ${theme.cardBg} 85%, transparent)`,
                  borderColor: theme.border,
                  backdropFilter: 'blur(12px)',
                }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${alertConfig.dotColor}`} />
                  <span
                    className="font-bold text-[11px] uppercase tracking-wider shrink-0"
                    style={{ color: theme.textPrimary }}
                  >
                    {alertConfig.badge}
                  </span>
                  <span className="hidden sm:inline opacity-30">•</span>
                  <p className="text-xs truncate hidden sm:block" style={{ color: theme.textSecondary }}>
                    {alertConfig.text}
                  </p>
                </div>

                <div className="flex items-center shrink-0">
                  <button
                    type="button"
                    onClick={() => navigate('/admin/assinatura')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-md shadow-red-500/20"
                  >
                    <span>{alertConfig.action}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })()}

          <Outlet />
        </div>
      </main>

      <ConnectionStatus />
    </div>
  );
}
