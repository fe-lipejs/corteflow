import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Clock,
  User,
  Scissors,
  Check,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Phone,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Star,
  CheckCircle2,
  ExternalLink,
  Search,
  Zap,
  Store,
  MapPin,
  X,
  Plus,
  ArrowLeft,
  RotateCcw,
  Trash2,
  LogOut,
  CalendarCheck,
  AlertCircle,
} from 'lucide-react';
import { format, addDays, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { demoPortalsService } from '../../services/demoPortalsService';
import type { DemoPortal, DemoService, DemoProfessional } from '../../types/demoPortal';

// ── Ícones SVG Customizados ──────────────────────────────────────────────────
const InstagramIcon = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={style}
  >
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
  </svg>
);

const WhatsAppIcon = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    style={style}
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.117.553 4.103 1.52 5.83L.058 23.277a.5.5 0 0 0 .608.636l5.707-1.512A11.946 11.946 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 0 1-5.007-1.376l-.357-.213-3.706.982.995-3.613-.234-.374A9.818 9.818 0 0 1 2.182 12C2.182 6.574 6.574 2.182 12 2.182c5.426 0 9.818 4.392 9.818 9.818 0 5.426-4.392 9.818-9.818 9.818z" />
  </svg>
);

const STEP_LABELS = ['Serviço', 'Profissional', 'Data & Hora', 'Confirmar'];

const AVAILABLE_TIMES = [
  '08:40', '09:20', '10:00', '10:40', '11:20',
  '13:40', '14:20', '15:00', '15:40', '16:20', '17:00', '17:40', '18:20',
];

const WEEKDAYS_MAP = [
  { day: 'Segunda-feira', hours: '09:00 – 19:00', open: true },
  { day: 'Terça-feira', hours: '09:00 – 19:00', open: true },
  { day: 'Quarta-feira', hours: '09:00 – 19:00', open: true },
  { day: 'Quinta-feira', hours: '09:00 – 19:00', open: true },
  { day: 'Sexta-feira', hours: '09:00 – 19:00', open: true },
  { day: 'Sábado', hours: '09:00 – 18:00', open: true },
  { day: 'Domingo', hours: 'Fechado', open: false },
];

function formatPhoneMask(val: string): string {
  const digits = val.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

// ── Tipagem dos Agendamentos Demo em LocalStorage ─────────────────────────────
interface DemoClientBooking {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  service_id: string;
  service_name: string;
  service_price: number;
  service_duration: number;
  service_photo_url?: string | null;
  professional_id?: string;
  professional_name: string;
  professional_photo_url?: string | null;
  date_raw: string; // YYYY-MM-DD
  date_formatted: string;
  time: string; // HH:mm
  status: 'confirmed' | 'canceled' | 'completed';
  cancel_reason?: string;
  notes?: string;
  created_at: string;
}

export default function PublicDemoStore() {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const [demo, setDemo] = useState<DemoPortal | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFoundOrExpired, setNotFoundOrExpired] = useState(false);

  // Visão atual da aplicação ('store' | 'success' | 'portal')
  const [currentView, setCurrentView] = useState<'store' | 'success' | 'portal'>(() => {
    if (location.pathname.endsWith('/portal')) return 'portal';
    if (location.pathname.endsWith('/sucesso')) return 'success';
    return 'store';
  });

  // Flow State (Passos do Agendamento 1 a 4)
  const [step, setStep] = useState(1);
  const [selectedService, setSelectedService] = useState<DemoService | null>(null);
  const [selectedProfessional, setSelectedProfessional] = useState<DemoProfessional | 'any' | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientNotes, setClientNotes] = useState('');

  // Estado do Agendamento Concluído mais recente
  const [lastBooking, setLastBooking] = useState<DemoClientBooking | null>(null);

  // Modais de Apoio
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const hasIncrementedView = useRef(false);

  // ── Estado do Portal do Cliente ──
  const [portalPhoneInput, setPortalPhoneInput] = useState('');
  const [isPortalLoggedIn, setIsPortalLoggedIn] = useState(false);
  const [portalActiveTab, setPortalActiveTab] = useState<'upcoming' | 'history'>('upcoming');
  const [clientBookings, setClientBookings] = useState<DemoClientBooking[]>([]);

  // Estados de Ações do Portal (Remarcar e Cancelar)
  const [rescheduleBooking, setRescheduleBooking] = useState<DemoClientBooking | null>(null);
  const [rescheduleNewDate, setRescheduleNewDate] = useState<Date>(startOfDay(new Date()));
  const [rescheduleNewTime, setRescheduleNewTime] = useState<string>('');

  const [cancelBookingTarget, setCancelBookingTarget] = useState<DemoClientBooking | null>(null);
  const [cancelReason, setCancelReason] = useState('Imprevisto de agenda');

  // 1. Injetar noindex para não ser indexado pelo Google
  useEffect(() => {
    let metaTag = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    let created = false;

    if (!metaTag) {
      metaTag = document.createElement('meta');
      metaTag.name = 'robots';
      document.head.appendChild(metaTag);
      created = true;
    }
    metaTag.content = 'noindex, nofollow';

    return () => {
      if (created && metaTag && metaTag.parentNode) {
        metaTag.parentNode.removeChild(metaTag);
      }
    };
  }, []);

  // 2. Carregar dados do demo a partir do slug
  useEffect(() => {
    if (!slug) {
      setNotFoundOrExpired(true);
      setLoading(false);
      return;
    }

    async function loadDemo() {
      try {
        setLoading(true);
        const data = await demoPortalsService.getBySlug(slug!);
        if (!data) {
          setNotFoundOrExpired(true);
          return;
        }

        const isExpired = new Date(data.expires_at) <= new Date();
        if (!data.active || isExpired) {
          setNotFoundOrExpired(true);
          return;
        }

        setDemo(data);

        // Carregar agendamentos salvos no localStorage para este portal
        try {
          const stored = localStorage.getItem(`demo_${data.slug}_bookings`);
          if (stored) {
            const parsed = JSON.parse(stored);
            setClientBookings(parsed);
          }
          const storedPhone = localStorage.getItem(`demo_${data.slug}_phone`);
          if (storedPhone) {
            setPortalPhoneInput(storedPhone);
            setIsPortalLoggedIn(true);
          }
        } catch (e) {
          console.warn('Erro ao ler localStorage do demo:', e);
        }

        // Incrementar visualização apenas uma vez por visita
        if (!hasIncrementedView.current) {
          hasIncrementedView.current = true;
          demoPortalsService.incrementViews(slug!);
        }
      } catch (err) {
        console.error('Erro ao carregar portal demo:', err);
        setNotFoundOrExpired(true);
      } finally {
        setLoading(false);
      }
    }

    loadDemo();
  }, [slug]);

  // Atualizar title do documento
  useEffect(() => {
    if (demo) {
      document.title = `${demo.business_name} | Agendamento Online`;
    }
  }, [demo]);

  // Sincronizar rota com view
  useEffect(() => {
    if (location.pathname.endsWith('/portal')) {
      setCurrentView('portal');
    } else if (location.pathname.endsWith('/sucesso')) {
      setCurrentView('success');
    }
  }, [location.pathname]);

  const themeColor = demo?.primary_color || '#D4AF37';

  // Próximos 30 dias para o carrossel de agendamento
  const nextDays = useMemo(() => {
    const days: Date[] = [];
    const today = startOfDay(new Date());
    for (let i = 0; i < 30; i++) {
      days.push(addDays(today, i));
    }
    return days;
  }, []);

  // Filtrar serviços por busca
  const filteredServices = useMemo(() => {
    if (!demo?.services) return [];
    if (!searchQuery.trim()) return demo.services;
    const q = searchQuery.toLowerCase();
    return demo.services.filter((s) => s.name.toLowerCase().includes(q));
  }, [demo?.services, searchQuery]);

  // Salvar agendamentos no LocalStorage do Demo
  function saveBookingsToStorage(newBookings: DemoClientBooking[]) {
    setClientBookings(newBookings);
    if (demo) {
      try {
        localStorage.setItem(`demo_${demo.slug}_bookings`, JSON.stringify(newBookings));
      } catch (e) {
        console.error('Falha ao persistir no localStorage:', e);
      }
    }
  }

  // Confirmar agendamento no fluxo público
  function handleConfirmBooking(e: React.FormEvent) {
    e.preventDefault();

    if (!selectedService) {
      toast.error('Por favor, selecione um serviço');
      setStep(1);
      return;
    }
    if (!selectedTime) {
      toast.error('Por favor, escolha um horário');
      setStep(3);
      return;
    }
    if (!clientName.trim()) {
      toast.error('Por favor, informe seu nome completo');
      return;
    }
    if (!clientPhone.trim()) {
      toast.error('Por favor, informe seu WhatsApp com DDD');
      return;
    }

    const proName =
      selectedProfessional === 'any'
        ? 'Primeiro Disponível'
        : selectedProfessional?.name || 'Profissional';

    const proPhoto =
      selectedProfessional === 'any' ? null : selectedProfessional?.photo_url || null;

    const dayFormatted = format(selectedDate, "dd 'de' MMMM", { locale: ptBR });
    const cleanOwnerPhone = demo?.owner_whatsapp.replace(/\D/g, '') || '';
    const cleanClientPhone = clientPhone.replace(/\D/g, '');
    const randomOrder = 'DEMO-' + Math.floor(1000 + Math.random() * 9000);

    const newBooking: DemoClientBooking = {
      id: 'demo_bk_' + Math.random().toString(36).substring(2, 9),
      order_number: randomOrder,
      customer_name: clientName.trim(),
      customer_phone: cleanClientPhone,
      service_id: selectedService.id,
      service_name: selectedService.name,
      service_price: selectedService.price,
      service_duration: selectedService.duration_minutes,
      service_photo_url: selectedService.photo_url || null,
      professional_id: selectedProfessional === 'any' ? undefined : selectedProfessional?.id,
      professional_name: proName,
      professional_photo_url: proPhoto,
      date_raw: format(selectedDate, 'yyyy-MM-dd'),
      date_formatted: dayFormatted,
      time: selectedTime,
      status: 'confirmed',
      notes: clientNotes.trim() || undefined,
      created_at: new Date().toISOString(),
    };

    // Salvar booking na lista
    const updatedBookings = [newBooking, ...clientBookings];
    saveBookingsToStorage(updatedBookings);

    // Salvar telefone do cliente para auto-login no Portal
    if (demo) {
      localStorage.setItem(`demo_${demo.slug}_phone`, cleanClientPhone);
    }
    setPortalPhoneInput(formatPhoneMask(cleanClientPhone));
    setIsPortalLoggedIn(true);

    setLastBooking(newBooking);
    setCurrentView('success');

    // Mensagem requerida pela especificação:
    // "Novo agendamento! [nome do cliente] marcou [serviço] com [profissional] em [dia] às [hora]. Era isso que eu queria te mostrar: seus clientes marcando sozinhos 😉"
    const messageText = `Novo agendamento! ${clientName.trim()} marcou ${selectedService.name} com ${proName} em ${dayFormatted} às ${selectedTime}. Era isso que eu queria te mostrar: seus clientes marcando sozinhos 😉`;
    const waUrl = `https://wa.me/${cleanOwnerPhone}?text=${encodeURIComponent(messageText)}`;

    // Abrir WhatsApp do proprietário para demonstração
    setTimeout(() => {
      window.open(waUrl, '_blank');
    }, 600);
  }

  // Cancelamento de agendamento no Portal
  function handleConfirmCancel() {
    if (!cancelBookingTarget) return;

    const updated = clientBookings.map((b) => {
      if (b.id === cancelBookingTarget.id) {
        return { ...b, status: 'canceled' as const, cancel_reason: cancelReason };
      }
      return b;
    });

    saveBookingsToStorage(updated);
    setCancelBookingTarget(null);
    toast.success('Agendamento cancelado com sucesso!');
  }

  // Reagendamento no Portal
  function handleConfirmReschedule() {
    if (!rescheduleBooking || !rescheduleNewTime) {
      toast.error('Escolha um horário para remarcar');
      return;
    }

    const dayFormatted = format(rescheduleNewDate, "dd 'de' MMMM", { locale: ptBR });
    const updated = clientBookings.map((b) => {
      if (b.id === rescheduleBooking.id) {
        return {
          ...b,
          date_raw: format(rescheduleNewDate, 'yyyy-MM-dd'),
          date_formatted: dayFormatted,
          time: rescheduleNewTime,
        };
      }
      return b;
    });

    saveBookingsToStorage(updated);
    setRescheduleBooking(null);
    toast.success('Agendamento reagendado com sucesso!');
  }

  // ── Tela de Carregando ──
  if (loading) {
    return (
      <div className="min-h-screen bg-[#070707] text-white flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-[#141414] border border-[#222] flex items-center justify-center mb-4">
          <Sparkles className="w-6 h-6 text-[#D4AF37] animate-pulse" />
        </div>
        <p className="text-sm text-[#777] font-medium">Carregando portal...</p>
      </div>
    );
  }

  // ── Tela de Expirado ou Desativado ──
  if (notFoundOrExpired || !demo) {
    return (
      <div className="min-h-screen bg-[#070707] text-white flex flex-col items-center justify-center p-4 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="max-w-md w-full bg-[#0d0d0d] border border-[#222] p-8 rounded-3xl shadow-2xl space-y-6"
        >
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mx-auto flex items-center justify-center">
            <AlertTriangle className="w-8 h-8" />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Demonstração Indisponível
            </h1>
            <p className="text-sm text-[#888] mt-2 leading-relaxed">
              Este link de demonstração expirou ou foi desativado.
            </p>
          </div>

          <div className="bg-[#141414] p-4 rounded-2xl border border-[#262626] text-xs text-[#777] text-left">
            <p className="flex items-center gap-2 text-white font-medium mb-1">
              <Sparkles className="w-4 h-4 text-[#D4AF37]" />
              Quer testar no seu estabelecimento?
            </p>
            Entre em contato para solicitar uma nova demonstração interativa personalizada.
          </div>

          <div className="pt-2 flex flex-col gap-3">
            <a
              href="https://wa.me/5527997303135?text=Ol%C3%A1!%20Gostaria%20de%20solicitar%20um%20novo%20link%20de%20demonstra%C3%A7%C3%A3o%20do%20Raffros."
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 w-full bg-[#D4AF37] hover:bg-[#e0bc46] text-black font-semibold py-3.5 rounded-xl text-sm transition-all shadow-lg"
            >
              <Phone className="w-4 h-4" />
              Falar no WhatsApp
            </a>

            <Link
              to="/"
              className="text-xs text-[#666] hover:text-[#bbb] transition-colors py-1"
            >
              Ir para a página inicial do Raffros
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ── VIEW 1: TELA DE SUCESSO (ESTILO SUCCESSBOOKING FIEL) ─────────────────────
  // ════════════════════════════════════════════════════════════════════════════
  if (currentView === 'success' && lastBooking) {
    const cleanOwnerPhone = demo.owner_whatsapp.replace(/\D/g, '');
    const messageText = `Novo agendamento! ${lastBooking.customer_name} marcou ${lastBooking.service_name} com ${lastBooking.professional_name} em ${lastBooking.date_formatted} às ${lastBooking.time}. Era isso que eu queria te mostrar: seus clientes marcando sozinhos 😉`;
    const waUrl = `https://wa.me/${cleanOwnerPhone}?text=${encodeURIComponent(messageText)}`;

    return (
      <div className="min-h-screen bg-[#070707] text-white font-sans flex flex-col items-center justify-center p-4">
        {/* Selo no topo */}
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border backdrop-blur-md shadow-lg"
            style={{
              backgroundColor: `${themeColor}15`,
              color: themeColor,
              borderColor: `${themeColor}40`,
            }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Demonstração Interativa Raffros
          </span>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="w-full max-w-md flex flex-col items-center text-center my-8"
        >
          {/* Círculo com Checkmark dourado */}
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-2xl"
            style={{
              backgroundColor: themeColor,
              boxShadow: `0 0 40px ${themeColor}50`,
            }}
          >
            <div className="w-16 h-16 rounded-full border-4 border-[#070707] flex items-center justify-center">
              <Check className="w-8 h-8 text-[#070707]" strokeWidth={4} />
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2">
            Agendamento confirmado
          </h1>
          <p className="text-[#888] mb-8 text-sm">
            {lastBooking.customer_name}, te esperamos em {lastBooking.date_formatted} às {lastBooking.time}.
          </p>

          {/* Card Resumo do Agendamento */}
          <div className="w-full bg-[#121212] border border-[#262626] rounded-3xl p-6 space-y-3.5 mb-6 text-left shadow-2xl">
            <div className="flex justify-between items-center text-xs pb-3 border-b border-[#222]">
              <span className="text-[#777]">Estabelecimento</span>
              <span className="font-bold text-white">{demo.business_name}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-[#777]">Serviço</span>
              <span className="font-semibold text-white">{lastBooking.service_name}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-[#777]">Profissional</span>
              <span className="font-semibold text-white">{lastBooking.professional_name}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-[#777]">Data</span>
              <span className="font-semibold text-white">{lastBooking.date_formatted}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-[#777]">Horário</span>
              <span className="font-semibold text-white font-mono">{lastBooking.time}</span>
            </div>
            <div className="flex justify-between items-center text-xs pt-3 border-t border-[#222]">
              <span className="text-[#777]">Total</span>
              <span className="font-bold text-base font-mono" style={{ color: themeColor }}>
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                  lastBooking.service_price
                )}
              </span>
            </div>
          </div>

          <p className="text-[#888] text-xs mb-4">
            Toque no botão abaixo para enviar os detalhes ao proprietário no WhatsApp.
          </p>

          {/* Botão de WhatsApp direcionado ao dono com mensagem de prospecção */}
          <a
            href={waUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2.5 w-full bg-[#25D366] hover:bg-[#20ba59] text-white font-bold py-4 px-6 rounded-2xl text-sm transition-all shadow-xl shadow-[#25D366]/20 active:scale-98 mb-3"
          >
            <WhatsAppIcon className="w-5 h-5" />
            <span>Enviar para o WhatsApp</span>
          </a>

          {/* Botão para Acessar o Portal do Cliente e gerenciar o agendamento */}
          <button
            onClick={() => setCurrentView('portal')}
            className="w-full py-3.5 px-4 rounded-xl bg-[#1c1c1c] hover:bg-[#252525] border border-[#2a2a2a] text-xs font-bold text-white transition-all flex items-center justify-center gap-2 mb-2"
          >
            <CalendarCheck className="w-4 h-4 text-amber-400" />
            <span>Acessar Meu Histórico (Portal do Cliente)</span>
          </button>

          <button
            onClick={() => {
              setCurrentView('store');
              setStep(1);
              setSelectedService(null);
              setSelectedProfessional(null);
            }}
            className="text-xs text-[#888] hover:text-white transition-colors py-2"
          >
            Voltar para o Salão / Fazer Outro Agendamento
          </button>
        </motion.div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ── VIEW 2: PORTAL DO CLIENTE (ESTILO CLIENTPORTAL FIEL) ────────────────────
  // ════════════════════════════════════════════════════════════════════════════
  if (currentView === 'portal') {
    const rawCleanPhone = portalPhoneInput.replace(/\D/g, '');
    const userBookings = clientBookings.filter(
      (b) => !rawCleanPhone || b.customer_phone.includes(rawCleanPhone) || rawCleanPhone.includes(b.customer_phone)
    );
    const upcomingBookings = userBookings.filter((b) => b.status === 'confirmed');
    const pastBookings = userBookings.filter((b) => b.status === 'canceled' || b.status === 'completed');

    return (
      <div className="min-h-screen bg-[#070707] text-white font-sans pb-24">
        {/* Cover Banner do Portal */}
        <div className="relative w-full h-44 sm:h-52 bg-neutral-900 overflow-hidden">
          <div
            className="w-full h-full relative"
            style={{
              background: `linear-gradient(135deg, ${themeColor}35 0%, #070707 100%)`,
            }}
          />
          <button
            onClick={() => setCurrentView('store')}
            className="absolute top-4 left-4 z-20 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-black/60 backdrop-blur-xl text-white text-xs font-bold border border-white/20 hover:bg-black/80 transition-all active:scale-95"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Voltar ao Salão</span>
          </button>
        </div>

        {/* Perfil do Salão no Cabeçalho */}
        <div className="max-w-2xl mx-auto px-4 relative z-10 flex flex-col items-center text-center -mt-16 sm:-mt-20 mb-8">
          <div
            className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl overflow-hidden relative shadow-2xl mb-3.5 border-4 border-[#070707]"
            style={{ backgroundColor: `${themeColor}20` }}
          >
            {demo.logo_url ? (
              <img
                src={demo.logo_url}
                alt={demo.business_name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center font-black text-3xl sm:text-4xl"
                style={{
                  background: `linear-gradient(135deg, ${themeColor}, ${themeColor}cc)`,
                  color: '#000',
                }}
              >
                {demo.business_name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          <span
            className="inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border mb-1.5"
            style={{
              borderColor: `${themeColor}40`,
              backgroundColor: `${themeColor}15`,
              color: themeColor,
            }}
          >
            Portal do Cliente
          </span>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            {demo.business_name}
          </h1>

          <p className="text-xs sm:text-sm text-[#888] mt-1 max-w-sm">
            Gerencie seus agendamentos, remarque ou cancele seus horários quando precisar.
          </p>

          {isPortalLoggedIn && (
            <div className="flex items-center gap-2 mt-3">
              <span className="text-xs text-[#aaa]">
                Conectado como <strong>{portalPhoneInput}</strong>
              </span>
              <button
                onClick={() => {
                  setIsPortalLoggedIn(false);
                  setPortalPhoneInput('');
                }}
                className="text-xs text-amber-400 hover:underline flex items-center gap-1 font-semibold"
              >
                <LogOut className="w-3 h-3" /> Trocar
              </button>
            </div>
          )}
        </div>

        {/* Conteúdo Principal do Portal */}
        <div className="max-w-xl mx-auto px-4">
          {!isPortalLoggedIn ? (
            /* Tela de Login com Telefone */
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#0f0f0f] border border-[#222] rounded-3xl p-6 sm:p-8 shadow-2xl"
            >
              <div className="text-center mb-6">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
                  style={{ backgroundColor: `${themeColor}20`, color: themeColor }}
                >
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-white mb-1">Acessar Meus Agendamentos</h2>
                <p className="text-xs text-[#888] leading-relaxed">
                  Digite seu WhatsApp para consultar, remarcar ou cancelar seus horários no salão{' '}
                  <strong>{demo.business_name}</strong>.
                </p>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!portalPhoneInput.trim()) {
                    toast.error('Informe seu número de WhatsApp');
                    return;
                  }
                  setIsPortalLoggedIn(true);
                  toast.success('Agendamentos carregados!');
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs font-bold uppercase text-[#aaa] mb-2 tracking-wider">
                    Número do WhatsApp com DDD
                  </label>
                  <input
                    type="tel"
                    value={portalPhoneInput}
                    onChange={(e) => setPortalPhoneInput(formatPhoneMask(e.target.value))}
                    placeholder="(27) 99730-3135"
                    className="w-full p-3.5 rounded-2xl bg-[#141414] border border-[#2a2a2a] focus:border-[#D4AF37] focus:outline-none text-white font-mono text-sm"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-4 rounded-2xl font-bold text-sm text-black transition-all hover:scale-[1.01] active:scale-98 shadow-xl"
                  style={{ backgroundColor: themeColor }}
                >
                  Consultar Agendamentos →
                </button>
              </form>
            </motion.div>
          ) : (
            /* Tela dos Agendamentos do Cliente Logado */
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              {/* Tabs: Próximos vs Histórico */}
              <div className="flex rounded-2xl bg-[#121212] p-1 border border-[#222]">
                <button
                  onClick={() => setPortalActiveTab('upcoming')}
                  className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${
                    portalActiveTab === 'upcoming'
                      ? 'bg-[#222] text-white shadow-md'
                      : 'text-[#777] hover:text-white'
                  }`}
                >
                  Próximos ({upcomingBookings.length})
                </button>
                <button
                  onClick={() => setPortalActiveTab('history')}
                  className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${
                    portalActiveTab === 'history'
                      ? 'bg-[#222] text-white shadow-md'
                      : 'text-[#777] hover:text-white'
                  }`}
                >
                  Histórico ({pastBookings.length})
                </button>
              </div>

              {/* Lista dos Agendamentos Ativos */}
              {portalActiveTab === 'upcoming' && (
                <div className="space-y-4">
                  {upcomingBookings.length === 0 ? (
                    <div className="bg-[#0f0f0f] border border-[#222] rounded-3xl p-8 text-center space-y-4">
                      <div className="w-12 h-12 rounded-2xl bg-[#181818] flex items-center justify-center mx-auto text-[#666]">
                        <Calendar className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-base">Nenhum horário agendado</h3>
                        <p className="text-xs text-[#777] mt-1">
                          Você não possui nenhum agendamento pendente no momento.
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setCurrentView('store');
                          setStep(1);
                        }}
                        className="py-3 px-6 rounded-xl font-bold text-xs text-black transition-all"
                        style={{ backgroundColor: themeColor }}
                      >
                        Agendar Agora
                      </button>
                    </div>
                  ) : (
                    upcomingBookings.map((b) => (
                      <motion.div
                        key={b.id}
                        layout
                        className="bg-[#0f0f0f] border border-[#222] rounded-3xl p-5 sm:p-6 space-y-4 shadow-xl"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              Confirmado
                            </span>
                            <h3 className="text-base font-bold text-white mt-2">{b.service_name}</h3>
                            <p className="text-xs text-[#888] mt-0.5 flex items-center gap-1 font-mono">
                              <Clock className="w-3.5 h-3.5 text-[#666]" />
                              {b.service_duration} min •{' '}
                              <span style={{ color: themeColor }}>
                                {new Intl.NumberFormat('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL',
                                }).format(b.service_price)}
                              </span>
                            </p>
                          </div>
                          <span className="text-[10px] font-mono text-[#555] bg-[#141414] px-2 py-1 rounded-lg border border-[#222]">
                            #{b.order_number}
                          </span>
                        </div>

                        {/* Detalhes de Data, Hora e Profissional */}
                        <div className="bg-[#141414] rounded-2xl p-4 border border-[#202020] grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-[#666] block mb-0.5">
                              Data &amp; Horário
                            </span>
                            <span className="font-bold text-white block">{b.date_formatted}</span>
                            <span className="text-white font-mono font-bold" style={{ color: themeColor }}>
                              às {b.time}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-[#666] block mb-0.5">
                              Profissional
                            </span>
                            <span className="font-bold text-white block">{b.professional_name}</span>
                            <span className="text-[11px] text-[#777]">Especialista</span>
                          </div>
                        </div>

                        {/* Ações de Reagendamento e Cancelamento */}
                        <div className="pt-2 flex items-center gap-2.5">
                          <button
                            onClick={() => {
                              setRescheduleBooking(b);
                              setRescheduleNewDate(startOfDay(new Date()));
                              setRescheduleNewTime(b.time);
                            }}
                            className="flex-1 py-3 rounded-xl bg-[#1c1c1c] hover:bg-[#252525] border border-[#2c2c2c] text-xs font-bold text-white transition-all flex items-center justify-center gap-1.5"
                          >
                            <Calendar className="w-3.5 h-3.5 text-amber-400" />
                            <span>Remarcar Horário</span>
                          </button>
                          <button
                            onClick={() => setCancelBookingTarget(b)}
                            className="py-3 px-4 rounded-xl border border-red-500/20 text-red-400 hover:bg-red-500/10 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Cancelar</span>
                          </button>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              )}

              {/* Aba de Histórico (Cancelados e Concluídos) */}
              {portalActiveTab === 'history' && (
                <div className="space-y-3">
                  {pastBookings.length === 0 ? (
                    <div className="bg-[#0f0f0f] border border-[#222] rounded-3xl p-8 text-center text-xs text-[#777]">
                      Nenhum agendamento anterior registrado.
                    </div>
                  ) : (
                    pastBookings.map((b) => (
                      <div
                        key={b.id}
                        className="bg-[#0d0d0d] border border-[#1e1e1e] rounded-2xl p-4 text-xs space-y-2 opacity-80"
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-white text-sm">{b.service_name}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                            {b.status === 'canceled' ? 'Cancelado' : 'Concluído'}
                          </span>
                        </div>
                        <p className="text-[#888]">
                          {b.date_formatted} às {b.time} • Profissional: {b.professional_name}
                        </p>
                        {b.cancel_reason && (
                          <p className="text-[#666] text-[11px] italic">Motivo: {b.cancel_reason}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Botão para Agendar Mais */}
              <div className="pt-4 text-center">
                <button
                  onClick={() => {
                    setCurrentView('store');
                    setStep(1);
                  }}
                  className="w-full py-4 rounded-2xl bg-[#141414] hover:bg-[#1a1a1a] border border-[#262626] text-xs font-bold text-white transition-all"
                >
                  + Agendar Novo Serviço
                </button>
              </div>
            </motion.div>
          )}
        </div>

        {/* ── MODAL REAGENDAMENTO NO PORTAL ── */}
        <AnimatePresence>
          {rescheduleBooking && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-[#0f0f0f] border border-[#262626] rounded-3xl p-6 max-w-md w-full space-y-5 shadow-2xl"
              >
                <div className="flex items-center justify-between pb-3 border-b border-[#222]">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-amber-400" />
                    <h3 className="font-bold text-white text-base">Remarcar Horário</h3>
                  </div>
                  <button
                    onClick={() => setRescheduleBooking(null)}
                    className="p-1 rounded-lg text-[#777] hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <p className="text-xs text-[#888]">
                    Selecione a nova data e o novo horário para:{' '}
                    <strong className="text-white">{rescheduleBooking.service_name}</strong>
                  </p>
                </div>

                {/* Carrossel de Dias */}
                <div>
                  <label className="block text-[11px] font-bold text-[#aaa] uppercase tracking-wider mb-2">
                    Novo Dia
                  </label>
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                    {nextDays.map((d, idx) => {
                      const isSel =
                        format(rescheduleNewDate, 'yyyy-MM-dd') === format(d, 'yyyy-MM-dd');
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setRescheduleNewDate(d)}
                          className={`flex-shrink-0 w-14 py-2.5 rounded-xl border text-center transition-all ${
                            isSel
                              ? 'bg-amber-400 border-amber-400 text-black font-bold shadow-lg'
                              : 'bg-[#161616] border-[#262626] text-[#888] hover:border-[#333]'
                          }`}
                        >
                          <span className="block text-[9px] uppercase font-semibold">
                            {format(d, 'EEE', { locale: ptBR })}
                          </span>
                          <span className="block text-sm font-extrabold mt-0.5">
                            {format(d, 'dd')}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Grade de Horários */}
                <div>
                  <label className="block text-[11px] font-bold text-[#aaa] uppercase tracking-wider mb-2">
                    Novo Horário
                  </label>
                  <div className="grid grid-cols-4 gap-2 max-h-36 overflow-y-auto">
                    {AVAILABLE_TIMES.map((t) => {
                      const isSel = rescheduleNewTime === t;
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setRescheduleNewTime(t)}
                          className={`py-2 rounded-xl text-xs font-semibold border text-center transition-all ${
                            isSel
                              ? 'bg-amber-400/20 border-amber-400 text-white font-bold'
                              : 'bg-[#141414] border-[#262626] text-[#ccc]'
                          }`}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    onClick={() => setRescheduleBooking(null)}
                    className="flex-1 py-3 rounded-xl bg-[#1a1a1a] text-xs font-bold text-[#888] hover:text-white"
                  >
                    Voltar
                  </button>
                  <button
                    onClick={handleConfirmReschedule}
                    className="flex-1 py-3 rounded-xl bg-amber-400 hover:bg-amber-500 text-xs font-bold text-black shadow-lg"
                  >
                    Confirmar Reagendamento
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* ── MODAL CANCELAMENTO NO PORTAL ── */}
        <AnimatePresence>
          {cancelBookingTarget && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-[#121212] border border-[#2a2a2a] rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-center"
              >
                <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 mx-auto flex items-center justify-center">
                  <Trash2 className="w-6 h-6" />
                </div>

                <div>
                  <h3 className="font-bold text-white text-base">Cancelar Agendamento?</h3>
                  <p className="text-xs text-[#888] mt-1">
                    Você tem certeza que deseja cancelar{' '}
                    <strong>{cancelBookingTarget.service_name}</strong> marcado para{' '}
                    {cancelBookingTarget.date_formatted} às {cancelBookingTarget.time}?
                  </p>
                </div>

                <div className="text-left">
                  <label className="block text-[10px] font-bold uppercase text-[#777] mb-1.5">
                    Motivo do cancelamento:
                  </label>
                  <select
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    className="w-full bg-[#181818] border border-[#2a2a2a] rounded-xl p-2.5 text-xs text-white focus:outline-none"
                  >
                    <option value="Imprevisto de agenda">Imprevisto de agenda</option>
                    <option value="Problema pessoal">Problema pessoal</option>
                    <option value="Vou agendar em outro dia">Vou agendar em outro dia</option>
                    <option value="Outro">Outro motivo</option>
                  </select>
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    onClick={() => setCancelBookingTarget(null)}
                    className="flex-1 py-2.5 rounded-xl bg-[#1c1c1c] text-xs font-bold text-white"
                  >
                    Manter Horário
                  </button>
                  <button
                    onClick={handleConfirmCancel}
                    className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-bold text-white"
                  >
                    Sim, Cancelar
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ── VIEW 3: TELA PRINCIPAL (LAYOUT PUBLIC STORE FIEL) ───────────────────────
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-[#070707] text-white font-sans antialiased selection:bg-amber-500 selection:text-black">
      {/* ── Top Bar Discreta com Selo de Demonstração ── */}
      <header className="sticky top-0 z-40 bg-[#070707]/90 backdrop-blur-md border-b border-[#1a1a1a] px-4 py-2.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border shadow-sm"
              style={{
                backgroundColor: `${themeColor}15`,
                color: themeColor,
                borderColor: `${themeColor}40`,
              }}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Demonstração Interativa
            </span>
            <span className="text-[11px] text-[#666] hidden sm:inline">
              Teste personalizado para o seu negócio
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentView('portal')}
              className="text-xs font-semibold text-[#aaa] hover:text-white flex items-center gap-1.5 transition-colors"
            >
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              <span>Meus Agendamentos</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── LAYOUT PRINCIPAL SPLIT: SIDEBAR ESQUERDA + CONTEÚDO DIREITA ── */}
      <div className="flex flex-col lg:flex-row min-h-screen w-full max-w-7xl mx-auto">
        {/* ── SIDEBAR ESQUERDA (PERFIL DO ESTABELECIMENTO) ── */}
        <aside className="relative lg:w-[400px] xl:w-[430px] lg:h-screen lg:sticky lg:top-12 lg:self-start border-b lg:border-b-0 lg:border-r border-[#1a1a1a] overflow-y-auto scrollbar-none flex flex-col shrink-0 bg-[#0a0a0a]">
          {/* Cover Banner */}
          <div className="relative w-full h-44 sm:h-52 shrink-0 overflow-hidden bg-neutral-900">
            <div
              className="w-full h-full relative"
              style={{
                background: `linear-gradient(135deg, ${themeColor}35 0%, #0a0a0a 100%)`,
              }}
            />
          </div>

          {/* Perfil & Informações */}
          <div className="px-6 sm:px-8 relative z-10 flex flex-col items-center text-center -mt-16 sm:-mt-20 pb-8">
            {/* Logo Avatar */}
            <div
              className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl overflow-hidden relative shadow-2xl mb-3.5 border-4 border-[#0a0a0a]"
              style={{
                backgroundColor: `${themeColor}20`,
                borderColor: '#0a0a0a',
              }}
            >
              {demo.logo_url ? (
                <img
                  src={demo.logo_url}
                  alt={demo.business_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center font-black text-3xl sm:text-4xl"
                  style={{
                    background: `linear-gradient(135deg, ${themeColor}, ${themeColor}cc)`,
                    color: '#000',
                  }}
                >
                  {demo.business_name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            {/* Nome do Negócio */}
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              {demo.business_name}
            </h1>

            {/* Rating Pill */}
            <div className="inline-flex items-center gap-2 mt-2 px-3 py-1 rounded-full border border-[#222] bg-[#141414] text-xs font-semibold">
              <span className="flex items-center gap-1 font-bold text-amber-400">
                <Star className="w-3.5 h-3.5 fill-current" /> 5.0
              </span>
              <span className="opacity-40">•</span>
              <span className="text-[#888]">Barbearia &amp; Salão</span>
            </div>

            {/* Slogan & Descrição */}
            <p className="mt-3.5 text-xs sm:text-sm text-[#888] leading-relaxed max-w-[320px]">
              Agende seu horário online em menos de 1 minuto com os melhores profissionais.
            </p>

            {/* Ações Mobile e Desktop */}
            <div className="mt-5 w-full flex items-center justify-center gap-2.5 max-w-[320px]">
              <button
                type="button"
                onClick={() => setCurrentView('portal')}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl font-bold text-xs bg-[#161616] hover:bg-[#202020] border border-[#262626] text-white transition-all active:scale-95 shadow-sm"
              >
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                Agendamentos
              </button>

              <button
                type="button"
                onClick={() => setShowInfoModal(true)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl font-bold text-xs bg-[#161616] hover:bg-[#202020] border border-[#262626] text-white transition-all active:scale-95 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5 text-amber-400" />
                Informações
              </button>
            </div>

            {/* WhatsApp Link Direto */}
            <div className="mt-3 w-full max-w-[320px]">
              <a
                href={`https://wa.me/${demo.owner_whatsapp.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-[#262626] bg-[#121212] hover:bg-[#1a1a1a] text-xs font-bold text-[#aaa] hover:text-white transition-colors"
              >
                <WhatsAppIcon className="w-4 h-4 text-emerald-400" />
                <span>Falar no WhatsApp</span>
              </a>
            </div>
          </div>
        </aside>

        {/* ── CONTEÚDO PRINCIPAL À DIREITA: WIZARD DE AGENDAMENTO ── */}
        <main className="flex-1 flex flex-col min-w-0 bg-[#070707] pb-24">
          {/* Step Indicator Header */}
          <div className="w-full border-b border-[#1a1a1a] bg-[#090909]/80 backdrop-blur-md sticky top-10 z-30 px-4 py-3 sm:py-4">
            <div className="w-full max-w-2xl mx-auto">
              <div className="flex items-center justify-between relative">
                {STEP_LABELS.map((label, i) => {
                  const num = i + 1;
                  const done = step > num;
                  const active = step === num;

                  return (
                    <div key={num} className="flex-1 flex flex-col items-center relative z-10">
                      <div className="flex items-center w-full">
                        {/* Linha Esquerda */}
                        <div
                          className="flex-1 h-[2px] transition-all duration-300"
                          style={{
                            background: i === 0 ? 'transparent' : step >= num ? themeColor : '#222',
                            opacity: i === 0 ? 0 : 1,
                          }}
                        />

                        {/* Pílula do Número */}
                        <button
                          type="button"
                          onClick={() => {
                            if (num < step) setStep(num);
                          }}
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all ${
                            num < step ? 'cursor-pointer hover:scale-105' : 'cursor-default'
                          }`}
                          style={{
                            background: done || active ? themeColor : '#181818',
                            color: done || active ? '#000' : '#777',
                            border: done || active ? 'none' : '1px solid #2e2e2e',
                          }}
                        >
                          {done ? <Check className="w-4 h-4 stroke-[3]" /> : num}
                        </button>

                        {/* Linha Direita */}
                        <div
                          className="flex-1 h-[2px] transition-all duration-300"
                          style={{
                            background:
                              i === STEP_LABELS.length - 1
                                ? 'transparent'
                                : step > num
                                ? themeColor
                                : '#222',
                            opacity: i === STEP_LABELS.length - 1 ? 0 : 1,
                          }}
                        />
                      </div>

                      {/* Label */}
                      <span
                        className="text-[10px] sm:text-[11px] font-semibold tracking-tight mt-1.5 transition-colors hidden xs:block"
                        style={{
                          color: active ? themeColor : done ? '#fff' : '#666',
                        }}
                      >
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── VIEWS DOS PASSOS ── */}
          <div className="flex-1 px-4 sm:px-8 py-6 max-w-4xl mx-auto w-full">
            <AnimatePresence mode="wait">
              {/* ───────────────── PASSO 1: ESCOLHA DO SERVIÇO ───────────────── */}
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  <div>
                    <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
                      O que você deseja fazer?
                    </h2>
                    <p className="text-xs sm:text-sm text-[#888] mt-1 font-medium">
                      Selecione o serviço para iniciar seu agendamento.
                    </p>
                  </div>

                  {/* Barra de Busca de Serviços */}
                  <div className="relative w-full max-w-md">
                    <Search className="w-4 h-4 text-[#666] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Buscar serviço..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-2xl text-xs sm:text-sm bg-[#121212] border border-[#222] text-white placeholder-[#555] focus:outline-none focus:border-[#D4AF37] transition-all"
                    />
                  </div>

                  {/* Grid de Serviços */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {filteredServices.map((service) => {
                      const isSelected = selectedService?.id === service.id;

                      return (
                        <motion.button
                          key={service.id}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            setSelectedService(service);
                            setStep(2);
                          }}
                          className={`group relative text-left rounded-3xl border p-4 transition-all flex flex-col justify-between overflow-hidden cursor-pointer ${
                            isSelected
                              ? 'bg-[#161616] border-[#D4AF37]'
                              : 'bg-[#0f0f0f] border-[#222] hover:border-[#333]'
                          }`}
                        >
                          <div className="flex items-start gap-3.5 w-full">
                            {/* Foto do Serviço com miniatura refinada */}
                            <div className="w-20 h-20 rounded-2xl overflow-hidden shrink-0 border border-[#2a2a2a] bg-[#161616]">
                              {service.photo_url ? (
                                <img
                                  src={service.photo_url}
                                  alt={service.name}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                              ) : (
                                <div
                                  className="w-full h-full flex items-center justify-center"
                                  style={{ backgroundColor: `${themeColor}15` }}
                                >
                                  <Scissors className="w-7 h-7" style={{ color: themeColor }} />
                                </div>
                              )}
                            </div>

                            {/* Informações */}
                            <div className="flex-1 min-w-0">
                              <h3 className="text-sm font-bold text-white leading-snug line-clamp-2">
                                {service.name}
                              </h3>
                              <p className="text-xs text-[#777] mt-1 flex items-center gap-1.5 font-medium">
                                <Clock className="w-3.5 h-3.5 text-[#555]" />
                                {service.duration_minutes} min
                              </p>
                              <p className="text-sm font-bold text-white font-mono mt-2" style={{ color: themeColor }}>
                                {new Intl.NumberFormat('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL',
                                }).format(service.price)}
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 pt-3 border-t border-[#1c1c1c] flex items-center justify-between text-xs">
                            <span className="text-[#666]">Clique para agendar</span>
                            <span
                              className="font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform"
                              style={{ color: themeColor }}
                            >
                              Agendar <ChevronRight className="w-3.5 h-3.5" />
                            </span>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* ───────────────── PASSO 2: ESCOLHA DO PROFISSIONAL ───────────────── */}
              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
                        Com quem deseja agendar?
                      </h2>
                      <p className="text-xs sm:text-sm text-[#888] mt-1 font-medium">
                        Escolha um profissional ou deixe o sistema encontrar o horário mais rápido.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="text-xs text-[#888] hover:text-white flex items-center gap-1"
                    >
                      <ChevronLeft className="w-4 h-4" /> Voltar
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Opção Qualquer Profissional */}
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setSelectedProfessional('any');
                        setStep(3);
                      }}
                      className="p-4 rounded-3xl border border-[#D4AF37]/40 bg-[#D4AF37]/05 hover:bg-[#D4AF37]/10 flex items-center text-left transition-all cursor-pointer group"
                    >
                      <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center mr-3.5 shrink-0"
                        style={{ backgroundColor: `${themeColor}20`, color: themeColor }}
                      >
                        <Zap className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-sm text-white">Qualquer profissional</h3>
                        <p className="text-xs text-[#888] mt-0.5">Horário mais rápido disponível</p>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#D4AF37]/20 text-[#D4AF37]">
                        Recomendado
                      </span>
                    </motion.button>

                    {/* Lista dos Profissionais */}
                    {demo.professionals?.map((pro) => (
                      <motion.button
                        key={pro.id}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          setSelectedProfessional(pro);
                          setStep(3);
                        }}
                        className="p-4 rounded-3xl border border-[#222] bg-[#0f0f0f] hover:border-[#333] flex items-center text-left transition-all cursor-pointer group"
                      >
                        <div className="w-14 h-14 rounded-2xl overflow-hidden mr-3.5 shrink-0 border border-[#262626] bg-[#161616]">
                          {pro.photo_url ? (
                            <img
                              src={pro.photo_url}
                              alt={pro.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-base font-bold text-[#888]">
                              {pro.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-sm text-white truncate">{pro.name}</h3>
                          <p className="text-xs text-[#777] mt-0.5 truncate">
                            {pro.role_title || 'Profissional'}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-[#555] group-hover:translate-x-1 transition-transform" />
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* ───────────────── PASSO 3: ESCOLHA DA DATA & HORÁRIO ───────────────── */}
              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
                        Qual o melhor dia e horário?
                      </h2>
                      <p className="text-xs sm:text-sm text-[#888] mt-1 font-medium">
                        Selecione a data no calendário e escolha o horário.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="text-xs text-[#888] hover:text-white flex items-center gap-1"
                    >
                      <ChevronLeft className="w-4 h-4" /> Voltar
                    </button>
                  </div>

                  {/* Carrossel de 30 Dias */}
                  <div>
                    <p className="text-xs font-semibold text-[#888] uppercase tracking-wider mb-2.5">
                      Selecione o Dia
                    </p>
                    <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-none">
                      {nextDays.map((d, idx) => {
                        const isSelected =
                          format(selectedDate, 'yyyy-MM-dd') === format(d, 'yyyy-MM-dd');
                        const isToday = idx === 0;

                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setSelectedDate(d)}
                            className={`flex-shrink-0 w-16 py-3.5 px-2 rounded-2xl border text-center transition-all ${
                              isSelected
                                ? 'text-black shadow-xl font-bold'
                                : 'bg-[#0f0f0f] border-[#222] text-[#888] hover:border-[#333]'
                            }`}
                            style={
                              isSelected
                                ? {
                                    backgroundColor: themeColor,
                                    borderColor: themeColor,
                                    color: '#000',
                                  }
                                : {}
                            }
                          >
                            <span className="block text-[10px] uppercase tracking-wider font-semibold">
                              {isToday ? 'Hoje' : format(d, 'EEE', { locale: ptBR })}
                            </span>
                            <span className="block text-base font-extrabold mt-0.5">
                              {format(d, 'dd')}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Grade de Horários */}
                  <div>
                    <p className="text-xs font-semibold text-[#888] uppercase tracking-wider mb-2.5">
                      Horários Disponíveis em {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
                    </p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
                      {AVAILABLE_TIMES.map((timeSlot) => {
                        const isSelected = selectedTime === timeSlot;
                        return (
                          <button
                            key={timeSlot}
                            type="button"
                            onClick={() => {
                              setSelectedTime(timeSlot);
                              setStep(4);
                            }}
                            className={`py-3 rounded-2xl text-xs font-semibold border text-center transition-all cursor-pointer ${
                              isSelected
                                ? 'font-bold shadow-lg'
                                : 'bg-[#0f0f0f] border-[#222] text-[#ccc] hover:border-[#333]'
                            }`}
                            style={
                              isSelected
                                ? {
                                    backgroundColor: `${themeColor}25`,
                                    borderColor: themeColor,
                                    color: '#fff',
                                  }
                                : {}
                            }
                          >
                            {timeSlot}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ───────────────── PASSO 4: CONFIRMAÇÃO & DADOS ───────────────── */}
              {step === 4 && (
                <motion.div
                  key="step4"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
                        Confirmar agendamento
                      </h2>
                      <p className="text-xs sm:text-sm text-[#888] mt-1 font-medium">
                        Preencha seus dados para finalizar o agendamento.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="text-xs text-[#888] hover:text-white flex items-center gap-1"
                    >
                      <ChevronLeft className="w-4 h-4" /> Voltar
                    </button>
                  </div>

                  {/* Resumo Visual do Agendamento */}
                  <div className="bg-[#121212] border border-[#262626] rounded-3xl p-5 space-y-3.5 shadow-xl">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#777]">
                      Resumo da Reserva
                    </h3>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#888]">Serviço</span>
                      <span className="font-bold text-white">{selectedService?.name}</span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#888]">Profissional</span>
                      <span className="font-bold text-white">
                        {selectedProfessional === 'any'
                          ? 'Primeiro Disponível'
                          : selectedProfessional?.name}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#888]">Data &amp; Hora</span>
                      <span className="font-bold text-white">
                        {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })} às {selectedTime}
                      </span>
                    </div>

                    <div className="pt-3 border-t border-[#222] flex items-center justify-between text-sm">
                      <span className="font-medium text-white">Total a Pagar</span>
                      <span className="font-extrabold font-mono text-base" style={{ color: themeColor }}>
                        {selectedService
                          ? new Intl.NumberFormat('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            }).format(selectedService.price)
                          : 'R$ 0,00'}
                      </span>
                    </div>
                  </div>

                  {/* Formulário dos Dados do Cliente */}
                  <form onSubmit={handleConfirmBooking} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#aaa] uppercase tracking-wider mb-1.5">
                        Seu Nome Completo *
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Felipe Santos"
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        className="w-full bg-[#141414] border border-[#282828] rounded-2xl px-4 py-3 text-sm text-white placeholder-[#555] focus:outline-none focus:border-[#D4AF37]"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#aaa] uppercase tracking-wider mb-1.5">
                        WhatsApp com DDD *
                      </label>
                      <input
                        type="tel"
                        placeholder="Ex: (27) 99730-3135"
                        value={clientPhone}
                        onChange={(e) => setClientPhone(formatPhoneMask(e.target.value))}
                        className="w-full bg-[#141414] border border-[#282828] rounded-2xl px-4 py-3 text-sm text-white placeholder-[#555] focus:outline-none focus:border-[#D4AF37] font-mono"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#aaa] uppercase tracking-wider mb-1.5">
                        Observações (opcional)
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Algum detalhe importante para o atendimento?"
                        value={clientNotes}
                        onChange={(e) => setClientNotes(e.target.value)}
                        className="w-full bg-[#141414] border border-[#282828] rounded-2xl px-4 py-3 text-sm text-white placeholder-[#555] focus:outline-none focus:border-[#D4AF37]"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-4 rounded-2xl font-bold text-sm text-black shadow-2xl active:scale-98 transition-all flex items-center justify-center gap-2 mt-2"
                      style={{ backgroundColor: themeColor }}
                    >
                      <Check className="w-5 h-5 stroke-[3]" />
                      <span>Confirmar Agendamento</span>
                    </button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* ── MODAL INFORMAÇÕES (HORÁRIOS & LOCALIZAÇÃO) ── */}
      <AnimatePresence>
        {showInfoModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0f0f0f] border border-[#262626] rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-3 border-b border-[#222]">
                <h3 className="font-bold text-white text-base">Horários de Atendimento</h3>
                <button
                  onClick={() => setShowInfoModal(false)}
                  className="p-1 rounded-lg text-[#777] hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 text-xs">
                {WEEKDAYS_MAP.map((w, idx) => (
                  <div key={idx} className="flex justify-between items-center py-1 border-b border-[#181818]">
                    <span className="text-[#888]">{w.day}</span>
                    <span className="font-medium text-white">{w.hours}</span>
                  </div>
                ))}
              </div>

              <div className="pt-2 text-center">
                <button
                  onClick={() => setShowInfoModal(false)}
                  className="w-full py-2.5 rounded-xl bg-[#1c1c1c] text-xs font-semibold text-white"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
