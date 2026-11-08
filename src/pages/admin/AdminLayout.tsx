import { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Building2, CreditCard, DollarSign,
  Users, ScrollText, Bell, Settings, Shield,
  LogOut, Menu, X, ChevronRight, Zap, LifeBuoy, Activity,
  Sparkles, Target, BarChart3
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../integrations/supabase/client';
import { useAdminNotifications } from '../../hooks/useAdminNotifications';

interface NavItem {
  to: string;
  icon: React.ElementType;
  label: string;
  badge?: number;
}

const navGroups = [
  {
    label: 'Visão Geral',
    items: [
      { to: '/platform', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/platform/intelligence', icon: BarChart3, label: 'Raffros Analytics' },
      { to: '/platform/analytics', icon: Activity, label: 'Visitas & Cliques' },
    ],
  },
  {
    label: 'Plataforma',
    items: [
      { to: '/platform/tenants', icon: Building2, label: 'Empresas' },
      { to: '/platform/demos', icon: Sparkles, label: 'Portais Demo' },
      { to: '/platform/captacao', icon: Target, label: 'Captação & CRM' },
      { to: '/platform/plans', icon: CreditCard, label: 'Planos' },
      { to: '/platform/financeiro', icon: DollarSign, label: 'Financeiro' },
    ],
  },
  {
    label: 'Gestão',
    items: [
      { to: '/platform/usuarios', icon: Users, label: 'Usuários' },
      { to: '/platform/history', icon: ScrollText, label: 'CRM & Histórico' },
      { to: '/platform/auditoria', icon: ScrollText, label: 'Auditoria' },
      { to: '/platform/notificacoes', icon: Bell, label: 'Notificações', badgeKey: 'notifications' },
      { to: '/platform/suporte', icon: LifeBuoy, label: 'Suporte', badgeKey: 'support' },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { to: '/platform/seguranca', icon: Shield, label: 'Segurança' },
      { to: '/platform/settings', icon: Settings, label: 'Configurações' },
    ],
  },
];

function NavItemComponent({ item, onClick, externalBadge }: { item: NavItem; onClick?: () => void; externalBadge?: number }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === '/platform'}
      onClick={onClick}
      className={({ isActive }) =>
        `group flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150 ${
          isActive
            ? 'bg-emerald-500/10 text-emerald-400 font-semibold shadow-xs border border-emerald-500/25'
            : 'text-zinc-400 hover:text-white hover:bg-white/[0.05]'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span className="flex items-center gap-3">
            <item.icon className={`w-4 h-4 transition-colors ${isActive ? 'text-emerald-400' : 'text-zinc-500 group-hover:text-zinc-300'}`} />
            {item.label}
          </span>
          {(item.badge || externalBadge) ? (
            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold px-2 py-0.5 rounded-full">
              {item.badge ?? externalBadge}
            </span>
          ) : isActive ? (
            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full shadow-[0_0_8px_#10b981]" />
          ) : null}
        </>
      )}
    </NavLink>
  );
}

export default function AdminLayout() {
  const { signOut, user } = useAuth();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const location = useLocation();
  const [profile, setProfile] = useState<{ full_name: string } | null>(null);
  const { unreadCount, unreadSupportCount } = useAdminNotifications();

  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('full_name').eq('id', user.id).single()
      .then(({ data }) => { if (data) setProfile(data); });
  }, [user]);

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Admin';

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  return (
    <div className="min-h-screen bg-[#050507] text-zinc-100 flex font-sans antialiased selection:bg-emerald-500/30 selection:text-emerald-200">

      {/* ── Mobile Overlay ── */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="md:hidden fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
            onClick={() => setIsMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Mobile Top Bar ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-[#09090c]/95 border-b border-white/10 z-50 flex items-center justify-between px-4 shadow-xl backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <img src="/logo.svg" alt="Raffros Corteflow" className="h-8 md:h-10 w-auto" />
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 ml-1">
            Platform
          </span>
        </div>
        <button
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="w-8 h-8 flex items-center justify-center rounded-md text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          {isMobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>
      </div>

      {/* ── Sidebar ── */}
      <aside
        className={`
          w-60 flex flex-col fixed top-0 left-0 md:top-4 md:left-4 h-full md:h-[calc(100vh-32px)] z-50 
          bg-[#0A0A0E]/90 border border-white/10 md:rounded-3xl shadow-2xl backdrop-blur-2xl
          transition-transform duration-300 ease-in-out
          md:translate-x-0
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-white/5 gap-2.5">
          <img src="/logo.svg" alt="Raffros Corteflow" className="h-10 w-auto flex-shrink-0" />
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <Sparkles className="w-2.5 h-2.5 text-emerald-400" /> Platform Admin
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map(item => {
                  const badge = (item as any).badgeKey === 'notifications' 
                    ? (unreadCount > 0 ? unreadCount : undefined)
                    : (item as any).badgeKey === 'support'
                      ? (unreadSupportCount > 0 ? unreadSupportCount : undefined)
                      : undefined;
                  return (
                    <NavItemComponent 
                      key={item.to} 
                      item={item} 
                      onClick={() => setIsMobileOpen(false)}
                      externalBadge={badge} 
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User + Logout */}
        <div className="border-t border-white/5 p-3 bg-white/[0.02] md:rounded-b-3xl">
          <div className="flex items-center gap-3 px-3 py-2 mb-1">
            <div className="w-8 h-8 bg-emerald-500/15 border border-emerald-500/30 rounded-full flex items-center justify-center flex-shrink-0 text-emerald-400 font-bold text-xs shadow-xs">
              {firstName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-zinc-200 truncate">{firstName}</p>
              <p className="text-[10px] text-emerald-400 font-medium">Super Admin</p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors font-medium cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Sair da plataforma
          </button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="flex-1 min-w-0 w-full min-h-screen md:ml-[270px] flex flex-col md:pt-4 md:pr-4 md:pb-4 transition-all">
        <div className="flex-1 min-h-0 bg-[#0B0B0F]/70 backdrop-blur-3xl md:rounded-3xl border border-transparent md:border-white/10 shadow-2xl overflow-hidden flex flex-col relative">
          
        {/* Top Header */}
        <header className="sticky top-0 z-30 h-14 bg-[#0B0B0F]/80 backdrop-blur-md border-b border-white/5 hidden md:flex items-center justify-between px-8">
          {/* Breadcrumb */}
          <BreadcrumbFromPath />

          {/* Right: greeting */}
          <p className="text-sm text-zinc-400">
            {getGreeting()},{' '}
            <span className="text-zinc-100 font-semibold">{firstName}.</span>
          </p>
        </header>

        {/* Page Content */}
        <div className="flex-1 min-w-0 w-full p-6 md:p-8 pt-20 md:pt-8 max-w-screen-2xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <footer className="px-8 py-4 border-t border-white/5 flex items-center justify-between mt-auto bg-black/20">
          <p className="text-xs text-zinc-500">Raffros Corteflow · Admin Console</p>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/5 text-zinc-400 border border-white/10">v2.0.0</span>
        </footer>
        
        </div>
      </main>
    </div>
  );
}

// ── Helper: Dynamic Breadcrumb ──────────────────────────────────────────────
const routeLabels: Record<string, string> = {
  platform: 'Platform',
  admin: 'Admin',
  tenants: 'Empresas',
  demos: 'Portais Demo',
  plans: 'Planos',
  financeiro: 'Financeiro',
  usuarios: 'Usuários',
  auditoria: 'Auditoria',
  notificacoes: 'Notificações',
  seguranca: 'Segurança',
  settings: 'Configurações',
  'custom-pricing': 'Preços Customizados',
  intelligence: 'Raffros Analytics',
  analytics: 'Visitas & Cliques',
  history: 'CRM & Histórico',
  suporte: 'Suporte',
};

function BreadcrumbFromPath() {
  const location = useLocation();
  const parts = location.pathname.split('/').filter(Boolean);

  return (
    <nav className="flex items-center gap-1 text-sm">
      {parts.map((part, i) => {
        const label = routeLabels[part] ?? (part.charAt(0).toUpperCase() + part.slice(1));
        const isLast = i === parts.length - 1;
        return (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />}
            <span className={isLast ? 'text-zinc-100 font-semibold' : 'text-zinc-400 hover:text-emerald-400 transition-colors'}>
              {label}
            </span>
          </span>
        );
      })}
    </nav>
  );
}
