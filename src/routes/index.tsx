import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Login from '../pages/Login';
import Cadastro from '../pages/Cadastro';
import LandingPage from '../pages/LandingPage';
import Onboarding from '../pages/Onboarding';
import SuccessBooking from '../pages/public/SuccessBooking';
import AdminLayout from '../pages/admin/AdminLayout';
import AdminDashboard from '../pages/admin/AdminDashboard';
import AdminTenants from '../pages/admin/AdminTenants';
import AdminSettings from '../pages/admin/AdminSettings';
import PublicStore from '../pages/public/PublicStore';
import ClientPortal from '../pages/public/ClientPortal';

import AppLayout from '../pages/app/AppLayout';
import Dashboard from '../pages/app/Dashboard';
import Agenda from '../pages/app/Agenda';
import Equipe from '../pages/app/Equipe';
import Servicos from '../pages/app/Servicos';
import Clientes from '../pages/app/Clientes';
import Financeiro from '../pages/app/Financeiro';
import Configuracoes from '../pages/app/Configuracoes';
import Assinatura from '../pages/app/Assinatura';

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode, allowedRoles?: string[] }) => {
  const { user, role, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Se o usuário está logado mas não tem role/tenant (é órfão), mandamos pro onboarding
  // a menos que ele já esteja indo pro admin (super admin não é órfão)
  if (allowedRoles && !role) {
    return <Navigate to="/onboarding" replace />;
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return <Navigate to="/app" replace />;
  }

  return <>{children}</>;
};

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/cadastro" element={<Cadastro />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/:slug/portal" element={<ClientPortal />} />
        <Route path="/:slug/sucesso" element={<SuccessBooking />} />
        <Route path="/:slug" element={<PublicStore />} />
        
        {/* Admin Routes - Super Admin Only */}
        <Route 
          path="/admin" 
          element={
            <ProtectedRoute allowedRoles={['super_admin']}>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="tenants" element={<AdminTenants />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>

        {/* App Routes - Owner */}
        <Route 
          path="/app" 
          element={
            <ProtectedRoute allowedRoles={['owner', 'professional']}>
              <AppLayout />
            </ProtectedRoute>
          } 
        >
          <Route index element={<Dashboard />} />
          <Route path="agenda" element={<Agenda />} />
          <Route path="equipe" element={<Equipe />} />
          <Route path="servicos" element={<Servicos />} />
          <Route path="clientes" element={<Clientes />} />
          <Route path="financeiro" element={<Financeiro />} />
          <Route path="configuracoes" element={<Configuracoes />} />
          <Route path="assinatura" element={<Assinatura />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
