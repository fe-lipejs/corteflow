import {
  motion,
  animate,
  useInView,
  useReducedMotion,
  AnimatePresence,
  useScroll,
  useTransform,
  useMotionValue,
  useSpring,
} from 'framer-motion';
import { Link } from 'react-router-dom';
import { useState, useEffect, useRef, type ReactNode } from 'react';
import {
  MapPin,
  CheckCircle2,
  Scissors,
  Sparkles,
  Heart,
  User,
  Home,
  Menu,
  X,
  Zap,
  ArrowRight,
  CalendarDays,
  Users,
  WalletCards,
  DollarSign,
  BarChart3,
  Clock,
  Star,
  Smartphone,
  Shield,
  TrendingUp,
  ChevronDown,
} from 'lucide-react';
import CookieConsentBanner from '../components/cookies/CookieConsentBanner';
import { trackEvent } from '../lib/analytics';
import { usePageTracking } from '../hooks/usePageTracking';
import {
  SpotifyGlyph,
  HeroPlaylistLine,
  FloatingPlaylistBadge,
} from '../components/SpotifyMoodCard';

/* ============================================================
   CONSTANTS
   ============================================================ */

const EASE: [number, number, number, number] = [0.16, 0.8, 0.24, 1];
const EASE_IN: [number, number, number, number] = [0.4, 0, 1, 1];

const M = {
  phoneBooking: '/Mockups/Iphone - Tela de Agendamento.PNG',
  phoneServices: '/Mockups/Iphone - Serviços.PNG',
  phoneDomicilio: '/Mockups/Iphone - Tela de Escolha Domicilio.PNG',
  phonePaymentPix: '/Mockups/Iphone - Tela de Pagamento Pix.PNG',
  phonePayment: '/Mockups/Iphone - Tela de Pagamento.PNG',
  themeA: '/Mockups/Iphone - Personalização Tema 1.PNG',
  themeB: '/Mockups/Iphone - Personalização Tema 2.PNG',
  themeC: '/Mockups/Iphone - Personalização Tema 3.PNG',
  tabletBarber: '/Mockups/Tablet Horizontal - Tela de Agendamento Barbearia.png',
  tabletSalon: '/Mockups/Tablet Horizontal - Tela de Agendamento Salão.png',
  tabletMetrics: '/Mockups/Tablet Horizontal - Visão Geral Metricas.jpg',
};

/* ============================================================
   UTILITIES
   ============================================================ */

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

function CountUp({ to, suffix = '' }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-10%' });
  const reduce = useReducedMotion();
  const [value, setValue] = useState(reduce ? to : 0);

  useEffect(() => {
    if (inView && !reduce) {
      const controls = animate(0, to, {
        duration: 1.4,
        ease: [0.33, 1, 0.68, 1],
        onUpdate: (latest) => setValue(Math.round(latest)),
      });
      return () => controls.stop();
    }
  }, [inView, to, reduce]);

  return (
    <span ref={ref}>
      {value}
      {suffix}
    </span>
  );
}

function Reveal({
  children,
  delay = 0,
  className = '',
  y = 28,
  once = true,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  y?: number;
  once?: boolean;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: reduce ? 0 : y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: '-8% 0px' }}
      transition={{
        duration: reduce ? 0.3 : 0.85,
        delay: reduce ? 0 : delay,
        ease: EASE,
      }}
    >
      {children}
    </motion.div>
  );
}

function Eyebrow({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <span
      className={cn(
        'mb-5 inline-flex items-center gap-2.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.18em]',
        dark ? 'text-[#D97706]' : 'text-[#F59E0B]'
      )}
    >
      <span className={cn('h-[1px] w-5', dark ? 'bg-[#D97706]' : 'bg-[#F59E0B]')} />
      {children}
    </span>
  );
}

/* ============================================================
   HEADER
   ============================================================ */

function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isMobileMenuOpen]);

  const closeMenu = () => setIsMobileMenuOpen(false);

  const links = [
    ['solucao', 'Solução'],
    ['como-funciona', 'Como funciona'],
    ['para-quem', 'Para quem é'],
    ['planos', 'Planos'],
  ] as const;

  return (
    <>
      <header
        className={cn(
          'fixed left-0 right-0 top-0 z-[100] transition-all duration-500',
          isScrolled
            ? 'border-b border-white/[0.07] bg-black/90 py-3 backdrop-blur-[20px]'
            : 'py-5'
        )}
      >
        <div className="mx-auto flex max-w-[1360px] items-center justify-between gap-6 px-6 md:px-12">
          <a
            href="#hero"
            className="inline-flex items-center gap-2.5 font-display text-[20px] font-bold tracking-tight text-white"
          >
            <img
              src="/logo.svg"
              alt="Raffros"
              className="h-8 w-auto object-contain drop-shadow-[0_0_14px_rgba(245,158,11,0.4)]"
            />
            <span>Raffros</span>
          </a>

          <nav className="hidden gap-8 md:flex">
            {links.map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                onClick={() => trackEvent('click_nav_link', { metadata: { item: id } })}
                className="text-[14px] font-medium text-[#A1A1A6] transition-colors duration-200 hover:text-white"
              >
                {label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Link
              to="/playlist"
              onClick={() => trackEvent('click_nav_playlist')}
              className="mr-1 hidden items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/8 px-3.5 py-1.5 text-[13px] font-medium text-[#F59E0B] transition-all hover:border-amber-500/40 hover:bg-amber-500/15 lg:inline-flex"
            >
              <SpotifyGlyph className="h-3.5 w-3.5" />
              Som da Casa
            </Link>

            <Link
              to="/admin"
              onClick={() => trackEvent('click_nav_login')}
              className="hidden text-[14px] font-medium text-[#A1A1A6] transition-colors hover:text-white md:inline-flex"
            >
              Entrar
            </Link>

            <Link
              to="/cadastro"
              onClick={() => trackEvent('click_nav_comecar_agora')}
              className="hidden items-center justify-center rounded-full px-5 py-2.5 text-[13px] font-bold text-black shadow-[0_8px_24px_-8px_rgba(245,158,11,0.5)] transition-all hover:scale-105 hover:shadow-[0_12px_30px_-8px_rgba(245,158,11,0.65)] md:inline-flex"
              style={{ background: 'linear-gradient(135deg, #F59E0B, #FBBF24)' }}
            >
              Começar grátis
            </Link>

            <button
              type="button"
              aria-label={isMobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.12] bg-white/[0.06] text-white transition-all active:scale-95 md:hidden"
              onClick={() => {
                const next = !isMobileMenuOpen;
                setIsMobileMenuOpen(next);
                trackEvent(next ? 'open_mobile_menu' : 'close_mobile_menu');
              }}
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[200] flex h-[100dvh] w-full flex-col bg-black"
          >
            <div className="flex items-center justify-between border-b border-white/[0.08] px-6 py-5">
              <a
                href="#hero"
                onClick={() => { closeMenu(); trackEvent('click_mobile_logo'); }}
                className="inline-flex items-center gap-2.5 font-display text-[20px] font-bold text-white"
              >
                <img src="/logo.svg" alt="Raffros" className="h-8 w-auto object-contain" />
                <span>Raffros</span>
              </a>
              <button
                type="button"
                aria-label="Fechar menu"
                onClick={() => { closeMenu(); trackEvent('close_mobile_menu'); }}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.12] bg-white/[0.06] text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
              {links.map(([id, label]) => (
                <a
                  key={id}
                  href={`#${id}`}
                  onClick={() => { closeMenu(); trackEvent('click_mobile_link', { metadata: { item: id } }); }}
                  className="font-display text-[28px] font-semibold text-white transition-colors hover:text-[#F59E0B]"
                >
                  {label}
                </a>
              ))}
              <Link
                to="/playlist"
                onClick={() => { closeMenu(); trackEvent('click_mobile_playlist'); }}
                className="inline-flex items-center gap-2 font-display text-[22px] font-medium text-[#F59E0B]"
              >
                <SpotifyGlyph className="h-5 w-5" />
                Som da Casa
              </Link>
              <Link
                to="/admin"
                onClick={() => { closeMenu(); trackEvent('click_mobile_login'); }}
                className="font-mono text-[16px] text-[#71717A] transition-colors hover:text-white"
              >
                Já tenho conta →
              </Link>
            </div>

            <div className="border-t border-white/[0.08] p-6">
              <Link
                to="/cadastro"
                onClick={() => { closeMenu(); trackEvent('click_mobile_comecar_agora'); }}
                className="flex w-full items-center justify-center rounded-full py-4 text-[16px] font-bold text-black"
                style={{ background: 'linear-gradient(135deg, #F59E0B, #FBBF24)' }}
              >
                Começar grátis — 7 dias grátis
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ============================================================
   HERO SECTION
   ============================================================ */

function HeroSection() {
  const reduce = useReducedMotion();

  return (
    <section
      id="hero"
      className="relative flex min-h-[100svh] flex-col justify-center overflow-hidden bg-black pb-16 pt-[120px]"
    >
      {/* Background radial glow */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 60% at 65% 50%, rgba(245,158,11,0.09) 0%, transparent 70%), radial-gradient(ellipse 40% 30% at 20% 80%, rgba(245,158,11,0.06) 0%, transparent 60%)',
        }}
      />

      {/* Subtle noise texture */}
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.025]"
        style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")' }}
      />

      <div className="relative z-10 mx-auto grid w-full max-w-[1360px] items-center gap-12 px-6 md:grid-cols-[1fr_auto] md:gap-16 md:px-12 lg:gap-24">
        {/* Left: Copy */}
        <div className="max-w-[640px]">
          <motion.div
            initial={{ opacity: 0, y: reduce ? 0 : 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
            className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.04] px-4 py-2"
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#F59E0B]" />
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[#A1A1A6]">
              Para barbearias, salões e esmalterias
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: reduce ? 0 : 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85, delay: 0.1, ease: EASE }}
            className="m-0 mb-6 font-display text-[clamp(38px,6.5vw,72px)] font-bold leading-[1.02] tracking-[-0.03em] text-white"
          >
            Você não abriu{' '}
            <br className="hidden sm:block" />
            uma barbearia{' '}
            <br className="hidden sm:block" />
            pra ficar{' '}
            <span
              className="not-italic"
              style={{
                background: 'linear-gradient(135deg, #F59E0B 0%, #FBBF24 50%, #F59E0B 100%)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              respondendo mensagem.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: reduce ? 0 : 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: EASE }}
            className="mb-9 max-w-[50ch] text-[clamp(16px,1.8vw,19px)] leading-relaxed text-[#8A8A8F]"
          >
            Agenda online com link próprio, pagamento automático e controle do seu negócio
            na palma da mão. Seu cliente agenda. Você atende.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: reduce ? 0 : 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.3, ease: EASE }}
            className="flex flex-wrap gap-4"
          >
            <Link
              to="/cadastro"
              onClick={() => trackEvent('click_hero_comecar_agora')}
              className="group inline-flex items-center justify-center gap-2 rounded-full px-8 py-[17px] text-[16px] font-bold text-black shadow-[0_20px_50px_-16px_rgba(245,158,11,0.6)] transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_24px_60px_-16px_rgba(245,158,11,0.75)]"
              style={{ background: 'linear-gradient(135deg, #F59E0B, #FBBF24)' }}
            >
              Colocar minha agenda no lugar
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
            <a
              href="#como-funciona"
              onClick={() => trackEvent('click_hero_ver_como_funciona')}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/[0.14] bg-white/[0.04] px-8 py-[17px] text-[16px] font-medium text-white/80 backdrop-blur transition-all duration-200 hover:border-white/30 hover:text-white"
            >
              Como funciona
              <ChevronDown className="h-4 w-4" />
            </a>
          </motion.div>

          {/* Playlist card */}
          <motion.div
            initial={{ opacity: 0, y: reduce ? 0 : 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.45, ease: EASE }}
            className="mt-10"
          >
            <HeroPlaylistLine />
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.6, ease: EASE }}
            className="mt-10 flex flex-wrap gap-x-10 gap-y-6 border-t border-white/[0.07] pt-8"
          >
            {[
              { num: 100, suf: '%', label: 'da agenda no piloto automático' },
              { num: 7, suf: ' dias', label: 'grátis para testar sem cartão' },
              { num: 0, suf: ' furos', label: 'com sinal anti-furo ativo' },
            ].map((s) => (
              <div key={s.label} className="flex flex-col">
                <span className="font-display text-[28px] font-bold text-[#F59E0B] leading-none">
                  <CountUp to={s.num} suffix={s.suf} />
                </span>
                <span className="mt-1.5 max-w-[15ch] text-[12px] leading-snug text-[#52525B]">
                  {s.label}
                </span>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Right: Hero mockup group */}
        <motion.div
          initial={{ opacity: 0, y: reduce ? 0 : 30, scale: reduce ? 1 : 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1.1, delay: 0.25, ease: EASE }}
          className="relative mx-auto w-full max-w-[360px] md:max-w-none md:w-[340px] lg:w-[400px] xl:w-[460px] shrink-0"
        >
          {/* Glow behind phones */}
          <div
            className="absolute inset-[-40px] -z-10 rounded-full opacity-30 blur-[80px]"
            style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.5), transparent 70%)' }}
          />

          {/* Main phone — booking */}
          <div
            className="relative mx-auto z-10"
            style={{ transform: 'perspective(1200px) rotateY(-8deg) rotateX(4deg)' }}
          >
            <div
              className="relative rounded-[3rem] border border-white/[0.14] bg-[#0A0A0C] p-[8px] shadow-[0_60px_120px_-30px_rgba(0,0,0,0.95),0_0_60px_-12px_rgba(245,158,11,0.25)]"
            >
              <span className="absolute left-1/2 top-[10px] z-10 h-[13px] w-[56px] -translate-x-1/2 rounded-full border border-white/10 bg-black" />
              <div className="relative overflow-hidden rounded-[2.5rem] aspect-[9/19.5]">
                <img
                  src={M.phoneBooking}
                  alt="Tela de agendamento da Raffros no iPhone"
                  className="absolute inset-0 h-full w-full object-cover object-top"
                  loading="eager"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-white/[0.03]" />
              </div>
            </div>
          </div>

          {/* Floating badge — confirmed */}
          <motion.div
            animate={reduce ? {} : { y: [0, -6, 0] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -left-[12%] top-[16%] z-20 flex items-center gap-2.5 rounded-[16px] border border-white/[0.1] bg-[#111114]/95 px-3.5 py-2.5 shadow-2xl backdrop-blur-[12px]"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/15">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            </div>
            <div>
              <strong className="block text-[12px] font-semibold text-white">Horário reservado</strong>
              <span className="block text-[10px] text-[#A1A1A6]">Agenda atualizada sozinha</span>
            </div>
          </motion.div>

          {/* Floating badge — payment */}
          <motion.div
            animate={reduce ? {} : { y: [0, 5, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }}
            className="absolute -right-[10%] bottom-[18%] z-20 flex items-center gap-2.5 rounded-[16px] border border-white/[0.1] bg-[#111114]/95 px-3.5 py-2.5 shadow-2xl backdrop-blur-[12px]"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/15">
              <DollarSign className="h-3.5 w-3.5 text-[#F59E0B]" />
            </div>
            <div>
              <strong className="block text-[12px] font-semibold text-white">Sinal recebido</strong>
              <span className="block text-[10px] text-[#A1A1A6]">R$ 25,00 via Pix</span>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* Scroll cue */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4, duration: 0.6 }}
        className="relative z-10 mt-14 flex items-center justify-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[#52525B]"
      >
        <motion.span
          animate={reduce ? {} : { scaleY: [1, 0, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: EASE_IN }}
          className="h-6 w-[1px] origin-top bg-gradient-to-b from-[#F59E0B] to-transparent"
        />
        role para ver
      </motion.div>
    </section>
  );
}

/* ============================================================
   CINEMATIC BREATHER — "Enquanto você atende"
   ============================================================ */

function BreatherSection() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const reduce = useReducedMotion();
  const y1 = useTransform(scrollYProgress, [0, 1], reduce ? ['0%', '0%'] : ['-8%', '8%']);
  const y2 = useTransform(scrollYProgress, [0, 1], reduce ? ['0%', '0%'] : ['8%', '-8%']);

  return (
    <section ref={ref} className="relative overflow-hidden bg-white px-6 py-[120px] md:py-[180px]">
      {/* Radial bg */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 50%, rgba(245,158,11,0.06), transparent 70%)' }}
      />

      <div className="relative z-10 mx-auto max-w-[900px] text-center">
        <motion.p
          style={{ y: y1 }}
          className="font-display text-[clamp(13px,1.5vw,16px)] font-medium uppercase tracking-[0.2em] text-[#C0B090]"
        >
          A realidade de quem gerencia no WhatsApp
        </motion.p>

        <motion.h2
          style={{ y: y2 }}
          className="mt-8 font-display text-[clamp(36px,7vw,80px)] font-bold leading-[1.02] tracking-[-0.04em] text-[#1D1D1F]"
        >
          12 mensagens.
          <br />
          <span style={{ color: '#B8B8B8' }}>Todas perguntando</span>
          <br />
          <span
            style={{
              background: 'linear-gradient(135deg, #D97706, #F59E0B)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            "tem horário?"
          </span>
        </motion.h2>

        <Reveal delay={0.15}>
          <p className="mx-auto mt-10 max-w-[50ch] text-[clamp(15px,1.8vw,18px)] leading-relaxed text-[#6E6E73]">
            Enquanto você está com a tesoura na mão, o celular não para.
            Você perde clientes, perde foco e ainda termina o dia sem saber quanto faturou.
          </p>
        </Reveal>

        <Reveal delay={0.3}>
          <p className="mt-8 font-display text-[clamp(18px,2.5vw,26px)] font-semibold text-[#1D1D1F]">
            Existe uma maneira muito melhor.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ============================================================
   PROBLEM SECTION — Message wall
   ============================================================ */

function ProblemSection() {
  const messages = [
    'Tem horário amanhã?',
    'Quanto é o corte?',
    'Pode ser com o João?',
    'Tem vaga sábado?',
    'Desmarca pra mim?',
    'Pode ser às 15h?',
    'Confirma meu horário',
    'Tem horário hoje?',
    'Pode remarcar?',
    'É só corte ou faz barba também?',
    'Quanto tempo leva?',
    'Me avisa quando tiver vaga',
  ];
  const reduce = useReducedMotion();

  return (
    <section id="solucao" className="overflow-hidden bg-[#0A0A0C] px-6 py-[104px] text-white md:px-12 md:py-[160px]">
      <div className="mx-auto max-w-[1360px]">
        <div className="grid items-center gap-16 md:grid-cols-2 md:gap-20">
          {/* Left: copy */}
          <div>
            <Reveal>
              <Eyebrow>O problema real</Eyebrow>
              <h2 className="font-display text-[clamp(28px,5vw,50px)] font-bold leading-[1.07] tracking-[-0.03em]">
                Seu celular não deveria ser
                <br />
                <span className="text-[#F59E0B]">sua recepcionista.</span>
              </h2>
            </Reveal>

            <Reveal delay={0.1}>
              <p className="mt-6 max-w-[44ch] text-[clamp(15px,1.7vw,17px)] leading-relaxed text-[#8A8A8F]">
                Você não está administrando sua agenda. Você está trabalhando para ela. Cada mensagem respondida
                durante um atendimento é um momento de atenção que seu cliente perdeu.
              </p>
            </Reveal>

            <Reveal delay={0.2}>
              <div className="mt-10 space-y-4">
                {[
                  { icon: Clock, label: 'Tempo perdido respondendo mensagens que deveriam ser automáticas.' },
                  { icon: DollarSign, label: 'Clientes que dão bolo e não pagam nada pela ausência.' },
                  { icon: BarChart3, label: 'Fechamento de mês sem saber quanto entrou, quanto saiu.' },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-start gap-4">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.04]">
                      <Icon className="h-4 w-4 text-[#F59E0B]" />
                    </div>
                    <p className="text-[14.5px] leading-relaxed text-[#8A8A8F]">{label}</p>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>

          {/* Right: animated message wall */}
          <div className="relative">
            <div
              className="relative h-[400px] md:h-[500px] overflow-hidden rounded-[28px] border border-white/[0.07] bg-[#111114]"
            >
              <div
                className="absolute inset-0 z-0 opacity-30"
                style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(37,211,102,0.12), transparent 70%)' }}
              />

              {/* WhatsApp bar */}
              <div className="relative z-10 flex items-center gap-3 border-b border-white/[0.07] bg-[#128C7E]/20 px-4 py-3 backdrop-blur">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#128C7E]">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" /></svg>
                </div>
                <div>
                  <p className="text-[12px] font-bold text-white">Barbearia do João</p>
                  <p className="text-[10px] text-[#71717A]">12 mensagens não lidas</p>
                </div>
                <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-[#25D366] font-mono text-[9px] font-bold text-black">12</span>
              </div>

              {/* Messages scrolling */}
              <div className="relative z-10 flex flex-col gap-2 p-4 overflow-hidden">
                {messages.map((msg, i) => (
                  <motion.div
                    key={msg}
                    initial={{ opacity: 0, x: reduce ? 0 : -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.08, duration: 0.45, ease: EASE }}
                    className="max-w-[80%] self-start rounded-[12px] rounded-tl-none border border-white/[0.06] bg-[#1A1A1E] px-3.5 py-2"
                  >
                    <p className="text-[12.5px] text-white">{msg}</p>
                    <span className="mt-0.5 block text-[9px] text-[#52525B]">
                      {String(9 + (i % 4)).padStart(2, '0')}:{String((i * 7) % 60).padStart(2, '0')}
                    </span>
                  </motion.div>
                ))}
              </div>

              {/* Fade overlay bottom */}
              <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#111114] to-transparent" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   SOLUTION FLOW SECTION
   ============================================================ */

function SolutionSection() {
  const steps = [
    { icon: Smartphone, label: 'Cliente abre seu link', sub: 'Nenhuma instalação de app.' },
    { icon: Scissors, label: 'Escolhe o serviço', sub: 'Com preço e duração claros.' },
    { icon: Users, label: 'Escolhe o profissional', sub: 'Ou o primeiro disponível.' },
    { icon: CalendarDays, label: 'Escolhe o horário', sub: 'Só os horários livres aparecem.' },
    { icon: Shield, label: 'Paga o sinal', sub: 'Anti-furo automático via Pix.' },
    { icon: CheckCircle2, label: 'Confirmado', sub: 'Você recebe a notificação.' },
  ];

  return (
    <section id="como-funciona" className="bg-white px-6 py-[104px] md:px-12 md:py-[160px]">
      <div className="mx-auto max-w-[1360px]">
        <div className="mb-20 max-w-[700px]">
          <Reveal>
            <Eyebrow dark>Como funciona</Eyebrow>
            <h2 className="font-display text-[clamp(28px,5vw,52px)] font-bold leading-[1.07] tracking-[-0.03em] text-[#1D1D1F]">
              Enquanto você atende.
              <br />
              <span className="text-[#D97706]">Seu cliente agenda.</span>
              <br />
              Sem você tocar no celular.
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-6 max-w-[46ch] text-[clamp(15px,1.7vw,17px)] leading-relaxed text-[#6E6E73]">
              A Raffros assume a parte que ninguém deveria estar fazendo manualmente.
              Do agendamento ao pagamento, tudo acontece sozinho.
            </p>
          </Reveal>
        </div>

        <div className="space-y-3">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <Reveal key={step.label} delay={i * 0.06}>
                <div className="group flex items-center gap-5 rounded-[18px] border border-black/[0.06] bg-[#F9F9FA] px-5 py-4 transition-all duration-200 hover:border-amber-400/30 hover:bg-white hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.08)]">
                  {/* Step number */}
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-bold text-[#D97706]"
                    style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}
                  >
                    {i + 1}
                  </span>
                  {/* Icon */}
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-black/[0.05] bg-white shadow-sm">
                    <Icon className="h-4 w-4 text-[#D97706]" />
                  </div>
                  {/* Text */}
                  <div className="min-w-0 flex-1">
                    <h3 className="font-display text-[16px] font-semibold text-[#1D1D1F] leading-snug">{step.label}</h3>
                    <p className="text-[13px] text-[#8A8A8F] leading-snug mt-0.5">{step.sub}</p>
                  </div>
                  {/* Arrow on hover */}
                  <ArrowRight className="h-4 w-4 shrink-0 text-[#D0D0D5] transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-[#D97706]" />
                </div>
              </Reveal>
            );
          })}
        </div>

        {/* CTA */}
        <Reveal delay={0.3} className="mt-16 text-center">
          <Link
            to="/cadastro"
            onClick={() => trackEvent('click_solucao_comecar')}
            className="group inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-8 py-4 text-[15px] font-semibold text-[#D97706] transition-all hover:bg-amber-500/18 hover:text-[#B45309]"
          >
            Quero minha agenda funcionando assim
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

/* ============================================================
   SCROLL STORY — iPhone mockup progression
   ============================================================ */

const STORY_STEPS = [
  {
    img: M.phoneBooking,
    alt: 'Tela de agendamento',
    headline: 'Seu cliente abre o link.',
    body: 'Uma página com a cara do seu negócio. Sem baixar app, sem cadastro obrigatório.',
  },
  {
    img: M.phoneServices,
    alt: 'Lista de serviços',
    headline: 'Escolhe o serviço.',
    body: 'Corte, barba, coloração. Cada serviço com preço, duração e quem faz.',
  },
  {
    img: M.phonePaymentPix,
    alt: 'Pagamento via Pix',
    headline: 'Paga o sinal na hora.',
    body: 'Via Pix, direto pra você. Ninguém marca e some sem pagar.',
  },
  {
    img: M.phonePayment,
    alt: 'Confirmação de pagamento',
    headline: 'Pronto. Confirmado.',
    body: 'Você recebe a notificação. A agenda se atualiza sozinha. Você continua atendendo.',
  },
];

function ScrollStorySection() {
  const [active, setActive] = useState(0);
  const reduce = useReducedMotion();

  return (
    <section className="overflow-hidden bg-[#0A0A0C] px-6 py-[104px] text-white md:px-12 md:py-[160px]">
      <div className="mx-auto max-w-[1360px]">
        <div className="mb-16 text-center">
          <Reveal>
            <Eyebrow>Experiência do seu cliente</Eyebrow>
            <h2 className="mx-auto max-w-[18ch] font-display text-[clamp(28px,5vw,50px)] font-bold leading-[1.07] tracking-[-0.03em]">
              O caminho do agendamento em 4 passos.
            </h2>
          </Reveal>
        </div>

        <div className="grid items-center gap-16 md:grid-cols-[1fr_auto] md:gap-24">
          {/* Steps */}
          <div className="flex flex-col gap-6">
            {STORY_STEPS.map((step, i) => (
              <Reveal key={step.headline} delay={i * 0.1}>
                <button
                  type="button"
                  onClick={() => {
                    setActive(i);
                    trackEvent('click_story_step', { metadata: { step: i } });
                  }}
                  className={cn(
                    'w-full rounded-[20px] border p-7 text-left transition-all duration-400',
                    active === i
                      ? 'border-[#F59E0B]/40 bg-[#F59E0B]/[0.06] shadow-[0_0_40px_-12px_rgba(245,158,11,0.3)]'
                      : 'border-white/[0.07] bg-white/[0.02] hover:border-white/[0.14]'
                  )}
                >
                  <div className="flex items-start gap-5">
                    <span
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-mono text-[13px] font-bold transition-all duration-300',
                        active === i
                          ? 'text-black shadow-[0_4px_14px_-4px_rgba(245,158,11,0.6)]'
                          : 'border border-white/[0.1] bg-white/[0.04] text-[#71717A]'
                      )}
                      style={active === i ? { background: 'linear-gradient(135deg, #F59E0B, #FBBF24)' } : {}}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <h3 className={cn(
                        'font-display text-[20px] font-semibold leading-snug tracking-[-0.01em] transition-colors duration-200',
                        active === i ? 'text-white' : 'text-[#8A8A8F]'
                      )}>
                        {step.headline}
                      </h3>
                      <p className={cn(
                        'mt-2 text-[14px] leading-relaxed transition-all duration-200',
                        active === i ? 'text-[#A1A1A6]' : 'text-[#52525B]'
                      )}>
                        {step.body}
                      </p>
                    </div>
                  </div>
                </button>
              </Reveal>
            ))}
          </div>

          {/* Phone mockup */}
          <div className="mx-auto shrink-0 w-[240px] md:w-[260px] lg:w-[290px]">
            <div
              className="relative rounded-[3rem] border border-white/[0.14] bg-[#0A0A0C] p-[8px] shadow-[0_60px_120px_-30px_rgba(0,0,0,0.9),0_0_60px_-12px_rgba(245,158,11,0.2)]"
              style={{ perspective: '1000px' }}
            >
              <span className="absolute left-1/2 top-[10px] z-10 h-[13px] w-[56px] -translate-x-1/2 rounded-full border border-white/10 bg-black" />
              <div className="relative overflow-hidden rounded-[2.5rem] aspect-[9/19.5]">
                <AnimatePresence mode="wait">
                  <motion.img
                    key={active}
                    src={STORY_STEPS[active].img}
                    alt={STORY_STEPS[active].alt}
                    className="absolute inset-0 h-full w-full object-cover object-top"
                    initial={{ opacity: 0, scale: reduce ? 1 : 1.04 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: reduce ? 1 : 0.97 }}
                    transition={{ duration: reduce ? 0.15 : 0.45, ease: EASE }}
                  />
                </AnimatePresence>
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-white/[0.03]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   BARBER SECTION — Tablet
   ============================================================ */

function BarberSection() {
  return (
    <section className="overflow-hidden bg-white px-6 py-[104px] md:px-12 md:py-[160px]">
      <div className="mx-auto max-w-[1360px]">
        <div className="mb-16 grid items-end gap-10 md:grid-cols-[1fr_0.6fr]">
          <Reveal>
            <Eyebrow dark>Para barbearias</Eyebrow>
            <h2 className="font-display text-[clamp(28px,5.5vw,54px)] font-bold leading-[1.05] tracking-[-0.03em] text-[#1D1D1F]">
              Uma agenda feita pra quem{' '}
              <br className="hidden md:block" />
              vive de{' '}
              <span style={{ color: '#D97706' }}>cadeira ocupada.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="max-w-[40ch] text-[clamp(15px,1.6vw,17px)] leading-relaxed text-[#6E6E73]">
              Cada profissional com seus horários. Cada cliente no horário certo.
              Controle completo da operação na tela do tablet ou celular.
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.12}>
          <div className="relative overflow-hidden rounded-[28px] border border-black/[0.06] shadow-[0_40px_80px_-24px_rgba(0,0,0,0.12)]">
            {/* Browser chrome */}
            <div className="flex h-10 shrink-0 items-center gap-2 border-b border-black/[0.06] bg-[#F5F5F7] px-4">
              <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
              <span className="ml-4 rounded-md border border-black/[0.08] bg-white px-3 py-0.5 font-mono text-[10px] text-[#86868B]">
                app.raffros.com/agenda
              </span>
            </div>
            <img
              src={M.tabletBarber}
              alt="Agenda de barbearia no painel Raffros"
              className="w-full object-cover"
              loading="lazy"
            />
          </div>
        </Reveal>

        <div className="mt-12 grid gap-5 md:grid-cols-4">
          {[
            { icon: CalendarDays, t: 'Agenda visual', d: 'Ver o dia inteiro sem abrir o WhatsApp.' },
            { icon: Users, t: 'Por profissional', d: 'João, Kauan, Marcus. Cada um no seu horário.' },
            { icon: Shield, t: 'Sinal anti-furo', d: 'Cliente marcou, pagou o sinal. Sem bolo.' },
            { icon: TrendingUp, t: 'Faturamento do dia', d: 'Quanto entrou, na palma da mão.' },
          ].map(({ icon: Icon, t, d }, i) => (
            <Reveal key={t} delay={i * 0.08}>
              <div className="rounded-[18px] border border-black/[0.06] bg-[#F5F5F7] p-6 transition-all hover:border-amber-400/40">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10">
                  <Icon className="h-4.5 w-4.5 text-[#D97706]" />
                </div>
                <h3 className="font-display text-[16px] font-semibold text-[#1D1D1F]">{t}</h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-[#6E6E73]">{d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   SALON SECTION — Tablet
   ============================================================ */

function SalonSection() {
  return (
    <section className="overflow-hidden bg-[#0A0A0C] px-6 py-[104px] text-white md:px-12 md:py-[160px]">
      <div className="mx-auto max-w-[1360px]">
        <div className="grid items-center gap-16 md:grid-cols-[0.85fr_1fr] md:gap-20">
          <Reveal>
            <Eyebrow>Para salões</Eyebrow>
            <h2 className="font-display text-[clamp(26px,4.5vw,44px)] font-bold leading-[1.1] tracking-[-0.03em]">
              Quando sua equipe cresce,
              <br />
              <span className="text-[#F59E0B]">sua agenda não pode virar caos.</span>
            </h2>
            <p className="mt-6 max-w-[44ch] text-[clamp(14px,1.6vw,16.5px)] leading-relaxed text-[#8A8A8F]">
              Múltiplos profissionais, múltiplos serviços, múltiplos clientes. Tudo na mesma tela,
              sem conflito, sem dupla marcação, sem WhatsApp.
            </p>
            <div className="mt-10 space-y-4">
              {[
                'Cada profissional tem seu próprio link e agenda',
                'Cliente escolhe com quem quer ser atendida',
                'Gestão completa de comissões por profissional',
                'Relatórios por serviço e por equipe',
              ].map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#F59E0B]" />
                  <span className="text-[14.5px] text-[#A1A1A6]">{item}</span>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.15}>
            <div className="relative overflow-hidden rounded-[24px] border border-white/[0.1] shadow-[0_40px_80px_-24px_rgba(0,0,0,0.6)]">
              <div className="flex h-10 shrink-0 items-center gap-2 border-b border-white/[0.07] bg-[#111114] px-4">
                <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
                <span className="ml-4 font-mono text-[10px] text-[#52525B]">app.raffros.com/agenda</span>
              </div>
              <img
                src={M.tabletSalon}
                alt="Agenda de salão de beleza no painel Raffros"
                className="w-full object-cover"
                loading="lazy"
              />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   METRICS SECTION
   ============================================================ */

function MetricsSection() {
  return (
    <section className="overflow-hidden bg-[#F5F5F7] px-6 py-[104px] md:px-12 md:py-[160px]">
      <div className="mx-auto max-w-[1360px]">
        <div className="mb-16 grid items-end gap-10 md:grid-cols-[1fr_0.65fr]">
          <Reveal>
            <Eyebrow dark>Visão do negócio</Eyebrow>
            <h2 className="font-display text-[clamp(26px,5vw,50px)] font-bold leading-[1.07] tracking-[-0.03em] text-[#1D1D1F]">
              Pare de terminar o mês{' '}
              <br className="hidden md:block" />
              <span style={{ color: '#D97706' }}>sem saber como foi.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="max-w-[40ch] text-[clamp(15px,1.6vw,17px)] leading-relaxed text-[#6E6E73]">
              Você não precisa adivinhar como está o seu negócio.
              Você precisa enxergar.
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.12}>
          <div className="relative overflow-hidden rounded-[28px] border border-black/[0.06] shadow-[0_40px_80px_-24px_rgba(0,0,0,0.10)]">
            <div className="flex h-10 items-center gap-2 border-b border-black/[0.06] bg-white px-4">
              <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
              <span className="ml-4 rounded-md border border-black/[0.08] bg-[#F5F5F7] px-3 py-0.5 font-mono text-[10px] text-[#86868B]">
                app.raffros.com/financeiro
              </span>
            </div>
            <img
              src={M.tabletMetrics}
              alt="Dashboard de métricas do painel Raffros"
              className="w-full object-cover"
              loading="lazy"
            />
          </div>
        </Reveal>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 md:grid-cols-4">
          {[
            { icon: TrendingUp, t: 'Faturamento', d: 'Dia, semana ou mês. Com comparativo.' },
            { icon: BarChart3, t: 'Ocupação', d: 'Saiba quanto da agenda você está aproveitando.' },
            { icon: Users, t: 'Top clientes', d: 'Quem mais frequenta e quanto gasta.' },
            { icon: DollarSign, t: 'Comissões', d: 'Automático por profissional e por serviço.' },
          ].map(({ icon: Icon, t, d }, i) => (
            <Reveal key={t} delay={i * 0.08}>
              <div className="rounded-[18px] border border-black/[0.06] bg-white p-6 shadow-sm transition-all hover:border-amber-400/30 hover:shadow-md">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10">
                  <Icon className="h-4.5 w-4.5 text-[#D97706]" />
                </div>
                <h3 className="font-display text-[16px] font-semibold text-[#1D1D1F]">{t}</h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-[#6E6E73]">{d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   PAYMENT SECTION
   ============================================================ */

function PaymentSection() {
  return (
    <section className="overflow-hidden bg-[#0A0A0C] px-6 py-[104px] text-white md:px-12 md:py-[160px]">
      <div className="mx-auto max-w-[1360px]">
        <div className="grid items-center gap-16 md:grid-cols-2 md:gap-20">
          {/* Phones group */}
          <Reveal>
            <div className="relative mx-auto flex max-w-[360px] items-end justify-center gap-4">
              {/* Phone Payment Pix - centered main */}
              <div
                className="relative z-10 w-[48%]"
                style={{ transform: 'perspective(1000px) rotateY(6deg)' }}
              >
                <div className="rounded-[2.5rem] border border-white/[0.14] bg-[#0A0A0C] p-[7px] shadow-[0_50px_90px_-30px_rgba(0,0,0,0.9),0_0_50px_-10px_rgba(245,158,11,0.22)]">
                  <span className="absolute left-1/2 top-[9px] z-10 h-[12px] w-12 -translate-x-1/2 rounded-full border border-white/10 bg-black" />
                  <div className="relative overflow-hidden rounded-[2rem] aspect-[9/19.5]">
                    <img
                      src={M.phonePaymentPix}
                      alt="Tela de pagamento Pix"
                      className="absolute inset-0 h-full w-full object-cover object-top"
                      loading="lazy"
                    />
                  </div>
                </div>
              </div>
              {/* Phone Payment - beside */}
              <div
                className="relative w-[44%]"
                style={{ transform: 'perspective(1000px) rotateY(-6deg)' }}
              >
                <div className="rounded-[2.5rem] border border-white/[0.10] bg-[#0A0A0C] p-[7px] shadow-[0_40px_70px_-25px_rgba(0,0,0,0.8)]">
                  <span className="absolute left-1/2 top-[9px] z-10 h-[12px] w-12 -translate-x-1/2 rounded-full border border-white/10 bg-black" />
                  <div className="relative overflow-hidden rounded-[2rem] aspect-[9/19.5]">
                    <img
                      src={M.phonePayment}
                      alt="Tela de pagamento"
                      className="absolute inset-0 h-full w-full object-cover object-top"
                      loading="lazy"
                    />
                  </div>
                </div>
              </div>
              {/* Glow */}
              <div
                className="absolute inset-0 -z-10 blur-[60px] opacity-25"
                style={{ background: 'radial-gradient(circle at 50% 60%, rgba(245,158,11,0.5), transparent 70%)' }}
              />
            </div>
          </Reveal>

          <div>
            <Reveal>
              <Eyebrow>Anti-furo</Eyebrow>
              <h2 className="font-display text-[clamp(26px,4.5vw,46px)] font-bold leading-[1.08] tracking-[-0.03em]">
                Seu horário
                <br />
                <span className="text-[#F59E0B]">vale alguma coisa.</span>
              </h2>
            </Reveal>

            <Reveal delay={0.1}>
              <p className="mt-6 max-w-[44ch] text-[clamp(14.5px,1.6vw,16.5px)] leading-relaxed text-[#8A8A8F]">
                Cliente marcou. Cliente pagou um sinal via Pix. Se der bolo, o valor fica com você.
                Simples assim. Chega de levar bolo de graça.
              </p>
            </Reveal>

            <Reveal delay={0.2}>
              <div className="mt-10 space-y-5">
                {[
                  { t: 'Pix instantâneo', d: 'O cliente paga antes de confirmar. Na hora, no celular dele.' },
                  { t: 'Você define o %', d: 'Pode ser 30%, 50% ou 100% antecipado. Você controla.' },
                  { t: 'Sem furo, sem drama', d: 'Pagou o sinal? Está confirmado. Não pagou? Não marcou.' },
                ].map(({ t, d }) => (
                  <div key={t} className="rounded-[16px] border border-white/[0.07] bg-white/[0.03] p-5">
                    <h3 className="font-display text-[16px] font-semibold text-white">{t}</h3>
                    <p className="mt-1.5 text-[13.5px] text-[#71717A]">{d}</p>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   DOMICILIO SECTION
   ============================================================ */

function DomicilioSection() {
  return (
    <section id="domicilio" className="overflow-hidden bg-[#0D0D0F] px-6 py-[104px] text-white md:px-12 md:py-[160px]">
      <div className="mx-auto max-w-[1360px]">
        <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
          <div>
            <Reveal>
              <Eyebrow>Atendimento a domicílio</Eyebrow>
              <h2 className="font-display text-[clamp(26px,4.5vw,46px)] font-bold leading-[1.08] tracking-[-0.03em] text-white">
                Você define o raio.
                <br />
                <span style={{ color: '#F59E0B' }}>A Raffros faz o resto.</span>
              </h2>
            </Reveal>

            <Reveal delay={0.1}>
              <p className="mt-6 max-w-[44ch] text-[clamp(14.5px,1.6vw,16.5px)] leading-relaxed text-[#8A8A8F]">
                Manicures, barbeiros e cabeleireiros que atendem em domicílio não precisam mais perguntar
                endereço, verificar distância e combinar no WhatsApp.
              </p>
              <p className="mt-4 max-w-[44ch] text-[clamp(14.5px,1.6vw,16.5px)] leading-relaxed text-[#8A8A8F]">
                O cliente informa onde está — o sistema confere se está dentro da área de atendimento e
                libera o horário na hora.
              </p>
            </Reveal>

            <Reveal delay={0.2}>
              <div className="mt-10 space-y-4">
                {[
                  'Cliente informa o endereço no agendamento',
                  'Sistema verifica se está dentro do seu raio',
                  'Cobrança automática de taxa de deslocamento',
                  'Mapa integrado para você visualizar',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-[#F59E0B]" />
                    <span className="text-[14.5px] text-[#A1A1A6]">{item}</span>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>

          {/* Mockup + Radar visual */}
          <Reveal delay={0.15}>
            <div className="relative flex h-[480px] w-full flex-col items-center justify-center md:h-[540px] pb-8">

              <div className="relative flex h-full w-full items-center justify-center">
                {/* Radar in background right */}
                <div className="absolute right-[-5%] sm:right-[0%] md:right-[-5%] lg:right-[0%] z-0 flex shrink-0 items-center justify-center">
                  <RadarVisual />
                </div>

                {/* Phone in foreground left */}
                <div className="absolute left-[0%] sm:left-[10%] md:left-[0%] lg:left-[5%] z-10 w-[200px] sm:w-[240px] md:w-[260px] lg:w-[280px]">
                  <div
                    className="relative rounded-[2.6rem] sm:rounded-[3rem] border border-white/[0.12] bg-[#0D0D0F] p-[6px] sm:p-[8px] shadow-[0_50px_90px_-30px_rgba(0,0,0,0.8),0_0_50px_-10px_rgba(245,158,11,0.2)]"
                    style={{ transform: 'perspective(1200px) rotateY(6deg) rotateX(2deg)' }}
                  >
                    <span className="absolute left-1/2 top-[10px] z-20 h-[11px] sm:h-[13px] w-12 sm:w-[56px] -translate-x-1/2 rounded-full border border-white/10 bg-black" />
                    <div className="relative aspect-[9/19.5] overflow-hidden rounded-[2.2rem] sm:rounded-[2.5rem]">
                      <img
                        src={M.phoneDomicilio}
                        alt="Tela de escolha de atendimento a domicílio"
                        className="absolute inset-0 h-full w-full object-cover object-top"
                        loading="lazy"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Caption text centered for the whole section */}
              {/* <p className="absolute bottom-[-60px] left-0 right-0 text-center font-display text-[11px] sm:text-[12px] italic text-[#8A8A8F]">
                Ex.: &ldquo;Atendo clientes em um raio de até 10 km.&rdquo;
              </p> */}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   RADAR VISUAL — Domicilio
   ============================================================ */

function RadarVisual() {
  const reduce = useReducedMotion();

  return (
    <div className="relative flex h-[240px] w-[240px] sm:h-[280px] sm:w-[280px] md:h-[320px] md:w-[320px] shrink-0 flex-col items-center justify-center">
      {/* Radar Main Circle Area */}
      <div className="relative h-full w-full flex items-center justify-center">
        {/* Ambient background glow */}
        <div
          className="absolute inset-[10%] rounded-full opacity-25 blur-2xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.7), transparent 70%)' }}
        />

        {/* Outer Ring (Dashed Amber) */}
        <div className="absolute inset-0 rounded-full border border-dashed border-[#F59E0B]/35 pointer-events-none" />

        {/* Middle Ring (Solid Amber) */}
        <div className="absolute inset-[16%] rounded-full border border-[#F59E0B]/20 pointer-events-none" />

        {/* Inner Ring (Solid Amber) */}
        <div className="absolute inset-[32%] rounded-full border border-[#F59E0B]/15 pointer-events-none" />

        {/* Pulsing Sonar Waves */}
        {!reduce && (
          <>
            <motion.div
              className="absolute rounded-full border border-[#F59E0B]/30 pointer-events-none"
              animate={{ inset: ['40%', '0%'], opacity: [0.8, 0] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: 'easeOut' }}
            />
            <motion.div
              className="absolute rounded-full border border-[#F59E0B]/30 pointer-events-none"
              animate={{ inset: ['40%', '0%'], opacity: [0.8, 0] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: 'easeOut', delay: 1.75 }}
            />
          </>
        )}

        {/* Animated Sweep Line & Rotating Ray Beam */}
        {!reduce && (
          <motion.div
            className="absolute inset-0 rounded-full pointer-events-none"
            animate={{ rotate: 360 }}
            transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
          >
            {/* Sweep fading cone trail */}
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background:
                  'conic-gradient(from 0deg, rgba(245,158,11,0.35) 0deg, rgba(245,158,11,0.08) 40deg, transparent 60deg)',
              }}
            />
            {/* Bright leading ray line */}
            <div className="absolute top-0 left-1/2 w-[2px] h-[50%] -translate-x-1/2 bg-gradient-to-t from-[#F59E0B] to-amber-200 shadow-[0_0_8px_#F59E0B] origin-bottom" />
          </motion.div>
        )}

        {/* Center "Você" Circle */}
        <div className="relative z-20 flex h-[40px] w-[40px] sm:h-[46px] sm:w-[46px] items-center justify-center rounded-full bg-gradient-to-b from-[#FBBF24] to-[#D97706] shadow-[0_0_20px_rgba(245,158,11,0.6)]">
          <span className="font-display text-[10px] sm:text-[11px] font-bold text-[#140F00] tracking-tight">
            Você
          </span>
        </div>

        {/* Client Ping Point (Glowing White Dot on Radar) */}
        <div
          className="absolute z-20 w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-white shadow-[0_0_10px_3px_rgba(255,255,255,0.95)]"
          style={{ bottom: '70%', right: '40%' }}
        >
          {!reduce && (
            <motion.span
              className="absolute inset-[-4px] rounded-full border border-white/70"
              animate={{ scale: [1, 2.2], opacity: [0.9, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
            />
          )}
        </div>

        {/* "Dentro do raio" Badge (Top Right) */}
        <div className="absolute top-[2%] right-[5%] sm:right-[10%] z-20">
          <div className="rounded-full border border-amber-500/50 bg-[#1c1500]/95 px-2.5 py-1 sm:px-3 sm:py-1 shadow-[0_0_12px_rgba(245,158,11,0.3)] backdrop-blur-md">
            <span className="font-mono text-[9px] sm:text-[10px] font-bold text-[#FBBF24] tracking-tight">
              Dentro do raio
            </span>
          </div>
        </div>

        {/* "Fora do raio" Badge (Bottom Center-Right) */}
        <div className="absolute bottom-[2%] right-[15%] sm:right-[40%] sm:bottom-[-%] z-20">
          <div className="rounded-full border border-white/10 bg-[#16161a]/95 px-2.5 py-1 sm:px-3 sm:py-1 backdrop-blur-md shadow-sm">
            <span className="font-mono text-[9px] sm:text-[10px] font-medium text-[#71717A] tracking-tight">
              Fora do raio
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   PERSONALIZATION SECTION
   ============================================================ */

const THEMES = [
  { img: M.themeA, label: 'Tema Clássico', desc: 'Escuro e dourado.' },
  { img: M.themeB, label: 'Tema Noir', desc: 'Preto absoluto.' },
  { img: M.themeC, label: 'Tema Elegante', desc: 'Sofisticado e feminino.' },
];

function PhoneShell({
  src,
  alt,
  size = 'md',
  tilt = 0,
  className = '',
}: {
  src: string;
  alt: string;
  size?: 'sm' | 'md' | 'lg';
  tilt?: number;
  className?: string;
}) {
  const widths = { sm: 'w-[120px] md:w-[140px]', md: 'w-[160px] md:w-[180px]', lg: 'w-[200px] md:w-[230px]' };
  const radii = { sm: 'rounded-[2.2rem]', md: 'rounded-[2.5rem]', lg: 'rounded-[3rem]' };
  const notchW = { sm: 'w-10', md: 'w-12', lg: 'w-14' };
  const notchH = { sm: 'h-[10px]', md: 'h-[11px]', lg: 'h-[13px]' };
  return (
    <div
      className={cn(widths[size], className)}
      style={tilt ? { transform: `perspective(1000px) rotateY(${tilt}deg) rotateZ(${tilt > 0 ? 2 : -2}deg)` } : {}}
    >
      <div
        className={cn(
          'relative border bg-white p-[6px]',
          radii[size],
          size === 'lg'
            ? 'border-black/[0.12] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.18),0_0_40px_-8px_rgba(245,158,11,0.10)]'
            : 'border-black/[0.08] shadow-[0_24px_48px_-12px_rgba(0,0,0,0.12)]',
        )}
      >
        <span
          className={cn(
            'absolute left-1/2 top-[8px] z-10 -translate-x-1/2 rounded-full border border-black/10 bg-[#1D1D1F]',
            notchH[size],
            notchW[size],
          )}
        />
        <div className={cn('relative overflow-hidden aspect-[9/19.5]', size === 'lg' ? 'rounded-[2.4rem]' : size === 'md' ? 'rounded-[2rem]' : 'rounded-[1.7rem]')}>
          <img
            src={src}
            alt={alt}
            className="absolute inset-0 h-full w-full object-cover object-top"
            loading="lazy"
          />
        </div>
      </div>
    </div>
  );
}

function PersonalizationSection() {
  return (
    <section className="overflow-hidden bg-white px-6 py-[104px] md:px-12 md:py-[160px]">
      <div className="mx-auto max-w-[1360px]">
        {/* Header */}
        <div className="mb-20 grid items-end gap-8 md:grid-cols-[1fr_0.65fr]">
          <Reveal>
            <Eyebrow dark>Personalização</Eyebrow>
            <h2 className="font-display text-[clamp(26px,5vw,50px)] font-bold leading-[1.07] tracking-[-0.03em] text-[#1D1D1F]">
              Seu negócio tem
              <br />
              <span style={{ color: '#D97706' }}>sua identidade.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="max-w-[38ch] text-[clamp(14.5px,1.6vw,16.5px)] leading-relaxed text-[#6E6E73]">
              Não existe tema fixo. A página do seu cliente tem as
              <strong className="text-[#1D1D1F]"> cores que você escolher</strong>, com logo e banner do
              seu negócio. Cada estabelecimento com a sua cara.
            </p>
          </Reveal>
        </div>

        {/* 3 iPhones — fan float layout */}
        <Reveal delay={0.08}>
          <div className="relative mx-auto flex justify-center" style={{ height: 480, maxWidth: 580 }}>

            {/* LEFT phone */}
            <motion.div
              className="absolute z-[1]"
              style={{
                left: '0%',
                bottom: 0,
                transform: 'perspective(900px) rotateY(22deg) rotateZ(-4deg)',
                transformOrigin: 'bottom center',
              }}
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
            >
              <div className="w-[140px] md:w-[165px]">
                <div className="relative rounded-[2.4rem] border border-black/[0.15] bg-[#1A1A1A] p-[6px] shadow-[0_30px_60px_-16px_rgba(0,0,0,0.30)]">
                  <span className="absolute left-1/2 top-[9px] z-10 h-[11px] w-9 -translate-x-1/2 rounded-full bg-[#0A0A0C]" />
                  <div className="relative overflow-hidden rounded-[2rem] aspect-[9/19.5]">
                    <img src={M.themeA} alt="Personalização da página" className="absolute inset-0 h-full w-full object-cover object-top" loading="lazy" />
                  </div>
                </div>
              </div>
            </motion.div>

            {/* CENTER phone */}
            <motion.div
              className="absolute z-10 left-1/2 -translate-x-1/2"
              style={{ bottom: 0 }}
              animate={{ y: [0, -16, 0] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
            >
              <div className="w-[190px] md:w-[220px]">
                {/* Glow */}
                <div
                  className="absolute inset-[-50px] -z-10 rounded-full blur-[70px] opacity-20"
                  style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.8), transparent 70%)' }}
                />
                <div className="relative rounded-[3rem] border border-black/[0.2] bg-[#1A1A1A] p-[7px] shadow-[0_60px_100px_-24px_rgba(0,0,0,0.40),0_0_40px_-8px_rgba(245,158,11,0.12)]">
                  <span className="absolute left-1/2 top-[10px] z-10 h-[13px] w-[52px] -translate-x-1/2 rounded-full bg-[#0A0A0C]" />
                  <div className="relative overflow-hidden rounded-[2.5rem] aspect-[9/19.5]">
                    <img src={M.themeB} alt="Personalização da página" className="absolute inset-0 h-full w-full object-cover object-top" loading="lazy" />
                  </div>
                </div>
              </div>
              {/* Label below center phone */}
              <div className="mt-4 text-center">
                <span
                  className="inline-flex items-center rounded-full px-4 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-black shadow-[0_4px_14px_-4px_rgba(245,158,11,0.5)]"
                  style={{ background: 'linear-gradient(135deg, #F59E0B, #FBBF24)' }}
                >
                  A sua cara
                </span>
              </div>
            </motion.div>

            {/* RIGHT phone */}
            <motion.div
              className="absolute z-[1]"
              style={{
                right: '0%',
                bottom: 0,
                transform: 'perspective(900px) rotateY(-22deg) rotateZ(4deg)',
                transformOrigin: 'bottom center',
              }}
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 1.6 }}
            >
              <div className="w-[140px] md:w-[165px]">
                <div className="relative rounded-[2.4rem] border border-black/[0.15] bg-[#1A1A1A] p-[6px] shadow-[0_30px_60px_-16px_rgba(0,0,0,0.30)]">
                  <span className="absolute left-1/2 top-[9px] z-10 h-[11px] w-9 -translate-x-1/2 rounded-full bg-[#0A0A0C]" />
                  <div className="relative overflow-hidden rounded-[2rem] aspect-[9/19.5]">
                    <img src={M.themeC} alt="Personalização da página" className="absolute inset-0 h-full w-full object-cover object-top" loading="lazy" />
                  </div>
                </div>
              </div>
            </motion.div>

          </div>
        </Reveal>

        {/* Bottom tagline */}
        <Reveal delay={0.2} className="mt-20 text-center">
          <p className="mx-auto max-w-[44ch] text-[clamp(14px,1.5vw,16px)] text-[#6E6E73]">
            Cores, logo, banner e estilo personalizados. A página do seu cliente com a cara
            do <strong className="text-[#1D1D1F]">seu</strong> negócio — não de mais ninguém.
          </p>
          <Link
            to="/cadastro"
            onClick={() => trackEvent('click_personalizacao_comecar')}
            className="group mt-8 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-7 py-3.5 text-[14.5px] font-semibold text-[#D97706] transition-all hover:bg-amber-500/18"
          >
            Personalizar minha página
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

/* ============================================================
   PARA QUEM SECTION
   ============================================================ */

function ParaQuemSection() {
  const audiences = [
    {
      icon: Scissors,
      title: 'Barbearias',
      pct: '',
      desc: 'Agenda cheia, zero WhatsApp. Clientes que pagam sinal e aparecem.',
      highlight: true,
    },
    {
      icon: Sparkles,
      title: 'Salões de beleza',
      pct: '',
      desc: 'Toda a equipe organizada em um só lugar. Cada profissional no seu horário.',
      highlight: false,
    },
    {
      icon: Heart,
      title: 'Esmalterias e manicures',
      pct: '',
      desc: 'Agenda online com link próprio. Sem depender de mensagem pra cada horário.',
      highlight: false,
    },
    {
      icon: User,
      title: 'Profissionais autônomos',
      pct: null,
      desc: 'Seu negócio com cara de empresa desde o primeiro cliente.',
      highlight: false,
    },
    {
      icon: Home,
      title: 'Atendimento a domicílio',
      pct: null,
      desc: 'Raio configurável, taxa automática, agenda por endereço.',
      highlight: false,
    },
    {
      icon: Zap,
      title: 'Profissional freelancer',
      pct: null,
      desc: 'Você define quando quer trabalhar. A Raffros organiza o resto.',
      highlight: false,
    },
  ];

  return (
    <section id="para-quem" className="overflow-hidden bg-white px-6 py-[104px] md:px-12 md:py-[160px]">
      <div className="mx-auto max-w-[1360px]">
        <div className="mb-16 max-w-[700px]">
          <Reveal>
            <Eyebrow dark>Para quem é</Eyebrow>
            <h2 className="font-display text-[clamp(26px,5vw,50px)] font-bold leading-[1.07] tracking-[-0.03em] text-[#1D1D1F]">
              Feito para quem vive de deixar
              <br />
              <span style={{ color: '#D97706' }}>gente bonita.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-6 max-w-[46ch] text-[clamp(15px,1.7vw,17px)] leading-relaxed text-[#6E6E73]">
              Da cadeira do barbeiro ao atendimento na casa do cliente. Se você ganha a vida cuidando das
              pessoas, a Raffros foi feita para você.
            </p>
          </Reveal>
        </div>

        <div className="space-y-2.5">
          {audiences.map(({ icon: Icon, title, pct, desc, highlight }, i) => (
            <Reveal key={title} delay={i * 0.06}>
              <div
                className={cn(
                  'group flex items-center gap-4 rounded-[16px] border px-5 py-4 transition-all duration-200',
                  highlight
                    ? 'border-amber-400/30 bg-amber-50 hover:border-amber-400/50 hover:shadow-[0_8px_24px_-8px_rgba(245,158,11,0.15)]'
                    : 'border-black/[0.06] bg-[#F9F9FA] hover:border-black/[0.12] hover:bg-white hover:shadow-sm'
                )}
              >
                {/* Icon */}
                <div className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border',
                  highlight ? 'border-amber-400/30 bg-amber-500/12' : 'border-amber-500/15 bg-amber-500/8'
                )}>
                  <Icon className="h-4 w-4 text-[#D97706]" />
                </div>
                {/* Text */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-[16px] font-semibold text-[#1D1D1F] leading-snug">{title}</h3>
                    {pct && (
                      <span className="hidden sm:inline-flex rounded-full border border-amber-400/30 bg-amber-50 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-600">
                        {pct}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-[13px] text-[#8A8A8F] sm:whitespace-normal sm:truncate-none">{desc}</p>
                </div>
                {/* Arrow */}
                <ArrowRight className="h-4 w-4 shrink-0 text-[#D0D0D5] transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-[#D97706]" />
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   PRICING SECTION
   ============================================================ */

function PricingSection() {
  const plans = [
    {
      name: 'Solo',
      price: 27,
      tag: 'Pra quem trabalha sozinho e quer parar de agendar pelo WhatsApp.',
      items: ['Agenda online ilimitada', '1 profissional', 'Atendimento a domicílio', 'Lembretes automáticos', 'Sinal anti-furo'],
      featured: false,
    },
    {
      name: 'Studio',
      price: 47,
      tag: 'Pra quem já tem equipe e quer o negócio inteiro organizado.',
      items: ['Tudo do plano Solo', 'Até 5 profissionais', 'Gestão de equipe completa', 'Relatórios de desempenho', 'Suporte prioritário'],
      featured: true,
    },
    {
      name: 'Business',
      price: 97,
      tag: 'Para estabelecimentos maiores, com operação em escala.',
      items: ['Tudo do plano Studio', 'Profissionais ilimitados', 'Múltiplas unidades', 'Gerente de conta dedicado'],
      featured: false,
    }
  ];

  return (
    <section id="planos" className="overflow-hidden bg-[#0A0A0C] px-6 py-[104px] text-white md:px-12 md:py-[160px]">
      <div className="mx-auto max-w-[1360px]">
        <div className="mb-16 text-center">
          <Reveal>
            <Eyebrow>Planos</Eyebrow>
            <h2 className="mx-auto max-w-[22ch] font-display text-[clamp(26px,5vw,50px)] font-bold leading-[1.07] tracking-[-0.03em]">
              O sistema que se paga no primeiro furo evitado.
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mx-auto mt-4 max-w-[44ch] text-[clamp(14.5px,1.6vw,16.5px)] text-[#8A8A8F]">
              7 dias grátis para testar tudo, sem cartão de crédito, sem fidelidade.
            </p>
          </Reveal>
        </div>

        <div className="mx-auto grid max-w-[1100px] gap-5 md:grid-cols-3 md:gap-6">
          {plans.map((plan, i) => (
            <Reveal key={plan.name} delay={i * 0.1} className={plan.featured ? 'md:-mt-4' : ''}>
              <div
                className={cn(
                  'relative flex h-full flex-col rounded-[28px] p-8 transition-all md:p-9',
                  plan.featured
                    ? 'border-2 border-[#F59E0B] shadow-[0_24px_64px_-20px_rgba(245,158,11,0.4)]'
                    : 'border border-white/[0.08] hover:border-white/[0.18]'
                )}
                style={plan.featured ? { background: 'linear-gradient(160deg, rgba(245,158,11,0.1), rgba(10,10,12,0.98) 55%)' } : { background: '#111114' }}
              >
                {plan.featured && (
                  <span
                    className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-4 py-1 font-mono text-[10.5px] font-bold text-black shadow-lg"
                    style={{ background: 'linear-gradient(135deg, #F59E0B, #FBBF24)' }}
                  >
                    Mais escolhido
                  </span>
                )}

                <h3 className="font-display text-[22px] font-semibold text-white">{plan.name}</h3>
                <p className="mt-2.5 text-[13.5px] text-[#71717A]">{plan.tag}</p>

                <p className={cn('mt-7 font-display text-[42px] font-bold leading-none', plan.featured ? 'text-[#F59E0B]' : 'text-white')}>
                  <span className="mr-0.5 align-super text-[19px]">R$</span>
                  {plan.price}
                  <small className="text-[14px] font-normal text-[#52525B]">/mês</small>
                </p>

                <ul className="mt-7 flex flex-1 flex-col gap-3">
                  {plan.items.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-[13.5px] text-[#D4D4D8]">
                      <CheckCircle2 className={cn('mt-0.5 h-4 w-4 shrink-0', plan.featured ? 'text-[#F59E0B]' : 'text-[#52525B]')} />
                      {item}
                    </li>
                  ))}
                </ul>

                <Link
                  to="/cadastro"
                  onClick={() => trackEvent(`click_plano_${plan.name.toLowerCase()}`, { metadata: { plano: plan.name, preco: plan.price } })}
                  className={cn(
                    'mt-8 inline-flex w-full items-center justify-center rounded-full px-6 py-4 text-[14.5px] font-bold transition-all',
                    plan.featured
                      ? 'text-black shadow-[0_20px_40px_-16px_rgba(245,158,11,0.55)] hover:scale-[1.02]'
                      : 'border border-white/[0.15] text-white hover:border-[#F59E0B] hover:text-[#F59E0B]'
                  )}
                  style={plan.featured ? { background: 'linear-gradient(135deg, #F59E0B, #FBBF24)' } : {}}
                >
                  Começar agora
                </Link>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.3} className="mt-10 text-center">
          <p className="font-mono text-[12px] text-[#52525B]">
            7 dias grátis · sem cartão de crédito · sem fidelidade · cancele quando quiser
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ============================================================
   FINAL CTA SECTION
   ============================================================ */

function FinalCTASection() {
  return (
    <section className="relative overflow-hidden bg-black px-6 py-[140px] text-center md:py-[200px]">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 60% at 50% -10%, rgba(245,158,11,0.22), transparent 65%)',
        }}
      />

      {/* Scattered glow dots */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {[
          { top: '15%', left: '10%', size: 3, delay: 0 },
          { top: '25%', left: '85%', size: 2, delay: 0.5 },
          { top: '70%', left: '15%', size: 2, delay: 1 },
          { top: '80%', left: '80%', size: 3, delay: 0.3 },
        ].map(({ top, left, size, delay }, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-amber-400"
            style={{ top, left, width: size, height: size }}
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 2.5, repeat: Infinity, delay, ease: 'easeInOut' }}
          />
        ))}
      </div>

      <Reveal>
        <p className="mx-auto mb-6 max-w-[54ch] font-mono text-[clamp(11px,1.2vw,13px)] uppercase tracking-[0.18em] text-[#52525B]">
          Seu cliente já está procurando horário. A pergunta é:
        </p>
        <h2 className="mx-auto mb-4 max-w-[20ch] font-display text-[clamp(32px,6vw,64px)] font-bold leading-[1.05] tracking-[-0.04em] text-white">
          Ele vai encontrar você{' '}
          <em className="not-italic" style={{ color: '#F59E0B' }}>
            organizado?
          </em>
        </h2>
        <p className="mx-auto mb-12 max-w-[44ch] text-[clamp(15px,1.7vw,17px)] text-[#6E6E73]">
          Comece com 7 dias grátis. Sem cartão. Sem fidelidade.
          Sua agenda funcionando ainda hoje.
        </p>
        <Link
          to="/cadastro"
          onClick={() => trackEvent('click_footer_comecar_agora')}
          className="group inline-flex items-center gap-2 rounded-full px-10 py-[20px] text-[17px] font-bold text-black shadow-[0_24px_60px_-16px_rgba(245,158,11,0.65)] transition-all duration-300 hover:scale-[1.04] hover:shadow-[0_28px_70px_-16px_rgba(245,158,11,0.8)]"
          style={{ background: 'linear-gradient(135deg, #F59E0B, #FBBF24)' }}
        >
          Quero começar
          <ArrowRight className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
        <p className="mt-5 font-mono text-[11px] text-[#3F3F46]">
          7 dias grátis · sem cartão · cancele quando quiser
        </p>
      </Reveal>
    </section>
  );
}

/* ============================================================
   FOOTER
   ============================================================ */

function Footer() {
  return (
    <footer className="border-t border-white/[0.07] bg-black px-6 pb-14 pt-16 md:px-12">
      <div className="mx-auto max-w-[1360px]">
        <div className="flex flex-col items-start justify-between gap-10 md:flex-row md:items-center">
          <a href="#hero" className="inline-flex items-center gap-2.5 font-display text-[19px] font-bold text-white">
            <img src="/logo.svg" alt="Raffros" className="h-7 w-auto object-contain drop-shadow-[0_0_10px_rgba(245,158,11,0.3)]" />
            <span>Raffros</span>
          </a>

          <nav className="flex flex-wrap gap-6 md:gap-8">
            {[
              ['#solucao', 'Solução'],
              ['#como-funciona', 'Como funciona'],
              ['#para-quem', 'Para quem é'],
              ['#planos', 'Planos'],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                onClick={() => trackEvent('click_footer_link', { metadata: { item: href } })}
                className="text-[13px] text-[#71717A] transition-colors hover:text-white"
              >
                {label}
              </a>
            ))}
            <Link
              to="/playlist"
              onClick={() => trackEvent('click_footer_playlist')}
              className="inline-flex items-center gap-1.5 text-[13px] text-[#71717A] transition-colors hover:text-[#F59E0B]"
            >
              <SpotifyGlyph className="h-[13px] w-[13px]" />
              Playlist
            </Link>
          </nav>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-white/[0.07] pt-8 md:flex-row md:items-center">
          <p className="text-[12px] text-[#52525B]">
            © {new Date().getFullYear()} Raffros. Todos os direitos reservados.
          </p>
          <div className="flex gap-6">
            <a href="/privacidade" className="text-[12px] text-[#52525B] transition-colors hover:text-white">Privacidade</a>
            <a href="/termos" className="text-[12px] text-[#52525B] transition-colors hover:text-white">Termos</a>
            <Link
              to="/admin"
              onClick={() => trackEvent('click_footer_login')}
              className="text-[12px] text-[#52525B] transition-colors hover:text-white"
            >
              Entrar na conta
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ============================================================
   MOBILE STICKY CTA
   ============================================================ */

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
          className="fixed inset-x-0 bottom-0 z-[90] bg-gradient-to-t from-[#000000] via-[#000000]/80 to-transparent pt-5 pb-[calc(env(safe-area-inset-bottom)+16px)] px-4 md:hidden pointer-events-none"
        >
          <Link
            to="/cadastro"
            onClick={() => trackEvent('click_mobile_sticky_cta')}
            className="pointer-events-auto flex h-14 w-full items-center justify-center gap-2 rounded-full text-[15px] font-bold text-black shadow-[0_0_24px_rgba(245,158,11,0.5)]"
            style={{ background: 'linear-gradient(135deg, #F59E0B, #FBBF24)' }}
          >
            Começar agora
            <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ============================================================
   SCROLL PROGRESS BAR
   ============================================================ */

function ScrollProgressBar() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 h-[2px] z-[1000] origin-left pointer-events-none"
      style={{
        scaleX,
        background: 'linear-gradient(90deg, #F59E0B, #FBBF24, #F59E0B)'
      }}
    />
  );
}

/* ============================================================
   PAGE
   ============================================================ */

export default function LandingPage() {
  usePageTracking();

  return (
    <div className="min-h-screen overflow-x-hidden bg-black font-body text-[#F5F5F7] selection:bg-[#F59E0B] selection:text-black">
      <ScrollProgressBar />
      <Header />

      <main className="pb-16 md:pb-0">
        {/* 1. HERO — Black */}
        <HeroSection />

        {/* 2. BREATHER — White (cinematic pain statement) */}
        <BreatherSection />

        {/* 3. PROBLEM — Black (message wall) */}
        <ProblemSection />

        {/* 4. SOLUTION FLOW — White */}
        <SolutionSection />

        {/* 5. SCROLL STORY — Black */}
        <ScrollStorySection />

        {/* 6. BARBER — White (tablet) */}
        <BarberSection />

        {/* 7. SALON — Black (tablet) */}
        <SalonSection />

        {/* 8. METRICS — White (tablet) */}
        <MetricsSection />

        {/* 9. PAYMENT — Black (2 phones) */}
        <PaymentSection />

        {/* 10. DOMICILIO — White (phone) */}
        <DomicilioSection />

        {/* 11. PERSONALIZATION — Black (phone switch) */}
        <PersonalizationSection />

        {/* 12. PARA QUEM — White */}
        <ParaQuemSection />

        {/* 13. PRICING — Black */}
        <PricingSection />

        {/* 14. FINAL CTA — Black */}
        <FinalCTASection />
      </main>

      <Footer />
      <CookieConsentBanner />
      <FloatingPlaylistBadge />
      <MobileCTA />
    </div>
  );
}