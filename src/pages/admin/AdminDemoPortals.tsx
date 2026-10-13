import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Plus,
  Copy,
  ExternalLink,
  Eye,
  Trash2,
  Calendar,
  Clock,
  Phone,
  Search,
  Check,
  X,
  Upload,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  Scissors,
  UserCheck,
  Palette,
  ShieldAlert,
  Loader2,
  Pencil,
  Image as ImageIcon,
  Camera,
} from 'lucide-react';
import toast from 'react-hot-toast';
import AdminPageHeader from './components/AdminPageHeader';
import AdminBadge from './components/AdminBadge';
import AdminEmptyState from './components/AdminEmptyState';
import { AdminTableSkeleton } from './components/AdminSkeleton';
import { demoPortalsService } from '../../services/demoPortalsService';
import type { DemoPortal, DemoService, DemoProfessional, CreateDemoPortalInput } from '../../types/demoPortal';

const COLOR_PRESETS = [
  { name: 'Laranja Padrão', hex: '#FD6500' },
  { name: 'Dourado Navalha', hex: '#D4AF37' },
  { name: 'Esmeralda', hex: '#10B981' },
  { name: 'Âmbar Solar', hex: '#F59E0B' },
  { name: 'Azul Real', hex: '#3B82F6' },
  { name: 'Roxo Premium', hex: '#8B5CF6' },
  { name: 'Rubi Moderno', hex: '#EF4444' },
];

interface ServiceItemState {
  id?: string;
  name: string;
  price: number;
  duration_minutes: number;
  photo_url?: string | null;
}

interface ProfessionalItemState {
  id?: string;
  name: string;
  photo_url?: string | null;
  role_title?: string;
}

export default function AdminDemoPortals() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'expired'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDemo, setEditingDemo] = useState<DemoPortal | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [createdDemo, setCreatedDemo] = useState<DemoPortal | null>(null);

  // Form State
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState<'barbearia' | 'salao' | 'esmalteria'>('barbearia');
  const [ownerWhatsapp, setOwnerWhatsapp] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#FD6500');
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [logoUrl, setLogoUrl] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [customSlug, setCustomSlug] = useState('');
  const [isCustomSlugEdited, setIsCustomSlugEdited] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [uploadingServiceIndex, setUploadingServiceIndex] = useState<number | null>(null);
  const [uploadingProIndex, setUploadingProIndex] = useState<number | null>(null);

  const [services, setServices] = useState<ServiceItemState[]>([
    { name: 'Corte Degradê & Navalha', price: 45, duration_minutes: 40, photo_url: null },
    { name: 'Barboterapia Completa', price: 35, duration_minutes: 30, photo_url: null },
    { name: 'Combo Cabelo + Barba', price: 70, duration_minutes: 60, photo_url: null },
  ]);

  const [professionals, setProfessionals] = useState<ProfessionalItemState[]>([
    { name: 'João Mestre Barbeiro', photo_url: null, role_title: 'Barbeiro' },
    { name: 'Carlos Especialista', photo_url: null, role_title: 'Barbeiro' },
  ]);

  // Query: listar todos os demos
  const { data: demos = [], isLoading } = useQuery({
    queryKey: ['admin_demo_portals'],
    queryFn: () => demoPortalsService.listAll(),
  });

  // Mutation: Criar Demo
  const createMutation = useMutation({
    mutationFn: (input: CreateDemoPortalInput) => demoPortalsService.create(input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin_demo_portals'] });
      setCreatedDemo(data);
      resetForm();
      setIsModalOpen(false);
      toast.success('Portal de demonstração criado! Abrindo em nova aba...');
      window.open(`/paginas/${data.slug}`, '_blank');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Erro ao criar portal de demonstração');
    },
  });

  // Mutation: Atualizar Demo Existente (incluindo serviços e profissionais)
  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<DemoPortal> }) =>
      demoPortalsService.update(id, updates),
    onSuccess: (data) => {
      const slug = data?.slug || editingDemo?.slug;
      queryClient.invalidateQueries({ queryKey: ['admin_demo_portals'] });
      setIsModalOpen(false);
      setEditingDemo(null);
      resetForm();
      toast.success('Portal demo atualizado com sucesso! Abrindo em nova aba...');
      if (slug) {
        window.open(`/paginas/${slug}`, '_blank');
      }
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Erro ao atualizar portal demo');
    },
  });

  // Mutation: Toggle Ativo/Inativo
  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      demoPortalsService.update(id, { active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_demo_portals'] });
      toast.success('Status do portal atualizado!');
    },
    onError: () => toast.error('Erro ao atualizar status do portal'),
  });

  // Mutation: Excluir Demo
  const deleteMutation = useMutation({
    mutationFn: (id: string) => demoPortalsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_demo_portals'] });
      setDeleteConfirmId(null);
      toast.success('Portal demo excluído instantaneamente!');
    },
    onError: () => toast.error('Erro ao excluir portal demo'),
  });

  function resetForm() {
    setEditingDemo(null);
    setBusinessName('');
    setBusinessType('barbearia');
    setOwnerWhatsapp('');
    setPrimaryColor('#FD6500');
    setExpiresInDays(7);
    setLogoUrl('');
    setBannerUrl('');
    setCustomSlug('');
    setIsCustomSlugEdited(false);
    setServices([
      { name: 'Corte Degradê & Navalha', price: 45, duration_minutes: 40, photo_url: null },
      { name: 'Barboterapia Completa', price: 35, duration_minutes: 30, photo_url: null },
      { name: 'Combo Cabelo + Barba', price: 70, duration_minutes: 60, photo_url: null },
    ]);
    setProfessionals([
      { name: 'João Mestre Barbeiro', photo_url: null, role_title: 'Barbeiro' },
      { name: 'Carlos Especialista', photo_url: null, role_title: 'Barbeiro' },
    ]);
  }

  function handleOpenCreate() {
    resetForm();
    setCreatedDemo(null);
    setIsModalOpen(true);
  }

  function handleOpenEdit(demo: DemoPortal) {
    setEditingDemo(demo);
    setBusinessName(demo.business_name);
    setBusinessType((demo.business_type as any) || 'barbearia');
    setOwnerWhatsapp(demo.owner_whatsapp);
    setPrimaryColor(demo.primary_color || '#FD6500');
    setLogoUrl(demo.logo_url || '');
    setBannerUrl(demo.banner_url || '');
    setCustomSlug(demo.slug || '');
    setIsCustomSlugEdited(true);

    // Calcular dias restantes
    const diffDays = Math.max(
      1,
      Math.ceil((new Date(demo.expires_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    );
    setExpiresInDays(diffDays);

    setServices(
      (demo.services || []).map((s) => ({
        id: s.id,
        name: s.name,
        price: s.price,
        duration_minutes: s.duration_minutes,
        photo_url: s.photo_url || null,
      }))
    );

    setProfessionals(
      (demo.professionals || []).map((p) => ({
        id: p.id,
        name: p.name,
        photo_url: p.photo_url || null,
        role_title: p.role_title || '',
      }))
    );

    setIsModalOpen(true);
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingLogo(true);
      const url = await demoPortalsService.uploadLogo(file);
      setLogoUrl(url);
      toast.success('Logo enviada!');
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao fazer upload da logo');
    } finally {
      setIsUploadingLogo(false);
    }
  }

  async function handleBannerUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingBanner(true);
      const url = await demoPortalsService.uploadBanner(file);
      setBannerUrl(url);
      toast.success('Fundo/Capa enviado com sucesso!');
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao fazer upload da imagem de fundo');
    } finally {
      setIsUploadingBanner(false);
    }
  }

  async function handleServicePhotoUpload(index: number, file: File) {
    try {
      setUploadingServiceIndex(index);
      const url = await demoPortalsService.uploadServicePhoto(file);
      const updated = [...services];
      updated[index] = { ...updated[index], photo_url: url };
      setServices(updated);
      toast.success('Foto do serviço enviada!');
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao enviar foto do serviço');
    } finally {
      setUploadingServiceIndex(null);
    }
  }

  async function handleProPhotoUpload(index: number, file: File) {
    try {
      setUploadingProIndex(index);
      const url = await demoPortalsService.uploadProfessionalPhoto(file);
      const updated = [...professionals];
      updated[index] = { ...updated[index], photo_url: url };
      setProfessionals(updated);
      toast.success('Foto do profissional enviada!');
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao enviar foto do profissional');
    } finally {
      setUploadingProIndex(null);
    }
  }

  function handleAddService() {
    setServices([...services, { name: '', price: 30, duration_minutes: 30, photo_url: null }]);
  }

  function handleRemoveService(index: number) {
    if (services.length <= 1) {
      toast.error('O portal precisa ter pelo menos 1 serviço');
      return;
    }
    setServices(services.filter((_, i) => i !== index));
  }

  function handleUpdateService(index: number, field: keyof ServiceItemState, value: any) {
    const updated = [...services];
    updated[index] = { ...updated[index], [field]: value };
    setServices(updated);
  }

  function handleAddProfessional() {
    setProfessionals([...professionals, { name: '', photo_url: null, role_title: '' }]);
  }

  function handleRemoveProfessional(index: number) {
    if (professionals.length <= 1) {
      toast.error('O portal precisa ter pelo menos 1 profissional');
      return;
    }
    setProfessionals(professionals.filter((_, i) => i !== index));
  }

  function handleUpdateProfessional(index: number, field: keyof ProfessionalItemState, value: any) {
    const updated = [...professionals];
    updated[index] = { ...updated[index], [field]: value };
    setProfessionals(updated);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!businessName.trim()) {
      toast.error('Informe o nome do estabelecimento');
      return;
    }
    if (!ownerWhatsapp.trim()) {
      toast.error('Informe o WhatsApp do proprietário');
      return;
    }
    const validServices = services.filter((s) => s.name.trim().length > 0);
    if (validServices.length === 0) {
      toast.error('Cadastre pelo menos 1 serviço com nome');
      return;
    }
    const validPros = professionals.filter((p) => p.name.trim().length > 0);
    if (validPros.length === 0) {
      toast.error('Cadastre pelo menos 1 profissional com nome');
      return;
    }

    if (editingDemo) {
      // Modo Edição
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + (expiresInDays > 0 ? expiresInDays : 7));

      updateMutation.mutate({
        id: editingDemo.id,
        updates: {
          business_name: businessName.trim(),
          business_type: businessType,
          slug: customSlug.trim() ? demoPortalsService.sanitizeSlug(customSlug) : undefined,
          logo_url: logoUrl || null,
          banner_url: bannerUrl || null,
          primary_color: primaryColor,
          owner_whatsapp: ownerWhatsapp.trim(),
          expires_at: expiresAt.toISOString(),
          services: validServices.map((s) => ({
            id: s.id || 'srv_' + Math.random().toString(36).substring(2, 9),
            name: s.name.trim(),
            price: Number(s.price) || 0,
            duration_minutes: Number(s.duration_minutes) || 30,
            photo_url: s.photo_url || null,
          })),
          professionals: validPros.map((p) => ({
            id: p.id || 'pro_' + Math.random().toString(36).substring(2, 9),
            name: p.name.trim(),
            photo_url: p.photo_url || null,
            role_title: p.role_title || '',
          })),
        },
      });
    } else {
      // Modo Criação
      createMutation.mutate({
        business_name: businessName,
        business_type: businessType,
        slug: customSlug.trim() ? demoPortalsService.sanitizeSlug(customSlug) : undefined,
        logo_url: logoUrl || null,
        banner_url: bannerUrl || null,
        primary_color: primaryColor,
        owner_whatsapp: ownerWhatsapp,
        expires_in_days: expiresInDays,
        services: validServices,
        professionals: validPros,
      });
    }
  }

  function copyDemoLink(slug: string) {
    const fullUrl = `${window.location.origin}/paginas/${slug}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedSlug(slug);
    toast.success('Link copiado para a área de transferência!');
    setTimeout(() => setCopiedSlug(null), 3000);
  }

  // Filtragem
  const filteredDemos = demos.filter((demo) => {
    const matchesSearch =
      demo.business_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      demo.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
      demo.owner_whatsapp.includes(searchTerm);

    const isExpired = new Date(demo.expires_at) <= new Date();

    if (filterStatus === 'active') {
      return matchesSearch && demo.active && !isExpired;
    }
    if (filterStatus === 'expired') {
      return matchesSearch && (isExpired || !demo.active);
    }
    return matchesSearch;
  });

  const totalViews = demos.reduce((acc, curr) => acc + (curr.views || 0), 0);
  const activeCount = demos.filter(
    (d) => d.active && new Date(d.expires_at) > new Date()
  ).length;

  return (
    <div className="space-y-8 pb-16">
      {/* ── Page Header ── */}
      <AdminPageHeader
        title="Portais Demo"
        subtitle="Crie demonstrações personalizadas em minutos para prospectar donos de barbearias e salões."
        icon={<Sparkles className="w-5 h-5 text-[#D4AF37]" />}
        actions={
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 bg-[#D4AF37] hover:bg-[#e0bc46] text-black font-semibold px-4 py-2.5 rounded-xl shadow-lg transition-all duration-200 active:scale-95 text-sm"
          >
            <Plus className="w-4 h-4" />
            Novo Portal Demo
          </button>
        }
      />

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#0c0c0c] border border-[#222] p-5 rounded-2xl relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#777] uppercase tracking-wider">
              Total Criados
            </span>
            <Sparkles className="w-4 h-4 text-[#D4AF37] opacity-80" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">{demos.length}</div>
          <p className="text-xs text-[#555] mt-1">Demos gerados no sistema</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-[#0c0c0c] border border-[#222] p-5 rounded-2xl relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#777] uppercase tracking-wider">
              Ativos Agora
            </span>
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 mt-2">{activeCount}</div>
          <p className="text-xs text-[#555] mt-1">Prontos para acesso do cliente</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-[#0c0c0c] border border-[#222] p-5 rounded-2xl relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#777] uppercase tracking-wider">
              Total de Visualizações
            </span>
            <Eye className="w-4 h-4 text-blue-400 opacity-80" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">{totalViews}</div>
          <p className="text-xs text-[#555] mt-1">Acessos recebidos nos links</p>
        </motion.div>
      </div>

      {/* ── Filter Bar ── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#0a0a0a] border border-[#1e1e1e] p-3 rounded-2xl">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-[#555] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nome, slug ou WhatsApp..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#121212] border border-[#262626] rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-[#555] focus:outline-none focus:border-[#D4AF37] transition-colors"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
          {(
            [
              { key: 'all', label: 'Todos' },
              { key: 'active', label: 'Ativos' },
              { key: 'expired', label: 'Expirados/Inativos' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterStatus(tab.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                filterStatus === tab.key
                  ? 'bg-[#222] text-white shadow-sm'
                  : 'text-[#666] hover:text-[#aaa] hover:bg-[#161616]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Demo List ── */}
      {isLoading ? (
        <AdminTableSkeleton />
      ) : filteredDemos.length === 0 ? (
        <AdminEmptyState
          title="Nenhum portal demo encontrado"
          description={
            searchTerm
              ? 'Tente ajustar sua busca ou filtros.'
              : 'Clique em "Novo Portal Demo" para criar seu primeiro teste personalizado e encantar prospects.'
          }
          action={
            <button
              onClick={handleOpenCreate}
              className="bg-[#D4AF37] text-black font-semibold px-4 py-2 rounded-xl text-xs"
            >
              Criar Primeiro Demo
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDemos.map((demo) => {
            const isExpired = new Date(demo.expires_at) <= new Date();
            const daysLeft = Math.ceil(
              (new Date(demo.expires_at).getTime() - new Date().getTime()) /
                (1000 * 60 * 60 * 24)
            );

            return (
              <motion.div
                key={demo.id}
                layout
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-[#0c0c0c] border border-[#222] rounded-2xl p-5 flex flex-col justify-between hover:border-[#333] transition-all group"
              >
                <div>
                  {/* Top: Logo + Name + Status */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-base overflow-hidden border border-[#262626] flex-shrink-0 shadow-md"
                        style={{
                          backgroundColor: demo.primary_color || '#1a1a1a',
                          color: '#fff',
                        }}
                      >
                        {demo.logo_url ? (
                          <img
                            src={demo.logo_url}
                            alt={demo.business_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          demo.business_name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div>
                        <h3 className="font-semibold text-white text-base leading-snug line-clamp-1">
                          {demo.business_name}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-[#1e1e1e] text-[#aaa]">
                            {demo.business_type === 'esmalteria'
                              ? 'Esmalteria'
                              : demo.business_type === 'salao'
                                ? 'Salão'
                                : 'Barbearia'}
                          </span>
                          <span className="text-xs text-[#666] font-mono">
                            /paginas/{demo.slug}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      {isExpired ? (
                        <AdminBadge variant="blocked" label="Expirado" dot />
                      ) : demo.active ? (
                        <AdminBadge variant="active" label="Ativo" dot />
                      ) : (
                        <AdminBadge variant="neutral" label="Inativo" dot />
                      )}
                    </div>
                  </div>

                  {/* Info stats */}
                  <div className="grid grid-cols-2 gap-2 bg-[#121212] p-3 rounded-xl border border-[#1e1e1e] mb-4 text-xs">
                    <div className="flex items-center gap-2 text-[#888]">
                      <Eye className="w-3.5 h-3.5 text-blue-400" />
                      <span>
                        <strong className="text-white">{demo.views}</strong> visualizações
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[#888]">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      <span>
                        {isExpired ? (
                          <span className="text-red-400 font-medium">Expirado</span>
                        ) : (
                          <span>
                            Expira em <strong className="text-white">{daysLeft}d</strong>
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[#888] col-span-2">
                      <Phone className="w-3.5 h-3.5 text-emerald-400" />
                      <a
                        href={`https://wa.me/${demo.owner_whatsapp.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#aaa] hover:text-emerald-400 transition-colors truncate"
                      >
                        WhatsApp: {demo.owner_whatsapp}
                      </a>
                    </div>
                  </div>

                  {/* Summary of services & pros com badges de fotos */}
                  <div className="flex items-center gap-2 text-xs text-[#555] mb-4">
                    <span>
                      {demo.services?.length || 0} serviços{' '}
                      {demo.services?.some((s) => s.photo_url) && (
                        <span className="text-emerald-400/80 font-medium">(com fotos)</span>
                      )}
                    </span>
                    <span>•</span>
                    <span>{demo.professionals?.length || 0} profissionais</span>
                  </div>
                </div>

                {/* Actions Bottom Bar */}
                <div className="pt-3 border-t border-[#1a1a1a] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => copyDemoLink(demo.slug)}
                      title="Copiar Link Demo"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1a1a1a] hover:bg-[#252525] text-xs text-[#ccc] hover:text-white transition-colors"
                    >
                      {copiedSlug === demo.slug ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400 font-medium">Copiado</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copiar</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleOpenEdit(demo)}
                      title="Editar Serviços e Profissionais deste Demo"
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#1a1a1a] hover:bg-[#252525] text-xs text-[#ccc] hover:text-[#D4AF37] transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Editar</span>
                    </button>

                    <a
                      href={`/paginas/${demo.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      title="Abrir Demonstração"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#D4AF37]/15 hover:bg-[#D4AF37]/25 text-[#D4AF37] border border-[#D4AF37]/30 text-xs font-semibold transition-all shadow-sm"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Abrir Demo</span>
                    </a>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() =>
                        toggleActiveMutation.mutate({ id: demo.id, active: !demo.active })
                      }
                      title={demo.active ? 'Desativar link' : 'Ativar link'}
                      className="p-1.5 text-[#888] hover:text-white transition-colors"
                    >
                      {demo.active ? (
                        <ToggleRight className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <ToggleLeft className="w-5 h-5 text-[#555]" />
                      )}
                    </button>

                    <button
                      onClick={() => setDeleteConfirmId(demo.id)}
                      title="Excluir Demo"
                      className="p-2 rounded-lg text-[#666] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── Modal de Criação / Edição de Portal Demo ── */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[#0d0d0d] border border-[#222] rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 sm:p-8"
            >
              <div className="flex items-center justify-between pb-5 border-b border-[#1e1e1e]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/20 flex items-center justify-center text-[#D4AF37]">
                    {editingDemo ? <Pencil className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">
                      {editingDemo ? 'Editar Portal Demo' : 'Criar Portal Demo'}
                    </h2>
                    <p className="text-xs text-[#666]">
                      {editingDemo
                        ? `Atualize os dados, serviços e profissionais de ${editingDemo.business_name}`
                        : 'Gere uma página de agendamento personalizada para seu prospect'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="w-8 h-8 rounded-lg bg-[#1a1a1a] flex items-center justify-center text-[#777] hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6 pt-6">
                {/* Dados Gerais */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-[#aaa] uppercase tracking-wider mb-2">
                      Nome do Estabelecimento *
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Barbearia Dom Vito, Studio Bella..."
                      value={businessName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setBusinessName(val);
                        if (!editingDemo && !isCustomSlugEdited) {
                          setCustomSlug(demoPortalsService.sanitizeSlug(val));
                        }
                      }}
                      className="w-full bg-[#141414] border border-[#262626] rounded-xl px-4 py-3 text-sm text-white placeholder-[#555] focus:outline-none focus:border-[#FD6500]"
                      required
                    />
                  </div>

                  {/* Link Personalizado (URL) */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-[#aaa] uppercase tracking-wider mb-2 flex items-center justify-between">
                      <span>Link da Página Demo (URL)</span>
                      <span className="text-[10px] text-[#777] font-normal lowercase">
                        {editingDemo ? 'personalizável' : 'opcional'}
                      </span>
                    </label>
                    <div className="flex items-center bg-[#141414] border border-[#262626] rounded-xl px-4 py-3 text-sm focus-within:border-[#FD6500] transition-colors">
                      <span className="text-[#666] select-none font-mono text-xs pr-1">
                        /paginas/
                      </span>
                      <input
                        type="text"
                        placeholder="ex: barbearia-do-joao"
                        value={customSlug}
                        onChange={(e) => {
                          setIsCustomSlugEdited(true);
                          setCustomSlug(demoPortalsService.sanitizeSlug(e.target.value));
                        }}
                        className="w-full bg-transparent text-white font-mono placeholder-[#555] focus:outline-none text-sm"
                      />
                    </div>
                    <p className="text-[11px] text-[#555] mt-1">
                      {editingDemo
                        ? 'Você pode trocar o link do prospect a qualquer momento (apenas letras minúsculas, números e traços).'
                        : 'Se deixar em branco, geraremos automaticamente a partir do nome com um código seguro.'}
                    </p>
                  </div>

                  {/* Tipo de Negócio */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-[#aaa] uppercase tracking-wider mb-2">
                      Tipo de Negócio *
                    </label>
                    <div className="grid grid-cols-3 gap-2.5">
                      {[
                        { id: 'barbearia', label: 'Barbearia', desc: 'Barba & Cortes', icon: Scissors },
                        { id: 'salao', label: 'Salão de Beleza', desc: 'Cabelo & Estética', icon: Sparkles },
                        { id: 'esmalteria', label: 'Esmalteria', desc: 'Manicure & Pedicure', icon: UserCheck },
                      ].map((type) => {
                        const Icon = type.icon;
                        const isSelected = businessType === type.id;
                        return (
                          <button
                            key={type.id}
                            type="button"
                            onClick={() => setBusinessType(type.id as any)}
                            className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                              isSelected
                                ? 'bg-[#1e1710] border-[#FD6500] text-white shadow-sm'
                                : 'bg-[#141414] border-[#262626] text-[#888] hover:border-[#383838] hover:text-[#ccc]'
                            }`}
                          >
                            <div className="flex items-center justify-between w-full mb-1.5">
                              <Icon className={`w-4 h-4 ${isSelected ? 'text-[#FD6500]' : 'text-[#666]'}`} />
                              {isSelected && <Check className="w-3.5 h-3.5 text-[#FD6500]" />}
                            </div>
                            <div>
                              <p className={`text-xs font-bold leading-tight ${isSelected ? 'text-white' : 'text-[#ccc]'}`}>
                                {type.label}
                              </p>
                              <p className="text-[10px] text-[#666] mt-0.5">{type.desc}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#aaa] uppercase tracking-wider mb-2">
                      WhatsApp do Dono (com DDD) *
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: (27) 99730-3135"
                      value={ownerWhatsapp}
                      onChange={(e) => setOwnerWhatsapp(e.target.value)}
                      className="w-full bg-[#141414] border border-[#262626] rounded-xl px-4 py-3 text-sm text-white placeholder-[#555] focus:outline-none focus:border-[#D4AF37]"
                      required
                    />
                    <p className="text-[11px] text-[#555] mt-1">
                      Receberá a notificação de teste quando o cliente agendar.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#aaa] uppercase tracking-wider mb-2">
                      Expiração do Link (dias a partir de hoje)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={90}
                      value={expiresInDays}
                      onChange={(e) => setExpiresInDays(Number(e.target.value))}
                      className="w-full bg-[#141414] border border-[#262626] rounded-xl px-4 py-3 text-sm text-white placeholder-[#555] focus:outline-none focus:border-[#D4AF37]"
                    />
                    <p className="text-[11px] text-[#555] mt-1">Padrão: 7 dias</p>
                  </div>
                </div>

                {/* Logo & Cor */}
                <div className="bg-[#121212] p-4 rounded-2xl border border-[#1f1f1f] space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#aaa] uppercase tracking-wider mb-1">
                        Logo / Foto do Negócio (opcional)
                      </label>
                      <p className="text-xs text-[#666]">
                        Faça upload da imagem ou deixe o ícone automático
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      {logoUrl && (
                        <div className="w-12 h-12 rounded-xl overflow-hidden border border-[#333] relative group">
                          <img
                            src={logoUrl}
                            alt="Logo preview"
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => setLogoUrl('')}
                            className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-red-400"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      <label className="cursor-pointer flex items-center gap-2 bg-[#1e1e1e] hover:bg-[#282828] text-xs font-medium text-white px-3.5 py-2.5 rounded-xl border border-[#333] transition-colors">
                        {isUploadingLogo ? (
                          <Loader2 className="w-4 h-4 animate-spin text-[#D4AF37]" />
                        ) : (
                          <Upload className="w-4 h-4 text-[#D4AF37]" />
                        )}
                        <span>{logoUrl ? 'Trocar Logo' : 'Enviar Logo'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          disabled={isUploadingLogo}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Fundo / Capa do Salão (Banner) */}
                  <div className="pt-4 border-t border-[#1f1f1f]">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-[#aaa] uppercase tracking-wider mb-1">
                          Imagem de Fundo / Capa do Topo (opcional)
                        </label>
                        <p className="text-xs text-[#666]">
                          Se não carregar imagem, o topo usará o fundo na cor de destaque ({primaryColor})
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        {bannerUrl ? (
                          <div className="w-24 h-12 rounded-xl overflow-hidden border border-[#333] relative group">
                            <img
                              src={bannerUrl}
                              alt="Banner preview"
                              className="w-full h-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => setBannerUrl('')}
                              className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-red-400"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div
                            className="w-24 h-12 rounded-xl border border-[#333] flex items-center justify-center text-[10px] font-bold text-white shadow-inner"
                            style={{
                              background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc)`,
                            }}
                          >
                            Cor Padrão
                          </div>
                        )}

                        <label className="cursor-pointer flex items-center gap-2 bg-[#1e1e1e] hover:bg-[#282828] text-xs font-medium text-white px-3.5 py-2.5 rounded-xl border border-[#333] transition-colors">
                          {isUploadingBanner ? (
                            <Loader2 className="w-4 h-4 animate-spin text-[#FD6500]" />
                          ) : (
                            <Camera className="w-4 h-4 text-[#FD6500]" />
                          )}
                          <span>{bannerUrl ? 'Trocar Fundo' : 'Enviar Fundo'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleBannerUpload}
                            disabled={isUploadingBanner}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Seletor de cor */}
                  <div>
                    <label className="block text-xs font-semibold text-[#aaa] uppercase tracking-wider mb-2">
                      Cor Principal da Página
                    </label>
                    <div className="flex items-center gap-2 flex-wrap">
                      {COLOR_PRESETS.map((preset) => (
                        <button
                          key={preset.hex}
                          type="button"
                          onClick={() => setPrimaryColor(preset.hex)}
                          className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                            primaryColor.toLowerCase() === preset.hex.toLowerCase()
                              ? 'ring-2 ring-white scale-110'
                              : 'opacity-70 hover:opacity-100'
                          }`}
                          style={{ backgroundColor: preset.hex }}
                          title={preset.name}
                        >
                          {primaryColor.toLowerCase() === preset.hex.toLowerCase() && (
                            <Check className="w-3.5 h-3.5 text-black stroke-[3]" />
                          )}
                        </button>
                      ))}

                      <div className="flex items-center gap-2 ml-2">
                        <input
                          type="color"
                          value={primaryColor}
                          onChange={(e) => setPrimaryColor(e.target.value)}
                          className="w-7 h-7 rounded-md cursor-pointer bg-transparent border-0"
                        />
                        <span className="text-xs font-mono text-[#777]">{primaryColor}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Serviços com Imagens ── */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Scissors className="w-4 h-4 text-[#D4AF37]" />
                      <h4 className="text-sm font-semibold text-white">Serviços Oferecidos (com fotos)</h4>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddService}
                      className="text-xs text-[#D4AF37] hover:underline flex items-center gap-1 font-medium"
                    >
                      <Plus className="w-3.5 h-3.5" /> Adicionar Serviço
                    </button>
                  </div>

                  <div className="space-y-3">
                    {services.map((srv, idx) => (
                      <div
                        key={idx}
                        className="bg-[#121212] p-3 rounded-2xl border border-[#222] space-y-2.5 transition-all hover:border-[#333]"
                      >
                        <div className="flex items-center gap-2">
                          {/* Miniatura ou Botão de Foto do Serviço */}
                          <div className="flex-shrink-0 relative">
                            {srv.photo_url ? (
                              <div className="w-12 h-12 rounded-xl overflow-hidden border border-[#333] relative group">
                                <img
                                  src={srv.photo_url}
                                  alt={srv.name || 'Serviço'}
                                  className="w-full h-full object-cover"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleUpdateService(idx, 'photo_url', null)}
                                  title="Remover foto"
                                  className="absolute inset-0 bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-red-400"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <label
                                title="Adicionar imagem do serviço"
                                className="w-12 h-12 rounded-xl border border-dashed border-[#333] hover:border-[#D4AF37] bg-[#181818] hover:bg-[#202020] flex flex-col items-center justify-center cursor-pointer transition-colors text-[#666] hover:text-[#D4AF37]"
                              >
                                {uploadingServiceIndex === idx ? (
                                  <Loader2 className="w-4 h-4 animate-spin text-[#D4AF37]" />
                                ) : (
                                  <>
                                    <Camera className="w-4 h-4" />
                                    <span className="text-[9px] mt-0.5">Foto</span>
                                  </>
                                )}
                                <input
                                  type="file"
                                  accept="image/*"
                                  disabled={uploadingServiceIndex === idx}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleServicePhotoUpload(idx, file);
                                  }}
                                  className="hidden"
                                />
                              </label>
                            )}
                          </div>

                          {/* Nome do Serviço */}
                          <input
                            type="text"
                            placeholder="Nome do serviço (ex: Corte Degradê)"
                            value={srv.name}
                            onChange={(e) => handleUpdateService(idx, 'name', e.target.value)}
                            className="flex-1 bg-[#181818] border border-[#262626] rounded-xl px-3 py-2 text-xs text-white placeholder-[#555] focus:outline-none focus:border-[#D4AF37]"
                          />

                          {/* Preço */}
                          <div className="flex items-center gap-1 bg-[#181818] px-2.5 py-1.5 rounded-xl border border-[#262626]">
                            <span className="text-[11px] text-[#666]">R$</span>
                            <input
                              type="number"
                              min={0}
                              placeholder="Preço"
                              value={srv.price}
                              onChange={(e) =>
                                handleUpdateService(idx, 'price', Number(e.target.value))
                              }
                              className="w-14 bg-transparent text-xs text-white focus:outline-none text-right font-medium"
                            />
                          </div>

                          {/* Duração */}
                          <div className="flex items-center gap-1 bg-[#181818] px-2.5 py-1.5 rounded-xl border border-[#262626]">
                            <input
                              type="number"
                              min={5}
                              step={5}
                              placeholder="Min"
                              value={srv.duration_minutes}
                              onChange={(e) =>
                                handleUpdateService(idx, 'duration_minutes', Number(e.target.value))
                              }
                              className="w-10 bg-transparent text-xs text-white focus:outline-none text-right"
                            />
                            <span className="text-[11px] text-[#666]">min</span>
                          </div>

                          {/* Excluir Serviço */}
                          <button
                            type="button"
                            onClick={() => handleRemoveService(idx)}
                            className="p-2 text-[#666] hover:text-red-400 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Profissionais com Fotos ── */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-blue-400" />
                      <h4 className="text-sm font-semibold text-white">Profissionais / Equipe (com fotos)</h4>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddProfessional}
                      className="text-xs text-blue-400 hover:underline flex items-center gap-1 font-medium"
                    >
                      <Plus className="w-3.5 h-3.5" /> Adicionar Profissional
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {professionals.map((pro, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 bg-[#121212] p-2.5 rounded-xl border border-[#222] hover:border-[#333] transition-all"
                      >
                        {/* Foto do Profissional */}
                        <div className="flex-shrink-0">
                          {pro.photo_url ? (
                            <div className="w-10 h-10 rounded-xl overflow-hidden border border-[#333] relative group">
                              <img
                                src={pro.photo_url}
                                alt={pro.name}
                                className="w-full h-full object-cover"
                              />
                              <button
                                type="button"
                                onClick={() => handleUpdateProfessional(idx, 'photo_url', null)}
                                title="Remover foto"
                                className="absolute inset-0 bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-red-400"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <label
                              title="Adicionar foto do profissional"
                              className="w-10 h-10 rounded-xl border border-dashed border-[#333] hover:border-blue-400 bg-[#181818] flex items-center justify-center cursor-pointer text-[#666] hover:text-blue-400 transition-colors"
                            >
                              {uploadingProIndex === idx ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                              ) : (
                                <Camera className="w-3.5 h-3.5" />
                              )}
                              <input
                                type="file"
                                accept="image/*"
                                disabled={uploadingProIndex === idx}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleProPhotoUpload(idx, file);
                                }}
                                className="hidden"
                              />
                            </label>
                          )}
                        </div>

                        <input
                          type="text"
                          placeholder="Nome do profissional (ex: Carlos Barbeiro)"
                          value={pro.name}
                          onChange={(e) => handleUpdateProfessional(idx, 'name', e.target.value)}
                          className="flex-1 bg-[#181818] border border-[#262626] rounded-xl px-3 py-2 text-xs text-white placeholder-[#555] focus:outline-none focus:border-blue-400"
                        />

                        <input
                          type="text"
                          placeholder="Cargo/Especialidade (ex: Barbeiro Chefe)"
                          value={pro.role_title || ''}
                          onChange={(e) => handleUpdateProfessional(idx, 'role_title', e.target.value)}
                          className="w-36 bg-[#181818] border border-[#262626] rounded-xl px-3 py-2 text-xs text-white placeholder-[#555] focus:outline-none focus:border-blue-400 hidden sm:block"
                        />

                        <button
                          type="button"
                          onClick={() => handleRemoveProfessional(idx)}
                          className="p-1 text-[#666] hover:text-red-400 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Botões submit */}
                <div className="pt-4 border-t border-[#1e1e1e] flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-medium text-[#777] hover:text-white transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="flex items-center gap-2 bg-[#D4AF37] hover:bg-[#e0bc46] disabled:opacity-50 text-black font-semibold px-6 py-2.5 rounded-xl text-sm shadow-lg transition-all"
                  >
                    {createMutation.isPending || updateMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Salvando Portal Demo...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>{editingDemo ? 'Salvar Alterações' : 'Criar e Gerar Link'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Modal de Sucesso pós-criação ── */}
      <AnimatePresence>
        {createdDemo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-3xl p-6 sm:p-8 max-w-md w-full text-center space-y-6 shadow-2xl"
            >
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
                <Check className="w-8 h-8 stroke-[3]" />
              </div>

              <div>
                <h3 className="text-xl font-bold text-white">Portal Demo Criado!</h3>
                <p className="text-xs text-[#888] mt-1.5">
                  A demonstração personalizada para <strong>{createdDemo.business_name}</strong> já
                  está ativa e pronta para envio.
                </p>
              </div>

              <div className="bg-[#161616] border border-[#262626] rounded-2xl p-3 text-left">
                <span className="text-[10px] text-[#666] uppercase font-bold tracking-wider block mb-1">
                  Link de Acesso Único
                </span>
                <p className="text-xs font-mono text-[#D4AF37] break-all">
                  {window.location.origin}/paginas/{createdDemo.slug}
                </p>
              </div>

              <div className="flex flex-col gap-2.5">
                <button
                  onClick={() => copyDemoLink(createdDemo.slug)}
                  className="flex items-center justify-center gap-2 w-full bg-[#D4AF37] hover:bg-[#e0bc46] text-black font-semibold py-3 rounded-xl text-sm transition-all shadow-lg active:scale-98"
                >
                  <Copy className="w-4 h-4" />
                  Copiar Link para o WhatsApp
                </button>

                <a
                  href={`/paginas/${createdDemo.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 w-full bg-[#222] hover:bg-[#2c2c2c] text-white font-medium py-3 rounded-xl text-sm transition-all"
                >
                  <ExternalLink className="w-4 h-4" />
                  Testar Portal Agora
                </a>

                <button
                  onClick={() => {
                    setCreatedDemo(null);
                    setIsModalOpen(false);
                  }}
                  className="text-xs text-[#777] hover:text-white pt-2 transition-colors"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Modal de Confirmação de Exclusão ── */}
      <AnimatePresence>
        {deleteConfirmId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#121212] border border-[#262626] rounded-2xl p-6 max-w-sm w-full text-center space-y-4"
            >
              <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 mx-auto flex items-center justify-center">
                <Trash2 className="w-6 h-6" />
              </div>

              <div>
                <h4 className="text-base font-bold text-white">Excluir este Portal Demo?</h4>
                <p className="text-xs text-[#777] mt-1">
                  O link deixará de funcionar imediatamente para qualquer pessoa que tentar
                  acessá-lo.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 py-2.5 rounded-xl bg-[#1e1e1e] hover:bg-[#262626] text-xs font-semibold text-white transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => deleteMutation.mutate(deleteConfirmId)}
                  disabled={deleteMutation.isPending}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-semibold text-white transition-colors"
                >
                  {deleteMutation.isPending ? 'Excluindo...' : 'Sim, Excluir'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
