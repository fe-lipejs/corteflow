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
import { usePlanFeatures } from '../../hooks/usePlanFeatures';

export default function AppLayout() {
  const { signOut, tenant, profile, loading } = useAuth();
  const { i18n } = useTranslation();
  const { theme, setThemeId, setCustomPalette } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [tenantSettings, setTenantSettings] = useState<any>(null);
  const { features, isLoading: planLoading } = usePlanFeatures();

  // Pages always accessible regardless of subscription status
  const publicAppPaths = ['/app/assinatura', '/app/configuracoes', '/app/suporte'];

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: theme.bg }}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: theme.accent }} />
          <span className="text-sm" style={{ color: theme.textMuted }}>Carregando...</span>
        </div>
      </div>
    );
  }

  if (!tenant) return <Navigate to="/login" replace />;

  const navItems = [
    { to: '/app', icon: LayoutDashboard, label: 'Visão geral', end: true },
    { to: '/app/agenda', icon: Calendar, label: 'Agenda', end: false },
    { to: '/app/equipe', icon: Users, label: 'Equipe', end: false },
    { to: '/app/servicos', icon: Scissors, label: 'Serviços', end: false },
    { to: '/app/clientes', icon: Users, label: 'Clientes', end: false },
    { to: '/app/financeiro', icon: DollarSign, label: 'Financeiro', end: false },
    { to: '/app/assinatura', icon: CreditCard, label: 'Assinatura', end: false },
    { to: '/app/suporte', icon: LifeBuoy, label: 'Suporte', end: false },
    { to: '/app/configuracoes', icon: Settings, label: 'Configurações', end: false },
  ];

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()
    : 'K';

  const handleSignOut = async () => {
    setIsSigningOut(true);
    await signOut();
    navigate('/login');
  };

  // Subscription guard — allow access to /app/assinatura and /app/configuracoes always
  const isPublicAppPath = publicAppPaths.some(p => location.pathname.startsWith(p));
  const tenantStatus = (tenant as any).status as string | undefined;

  // Calculate dynamic suspension if grace period expired
  const isGracePeriodExpired = features.subscription_status === 'past_due' && features.grace_period_ends_at && new Date(features.grace_period_ends_at) < new Date();
  const isEffectivelySuspended = tenantStatus === 'blocked' || tenantStatus === 'suspended' || isGracePeriodExpired;
  
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
              <button onClick={() => navigate('/app/assinatura')} className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl w-full" style={{ background: theme.accentGradient, color: theme.btnPrimaryText }}>
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
        className="md:hidden fixed top-0 left-0 right-0 h-16 backdrop-blur-xl z-30 flex items-center justify-between px-4"
        style={{ background: theme.sidebarBg, borderBottom: `1px solid ${theme.border}` }}
      >
        <div className="flex items-center gap-2">
          {tenantSettings?.logo_url ? (
            <img src={tenantSettings.logo_url} alt="Logo do Salão" className="w-8 h-8 rounded-full object-cover border" style={{ borderColor: theme.border }} />
          ) : (
            <div 
              className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm"
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

      {/* Overlay for mobile */}
      {isMobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 z-20 backdrop-blur-sm"
          style={{ background: theme.bgOverlay }}
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`navalha-sidebar flex flex-col fixed top-0 left-0 h-full z-30 transform transition-transform duration-300 md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`} 
        style={{ width: '250px', background: theme.sidebarBg, borderRight: `1px solid ${theme.border}` }}
      >
        {/* Logo */}
        <div className="items-center justify-between px-5 py-5 hidden md:flex" style={{ borderBottom: `1px solid ${theme.border}` }}>
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="Raffros Corteflow" className="h-8 w-auto flex-shrink-0" />
            <div>
              <p className="text-xs leading-tight" style={{ color: theme.textMuted }}>Painel do Salão</p>
            </div>
          </div>
          <NotificationBell align="left" />
        </div>

        {/* Mobile Spacer */}
        <div className="md:hidden h-16 flex items-center px-5" style={{ borderBottom: `1px solid ${theme.border}` }}>
           <span className="font-bold" style={{ color: theme.textPrimary }}>Menu</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) =>
                `navalha-nav-item ${isActive ? 'active' : ''}`
              }
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </NavLink>
          ))}

          {/* Divider */}
          <div className="my-3" style={{ borderTop: `1px solid ${theme.border}` }} />

          {profile?.role === 'super_admin' && (
            <NavLink
              to="/admin"
              className={({ isActive }) => `navalha-nav-item ${isActive ? 'active' : ''}`}
            >
              <Shield className="w-4 h-4 flex-shrink-0" />
              <span>Admin <span style={{ color: theme.accent }}>Master</span></span>
            </NavLink>
          )}
        </nav>

        {/* User Footer */}
        <div className="p-3" style={{ borderTop: `1px solid ${theme.border}` }}>
          <div 
            className="flex items-center justify-between p-2 rounded-xl transition-colors cursor-pointer"
            style={{ ['--hover-bg' as string]: theme.bgHover }}
            onMouseEnter={(e) => (e.currentTarget.style.background = theme.bgHover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <div className="flex items-center gap-3">
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                style={{ background: theme.accent, color: theme.textInverse }}
              >
                {initials}
              </div>
              <div className="truncate w-24">
                <p className="text-xs font-semibold leading-tight truncate" style={{ color: theme.textPrimary }}>{profile?.full_name?.split(' ')[0] || 'Usuário'}</p>
                <p className="text-xs leading-tight truncate" style={{ color: theme.textMuted }}>{tenant.name}</p>
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
                onClick={() => navigate('/app/assinatura')}
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
