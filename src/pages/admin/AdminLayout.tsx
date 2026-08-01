import { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, Store, Settings, LogOut, Shield, Menu, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

export default function AdminLayout() {
  const { signOut } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Bom dia';
    if (hour >= 12 && hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const navItems = [
    { to: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/admin/tenants', icon: Store, label: 'Salões' },
    { to: '/admin/settings', icon: Settings, label: 'Configurações' },
  ];

  return (
    <div className="min-h-screen bg-[#1A1714] text-zinc-50 flex font-sans">
      
      {/* Mobile Top Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-[#1A1714]/80 backdrop-blur-xl border-b border-[#2A2520] z-30 flex items-center justify-between px-4">
        <div className="flex items-center text-white">
          <Shield className="w-5 h-5 mr-2 text-[#C9963B]" />
          <span className="font-bold tracking-wide text-sm">NAVALHA ADMIN</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-zinc-400 hover:text-white p-2">
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Overlay for mobile */}
      {isMobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/60 z-20 backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`w-64 bg-[#1A1714]/80 backdrop-blur-xl border-r border-[#2A2520] flex flex-col fixed h-full z-30 transition-transform duration-300 md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="h-16 hidden md:flex items-center px-6 border-b border-[#2A2520] text-white">
          <Shield className="w-5 h-5 mr-3 text-[#C9963B]" />
          <span className="font-bold tracking-wide">NAVALHA ADMIN</span>
        </div>
        
        {/* Mobile Spacer */}
        <div className="md:hidden h-16 flex items-center px-6 border-b border-[#2A2520] text-white">
          <span className="font-bold">Menu</span>
        </div>
        
        <nav className="flex-1 py-6 px-4 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/admin'}
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) => 
                `flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all ${
                  isActive ? 'bg-[#C9963B] text-[#1A1714] shadow-[0_0_15px_rgba(201,150,59,0.2)] font-bold' : 'text-[#A09888] hover:bg-[#1E1B17] hover:text-white'
                }`
              }
            >
              <item.icon className={`w-5 h-5 mr-3 transition-colors`} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-[#2A2520]">
          <button 
            onClick={signOut}
            className="flex items-center w-full px-4 py-3 text-sm font-medium rounded-xl text-[#A09888] hover:bg-red-500/10 hover:text-red-500 transition-colors"
          >
            <LogOut className="w-5 h-5 mr-3" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative pt-16 md:pt-0 md:ml-64 transition-all">
        {/* Subtle background glow effect */}
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#C9963B]/5 blur-[120px] rounded-full pointer-events-none" />
        
        <header className="h-20 border-b border-[#2A2520] hidden md:flex items-center px-8 bg-[#1A1714]/80 backdrop-blur-md sticky top-0 z-20">
          <h1 className="text-2xl font-serif font-bold text-white tracking-tight">
            {getGreeting()}, <span className="text-[#C9963B]">plataforma.</span>
          </h1>
        </header>
        <div className="p-4 md:p-8 max-w-7xl relative z-10 overflow-x-hidden">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
