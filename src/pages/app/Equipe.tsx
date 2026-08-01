import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Crown, Users, CheckCircle, Palmtree, XCircle, SlidersHorizontal, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../contexts/ThemeContext';
import {
  useProfessionals,
  useServices,
  useCreateProfessional,
  useUpdateProfessional,
  useDeleteProfessional,
  type CreateProfessionalInput,
  type UpdateProfessionalInput,
} from '../../hooks/useProfessionals';
import type { Professional } from '../../types/database';
import ProfessionalCard from './equipe/ProfessionalCard';
import ProfessionalModal from './equipe/ProfessionalModal';
import { CardSkeleton } from '../../components/ui/Skeleton';

// ─── Sort options ─────────────────────────────────────────────────────────────
type SortKey = 'name_asc' | 'name_desc' | 'newest' | 'oldest' | 'status';

export default function Equipe() {
  const { tenant } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const tenantId = tenant?.id ?? '';

  // ── Data fetching ──────────────────────────────────────────────────────────
  const { data: professionals = [], isLoading, error } = useProfessionals(tenantId || null);
  const { data: services = [] } = useServices(tenantId || null);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createMutation = useCreateProfessional(tenantId);
  const updateMutation = useUpdateProfessional(tenantId);
  const deleteMutation = useDeleteProfessional(tenantId);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPro, setEditingPro] = useState<Professional | null>(null);
  const [deletingPro, setDeletingPro] = useState<Professional | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('newest');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [mutationError, setMutationError] = useState<string | null>(null);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total: professionals.length,
    active: professionals.filter(p => p.status === 'active').length,
    vacation: professionals.filter(p => p.status === 'vacation').length,
    inactive: professionals.filter(p => p.status === 'inactive' || p.status === 'leave').length,
  }), [professionals]);

  // ── Filtered + sorted list ─────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...professionals];

    // Text search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.phone?.toLowerCase().includes(q) ||
        p.instagram?.toLowerCase().includes(q) ||
        p.role_title?.toLowerCase().includes(q) ||
        p.specialties?.some(s => s.toLowerCase().includes(q))
      );
    }

    // Status filter
    if (filterStatus !== 'all') {
      list = list.filter(p => p.status === filterStatus);
    }

    // Sort
    switch (sortKey) {
      case 'name_asc': list.sort((a, b) => a.name.localeCompare(b.name)); break;
      case 'name_desc': list.sort((a, b) => b.name.localeCompare(a.name)); break;
      case 'newest': list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()); break;
      case 'oldest': list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()); break;
      case 'status': list.sort((a, b) => a.status.localeCompare(b.status)); break;
    }

    return list;
  }, [professionals, search, filterStatus, sortKey]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleNewClick = () => {
    setEditingPro(null);
    setModalOpen(true);
    setMutationError(null);
  };

  const handleEdit = (p: Professional) => {
    setEditingPro(p);
    setModalOpen(true);
    setMutationError(null);
  };

  const handleCreate = async (input: CreateProfessionalInput) => {
    try {
      setMutationError(null);
      await createMutation.mutateAsync(input);
      setModalOpen(false);
    } catch (e: any) {
      setMutationError(e?.message ?? 'Erro ao criar profissional.');
    }
  };

  const handleUpdate = async (input: UpdateProfessionalInput) => {
    try {
      setMutationError(null);
      await updateMutation.mutateAsync(input);
      setModalOpen(false);
      setEditingPro(null);
    } catch (e: any) {
      setMutationError(e?.message ?? 'Erro ao atualizar profissional.');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingPro) return;
    try {
      await deleteMutation.mutateAsync({ id: deletingPro.id, photoUrl: deletingPro.photo_url });
      setDeletingPro(null);
    } catch (e: any) {
      setMutationError(e?.message ?? 'Erro ao excluir profissional.');
      setDeletingPro(null);
    }
  };

  const handleViewAgenda = (p: Professional) => {
    navigate(`/app/agenda?professional=${p.id}`);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-12 animate-fade-in">

      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: theme.textSecondary }}>Gestão</p>
          <h1 className="font-serif text-3xl font-bold" style={{ color: theme.textPrimary }}>Equipe</h1>
          <p className="text-sm mt-1" style={{ color: theme.textSecondary }}>Gerencie os profissionais do seu salão.</p>
        </div>
        <button
          onClick={handleNewClick}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all shadow-[0_0_20px_rgba(201,150,59,0.2)] hover:shadow-[0_0_30px_rgba(201,150,59,0.35)] hover:-translate-y-0.5"
          style={{ background: theme.accentGradient, color: theme.btnPrimaryText, boxShadow: theme.shadowAccent }}
        >
          <Plus className="w-5 h-5" /> Novo Profissional
        </button>
      </div>

      {/* ── Stats Dashboard ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: stats.total, icon: Users, color: theme.accent, bg: `${theme.accent}15` },
          { label: 'Ativos', value: stats.active, icon: CheckCircle, color: theme.success, bg: `${theme.success}15` },
          { label: 'Férias', value: stats.vacation, icon: Palmtree, color: theme.warning, bg: `${theme.warning}15` },
          { label: 'Inativos', value: stats.inactive, icon: XCircle, color: theme.error, bg: `${theme.error}15` },
        ].map(stat => (
          <div
            key={stat.label}
            className="rounded-2xl p-4 border flex items-center gap-4 glass-card"
          >
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: stat.bg }}>
              <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: theme.textPrimary }}>{isLoading ? '—' : stat.value}</p>
              <p className="text-xs" style={{ color: theme.textSecondary }}>{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Search & Filters ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: theme.textSecondary }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome, cargo, especialidade, telefone..."
            className="w-full rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-none themed-input"
          />
        </div>

        <div className="flex gap-2">
          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="rounded-xl px-3 py-3 text-sm focus:outline-none themed-input"
          >
            <option value="all">Todos os status</option>
            <option value="active">Ativos</option>
            <option value="vacation">Férias</option>
            <option value="leave">Afastados</option>
            <option value="inactive">Inativos</option>
          </select>

          {/* Sort */}
          <div className="relative">
            <select
              value={sortKey}
              onChange={e => setSortKey(e.target.value as SortKey)}
              className="rounded-xl pl-10 pr-3 py-3 text-sm focus:outline-none appearance-none cursor-pointer themed-input"
            >
              <option value="newest">Mais recente</option>
              <option value="oldest">Mais antigo</option>
              <option value="name_asc">Nome A–Z</option>
              <option value="name_desc">Nome Z–A</option>
              <option value="status">Status</option>
            </select>
            <SlidersHorizontal className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: theme.textSecondary }} />
          </div>
        </div>
      </div>

      {/* ── Error Banner ── */}
      {(error || mutationError) && (
        <div className="flex items-center gap-3 p-4 rounded-xl text-sm" style={{ background: `${theme.error}10`, border: `1px solid ${theme.error}30`, color: theme.error }}>
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{mutationError ?? 'Erro ao carregar profissionais. Tente novamente.'}</span>
        </div>
      )}

      {/* ── Loading ── */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          <CardSkeleton count={4} />
        </div>
      )}

      {/* ── Grid ── */}
      {!isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map(pro => (
            <ProfessionalCard
              key={pro.id}
              professional={pro}
              onEdit={handleEdit}
              onDelete={setDeletingPro}
              onViewAgenda={handleViewAgenda}
            />
          ))}

          {/* Empty state */}
          {filtered.length === 0 && !isLoading && (
            <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 border glass-card" style={{ borderColor: theme.border }}>
                <Users className="w-8 h-8 opacity-50" style={{ color: theme.textSecondary }} />
              </div>
              {search || filterStatus !== 'all' ? (
                <>
                  <p className="font-semibold mb-2" style={{ color: theme.textPrimary }}>Nenhum resultado encontrado</p>
                  <p className="text-sm" style={{ color: theme.textSecondary }}>Tente ajustar os filtros de busca.</p>
                </>
              ) : (
                <>
                  <p className="font-semibold mb-2" style={{ color: theme.textPrimary }}>Sua equipe está vazia</p>
                  <p className="text-sm mb-5" style={{ color: theme.textSecondary }}>Adicione o primeiro profissional do seu salão.</p>
                  <button
                    onClick={handleNewClick}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all shadow-[0_0_20px_rgba(201,150,59,0.2)] hover:shadow-[0_0_30px_rgba(201,150,59,0.35)]"
                    style={{ background: theme.accentGradient, color: theme.btnPrimaryText, boxShadow: theme.shadowAccent }}
                  >
                    <Plus className="w-5 h-5" /> Adicionar Profissional
                  </button>
                </>
              )}
            </div>
          )}

          {/* Add card shortcut */}
          {filtered.length > 0 && (
            <div
              onClick={handleNewClick}
              className="rounded-2xl p-5 border-2 border-dashed flex items-center justify-center cursor-pointer transition-all hover:-translate-y-1 group"
              style={{ minHeight: '200px', borderColor: theme.border, background: theme.inputBg }}
            >
              <div className="text-center">
                <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3 transition-all" style={{ background: theme.accentMuted, color: theme.accent }}>
                  <Plus className="w-5 h-5" />
                </div>
                <p className="text-sm font-semibold transition-colors" style={{ color: theme.accent }}>
                  Adicionar profissional
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Modal: Create / Edit ── */}
      {modalOpen && (
        <ProfessionalModal
          professional={editingPro}
          services={services}
          tenantId={tenantId}
          onClose={() => { setModalOpen(false); setEditingPro(null); setMutationError(null); }}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      )}

      {/* ── Modal: Delete Confirmation ── */}
      {deletingPro && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="border rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl glass-card" style={{ borderColor: theme.border }}>
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: `${theme.error}10`, color: theme.error }}>
              <AlertCircle className="w-7 h-7" />
            </div>
            <h3 className="font-serif text-xl font-bold mb-2" style={{ color: theme.textPrimary }}>Excluir Profissional?</h3>
            <p className="text-sm mb-7" style={{ color: theme.textSecondary }}>
              <strong style={{ color: theme.textPrimary }}>{deletingPro.name}</strong> será removido permanentemente, incluindo sua foto e jornada de trabalho. Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingPro(null)}
                className="flex-1 py-3 rounded-xl border font-semibold text-sm transition-all hover:bg-[var(--theme-bg-hover)]"
                style={{ borderColor: theme.border, color: theme.textPrimary }}
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleteMutation.isPending}
                className="flex-1 py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-white"
                style={{ background: theme.error }}
              >
                {deleteMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Excluindo...</> : 'Confirmar Exclusão'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Upgrade Plan ── */}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="border rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl glass-card" style={{ borderColor: theme.border }}>
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: theme.accentMuted, color: theme.accent }}>
              <Crown className="w-7 h-7" />
            </div>
            <h3 className="font-serif text-2xl font-bold mb-2" style={{ color: theme.textPrimary }}>Upgrade para Growth</h3>
            <p className="text-sm mb-7" style={{ color: theme.textSecondary }}>
              O plano Starter permite 1 profissional. Faça upgrade para adicionar toda sua equipe sem limites.
            </p>
            <button
              onClick={() => { setShowUpgradeModal(false); navigate('/app/assinatura'); }}
              className="w-full py-3 rounded-xl mb-3 font-bold transition-all shadow-[0_0_20px_rgba(201,150,59,0.2)] hover:shadow-[0_0_30px_rgba(201,150,59,0.4)]"
              style={{ background: theme.accentGradient, color: theme.btnPrimaryText, boxShadow: theme.shadowAccent }}
            >
              Ver planos
            </button>
            <button className="text-sm w-full py-2 transition-colors hover:underline" style={{ color: theme.textSecondary }} onClick={() => setShowUpgradeModal(false)}>
              Agora não
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
