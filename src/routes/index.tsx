import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Middlewares
import RequireAuth from '../middlewares/RequireAuth';
import RequireRole from '../middlewares/RequireRole';

// Public & Auth Pages
import Login from '../pages/Login';
import Cadastro from '../pages/Cadastro';
import LandingPage from '../pages/LandingPage';
import Onboarding from '../pages/Onboarding';
import RedefinirSenha from '../pages/RedefinirSenha';

// Client Public Pages
import SuccessBooking from '../pages/public/SuccessBooking';
import PublicStore from '../pages/public/PublicStore';
import ClientPortal from '../pages/public/ClientPortal';

// Admin Pages (Super Admin)
import AdminLayout from '../pages/admin/AdminLayout';
import AdminDashboard from '../pages/admin/AdminDashboard';
import AdminTenants from '../pages/admin/AdminTenants';
import AdminSettings from '../pages/admin/AdminSettings';
import AdminPlans from '../pages/admin/AdminPlans';
import AdminCustomPricing from '../pages/admin/AdminCustomPricing';
import AdminFinanceiro from '../pages/admin/AdminFinanceiro';
import AdminUsuarios from '../pages/admin/AdminUsuarios';
import AdminAuditoria from '../pages/admin/AdminAuditoria';
import AdminNotificacoes from '../pages/admin/AdminNotificacoes';
import AdminSeguranca from '../pages/admin/AdminSeguranca';

// App Pages (Tenant Admin/Manager/Professional)
import AppLayout from '../pages/app/AppLayout';
import Dashboard from '../pages/app/Dashboard';
import Agenda from '../pages/app/Agenda';
import Equipe from '../pages/app/Equipe';
import Servicos from '../pages/app/Servicos';
import Clientes from '../pages/app/Clientes';
import Financeiro from '../pages/app/Financeiro';
import Configuracoes from '../pages/app/Configuracoes';
import Assinatura from '../pages/app/Assinatura';
import Suporte from '../pages/app/Suporte';
import AdminSuporte from '../pages/admin/AdminSuporte';
import FeatureGate from '../components/FeatureGate';

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/cadastro" element={<Cadastro />} />
        <Route path="/redefinir-senha" element={<RedefinirSenha />} />
        <Route path="/reset-password" element={<RedefinirSenha />} />

        {/* Onboarding only requires auth, handles role assignment inside */}
        <Route
          path="/onboarding"
          element={
            <RequireAuth>
              <Onboarding />
            </RequireAuth>
          }
        />

        {/* Public routes */}
        <Route path="/:slug/portal" element={<ClientPortal />} />
        <Route path="/:slug/sucesso" element={<SuccessBooking />} />
        <Route path="/:slug" element={<PublicStore />} />

        {/* ── Admin Routes — Super Admin & Platform Owners ── */}
        <Route
          path="/admin"
          element={
            <RequireAuth>
              <RequireRole allowedRoles={['super_admin', 'owner']}>
                <AdminLayout />
              </RequireRole>
            </RequireAuth>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="tenants" element={<AdminTenants />} />
          <Route path="plans" element={<AdminPlans />} />
          <Route path="custom-pricing" element={<AdminCustomPricing />} />
          <Route path="financeiro" element={<AdminFinanceiro />} />
          <Route path="usuarios" element={<AdminUsuarios />} />
          <Route path="auditoria" element={<AdminAuditoria />} />
          <Route path="notificacoes" element={<AdminNotificacoes />} />
          <Route path="seguranca" element={<AdminSeguranca />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="suporte" element={<AdminSuporte />} />
        </Route>

        {/* ── App Routes — Tenant Roles ── */}
        <Route
          path="/app"
          element={
            <RequireAuth>
              <RequireRole allowedRoles={['admin', 'manager', 'professional', 'owner', 'super_admin']}>
                <AppLayout />
              </RequireRole>
            </RequireAuth>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="agenda" element={<FeatureGate modulePrefix="agenda"><Agenda /></FeatureGate>} />
          <Route path="equipe" element={<FeatureGate modulePrefix="equipe"><Equipe /></FeatureGate>} />
          <Route path="servicos" element={<FeatureGate modulePrefix="catalogo"><Servicos /></FeatureGate>} />
          <Route path="clientes" element={<FeatureGate modulePrefix="clientes"><Clientes /></FeatureGate>} />
          <Route path="financeiro" element={<FeatureGate modulePrefix="financeiro"><Financeiro /></FeatureGate>} />
          <Route path="configuracoes" element={<Configuracoes />} />
          <Route path="assinatura" element={<Assinatura />} />
          <Route path="suporte" element={<Suporte />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
