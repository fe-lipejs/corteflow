import { useEffect, useState } from 'react';
import { Outlet, NavLink, Navigate, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Calendar, Users, Scissors,
  DollarSign, Settings, LogOut, Bell, CreditCard, Shield, Loader2, Menu, X,
  AlertTriangle, Clock, LifeBuoy
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../integrations/supabase/client';
import { NotificationBell } from '../../components/notifications/NotificationBell';
import { ConnectionStatus } from '../../components/notifications/ConnectionStatus';
import { usePermissionEngine } from '../../hooks/usePermissionEngine';

export default function AppLayout() {
  const { signOut, tenant, profile, loading, role, professionalPermissions, professionalProfile } = useAuth();
  const { i18n } = useTranslation();
  const { theme, setThemeId, setCustomPalette } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [tenantSettings, setTenantSettings] = useState<any>(null);
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

  let navItems = [
    { to: '/admin', icon: LayoutDashboard, label: 'Visão geral', end: true, permission: 'view_dashboard' },
    { to: '/admin/agenda', icon: Calendar, label: 'Agenda', end: false, permission: 'view_agenda' },
    { to: '/admin/equipe', icon: Users, label: 'Equipe', end: false, permission: 'view_equipe' },
    { to: '/admin/servicos', icon: Scissors, label: 'Serviços', end: false, permission: 'view_servicos' },
    { to: '/admin/clientes', icon: Users, label: 'Clientes', end: false, permission: 'view_clientes' },
    { to: '/admin/financeiro', icon: DollarSign, label: 'Financeiro', end: false, permission: 'view_financeiro' },
    { to: '/admin/assinatura', icon: CreditCard, label: 'Assinatura', end: false, permission: null },
    { to: '/admin/suporte', icon: LifeBuoy, label: 'Suporte', end: false, badge: unreadSupport, permission: null },
    { to: '/admin/configuracoes', icon: Settings, label: 'Configurações', end: false, permission: null },
  ];

  if (role === 'professional') {
    navItems = [];
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

  if (loading || !tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
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

  // Calculate dynamic suspension if grace period expired
  const isGracePeriodExpired = false; // Grace period removido
  const isEffectivelySuspended = tenantStatus === 'blocked' || tenantStatus === 'suspended';
  
  const displaySuspensionReason = features.suspension_reason || 'Sua conta foi suspensa. Entre em contato com o suporte.';

  // Blocked or suspended by admin (or by grace period expiration): hard block
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
              <button onClick={() => navigate('/admin/assinatura')} className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl w-full" style={{ background: theme.accentGradient, color: theme.btnPrimaryText }}>
                <CreditCard className="w-4 h-4" /> Regularizar Assinatura
              </button>
            )}
            <button onClick={handleSignOut} className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl w-full border" style={{ borderColor: theme.border, color: theme.textPrimary }}>
              <LogOut className="w-4 h-4" /> Sair
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex" style={{ background: theme.bg }}>
      
      {/* Mobile Top Bar */}
      <div 
        className="md:hidden fixed top-0 left-0 right-0 h-16 backdrop-blur-xl z-40 flex items-center justify-between px-4"
        style={{ background: theme.sidebarBg, borderBottom: `1px solid ${theme.border}` }}
      >
        <div className="flex items-center gap-2">
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
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} style={{ color: theme.textPrimary }} className="p-2 -mr-2">
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
        className={`flex flex-col fixed top-0 left-0 h-full z-50 md:z-50 transition-transform duration-300 md:translate-x-0 backdrop-blur-xl ${
          isMobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'
        }`}
        style={{ width: '250px', background: theme.sidebarBg, borderRight: `1px solid ${theme.sidebarBorder}` }}
      >
        {/* Logo & Tenant Area */}
        <div className="p-6 border-b flex items-center justify-between gap-3" style={{ borderColor: theme.sidebarBorder }}>
          <div className="flex items-center gap-3 truncate flex-1">
            {tenantSettings?.logo_url ? (
              <img src={tenantSettings.logo_url} alt="Logo do Salão" className="w-9 h-9 rounded-full object-cover border" style={{ borderColor: theme.border }} />
            ) : (
              <div 
                className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm"
                style={{ background: theme.accent, color: theme.textInverse }}
              >
                {initials}
              </div>
            )}
            <div className="truncate flex-1">
              <h2 className="font-bold text-sm leading-tight truncate" style={{ color: theme.textPrimary }}>{tenant.name}</h2>
              <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded tracking-wide inline-block mt-0.5" style={{ background: `${theme.accent}15`, color: theme.accent }}>
                {tenant.business_type}
              </span>
            </div>
          </div>
          {/* Close button for mobile inside drawer */}
          <button 
            onClick={() => setIsMobileMenuOpen(false)} 
            className="md:hidden p-1 rounded-lg hover:opacity-80 transition-opacity"
            style={{ color: theme.textMuted }}
          >
            <X className="w-5 h-5" />
          </button>
          <div className="hidden md:block">
            <NotificationBell align="sidebar" />
          </div>
        </div>

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
              <item.icon className="w-4 h-4" />
              <span className="flex-1">{item.label}</span>
              {(item as any).badge && (
                <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-pulse"></span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User profile footer */}
        <div className="p-4 border-t" style={{ borderColor: theme.sidebarBorder }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 truncate">
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0"
                style={{ background: theme.accent, color: theme.textInverse }}
              >
                {initials}
              </div>
              <div className="truncate w-24">
                <p className="text-xs font-semibold leading-tight truncate" style={{ color: theme.textPrimary }}>{displayName.split(' ')[0]}</p>
                <p className="text-xs leading-tight truncate" style={{ color: theme.textMuted }}>{role === 'professional' ? 'Profissional' : tenant.name}</p>
              </div>
            </div>
            <button 
              onClick={handleSignOut} 
              className="ml-2 transition-opacity hover:opacity-80"
              style={{ color: theme.textMuted }}
            >
              {isSigningOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 min-h-screen pt-16 md:pt-0 md:ml-[250px] transition-all flex flex-col">
        <div className="p-4 md:p-8 max-w-7xl mx-auto w-full overflow-x-hidden flex-1 flex flex-col">
          {features.subscription_status === 'past_due' && features.grace_period_ends_at && !isGracePeriodExpired && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-600 rounded-xl p-4 mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-sm">Problema com o pagamento</h3>
                  <p className="text-sm opacity-90">
                    Identificamos uma pendência no pagamento da sua assinatura. 
                    Você possui acesso até {new Date(features.grace_period_ends_at).toLocaleDateString('pt-BR')} para regularizar a situação antes da suspensão da conta.
                  </p>
                </div>
              </div>
              <button 
                onClick={() => navigate('/admin/assinatura')}
                className="whitespace-nowrap px-4 py-2 bg-yellow-500 text-yellow-950 font-bold rounded-lg text-sm transition-opacity hover:opacity-90 w-full md:w-auto text-center"
              >
                Regularizar Agora
              </button>
            </div>
          )}
          <Outlet />
        </div>
      </main>

      <ConnectionStatus />
    </div>
  );
}

