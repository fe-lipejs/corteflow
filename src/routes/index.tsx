import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Middlewares
import RequireAuth from '../middlewares/RequireAuth';
import RequireRole from '../middlewares/RequireRole';

// Public & Auth Pages
import Login from '../pages/Login';
import Cadastro from '../pages/Cadastro';
import LandingPage from '../pages/LandingPage';
import PlaylistPage from '../pages/PlaylistPage';
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
import AdminAnalytics from '../pages/admin/AdminAnalytics';

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
import AdminSuporte from '../pages/admin/AdminSuporte';
import FeatureGate from '../components/FeatureGate';

// ─── Subdomain Detection ──────────────────────────────────────────────────────
type AppMode = 'landing' | 'app' | 'admin' | 'tenant' | 'dev';

function getAppMode(): AppMode {
  const hostname = window.location.hostname;

  // Local development, ngrok, or direct Netlify preview URL (no wildcard custom DNS yet)
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.ngrok.io') ||
    hostname.endsWith('.ngrok-free.app') ||
    hostname.endsWith('.netlify.app')
  ) {
    return 'dev';
  }

  const subdomain = hostname.split('.')[0];

  if (subdomain === 'app') return 'app';
  if (subdomain === 'admin') return 'admin';
  if (hostname === 'raffros.com' || hostname === 'www.raffros.com') return 'landing';
  // Any other subdomain (e.g. kauan-barbearia.raffros.com) → public tenant page
  if (hostname.includes('.raffros.com') && subdomain !== 'www') return 'tenant';

  return 'landing';
}

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
    </>
  );
}

// ─── App Route Tree ───────────────────────────────────────────────────────────
function AppRouteTree() {
  return (
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
      <Route path="change-password" element={<ChangePassword />} />
      <Route path="minha-comissao" element={<MinhaComissao />} />
    </Route>
  );
}

// ─── Admin Route Tree ─────────────────────────────────────────────────────────
function AdminRouteTree() {
  return (
    <Route
      path="/admin"
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
  const mode = getAppMode();

  // ── Tenant subdomain: kauan-barbearia.raffros.com ──
  // Slug comes from the hostname. No /:slug prefix in routes.
  if (mode === 'tenant') {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<PublicStore />} />
          <Route path="/portal" element={<ClientPortal />} />
          <Route path="/sucesso" element={<SuccessBooking />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    );
  }

  // ── app.raffros.com — Painel do dono ──
  if (mode === 'app') {
    return (
      <BrowserRouter>
        <Routes>
          {AuthRoutes()}
          {AppRouteTree()}
          <Route path="/" element={<Navigate to="/app" replace />} />
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
      </BrowserRouter>
    );
  }

  // ── admin.raffros.com — Painel super admin ──
  if (mode === 'admin') {
    return (
      <BrowserRouter>
        <Routes>
          {AuthRoutes()}
          {AdminRouteTree()}
          <Route path="/" element={<Navigate to="/admin" replace />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </BrowserRouter>
    );
  }

  // ── raffros.com — Landing page ──
  if (mode === 'landing') {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/playlist" element={<PlaylistPage />} />
          {AuthRoutes()}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    );
  }

  // ── localhost / ngrok — Dev mode: all routes (original path-based behaviour) ──
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/playlist" element={<PlaylistPage />} />
        {AuthRoutes()}

        {/* Public tenant routes (path-based in dev) */}
        <Route path="/:slug/portal" element={<ClientPortal />} />
        <Route path="/:slug/sucesso" element={<SuccessBooking />} />
        <Route path="/:slug" element={<PublicStore />} />

        {AdminRouteTree()}
        {AppRouteTree()}

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
