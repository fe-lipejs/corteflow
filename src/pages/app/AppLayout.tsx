import { useEffect, useState } from 'react';
import { Outlet, NavLink, Navigate, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Calendar, Users, Scissors,
  DollarSign, Settings, LogOut, Bell, CreditCard, Shield, Loader2, Menu, X,
  AlertTriangle, Clock, LifeBuoy, Compass
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../integrations/supabase/client';
import { NotificationBell } from '../../components/notifications/NotificationBell';
import { ConnectionStatus } from '../../components/notifications/ConnectionStatus';
import { usePlanFeatures } from '../../hooks/usePlanFeatures';
import { GuideProvider, useGuide } from '../../contexts/GuideContext';
import { SpotlightGuideTour } from '../../components/guides/SpotlightGuideTour';

const TourLaunchButton = () => {
  const { startTour } = useGuide();
  const { theme } = useTheme();

  return (
    <button
      type="button"
      onClick={startTour}
      className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold opacity-80 hover:opacity-100 transition-all cursor-pointer mb-2"
      style={{ background: `${theme.accent}12`, color: theme.accent, border: `1px solid ${theme.accent}25` }}
      title="Iniciar tour interativo pelos menus"
    >
      <Compass className="w-3.5 h-3.5 animate-spin-slow" />
      <span>Tour Interativo</span>
    </button>
  );
};

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

  const handleSignOut = async () => {
    setIsSigningOut(true);
    await signOut();
    navigate('/login');
  };

  const navItems = [
    { to: '/app', icon: LayoutDashboard, label: 'Visão geral', end: true, guideId: 'nav-visao-geral' },
    { to: '/app/agenda', icon: Calendar, label: 'Agenda', end: false, guideId: 'nav-agenda' },
    { to: '/app/equipe', icon: Users, label: 'Equipe', end: false, guideId: 'nav-equipe' },
    { to: '/app/servicos', icon: Scissors, label: 'Serviços', end: false, guideId: 'nav-servicos' },
    { to: '/app/clientes', icon: Users, label: 'Clientes', end: false, guideId: 'nav-clientes' },
    { to: '/app/financeiro', icon: DollarSign, label: 'Financeiro', end: false, guideId: 'nav-financeiro' },
    { to: '/app/assinatura', icon: CreditCard, label: 'Assinatura', end: false, guideId: 'nav-assinatura' },
    { to: '/app/suporte', icon: LifeBuoy, label: 'Suporte', end: false, guideId: 'nav-suporte' },
    { to: '/app/configuracoes', icon: Settings, label: 'Configurações', end: false, guideId: 'nav-configuracoes' },
  ];

  if (loading || !tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: theme.bg }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: theme.accent }} />
      </div>
    );
  }

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()
    : 'K';

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
    <GuideProvider>
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

        {/* Mobile Backdrop Overlay */}
        {isMobileMenuOpen && (
          <div 
            className="md:hidden fixed inset-0 z-30 backdrop-blur-sm transition-opacity"
            style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar (Desktop fixed & Mobile Drawer) */}
        <aside 
          className={`flex flex-col fixed top-0 left-0 h-full z-40 md:z-20 transition-transform duration-300 md:translate-x-0 backdrop-blur-xl ${
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
              <NotificationBell />
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                data-guide={item.guideId}
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
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          {/* User profile footer */}
          <div className="p-4 border-t" style={{ borderColor: theme.sidebarBorder }}>
            <TourLaunchButton />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 truncate">
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0"
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
        {/* Tour Spotlight Interativo Ancorado com Seta */}
        <SpotlightGuideTour />
      </div>
    </GuideProvider>
  );
}
