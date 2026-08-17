import { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Building2, CreditCard, DollarSign,
  Users, ScrollText, Bell, Settings, Shield,
  LogOut, Menu, X, ChevronRight, Zap, LifeBuoy
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
      { to: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
    ],
  },
  {
    label: 'Plataforma',
    items: [
      { to: '/admin/tenants', icon: Building2, label: 'Empresas' },
      { to: '/admin/plans', icon: CreditCard, label: 'Planos' },
      { to: '/admin/financeiro', icon: DollarSign, label: 'Financeiro' },
    ],
  },
  {
    label: 'Gestão',
    items: [
      { to: '/admin/usuarios', icon: Users, label: 'Usuários' },
      { to: '/admin/auditoria', icon: ScrollText, label: 'Auditoria' },
      { to: '/admin/notificacoes', icon: Bell, label: 'Notificações', badgeKey: 'notifications' },
      { to: '/admin/suporte', icon: LifeBuoy, label: 'Suporte', badgeKey: 'support' },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { to: '/admin/seguranca', icon: Shield, label: 'Segurança' },
      { to: '/admin/settings', icon: Settings, label: 'Configurações' },
    ],
  },
];

function NavItemComponent({ item, onClick, externalBadge }: { item: NavItem; onClick?: () => void; externalBadge?: number }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === '/admin'}
      onClick={onClick}
      className={({ isActive }) =>
        `group flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
          isActive
            ? 'bg-white/[0.06] text-white'
            : 'text-[#777] hover:text-[#bbb] hover:bg-white/[0.03]'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span className="flex items-center gap-3">
            <item.icon className={`w-4 h-4 transition-colors ${isActive ? 'text-white' : 'text-[#555] group-hover:text-[#888]'}`} />
            {item.label}
          </span>
          {(item.badge || externalBadge) ? (
            <span className="bg-violet-500/20 text-violet-400 text-xs font-bold px-1.5 py-0.5 rounded-full">
              {item.badge ?? externalBadge}
            </span>
          ) : isActive ? (
            <div className="w-1.5 h-1.5 bg-white rounded-full opacity-60" />
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
    <div className="min-h-screen bg-[#000000] text-white flex font-sans antialiased">

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
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-[#000]/90 border-b border-[#1a1a1a] z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <img src="/logo.svg" alt="Raffros Corteflow" className="h-8 md:h-10 w-auto" />
          <span className="text-[10px] font-bold text-[#555] uppercase tracking-widest ml-1">Platform</span>
        </div>
        <button
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="w-8 h-8 flex items-center justify-center rounded-md text-[#666] hover:text-white hover:bg-[#1a1a1a] transition-colors"
        >
          {isMobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>
      </div>

      {/* ── Sidebar ── */}
      <aside
        className={`
          w-60 flex flex-col fixed h-full z-50 
          bg-[#000000] border-r border-[#111111]
          transition-transform duration-300 ease-in-out
          md:translate-x-0
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-[#111] gap-2.5">
          <img src="/logo.svg" alt="Raffros Corteflow" className="h-12 w-auto flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] text-[#444] font-medium uppercase tracking-widest mt-0.5">Platform Admin</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-widest text-[#333]">
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
        <div className="border-t border-[#111] p-3">
          <div className="flex items-center gap-3 px-3 py-2 mb-1">
            <div className="w-7 h-7 bg-[#1a1a1a] border border-[#2a2a2a] rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-[#888]">
                {firstName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-[#ccc] truncate">{firstName}</p>
              <p className="text-[10px] text-[#444]">Super Admin</p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-[#555] hover:text-red-400 hover:bg-red-500/5 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sair da plataforma
          </button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="flex-1 min-h-screen md:ml-60 flex flex-col">
        {/* Top Header */}
        <header className="sticky top-0 z-30 h-14 bg-[#000]/80 backdrop-blur-xl border-b border-[#111] hidden md:flex items-center justify-between px-8">
          {/* Breadcrumb */}
          <BreadcrumbFromPath />

          {/* Right: greeting */}
          <p className="text-sm text-[#444]">
            {getGreeting()},{' '}
            <span className="text-[#888] font-medium">{firstName}.</span>
          </p>
        </header>

        {/* Page Content */}
        <div className="flex-1 p-6 md:p-8 pt-20 md:pt-8 max-w-screen-2xl">
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
        <footer className="px-8 py-4 border-t border-[#0d0d0d] flex items-center justify-between">
          <p className="text-xs text-[#333]">Raffros Corteflow · Admin Console</p>
          <p className="text-xs text-[#2a2a2a]">v2.0.0</p>
        </footer>
      </main>
    </div>
  );
}

// ── Helper: Dynamic Breadcrumb ──────────────────────────────────────────────
const routeLabels: Record<string, string> = {
  admin: 'Admin',
  tenants: 'Empresas',
  plans: 'Planos',
  financeiro: 'Financeiro',
  usuarios: 'Usuários',
  auditoria: 'Auditoria',
  notificacoes: 'Notificações',
  seguranca: 'Segurança',
  settings: 'Configurações',
  'custom-pricing': 'Preços Customizados',
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
            {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-[#2a2a2a]" />}
            <span className={isLast ? 'text-[#888] font-medium' : 'text-[#333]'}>
              {label}
            </span>
          </span>
        );
      })}
    </nav>
  );
}
