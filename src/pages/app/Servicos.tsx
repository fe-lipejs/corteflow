import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, SlidersHorizontal, Scissors, Package, AlertCircle, Loader2, Crown, Lock, Tag } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../contexts/ThemeContext';
import { usePermissionEngine } from '../../hooks/usePermissionEngine';
import { useServices, useCreateService, useUpdateService, useDeleteService, type Service, type ServiceInput } from '../../hooks/useServices';
import { useProducts, useCreateProduct, useUpdateProduct, useDeleteProduct, type Product, type ProductInput } from '../../hooks/useProducts';
import { supabase } from '../../integrations/supabase/client';
import FeatureGate from '../../components/FeatureGate';
import ServiceCard from './servicos/ServiceCard';
import ServiceModal from './servicos/ServiceModal';
import ProductModal from './servicos/ProductModal';
import { CategoriesManagerModal } from './servicos/CategoriesManagerModal';
import { useCategories } from '../../hooks/useCategories';
import { CardSkeleton, Skeleton } from '../../components/ui/Skeleton';
const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });

export default function Servicos() {
  const { tenant } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const engine = usePermissionEngine();
  const tenantId = tenant?.id ?? '';

  const [activeTab, setActiveTab] = useState<'servicos' | 'produtos'>('servicos');
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [deletingService, setDeletingService] = useState<Service | null>(null);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Todos');
  const [categoriesManagerOpen, setCategoriesManagerOpen] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  // Data
  const { categories, isLoading: loadingCategories } = useCategories(tenantId || null);
  const { data: services = [], isLoading: loadingServices, error: servicesError } = useServices(tenantId || null);
  const { data: products = [], isLoading: loadingProducts } = useProducts(tenantId || null);

  // Mutations
  const createService = useCreateService(tenantId);
  const updateService = useUpdateService(tenantId);
  const deleteService = useDeleteService(tenantId);
  const createProduct = useCreateProduct(tenantId);
  const updateProduct = useUpdateProduct(tenantId);
  const deleteProduct = useDeleteProduct(tenantId);

  const isMutating = createService.isPending || updateService.isPending || deleteService.isPending ||
    createProduct.isPending || updateProduct.isPending || deleteProduct.isPending;

  // Filtered services
  const filteredServices = useMemo(() => {
    let list = [...services];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(s => s.name.toLowerCase().includes(q) || s.category?.toLowerCase().includes(q) || s.tags?.some(t => t.toLowerCase().includes(q)));
    }
    if (categoryFilter !== 'Todos') list = list.filter(s => s.category === categoryFilter);
    return list;
  }, [services, search, categoryFilter]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    let list = [...products];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q) || p.brand?.toLowerCase().includes(q));
    }
    if (categoryFilter !== 'Todos') list = list.filter(p => p.category === categoryFilter);
    return list;
  }, [products, search, categoryFilter]);

  // Stats
  const serviceStats = useMemo(() => ({
    total: services.length,
    active: services.filter(s => s.active).length,
    categories: new Set(services.map(s => s.category)).size,
    avgDuration: services.length ? Math.round(services.reduce((a, s) => a + s.duration_minutes, 0) / services.length) : 0,
  }), [services]);

  const handleSaveService = async (input: ServiceInput) => {
    try {
      setMutationError(null);
      if (editingService) {
        await updateService.mutateAsync({ id: editingService.id, ...input });
      } else {
        await createService.mutateAsync(input);
      }
      setServiceModalOpen(false);
      setEditingService(null);
    } catch (e: any) {
      setMutationError(e?.message ?? 'Erro ao salvar serviço.');
    }
  };

  const handleDeleteServiceConfirm = async () => {
    if (!deletingService) return;
    try {
      await deleteService.mutateAsync({ id: deletingService.id, photoUrl: deletingService.photo_url });
      setDeletingService(null);
    } catch (e: any) {
      setMutationError(e?.message ?? 'Erro ao excluir serviço.');
    }
  };

  const handleSaveProduct = async (input: ProductInput) => {
    try {
      setMutationError(null);
      if (editingProduct) {
        await updateProduct.mutateAsync({ id: editingProduct.id, ...input });
      } else {
        await createProduct.mutateAsync(input);
      }
      setProductModalOpen(false);
      setEditingProduct(null);
    } catch (e: any) {
      setMutationError(e?.message ?? 'Erro ao salvar produto.');
    }
  };

  const handleDeleteProductConfirm = async () => {
    if (!deletingProduct) return;
    try {
      await deleteProduct.mutateAsync({ id: deletingProduct.id, photoUrl: deletingProduct.photo_url });
      setDeletingProduct(null);
    } catch (e: any) {
      setMutationError(e?.message ?? 'Erro ao excluir produto.');
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: theme.textSecondary }}>Catálogo</p>
          <h1 className="font-serif text-3xl font-bold" style={{ color: theme.textPrimary }}>Serviços</h1>
          <p className="text-sm mt-1" style={{ color: theme.textSecondary }}>Gerencie seu catálogo de serviços e produtos.</p>
        </div>
        <button
          onClick={() => {
            if (activeTab === 'servicos') {
              if (!engine.hasPermission('catalogo.criar')) {
                setShowUpgradeModal('Cadastrar Novo Serviço');
                return;
              }
              setEditingService(null);
              setServiceModalOpen(true);
            } else {
              if (!engine.hasPermission('produto.criar') && !engine.hasPermission('catalogo.criar')) {
                setShowUpgradeModal('Cadastrar Novo Produto');
                return;
              }
              setEditingProduct(null);
              setProductModalOpen(true);
            }
            setMutationError(null);
          }}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all hover:opacity-90 cursor-pointer"
          style={{ background: theme.accentGradient, color: theme.btnPrimaryText, boxShadow: theme.shadowAccent }}
        >
          <Plus className="w-5 h-5" />
          {activeTab === 'servicos' ? 'Novo Serviço' : 'Novo Produto'}
        </button>
      </div>

      {/* Stats — Services only */}
      {activeTab === 'servicos' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total', value: serviceStats.total, icon: Scissors, color: theme.accent },
            { label: 'Ativos', value: serviceStats.active, icon: Tag, color: theme.success },
            { label: 'Categorias', value: serviceStats.categories, icon: SlidersHorizontal, color: theme.info },
            { label: 'Duração Média', value: `${serviceStats.avgDuration}min`, icon: Loader2, color: '#a78bfa' },
          ].map(stat => (
            <div key={stat.label} className="rounded-2xl p-4 border flex items-center gap-4 glass-card">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${stat.color}15` }}>
                <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
              </div>
              <div>
                <p className="text-xl font-bold" style={{ color: theme.textPrimary }}>{loadingServices ? '—' : stat.value}</p>
                <p className="text-xs" style={{ color: theme.textSecondary }}>{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error banner */}
      {(servicesError || mutationError) && (
        <div className="flex items-center gap-3 p-4 rounded-xl text-sm" style={{ background: `${theme.error}10`, border: `1px solid ${theme.error}30`, color: theme.error }}>
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{mutationError ?? 'Erro ao carregar dados.'}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl border w-fit glass-card" style={{ borderColor: theme.border }}>
        {(['servicos', 'produtos'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              setCategoryFilter('Todos');
            }}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === tab ? 'shadow' : 'hover:opacity-80'}`}
            style={{
              color: activeTab === tab ? theme.btnPrimaryText : theme.textSecondary,
              background: activeTab === tab ? theme.accentGradient : 'transparent',
            }}
          >
            {tab === 'servicos' ? <Scissors className="w-4 h-4" /> : <Package className="w-4 h-4" />}
            {tab === 'servicos' ? 'Serviços' : 'Produtos'}
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold" style={{ background: activeTab === tab ? 'rgba(0,0,0,0.2)' : theme.cardBg, color: activeTab === tab ? theme.btnPrimaryText : theme.textSecondary }}>
              {tab === 'servicos' ? services.length : products.length}
            </span>
          </button>
        ))}
      </div>

      {/* ── SERVICES TAB ── */}
      {activeTab === 'servicos' && (
        <>
          {/* Search + Category filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: theme.textSecondary }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar serviço, categoria ou tag..." className="w-full rounded-xl text-sm focus:outline-none themed-input themed-input-search" />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none items-center">
              <button onClick={() => setCategoryFilter('Todos')} className="px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap border transition-all"
                style={{
                  color: categoryFilter === 'Todos' ? theme.btnPrimaryText : theme.textSecondary,
                  background: categoryFilter === 'Todos' ? theme.accentGradient : theme.cardBg,
                  borderColor: categoryFilter === 'Todos' ? theme.accent : theme.border,
                }}>
                Todos
              </button>
              {categories.filter(c => c.type === 'service' || c.type === 'both').map(cat => (
                <button key={cat.id} onClick={() => setCategoryFilter(cat.name)} className="px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap border transition-all"
                  style={{
                    color: categoryFilter === cat.name ? theme.btnPrimaryText : theme.textSecondary,
                    background: categoryFilter === cat.name ? theme.accentGradient : theme.cardBg,
                    borderColor: categoryFilter === cat.name ? theme.accent : theme.border,
                  }}>
                  {cat.name}
                </button>
              ))}
              <button
                onClick={() => setCategoriesManagerOpen(true)}
                className="ml-2 flex items-center justify-center p-2 rounded-xl border transition-colors opacity-70 hover:opacity-100 shrink-0"
                style={{ borderColor: theme.border, background: theme.cardBg, color: theme.textPrimary }}
                title="Gerenciar Categorias"
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Loading */}
          {loadingServices && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 mt-6">
              <CardSkeleton count={4} />
            </div>
          )}

          {/* Grid */}
          {!loadingServices && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filteredServices.map(svc => (
                <ServiceCard key={svc.id} service={svc}
                  onEdit={s => {
                    if (!engine.hasPermission('catalogo.editar')) {
                      setShowUpgradeModal('Editar Serviço');
                      return;
                    }
                    setEditingService(s);
                    setServiceModalOpen(true);
                    setMutationError(null);
                  }}
                  onDelete={s => {
                    if (!engine.hasPermission('catalogo.excluir')) {
                      setShowUpgradeModal('Excluir Serviço');
                      return;
                    }
                    setDeletingService(s);
                  }}
                />
              ))}

              {/* Empty state */}
              {filteredServices.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 border glass-card" style={{ borderColor: theme.border }}>
                    <Scissors className="w-8 h-8 opacity-50" style={{ color: theme.textSecondary }} />
                  </div>
                  {search || categoryFilter !== 'Todos' ? (
                    <><p className="font-semibold mb-1" style={{ color: theme.textPrimary }}>Nenhum resultado</p><p className="text-sm" style={{ color: theme.textSecondary }}>Tente ajustar os filtros.</p></>
                  ) : (
                    <><p className="font-semibold mb-2" style={{ color: theme.textPrimary }}>Nenhum serviço cadastrado</p>
                      <p className="text-sm mb-5" style={{ color: theme.textSecondary }}>Crie o primeiro serviço do seu catálogo.</p>
                      <button onClick={() => {
                        if (!engine.hasPermission('catalogo.criar')) {
                          setShowUpgradeModal('Criar Serviço');
                          return;
                        }
                        setServiceModalOpen(true);
                      }} className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold" style={{ background: theme.accentGradient, color: theme.btnPrimaryText }}>
                        <Plus className="w-5 h-5" /> Criar Serviço
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Add shortcut card */}
              {filteredServices.length > 0 && (
                <div onClick={() => {
                  if (!engine.hasPermission('catalogo.criar')) {
                    setShowUpgradeModal('Criar Novo Serviço');
                    return;
                  }
                  setEditingService(null);
                  setServiceModalOpen(true);
                }} className="rounded-2xl border-2 border-dashed flex items-center justify-center cursor-pointer transition-all hover:-translate-y-1 group" style={{ minHeight: '260px', borderColor: theme.border, background: theme.inputBg }}>
                  <div className="text-center">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3 transition-all" style={{ background: theme.accentMuted, color: theme.accent }}><Plus className="w-5 h-5" /></div>
                    <p className="text-sm font-semibold transition-colors" style={{ color: theme.accent }}>Novo serviço</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── PRODUCTS TAB ── */}
      {activeTab === 'produtos' && (
        <FeatureGate modulePrefix="produto" message="O módulo de produtos e estoque é exclusivo de planos superiores. Faça upgrade para cadastrar e gerenciar produtos.">
        <div className="relative space-y-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: theme.textSecondary }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar produto, categoria ou marca..." className="w-full rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-none themed-input" />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none items-center">
              <button onClick={() => setCategoryFilter('Todos')} className="px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap border transition-all"
                style={{
                  color: categoryFilter === 'Todos' ? theme.btnPrimaryText : theme.textSecondary,
                  background: categoryFilter === 'Todos' ? theme.accentGradient : theme.cardBg,
                  borderColor: categoryFilter === 'Todos' ? theme.accent : theme.border,
                }}>
                Todos
              </button>
              {categories.filter(c => c.type === 'product' || c.type === 'both').map(cat => (
                <button key={cat.id} onClick={() => setCategoryFilter(cat.name)} className="px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap border transition-all"
                  style={{
                    color: categoryFilter === cat.name ? theme.btnPrimaryText : theme.textSecondary,
                    background: categoryFilter === cat.name ? theme.accentGradient : theme.cardBg,
                    borderColor: categoryFilter === cat.name ? theme.accent : theme.border,
                  }}>
                  {cat.name}
                </button>
              ))}
              <button
                onClick={() => setCategoriesManagerOpen(true)}
                className="ml-2 flex items-center justify-center p-2 rounded-xl border transition-colors opacity-70 hover:opacity-100 shrink-0"
                style={{ borderColor: theme.border, background: theme.cardBg, color: theme.textPrimary }}
                title="Gerenciar Categorias"
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>
            </div>
          </div>
          {/* Products list */}
          <div className="space-y-3">
            {loadingProducts && (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4 rounded-2xl border glass-card" style={{ borderColor: theme.border, background: theme.cardBg }}>
                  <Skeleton className="w-14 h-14 rounded-xl shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                </div>
              ))
            )}
            {!loadingProducts && filteredProducts.map(p => (
              <div key={p.id} className="flex items-center gap-4 p-4 rounded-2xl border transition-all hover:-translate-y-0.5 glass-card" style={{ borderColor: theme.border }}>
                <div className="w-14 h-14 rounded-xl overflow-hidden flex items-center justify-center shrink-0" style={{ background: theme.inputBg }}>
                  {p.photo_url ? <img src={p.photo_url} alt={p.name} className="w-full h-full object-cover" /> : <Package className="w-6 h-6 opacity-40" style={{ color: theme.textSecondary }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm" style={{ color: theme.textPrimary }}>{p.name}</p>
                  <p className="text-xs" style={{ color: theme.textSecondary }}>{p.category} {p.brand && `· ${p.brand}`}</p>
                  <p className="text-xs mt-0.5" style={{ color: theme.textSecondary }}>Estoque: <span className={p.stock <= p.min_stock && p.min_stock > 0 ? 'font-bold' : ''} style={{ color: p.stock <= p.min_stock && p.min_stock > 0 ? theme.warning : theme.textPrimary }}>{p.stock} un</span></p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold" style={{ color: theme.accent }}>{fmt.format(p.price)}</p>
                  {p.promo_price && <p className="text-xs line-through" style={{ color: theme.textSecondary }}>{fmt.format(p.promo_price)}</p>}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => {
                    if (!engine.hasPermission('produto.editar') && !engine.hasPermission('catalogo.editar')) {
                      setShowUpgradeModal('Editar Produto');
                      return;
                    }
                    setEditingProduct(p);
                    setProductModalOpen(true);
                  }} className="text-xs px-3 py-1.5 rounded-lg transition-all hover:bg-[var(--theme-bg-hover)] cursor-pointer" style={{ color: theme.textSecondary }}>Editar</button>
                  <button onClick={() => {
                    if (!engine.hasPermission('produto.excluir') && !engine.hasPermission('catalogo.excluir')) {
                      setShowUpgradeModal('Excluir Produto');
                      return;
                    }
                    setDeletingProduct(p);
                  }} className="text-xs px-3 py-1.5 rounded-lg transition-all cursor-pointer" style={{ color: theme.error, background: `${theme.error}10` }}>Excluir</button>
                </div>
              </div>
            ))}
            {filteredProducts.length === 0 && !loadingProducts && (
              <div className="text-center py-20">
                <Package className="w-12 h-12 mx-auto mb-4 opacity-30" style={{ color: theme.textSecondary }} />
                <p className="font-semibold mb-2" style={{ color: theme.textPrimary }}>Nenhum produto cadastrado</p>
                <p className="text-sm mb-5" style={{ color: theme.textSecondary }}>Controle seu estoque de produtos.</p>
                <button onClick={() => {
                  if (!engine.hasPermission('produto.criar') && !engine.hasPermission('catalogo.criar')) {
                    setShowUpgradeModal('Cadastrar Novo Produto');
                    return;
                  }
                  setEditingProduct(null);
                  setProductModalOpen(true);
                }} className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold mx-auto cursor-pointer" style={{ background: theme.accentGradient, color: theme.btnPrimaryText }}>
                  <Plus className="w-5 h-5" /> Criar Produto
                </button>
              </div>
            )}
          </div>
        </div>
        </FeatureGate>
      )}

      {/* ── Service Modal ── */}
      {serviceModalOpen && (
        <ServiceModal
          service={editingService}
          tenantId={tenantId}
          onClose={() => { setServiceModalOpen(false); setEditingService(null); }}
          onSave={handleSaveService}
          isLoading={createService.isPending || updateService.isPending}
        />
      )}

      {/* ── Product Modal ── */}
      {productModalOpen && (
        <ProductModal
          product={editingProduct}
          tenantId={tenantId}
          onClose={() => { setProductModalOpen(false); setEditingProduct(null); }}
          onSave={handleSaveProduct}
          isLoading={createProduct.isPending || updateProduct.isPending}
        />
      )}

      {/* ── Categories Manager ── */}
      <CategoriesManagerModal
        tenantId={tenantId}
        isOpen={categoriesManagerOpen}
        onClose={() => setCategoriesManagerOpen(false)}
      />

      {/* ── Delete Service Confirm ── */}
      {deletingService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="border rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl glass-card" style={{ borderColor: theme.border }}>
            <AlertCircle className="w-10 h-10 mx-auto mb-4" style={{ color: theme.error }} />
            <h3 className="font-serif text-xl font-bold mb-2" style={{ color: theme.textPrimary }}>Excluir Serviço?</h3>
            <p className="text-sm mb-7" style={{ color: theme.textSecondary }}><strong style={{ color: theme.textPrimary }}>{deletingService.name}</strong> será removido permanentemente.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeletingService(null)} className="flex-1 py-3 rounded-xl border font-semibold text-sm transition-all hover:bg-[var(--theme-bg-hover)]" style={{ borderColor: theme.border, color: theme.textPrimary }}>Cancelar</button>
              <button onClick={handleDeleteServiceConfirm} disabled={deleteService.isPending} className="flex-1 py-3 rounded-xl font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2 text-white" style={{ background: theme.error }}>
                {deleteService.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Excluindo...</> : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Product Confirm ── */}
      {deletingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="border rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl glass-card" style={{ borderColor: theme.border }}>
            <AlertCircle className="w-10 h-10 mx-auto mb-4" style={{ color: theme.error }} />
            <h3 className="font-serif text-xl font-bold mb-2" style={{ color: theme.textPrimary }}>Excluir Produto?</h3>
            <p className="text-sm mb-7" style={{ color: theme.textSecondary }}><strong style={{ color: theme.textPrimary }}>{deletingProduct.name}</strong> será removido permanentemente.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeletingProduct(null)} className="flex-1 py-3 rounded-xl border font-semibold text-sm transition-all hover:bg-[var(--theme-bg-hover)]" style={{ borderColor: theme.border, color: theme.textPrimary }}>Cancelar</button>
              <button onClick={handleDeleteProductConfirm} disabled={deleteProduct.isPending} className="flex-1 py-3 rounded-xl font-bold text-sm disabled:opacity-50 text-white" style={{ background: theme.error }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
      {/* ── Modal: Upgrade Plan ── */}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md">
          <div className="border rounded-3xl p-8 max-w-sm w-full text-center shadow-[0_0_80px_rgba(0,0,0,0.5)] ring-1 ring-white/10 glass-card animate-scale-in" style={{ borderColor: theme.border, background: theme.cardBg }}>
            <div className="relative mb-6">
              <div className="relative w-20 h-20 mx-auto bg-black border rounded-full flex items-center justify-center" style={{ borderColor: theme.accent }}>
                <Crown className="w-10 h-10" style={{ color: theme.accent }} />
                <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full border-2 flex items-center justify-center" style={{ background: theme.cardBg, borderColor: theme.border }}>
                  <Lock className="w-4 h-4" style={{ color: theme.textSecondary }} />
                </div>
              </div>
            </div>

            <h3 className="font-bold text-xl mb-2" style={{ color: theme.textPrimary }}>
              Recurso Premium
            </h3>
            <p className="text-sm mb-6" style={{ color: theme.textSecondary }}>
              A funcionalidade de <strong>{showUpgradeModal}</strong> é exclusiva de planos superiores. Faça o upgrade para desbloquear o acesso total.
            </p>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => navigate('/admin/assinatura')}
                className="w-full py-3.5 px-4 rounded-xl font-bold text-sm transition-all shadow-lg hover:opacity-90"
                style={{ background: theme.accentGradient, color: theme.btnPrimaryText }}
              >
                Ver planos
              </button>
              <button
                type="button"
                onClick={() => setShowUpgradeModal(null)}
                className="w-full py-2 text-xs font-semibold hover:underline"
                style={{ color: theme.textSecondary }}
              >
                Agora não
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

