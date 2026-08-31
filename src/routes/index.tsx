import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Middlewares
import RequireAuth from '../middlewares/RequireAuth';
import RequireRole from '../middlewares/RequireRole';
import RequirePermission from '../middlewares/RequirePermission';

// Public & Auth Pages
import Login from '../pages/Login';
import Cadastro from '../pages/Cadastro';
import LandingPage from '../pages/LandingPage';
import PlaylistPage from '../pages/PlaylistPage';
import Onboarding from '../pages/Onboarding';
import RedefinirSenha from '../pages/RedefinirSenha';
import SelectTenant from '../pages/SelectTenant';

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
import AdminAnalytics from '../pages/admin/AdminAnalytics';
import AdminSuporte from '../pages/admin/AdminSuporte';
import { AdminHistory } from '../pages/admin/AdminHistory';

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
import ChangePassword from '../pages/app/ChangePassword';
import MinhaComissao from '../pages/app/MinhaComissao';
import MinhaArea from '../pages/app/MinhaArea';
import FeatureGate from '../components/FeatureGate';

// ─── Shared Auth/Onboarding Routes ────────────────────────────────────────────
function AuthRoutes() {
  return (
    <>
      <Route path="/login" element={<Login />} />
      <Route path="/cadastro" element={<Cadastro />} />
      <Route path="/redefinir-senha" element={<RedefinirSenha />} />
      <Route path="/reset-password" element={<RedefinirSenha />} />
      <Route
        path="/onboarding"
        element={
          <RequireAuth>
            <Onboarding />
          </RequireAuth>
        }
      />
      <Route path="/select-tenant" element={<RequireAuth><SelectTenant /></RequireAuth>} />
      <Route path="/admin/senha" element={<RequireAuth><ChangePassword /></RequireAuth>} />
    </>
  );
}

// ─── App Route Tree (Now /admin) ───────────────────────────────────────────────
function AppRouteTree() {
  return (
    <Route
      path="/admin"
      element={
        <RequireAuth>
          <RequireRole allowedRoles={['admin', 'manager', 'professional', 'owner', 'super_admin']}>
            <AppLayout />
          </RequireRole>
        </RequireAuth>
      }
    >
      <Route index element={<Dashboard />} />
      <Route path="agenda" element={
        <RequirePermission modulePrefix="agenda">
          <Agenda />
        </RequirePermission>
      } />
      <Route path="equipe" element={
        <RequirePermission modulePrefix="equipe">
          <Equipe />
        </RequirePermission>
      } />
      <Route path="servicos" element={
        <RequirePermission modulePrefix="catalogo">
          <Servicos />
        </RequirePermission>
      } />
      <Route path="clientes" element={
        <RequirePermission modulePrefix="clientes">
          <Clientes />
        </RequirePermission>
      } />
      <Route path="financeiro" element={
        <RequirePermission modulePrefix="financeiro">
          <Financeiro />
        </RequirePermission>
      } />
      <Route path="configuracoes" element={
        <RequirePermission modulePrefix="configuracoes">
          <Configuracoes />
        </RequirePermission>
      } />
      <Route path="assinatura" element={<Assinatura />} />
      <Route path="suporte" element={<Suporte />} />
      <Route path="minha-comissao" element={<MinhaComissao />} />
      <Route path="minha-area" element={<MinhaArea />} />
    </Route>
  );
}

// ─── Admin Route Tree (Now /platform) ─────────────────────────────────────────
function AdminRouteTree() {
  return (
    <Route
      path="/platform"
      element={
        <RequireAuth>
          <RequireRole allowedRoles={['super_admin']}>
            <AdminLayout />
          </RequireRole>
        </RequireAuth>
      }
    >
      <Route index element={<AdminDashboard />} />
      <Route path="analytics" element={<AdminAnalytics />} />
      <Route path="tenants" element={<AdminTenants />} />
      <Route path="plans" element={<AdminPlans />} />
      <Route path="custom-pricing" element={<AdminCustomPricing />} />
      <Route path="financeiro" element={<AdminFinanceiro />} />
      <Route path="history" element={<AdminHistory />} />
      <Route path="usuarios" element={<AdminUsuarios />} />
      <Route path="auditoria" element={<AdminAuditoria />} />
      <Route path="notificacoes" element={<AdminNotificacoes />} />
      <Route path="seguranca" element={<AdminSeguranca />} />
      <Route path="settings" element={<AdminSettings />} />
      <Route path="suporte" element={<AdminSuporte />} />
    </Route>
  );
}

// ─── Main Router ──────────────────────────────────────────────────────────────
export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/playlist" element={<PlaylistPage />} />
        {AuthRoutes()}
        
        {/* Tenant Admin (Barbearia/Salão) */}
        {AppRouteTree()}

        {/* Super Admin (Dono da Plataforma) */}
        {AdminRouteTree()}

        {/* Public tenant routes (path-based) */}
        <Route path="/:slug/portal" element={<ClientPortal />} />
        <Route path="/:slug/sucesso" element={<SuccessBooking />} />
        <Route path="/:slug" element={<PublicStore />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}



