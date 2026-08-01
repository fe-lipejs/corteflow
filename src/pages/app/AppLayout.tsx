import { useEffect, useState } from 'react';
import { Outlet, NavLink, Navigate, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Calendar, Users, Scissors,
  DollarSign, Settings, LogOut, Bell, CreditCard, Shield, Loader2, Menu, X
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../integrations/supabase/client';
import { NotificationBell } from '../../components/notifications/NotificationBell';
import { ConnectionStatus } from '../../components/notifications/ConnectionStatus';

export default function AppLayout() {
  const { signOut, tenant, profile, loading } = useAuth();
  const { i18n } = useTranslation();
  const { theme, setThemeId } = useTheme();
  const navigate = useNavigate();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Sync theme with tenant settings from DB
  useEffect(() => {
    if (tenant?.id) {
      supabase
        .from('tenant_settings')
        .select('theme_preset')
        .eq('tenant_id', tenant.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.theme_preset) {
            setThemeId(data.theme_preset);
          }
        });
    }
  }, [tenant?.id, setThemeId]);

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

  return (
    <div className="min-h-screen flex" style={{ background: theme.bg }}>
      
      {/* Mobile Top Bar */}
      <div 
        className="md:hidden fixed top-0 left-0 right-0 h-16 backdrop-blur-xl z-30 flex items-center justify-between px-4"
        style={{ background: theme.sidebarBg, borderBottom: `1px solid ${theme.border}` }}
      >
        <div className="flex items-center gap-2">
          <div 
            className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm"
            style={{ background: theme.accent, color: theme.textInverse }}
          >
            {initials}
          </div>
          <span className="font-bold text-sm" style={{ color: theme.textPrimary }}>Navalha</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} style={{ color: theme.textPrimary }} className="p-2">
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
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
            <div 
              className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm"
              style={{ background: theme.accent, color: theme.textInverse }}
            >
              {initials}
            </div>
            <div>
              <p className="font-bold text-sm leading-tight" style={{ color: theme.textPrimary }}>Navalha</p>
              <p className="text-xs leading-tight" style={{ color: theme.textMuted }}>Painel do Salão</p>
            </div>
          </div>
          <NotificationBell />
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
          <Outlet />
        </div>
      </main>
      <ConnectionStatus />
    </div>
  );
}
