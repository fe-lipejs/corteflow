import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useEffect, useState, type ReactNode } from 'react';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Clock3,
  CreditCard,
  DollarSign,
  Heart,
  Home,
  MapPin,
  Menu,
  MessageCircle,
  Monitor,
  MousePointer2,
  Palette,
  Scissors,
  ShieldCheck,
  Sparkles,
  Star,
  User,
  UserPlus,
  Users,
  WalletCards,
  X,
  Zap,
} from 'lucide-react';

import CookieConsentBanner from '../components/cookies/CookieConsentBanner';
import { usePageTracking } from '../hooks/usePageTracking';
import SpotifyMoodCard, {
  SpotifyGlyph,
  FloatingPlaylistBadge,
} from '../components/SpotifyMoodCard';

// 1. CORREÇÃO DO BUG: Função mock para o analytics local (não quebra o build)
const trackEvent = (eventName: string, data?: any) => {
  if (process.env.NODE_ENV === 'development') {
    console.log('[Analytics] Event:', eventName, data);
  }
};

// Utilitário de classes simples
function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const IMAGES = {
  hero: '/images/hero-atendimento.jpg',
  barber: '/images/barbearia.jpg',
  salon: '/images/salao-cachos.jpg',
  manicure: '/images/manicure-celular.jpg',
  autonomous: '/images/estilo-corte.jpg',
  domicile: '/images/map-dark.png',

  dashboard: '/images/dashboard-dark.png',
  agenda: '/images/dashboard-dark.png',
  booking: '/images/mockup-iphone-light.png',
  finance: '/images/dashboard-dark.png',

  themeNoir: '/images/custom-dark.png',
  themeClean: '/images/custom-light.png',
  themeLight: '/images/custom-light.png',
  themeAmber: '/images/custom-light.png',

  barberMobile: '/images/cliente-app.jpg',
  salonMobile: '/images/mockup-iphone-light.png',
  manicureMobile: '/images/manicure-celular.jpg',
};

function Reveal({
  children,
  delay = 0,
  className = '',
  y = 18,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  y?: number;
}) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: reduce ? 0 : y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-12% 0px' }}
      transition={{
        duration: reduce ? 0.35 : 0.75,
        delay: reduce ? 0 : delay,
        ease: EASE,
      }}
    >
      {children}
    </motion.div>
  );
}

function Eyebrow({ children, light = false }: { children: ReactNode; light?: boolean }) {
  return (
    <span
      className={[
        'mb-5 inline-flex items-center gap-2 font-mono',
        'text-[10px] font-medium uppercase tracking-[0.18em]',
        light ? 'text-[#B45309]' : 'text-[#F59E0B]',
      ].join(' ')}
    >
      <span className={['h-px w-4', light ? 'bg-[#B45309]' : 'bg-[#F59E0B]'].join(' ')} />
      {children}
    </span>
  );
}

function ImageOrPlaceholder({
  src,
  alt,
  className = '',
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return <div className={cn("bg-[#16161A]", className)} />;
  return <img src={src} alt={alt} onError={() => setFailed(true)} className={className} />;
}

// ==========================================
// CORREÇÕES NOS MOCKUPS (IMG 3 e 4)
// ==========================================

function BrowserFrame({
  children,
  title = 'Raffros',
  className = '',
  dark = true,
}: {
  children: ReactNode;
  title?: string;
  className?: string;
  dark?: boolean;
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-[22px] border shadow-2xl flex flex-col',
        dark ? 'border-white/[0.1] bg-[#0F0F12]' : 'border-black/[0.08] bg-white',
        className
      )}
    >
      <div
        className={cn(
          'flex h-10 shrink-0 items-center gap-2 border-b px-4',
          dark ? 'border-white/[0.07] bg-[#111114]' : 'border-black/[0.07] bg-[#F8F8F8]'
        )}
      >
        <span className="h-2 w-2 rounded-full bg-[#FF5F57]" />
        <span className="h-2 w-2 rounded-full bg-[#FEBC2E]" />
        <span className="h-2 w-2 rounded-full bg-[#28C840]" />
        <span className={cn('ml-3 text-[10px] font-mono', dark ? 'text-[#71717A]' : 'text-[#8A8A8F]')}>
          {title}
        </span>
      </div>
      <div className="flex-1 relative overflow-hidden">{children}</div>
    </div>
  );
}

function PhoneMockup({
  src,
  alt,
  className = '',
  children,
}: {
  src?: string;
  alt?: string;
  className?: string;
  children?: ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div
      className={cn(
        'relative rounded-[2.25rem] border-[6px] border-[#1A1A1E] bg-[#050506] shadow-[0_40px_90px_-30px_rgba(0,0,0,.9)]',
        className
      )}
    >
      {/* Notch do celular fixado perfeitamente */}
      <div className="absolute left-1/2 top-1.5 z-20 h-[16px] w-[64px] -translate-x-1/2 rounded-full bg-[#080809]" />

      {/* Tela do celular (padding zeredo para cobrir toda a tela - Correção IMG 3) */}
      <div className="relative h-full w-full overflow-hidden rounded-[1.8rem] bg-white">
        {src && !failed ? (
          <img
            src={src}
            alt={alt || ''}
            onError={() => setFailed(true)}
            className="h-full w-full object-cover object-top"
          />
        ) : (
          children
        )}
      </div>
    </div>
  );
}

function FloatingPhone({
  src,
  alt,
  className = '',
  delay = 0,
}: {
  src: string;
  alt: string;
  className?: string;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      animate={reduce ? undefined : { y: [0, -8, 0] }}
      transition={reduce ? undefined : { duration: 5, repeat: Infinity, ease: 'easeInOut', delay }}
      className={className}
    >
      <PhoneMockup src={src} alt={alt} className="h-full w-full" />
    </motion.div>
  );
}

function Stat({ label, value, dark = true }: { label: string; value: string; dark?: boolean }) {
  return (
    <div className={cn('rounded-2xl border p-4', dark ? 'border-white/[0.07] bg-white/[0.025]' : 'border-black/[0.07] bg-[#FAFAFA]')}>
      <span className={cn('block text-[10px] font-mono uppercase tracking-[0.12em]', dark ? 'text-[#71717A]' : 'text-[#86868B]')}>
        {label}
      </span>
      <strong className={cn('mt-2 block font-display text-[24px] tracking-[-0.03em]', dark ? 'text-white' : 'text-[#1D1D1F]')}>
        {value}
      </strong>
    </div>
  );
}

function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const close = () => setMenu(false);

  const links = [
    ['produto', 'Produto'],
    ['domicilio', 'Domicílio'],
    ['para-quem', 'Para quem é'],
    ['planos', 'Planos'],
  ];

  return (
    <>
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-[100] border-b px-5 md:px-10 transition-all duration-500',
          scrolled ? 'border-white/[0.08] bg-black/85 py-3 backdrop-blur-2xl' : 'border-transparent bg-transparent py-5'
        )}
      >
        <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-5">
          <a href="#hero" className="flex items-center gap-2.5" onClick={() => trackEvent('click_logo')}>
            <img src="/images/RaffrosLogo.png" alt="Raffros" className="h-8 w-auto" />
            <span className="font-display text-[19px] font-semibold tracking-[-0.02em] text-white">Raffros</span>
          </a>

          <nav className="hidden items-center gap-7 lg:flex">
            {links.map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                onClick={() => trackEvent('click_nav_link', { metadata: { item: id } })}
                className="text-[13px] text-[#A1A1A6] transition-colors hover:text-white"
              >
                {label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2.5">
            <Link
              to="/playlist"
              className="hidden items-center gap-1.5 rounded-full border border-[#F59E0B]/20 bg-[#F59E0B]/10 px-3 py-2 text-[11.5px] text-[#FBBF24] transition-colors hover:bg-[#F59E0B]/15 md:inline-flex"
            >
              <SpotifyGlyph className="h-3.5 w-3.5" />
              Som da Casa
            </Link>

            <Link to="/login" className="hidden px-2 text-[13px] text-[#A1A1A6] transition-colors hover:text-white md:inline-flex">
              Entrar
            </Link>

            {/* BOTÃO COM GRADIENTE LINDO (CORREÇÃO IMG 5) */}
            <a
              href="#planos"
              onClick={() => trackEvent('click_nav_comecar_agora')}
              className="hidden rounded-full px-5 py-2.5 text-[13px] font-semibold text-black transition-transform hover:scale-[1.03] md:inline-flex shadow-[0_0_20px_rgba(245,158,11,0.3)]"
              style={{ background: 'linear-gradient(135deg, #F59E0B, #FBBF24)' }}
            >
              Começar agora
            </a>

            <button
              type="button"
              onClick={() => setMenu(!menu)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.06] text-white lg:hidden"
            >
              {menu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {menu && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="fixed inset-0 z-[200] flex h-[100dvh] flex-col justify-between bg-black p-6 sm:p-10 lg:hidden"
          >
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-5">
              <a href="#hero" onClick={close} className="flex items-center gap-2.5">
                <img src="/images/RaffrosLogo.png" alt="Raffros" className="h-8 w-auto" />
                <span className="font-display text-[19px] font-semibold text-white">Raffros</span>
              </a>
              <button
                type="button"
                onClick={close}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.06] text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-col items-center gap-6 text-center">
              {links.map(([id, label]) => (
                <a key={id} href={`#${id}`} onClick={close} className="font-display text-[25px] font-medium text-white">
                  {label}
                </a>
              ))}
              <Link to="/playlist" onClick={close} className="mt-2 inline-flex items-center gap-2 font-display text-[20px] font-medium text-[#F59E0B]">
                <SpotifyGlyph className="h-4 w-4" />
                Som da Casa
              </Link>
              <Link to="/login" onClick={close} className="mt-1 font-mono text-[13px] text-[#71717A]">
                Entrar na conta →
              </Link>
            </div>

            <a
              href="#planos"
              onClick={close}
              className="flex w-full items-center justify-center rounded-full py-4 text-[15px] font-semibold text-black shadow-[0_0_20px_rgba(245,158,11,0.3)]"
              style={{ background: 'linear-gradient(135deg, #F59E0B, #FBBF24)' }}
            >
              Começar agora
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ==========================================
// MOCKUPS EM REACT MELHORADOS (Correções Img 1 e 4)
// ==========================================

function HeroClientMockup() {
  return (
    <PhoneMockup className="h-[460px] w-[230px]">
      <div className="relative flex h-full w-full flex-col bg-[#0A0A0C] text-white">
        <div className="relative h-28 w-full shrink-0">
          <ImageOrPlaceholder src={IMAGES.barber} alt="Cover" className="h-full w-full object-cover opacity-70" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0C] to-transparent" />
        </div>
        <div className="relative -mt-12 flex flex-col items-center px-4">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-[18px] border-4 border-[#0A0A0C] bg-[#111114] shadow-xl">
            <ImageOrPlaceholder src={IMAGES.barber} alt="Profile" className="h-full w-full object-cover" />
          </div>
          <h3 className="mt-2 font-display text-[16px] font-bold text-white">Kauan Barber</h3>
          <div className="mt-1.5 flex items-center gap-1.5 rounded-full bg-[#1A1A1E] px-2.5 py-1 text-[8px] border border-white/5">
            <Star className="h-2.5 w-2.5 text-[#F59E0B] fill-[#F59E0B]" />
            <span className="font-bold text-white">5.0</span>
            <span className="text-[#6E6E73]">•</span>
            <span className="text-[#A1A1A6]">Profissional</span>
          </div>
          <p className="mt-2 text-[8px] text-[#A1A1A6] text-center w-full truncate">O melhor serviço da região para você</p>
          <button className="mt-3 flex w-full shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#1A1A1E] border border-white/5 py-2.5 text-[9px] font-semibold transition-all hover:bg-white/5">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="#F59E0B">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
            </svg>
            WhatsApp
          </button>
        </div>

        <div className="mt-4 px-4 flex-1 flex flex-col min-h-0">
          <div className="shrink-0 overflow-hidden rounded-[14px] bg-[#111114] border border-white/5">
            <div className="flex items-center gap-2 p-2.5">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#F59E0B]/10">
                <MapPin className="h-3 w-3 text-[#F59E0B]" />
              </div>
              <div className="flex-1 min-w-0">
                <strong className="block text-[9px] font-semibold text-white truncate">Local & Horários</strong>
                <span className="block text-[7px] text-[#8A8A8F] truncate">Rua Agamalie de Moraes, n 254</span>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-center shrink-0">
            {[1, 2, 3, 4].map((step, i) => (
              <div key={step} className="flex items-center">
                <div className={cn("flex h-4 w-4 items-center justify-center rounded-full text-[7px] font-bold", i === 0 ? "bg-[#F59E0B] text-black" : "bg-[#111114] text-[#8A8A8F] border border-white/10")}>
                  {step}
                </div>
                {i < 3 && <div className="h-[1px] w-5 bg-white/10" />}
              </div>
            ))}
          </div>

          <div className="mt-3 flex-1 overflow-y-auto pb-4 space-y-2">
            {[
              ['Corte masculino', 'R$ 45'],
              ['Corte + Barba', 'R$ 70'],
              ['Barba', 'R$ 30'],
            ].map(([service, price], idx) => (
              <div key={service} className="relative overflow-hidden rounded-[12px] bg-[#111114] border border-white/5 p-3 shrink-0">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 pr-2">
                    <strong className="block text-[9px] font-medium text-white truncate">{service}</strong>
                    <span className="mt-1 block text-[8px] text-[#A1A1A6] truncate">{idx === 0 ? '45 min' : '30 min'}</span>
                  </div>
                  <span className="shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-[8px] font-bold text-white">
                    {price}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PhoneMockup>
  );
}

function FinanceMockup() {
  return (
    <BrowserFrame title="raffros.com / dashboard">
      <div className="flex min-h-[410px] w-full bg-[#0A0A0C] text-white">
        <aside className="hidden w-[160px] flex-col border-r border-white/[0.04] bg-[#0A0A0C] p-3 sm:flex">
          <div className="flex items-center gap-2 mb-6 mt-2 pl-2">
            <div className="h-7 w-7 shrink-0 overflow-hidden rounded-[8px]">
              <ImageOrPlaceholder src={IMAGES.manicure} alt="Profile" className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0">
              <strong className="block text-[9px] font-bold truncate">Maria Manicure</strong>
              <span className="block text-[6px] font-bold text-[#F59E0B] tracking-widest uppercase">Esmalteria</span>
            </div>
          </div>
          <nav className="flex-1 space-y-1">
            {[
              ['Visão geral', true],
              ['Agenda', false],
              ['Equipe', false],
              ['Serviços', false],
              ['Clientes', false],
              ['Financeiro', false],
            ].map(([label, active]) => (
              <div key={String(label)} className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-[9px] font-medium transition-colors", active ? "bg-[#F59E0B] text-black" : "text-[#A1A1A6]")}>
                <div className="h-3 w-3 bg-current opacity-70" style={{ mask: "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><rect x=\"3\" y=\"3\" width=\"7\" height=\"7\"></rect><rect x=\"14\" y=\"3\" width=\"7\" height=\"7\"></rect><rect x=\"14\" y=\"14\" width=\"7\" height=\"7\"></rect><rect x=\"3\" y=\"14\" width=\"7\" height=\"7\"></rect></svg>') center/contain no-repeat" }}></div>
                {String(label)}
              </div>
            ))}
          </nav>
        </aside>

        <main className="flex-1 p-5 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between shrink-0">
            <div>
              <h2 className="font-display text-[22px] font-bold tracking-tight">Boa noite, <span className="text-[#F59E0B]">Maria.</span></h2>
              <p className="text-[10px] text-[#71717A]">Você tem 5 agendamentos hoje.</p>
            </div>
            <button className="rounded-full bg-[#F59E0B] px-3 py-1.5 text-[9px] font-bold text-black shadow-lg shadow-[#F59E0B]/20">+ Agendar</button>
          </div>

          <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
            {[
              ['Agendamentos', '5', 'hoje', Calendar],
              ['Faturamento', 'R$ 450', 'hoje', DollarSign],
              ['Ocupação', '85%', 'hoje', Clock],
              ['Novos', '4 clientes', 'últimos 7 dias', UserPlus]
            ].map(([t, val, sub, Icon], i) => (
              <div key={i} className="rounded-[14px] bg-[#111114] p-3 flex flex-col justify-between border border-white/[0.04] min-w-0">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] text-[#A1A1A6] truncate pr-1">{t}</span>
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] bg-[#F59E0B]/10"><Icon className="h-2.5 w-2.5 text-[#F59E0B]" /></div>
                </div>
                <div className="mt-3">
                  <strong className="block font-display text-[18px] md:text-[22px] font-bold leading-none truncate">{val}</strong>
                  <span className="mt-1 text-[8px] font-bold text-[#F59E0B] truncate">{sub}</span>
                </div>
              </div>
            ))}
          </div>

          {/* CORREÇÃO IMG 4: Removido o sidebar para o conteúdo não espremer! */}
          <div className="mt-4 flex-1 rounded-[14px] bg-[#111114] p-4 flex flex-col relative overflow-hidden border border-white/[0.04]">
            <div className="flex items-center justify-between mb-2 shrink-0">
              <div>
                <strong className="block text-[12px] font-bold text-white">Agenda de hoje</strong>
                <span className="text-[8px] text-[#71717A]">5 horários confirmados</span>
              </div>
              <span className="text-[8px] font-bold text-[#F59E0B] cursor-pointer">Ver semana →</span>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 mt-1 space-y-2">
              {[
                ['10:00', 'João Cliente', 'Corte + Barba', 'R$ 70,00'],
                ['11:30', 'Marcos', 'Pé e Mão', 'R$ 50,00'],
                ['14:00', 'Kauan', 'Corte Degradê', 'R$ 45,00'],
                ['15:30', 'Juliana', 'Coloração', 'R$ 120,00'],
              ].map(([time, name, serv, val], i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 p-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-[11px] font-bold text-[#F59E0B] w-8 shrink-0">{time}</span>
                    <div className="min-w-0">
                      <span className="block text-[10px] font-bold text-white truncate">{name}</span>
                      <span className="block text-[9px] text-[#8A8A8F] truncate">{serv}</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-white shrink-0 pl-2">{val}</span>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </BrowserFrame>
  );
}

function Hero() {
  const reduce = useReducedMotion();

  return (
    <section id="hero" className="relative min-h-[100svh] overflow-hidden bg-black px-5 pb-16 pt-28 text-white md:px-10 md:pb-20 md:pt-32 flex items-center">
      {/* BACKGROUND DA HERO: Fundo limpo, profissional (Correção IMG 2) */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute left-[5%] top-[-10%] h-[400px] w-[400px] rounded-full bg-[#F59E0B]/[0.08] blur-[120px]" />
        <div className="absolute right-[10%] top-[20%] h-[500px] w-[500px] rounded-full bg-[#B45309]/[0.06] blur-[130px]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_40%,rgba(0,0,0,1)_100%)]" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-[1240px]">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_0.9fr] lg:gap-10">
          <div>
            <Reveal delay={0.05}>
              <h1 className="max-w-[720px] font-display text-[clamp(3.15rem,7.8vw,6.4rem)] font-semibold leading-[0.89] tracking-[-0.05em] text-white">
                Sua agenda.
                <br />
                Seu ritmo.
                <br />
                <span className="bg-gradient-to-br from-[#FBBF24] via-[#F59E0B] to-[#25D366] bg-clip-text text-transparent">
                  Sem WhatsApp.
                </span>
              </h1>
            </Reveal>

            <Reveal delay={0.1}>
              <p className="mt-6 max-w-[510px] text-[15px] leading-7 text-[#A1A1A6] md:text-[17px]">
                Cliente escolhe, agenda, paga o sinal e recebe a confirmação.
                <span className="text-white"> Você atende. A Raffros organiza.</span>
              </p>
            </Reveal>

            <Reveal delay={0.15}>
              <div className="mt-8 flex flex-wrap gap-4">
                {/* BOTÃO CORRIGIDO: Gradient brilhante e sombra (IMG 5) */}
                <a
                  href="#planos"
                  onClick={() => trackEvent('click_hero_comecar_agora')}
                  className="inline-flex items-center gap-2 rounded-full px-8 py-4 text-[14px] font-bold text-black transition-transform hover:scale-[1.03] shadow-[0_0_30px_rgba(245,158,11,0.4)]"
                  style={{ background: 'linear-gradient(135deg, #F59E0B, #FBBF24)' }}
                >
                  Começar agora
                  <ArrowRight className="h-4 w-4" />
                </a>
                <a
                  href="#produto"
                  onClick={() => trackEvent('click_hero_conhecer')}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 px-8 py-4 text-[14px] font-medium text-white hover:bg-white/5 transition-colors"
                >
                  Ver como funciona
                </a>
              </div>
            </Reveal>

            <Reveal delay={0.2}>
              <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[10px] text-[#71717A]">
                <span>7 dias grátis</span>
                <span>·</span>
                <span>Sem fidelidade</span>
                <span>·</span>
                <span>Feito para beleza</span>
              </div>
            </Reveal>
          </div>

          <div className="relative flex justify-center lg:justify-end min-h-[420px] md:min-h-[580px] w-full">
            <motion.div
              initial={{ opacity: 0, y: reduce ? 0 : 30 }}
              animate={{ opacity: 1, y: [0, -5, 0] }}
              transition={{
                opacity: { duration: 0.7, delay: 0.3, ease: EASE },
                y: { duration: 4.8, repeat: Infinity, ease: 'easeInOut', delay: 1 },
              }}
              className="relative z-10 w-[60%] max-w-[260px] sm:w-[50%] lg:w-[280px]"
            >
              <HeroClientMockup />
            </motion.div>
          </div>
        </div>

        <Reveal delay={0.25}>
          <div className="mt-16 grid grid-cols-2 overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.025] backdrop-blur-sm md:grid-cols-4">
            {[
              ['Agenda', 'online'],
              ['Sinal', 'anti-furo'],
              ['Financeiro', 'automático'],
              ['Domicílio', 'por raio'],
            ].map(([value, label], index) => (
              <div key={value} className={cn('px-4 py-5 md:px-7', index > 0 && 'border-l border-white/10', index > 1 && 'md:border-l')}>
                <strong className="block font-display text-[15px] font-semibold text-white">{value}</strong>
                <span className="mt-1 block text-[10px] text-[#71717A]">{label}</span>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Manifesto() {
  return (
    <section className="relative overflow-hidden bg-white px-5 py-24 text-[#1D1D1F] md:px-10 md:py-[130px]">
      <div className="relative mx-auto max-w-[1000px]">
        <Reveal>
          <Eyebrow light>Menos conversa. Mais trabalho.</Eyebrow>
          <h2 className="max-w-[900px] font-display text-[clamp(2.6rem,6.5vw,5.5rem)] font-semibold leading-[0.96] tracking-[-0.055em]">
            O celular toca.
            <br />
            O cliente espera.
            <br />
            <span className="text-[#A1A1A6]">A agenda não deveria atrapalhar.</span>
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="mt-12 grid gap-3 md:grid-cols-3">
            {[
              { icon: MessageCircle, title: 'Menos WhatsApp', text: 'Seu link recebe os agendamentos.' },
              { icon: ShieldCheck, title: 'Menos furos', text: 'O sinal protege seus horários.' },
              { icon: BarChart3, title: 'Mais controle', text: 'Agenda e dinheiro no mesmo lugar.' },
            ].map((item, index) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="relative overflow-hidden rounded-[24px] border border-black/10 bg-[#F8F8F8] p-6 transition-shadow hover:shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white shadow-sm">
                      <Icon className="h-5 w-5 text-[#B45309]" />
                    </div>
                    <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#8A8A8F]">0{index + 1}</span>
                  </div>
                  <h3 className="mt-8 font-display text-[20px] font-semibold">{item.title}</h3>
                  <p className="mt-2 max-w-[25ch] text-[13px] leading-6 text-[#6E6E73]">{item.text}</p>
                </div>
              );
            })}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function ProductIntro() {
  return (
    <section id="produto" className="bg-[#0A0A0C] px-5 py-24 text-white md:px-10 md:py-[140px]">
      <div className="mx-auto max-w-[1240px]">
        <div className="grid items-end gap-10 md:grid-cols-[1fr_0.75fr]">
          <Reveal>
            <Eyebrow>Seu negócio em uma tela</Eyebrow>
            <h2 className="max-w-[800px] font-display text-[clamp(2.7rem,6vw,5.2rem)] font-semibold leading-[0.94] tracking-[-0.05em]">
              A agenda que parece simples porque ela foi pensada para você.
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="max-w-[430px] text-[15px] leading-7 text-[#8A8A8F] md:ml-auto">
              Não é um sistema cheio de telas que você nunca abre. É uma operação visual para quem precisa atender, vender e saber o que entrou.
            </p>
          </Reveal>
        </div>
        <Reveal delay={0.08}>
          <div className="mt-16 w-full flex justify-center">
            {/* O BrowserFrame adaptado perfeitamente sem amassar */}
            <div className="w-full max-w-[800px]">
              <FinanceMockup />
            </div>
          </div>
        </Reveal>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {[
            { icon: CalendarDays, title: 'Agenda visual', text: 'Veja o seu dia inteiro sem depender de mensagens.' },
            { icon: Users, title: 'Equipe organizada', text: 'Cada profissional tem seus horários e serviços.' },
            { icon: WalletCards, title: 'Dinheiro visível', text: 'Acompanhe sinais, faturamento e comissão.' },
          ].map((item, index) => {
            const Icon = item.icon;
            return (
              <Reveal key={item.title} delay={index * 0.06}>
                <div className="h-full border border-white/[0.07] bg-white/[0.02] p-6 rounded-2xl">
                  <Icon className="h-5 w-5 text-[#F59E0B]" />
                  <h3 className="mt-5 font-display text-[17px] font-semibold">{item.title}</h3>
                  <p className="mt-2 text-[13px] leading-6 text-[#71717A]">{item.text}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function BelongingSection() {
  const [active, setActive] = useState<'barber' | 'salon' | 'nail'>('barber');
  const items = {
    barber: { label: 'Barbearia', title: 'Mais tempo cortando. Menos tempo respondendo.', image: IMAGES.barber, mockup: IMAGES.barberMobile },
    salon: { label: 'Salão', title: 'Cada profissional no seu horário. Tudo no mesmo lugar.', image: IMAGES.salon, mockup: IMAGES.salonMobile },
    nail: { label: 'Manicure', title: 'Seu trabalho é delicado. Sua agenda também pode ser.', image: IMAGES.manicure, mockup: IMAGES.manicureMobile },
  };
  const current = items[active];

  return (
    <section id="para-quem" className="bg-[#0A0A0C] px-5 py-24 text-white md:px-10 md:py-[150px]">
      <div className="mx-auto max-w-[1240px]">
        <Reveal>
          <Eyebrow>Sentimento de pertencimento</Eyebrow>
          <h2 className="max-w-[800px] font-display text-[clamp(2.7rem,6vw,5.2rem)] font-semibold leading-[0.94] tracking-[-0.055em]">
            Não importa como você atende.
            <br />
            <span className="text-[#71717A]">A Raffros entende o seu ritmo.</span>
          </h2>
        </Reveal>

        <div className="mt-12 flex flex-wrap gap-2 border-b border-white/[0.07] pb-5">
          {Object.entries(items).map(([key, item]) => (
            <button
              key={key}
              onClick={() => setActive(key as typeof active)}
              className={cn('rounded-full px-5 py-2.5 text-[12px] transition-all', active === key ? 'bg-white text-black' : 'border border-white/[0.1] text-[#8A8A8F] hover:text-white')}
            >
              {item.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={active} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.5 }} className="grid items-center gap-14 pt-14 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <h3 className="max-w-[600px] font-display text-[clamp(2rem,4vw,3.4rem)] font-semibold leading-[0.98]">{current.title}</h3>
              <div className="mt-8 flex flex-wrap gap-3 text-[11px] text-[#71717A]">
                <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[#F59E0B]" /> Página personalizada</span>
                <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[#F59E0B]" /> Agenda online</span>
                <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[#F59E0B]" /> Sinal anti-furo</span>
              </div>
            </div>
            <div className="relative min-h-[460px] sm:min-h-[540px]">
              <div className="absolute inset-0 overflow-hidden rounded-[30px] border border-white/[0.08]">
                <ImageOrPlaceholder src={current.image} alt={current.label} className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
              </div>
              <div className="absolute bottom-[-10px] right-[5%] w-[190px] sm:w-[220px]">
                <FloatingPhone src={current.mockup} alt={`Mockup ${current.label}`} className="h-[400px] sm:h-[450px]" />
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}

function Pricing() {
  const plans = [
    { name: 'Solo', price: 49, tag: 'Trabalha sozinho', items: ['Agenda ilimitada', '1 profissional', 'Sinal anti-furo', 'Página de agendamento', 'Controle financeiro'] },
    { name: 'Studio', price: 89, tag: 'Já tem equipe', featured: true, items: ['Tudo do Solo', 'Até 5 profissionais', 'Relatórios de gestão', 'Comissões', 'Personalização'] },
    { name: 'Equipe', price: 149, tag: 'Operação em escala', items: ['Tudo do Studio', 'Profissionais ilimitados', 'Múltiplas unidades', 'Gestão avançada'] },
  ];

  return (
    <section id="planos" className="bg-[#0A0A0C] px-5 py-24 text-white md:px-10 md:py-[150px]">
      <div className="mx-auto max-w-[1120px]">
        <div className="text-center">
          <Reveal>
            <Eyebrow>Planos</Eyebrow>
            <h2 className="mx-auto max-w-[800px] font-display text-[clamp(2.7rem,6vw,5rem)] font-semibold leading-[0.94] tracking-[-0.055em]">
              Se paga no primeiro furo evitado.
            </h2>
            <p className="mt-4 text-[14px] text-[#8A8A8F]">7 dias grátis. Sem fidelidade.</p>
          </Reveal>
        </div>
        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {plans.map((plan, index) => (
            <Reveal key={plan.name} delay={index * 0.06}>
              <div className={cn('relative flex h-full flex-col rounded-[25px] p-7 md:p-8', plan.featured ? 'border border-[#F59E0B] bg-[#121216] md:scale-[1.025] shadow-2xl' : 'border border-white/[0.08] bg-[#0F0F12]')}>
                {plan.featured && <span className="absolute -top-3 left-7 rounded-full px-3 py-1 font-mono text-[9px] font-bold text-black" style={{ background: 'linear-gradient(135deg, #F59E0B, #FBBF24)' }}>Mais escolhido</span>}
                <h3 className="font-display text-[20px] font-semibold">{plan.name}</h3>
                <p className="mt-1 text-[12px] text-[#71717A]">{plan.tag}</p>
                <div className="mt-7">
                  <span className="align-super font-mono text-[12px] text-[#71717A]">R$</span>
                  <strong className="ml-1 font-display text-[42px] font-semibold">{plan.price}</strong>
                  <span className="ml-1 text-[12px] text-[#71717A]">/mês</span>
                </div>
                <div className="my-7 h-px bg-white/[0.07]" />
                <ul className="flex flex-1 flex-col gap-3">
                  {plan.items.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-[12.5px] text-[#C9C9CE]">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#F59E0B]" /> {item}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/cadastro"
                  className={cn('mt-8 flex w-full items-center justify-center rounded-full px-6 py-3.5 text-[13px] font-bold', plan.featured ? 'text-black shadow-[0_0_20px_rgba(245,158,11,0.3)]' : 'border border-white/[0.12] text-white hover:border-[#F59E0B]')}
                  style={plan.featured ? { background: 'linear-gradient(135deg, #F59E0B, #FBBF24)' } : undefined}
                >
                  Começar agora
                </Link>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="relative overflow-hidden bg-black px-5 py-[130px] text-center text-white md:px-10 md:py-[180px]">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[450px] w-[450px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#F59E0B]/[0.05] blur-[110px]" />
      <div className="relative mx-auto max-w-[850px]">
        <Reveal>
          <Eyebrow>Pronto para simplificar?</Eyebrow>
          <h2 className="font-display text-[clamp(3rem,7vw,6rem)] font-semibold leading-[0.9] tracking-[-0.06em]">
            Você cuida do cliente.
            <br />
            <span className="text-[#F59E0B]">A Raffros cuida da agenda.</span>
          </h2>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link
              to="/cadastro"
              className="inline-flex items-center gap-2 rounded-full px-8 py-4 text-[14px] font-bold text-black transition-transform hover:scale-[1.03] shadow-[0_0_30px_rgba(245,158,11,0.4)]"
              style={{ background: 'linear-gradient(135deg, #F59E0B, #FBBF24)' }}
            >
              Começar agora
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <p className="mt-5 font-mono text-[10px] text-[#52525B]">7 dias grátis · sem fidelidade</p>
        </Reveal>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/[0.07] bg-black px-5 pb-12 pt-14 text-white md:px-10">
      <div className="mx-auto max-w-[1240px]">
        <div className="flex flex-col gap-9 md:flex-row md:items-center md:justify-between">
          <a href="#hero" className="flex items-center justify-center gap-2.5 md:justify-start">
            <img src="/images/RaffrosLogo.png" alt="Raffros" className="h-7 w-auto" />
            <span className="font-display text-[17px] font-semibold">Raffros</span>
          </a>
          <nav className="flex flex-wrap justify-center gap-x-6 gap-y-3">
            {[
              ['#produto', 'Produto'],
              ['#domicilio', 'Domicílio'],
              ['#para-quem', 'Para quem é'],
              ['#planos', 'Planos'],
            ].map(([href, label]) => (
              <a key={href} href={href} className="text-[11.5px] text-[#71717A] hover:text-[#F59E0B]">
                {label}
              </a>
            ))}
          </nav>
          <p className="text-center text-[10.5px] text-[#52525B] md:text-right">
            © {new Date().getFullYear()} Raffros.
          </p>
        </div>
      </div>
    </footer>
  );
}

function MobileCTA() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 560);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.45, ease: EASE }}
          className="fixed inset-x-0 bottom-0 z-[90] border-t border-white/10 bg-black/90 p-3 pb-[calc(env(safe-area-inset-bottom)+12px)] backdrop-blur-2xl md:hidden"
        >
          <a
            href="#planos"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full text-[13.5px] font-bold text-black shadow-[0_0_20px_rgba(245,158,11,0.4)]"
            style={{ background: 'linear-gradient(135deg, #F59E0B, #FBBF24)' }}
          >
            Começar agora
            <ArrowRight className="h-4 w-4" />
          </a>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-black pb-16 font-body text-white selection:bg-[#F59E0B] selection:text-black md:pb-0">
      <Header />
      <Hero />
      <Manifesto />
      <ProductIntro />
      <BelongingSection />
      <Pricing />
      <FinalCTA />
      <Footer />
      <CookieConsentBanner />
      <MobileCTA />
    </main>
  );
}