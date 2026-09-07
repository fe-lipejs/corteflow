import {
  motion,
  AnimatePresence,
  useInView,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion';
import { Link } from 'react-router-dom';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowDown,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Menu,
  X,
  Users,
  WalletCards,
  BarChart3,
  Smartphone,
  MapPin,
  Sparkles,
  Scissors,
  Home,
  Zap,
} from 'lucide-react';

import CookieConsentBanner from '../components/cookies/CookieConsentBanner';
import { trackEvent } from '../lib/analytics';
import { usePageTracking } from '../hooks/usePageTracking';
import {
  SpotifyGlyph,
  FloatingPlaylistBadge,
} from '../components/SpotifyMoodCard';

/* ============================================================
   RAFFROS — NEW PREMIUM LANDING
   Visual direction:
   Apple × Nothing
   Minimal / Editorial / Product-first
   ============================================================ */

const EASE: [number, number, number, number] = [
  0.16,
  1,
  0.3,
  1,
];

const M = {
  booking: '/Mockups/Iphone - Tela de Agendamento.PNG',
  services: '/Mockups/Iphone - Serviços.PNG',
  domicilio: '/Mockups/Iphone - Tela de Escolha Domicilio.PNG',
  pix: '/Mockups/Iphone - Tela de Pagamento Pix.PNG',
  payment: '/Mockups/Iphone - Tela de Pagamento.PNG',

  themeA: '/Mockups/Iphone - Personalização Tema 1.PNG',
  themeB: '/Mockups/Iphone - Personalização Tema 2.PNG',
  themeC: '/Mockups/Iphone - Personalização Tema 3.PNG',

  barber:
    '/Mockups/Tablet Horizontal - Tela de Agendamento Barbearia.png',

  salon:
    '/Mockups/Tablet Horizontal - Tela de Agendamento Salão.png',

  metrics:
    '/Mockups/Tablet Horizontal - Visão Geral Metricas.jpg',
};

/* ============================================================
   UTILS
   ============================================================ */

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function Reveal({
  children,
  delay = 0,
  y = 32,
  className = '',
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={{
        opacity: 0,
        y: reduce ? 0 : y,
      }}
      whileInView={{
        opacity: 1,
        y: 0,
      }}
      viewport={{
        once: true,
        margin: '-10% 0px',
      }}
      transition={{
        duration: reduce ? 0.25 : 0.85,
        delay: reduce ? 0 : delay,
        ease: EASE,
      }}
    >
      {children}
    </motion.div>
  );
}

function MonoLabel({
  children,
  dark = false,
}: {
  children: ReactNode;
  dark?: boolean;
}) {
  return (
    <div
      className={cn(
        'mb-7 flex items-center gap-3 font-mono text-[10px] font-medium uppercase tracking-[0.2em]',
        dark ? 'text-black/45' : 'text-white/45'
      )}
    >
      <span
        className={cn(
          'h-px w-7',
          dark ? 'bg-black/30' : 'bg-white/30'
        )}
      />

      <span>{children}</span>
    </div>
  );
}

function SectionNumber({
  number,
  dark = false,
}: {
  number: string;
  dark?: boolean;
}) {
  return (
    <span
      className={cn(
        'font-mono text-[10px] tracking-[0.18em]',
        dark ? 'text-black/30' : 'text-white/30'
      )}
    >
      {number}
    </span>
  );
}

/* ============================================================
   GLOBAL BACKGROUND
   ============================================================ */

function Grain() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[999] opacity-[0.025] mix-blend-overlay"
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='.45'/%3E%3C/svg%3E\")",
      }}
    />
  );
}

/* ============================================================
   NAVIGATION
   ============================================================ */

function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => {
      setScrolled(window.scrollY > 40);
    };

    window.addEventListener('scroll', handler, {
      passive: true,
    });

    return () => {
      window.removeEventListener('scroll', handler);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';

    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const nav = [
    ['produto', 'Produto'],
    ['experiencia', 'Experiência'],
    ['para-quem', 'Para quem'],
    ['planos', 'Planos'],
  ] as const;

  return (
    <>
      <header
        className={cn(
          'fixed left-0 right-0 top-0 z-[200] transition-all duration-500',
          scrolled
            ? 'border-b border-white/[0.08] bg-black/80 backdrop-blur-2xl'
            : 'bg-transparent'
        )}
      >
        <div className="mx-auto flex h-[76px] max-w-[1500px] items-center justify-between px-5 md:px-10 lg:px-14">
          <a
            href="#hero"
            className="group flex items-center gap-3"
          >
            <img
              src="/logo.svg"
              alt="Raffros"
              className="h-7 w-auto transition-transform duration-500 group-hover:scale-105"
            />

            <span className="font-display text-[18px] font-semibold tracking-[-0.04em] text-white">
              Raffros
            </span>
          </a>

          <nav className="hidden items-center gap-9 md:flex">
            {nav.map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                onClick={() =>
                  trackEvent('click_nav_link', {
                    metadata: { item: id },
                  })
                }
                className="text-[13px] font-medium text-white/55 transition-colors hover:text-white"
              >
                {label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-5">
            <Link
              to="/admin"
              onClick={() =>
                trackEvent('click_nav_login')
              }
              className="hidden text-[13px] font-medium text-white/55 transition-colors hover:text-white sm:block"
            >
              Entrar
            </Link>

            <Link
              to="/cadastro"
              onClick={() =>
                trackEvent('click_nav_comecar_agora')
              }
              className="hidden h-10 items-center justify-center rounded-full bg-white px-5 text-[12px] font-semibold text-black transition-all hover:bg-white/90 hover:scale-[1.02] md:flex"
            >
              Começar grátis
            </Link>

            <button
              type="button"
              aria-label={open ? 'Fechar menu' : 'Abrir menu'}
              onClick={() => setOpen((v) => !v)}
              className="flex h-10 w-10 items-center justify-center text-white md:hidden"
            >
              {open ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[190] flex flex-col bg-[#050505] md:hidden"
          >
            <div className="flex h-[76px] items-center justify-between border-b border-white/[0.08] px-5">
              <div className="flex items-center gap-3">
                <img
                  src="/logo.svg"
                  alt="Raffros"
                  className="h-7 w-auto"
                />
                <span className="font-display text-lg font-semibold text-white">
                  Raffros
                </span>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-10 w-10 items-center justify-center text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-1 flex-col justify-center px-7">
              {nav.map(([id, label], index) => (
                <a
                  key={id}
                  href={`#${id}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between border-b border-white/[0.08] py-6"
                >
                  <span className="font-display text-[34px] font-medium tracking-[-0.05em] text-white">
                    {label}
                  </span>

                  <span className="font-mono text-[10px] text-white/30">
                    0{index + 1}
                  </span>
                </a>
              ))}
            </div>

            <div className="p-5">
              <Link
                to="/cadastro"
                onClick={() => setOpen(false)}
                className="flex h-14 items-center justify-center rounded-full bg-white text-[14px] font-semibold text-black"
              >
                Começar grátis
              </Link>

              <p className="mt-4 text-center font-mono text-[10px] text-white/30">
                7 dias grátis · sem cartão
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ============================================================
   HERO
   ============================================================ */

function HeroSection() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });

  const imageY = useTransform(
    scrollYProgress,
    [0, 1],
    reduce ? ['0%', '0%'] : ['0%', '16%']
  );

  const imageScale = useTransform(
    scrollYProgress,
    [0, 1],
    reduce ? [1, 1] : [1, 0.94]
  );

  return (
    <section
      ref={ref}
      id="hero"
      className="relative min-h-[100svh] overflow-hidden bg-[#050505] text-white"
    >
      {/* Technical vertical lines */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.055]"
      >
        <div className="mx-auto h-full max-w-[1500px] border-x border-white" />
      </div>

      {/* Ambient light */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-[50%] top-[45%] h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[130px]"
        style={{
          background:
            'radial-gradient(circle, rgba(255,255,255,0.07), transparent 65%)',
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-[1500px] flex-col px-5 pt-[76px] md:px-10 lg:px-14">
        <div className="flex flex-1 flex-col justify-between pb-8 pt-16 md:pt-20">
          {/* TOP LINE */}
          <div className="flex items-center justify-between">
            <MonoLabel>
              Sistema de gestão para beleza
            </MonoLabel>

            <SectionNumber number="01 / 14" />
          </div>

          {/* MAIN */}
          <div className="grid items-center gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-8">
            <div className="relative z-20">
              <motion.div
                initial={{
                  opacity: 0,
                  y: reduce ? 0 : 25,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                transition={{
                  duration: 0.9,
                  ease: EASE,
                }}
              >
                <h1 className="max-w-[850px] font-display text-[clamp(52px,8.3vw,126px)] font-medium leading-[0.87] tracking-[-0.075em]">
                  Sua agenda.
                  <br />
                  <span className="text-white/35">
                    Finalmente
                  </span>
                  <br />
                  <span className="text-white">
                    trabalhando.
                  </span>
                </h1>
              </motion.div>

              <motion.p
                initial={{
                  opacity: 0,
                  y: reduce ? 0 : 20,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                transition={{
                  duration: 0.8,
                  delay: 0.15,
                  ease: EASE,
                }}
                className="mt-9 max-w-[470px] text-[15px] leading-[1.7] text-white/45 md:text-[17px]"
              >
                Seus clientes escolhem serviço, profissional
                e horário pelo seu link. A Raffros organiza
                o resto.
              </motion.p>

              <motion.div
                initial={{
                  opacity: 0,
                  y: reduce ? 0 : 18,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                transition={{
                  duration: 0.8,
                  delay: 0.25,
                  ease: EASE,
                }}
                className="mt-9 flex flex-wrap items-center gap-5"
              >
                <Link
                  to="/cadastro"
                  onClick={() =>
                    trackEvent('click_hero_comecar_agora')
                  }
                  className="group flex h-14 items-center gap-4 rounded-full bg-white px-7 text-[14px] font-semibold text-black transition-all hover:scale-[1.025]"
                >
                  Começar grátis

                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black text-white">
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>

                <a
                  href="#produto"
                  className="group flex items-center gap-3 text-[13px] font-medium text-white/45 transition-colors hover:text-white"
                >
                  Explorar produto

                  <ArrowDown className="h-4 w-4 transition-transform group-hover:translate-y-1" />
                </a>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{
                  duration: 1,
                  delay: 0.5,
                }}
                className="mt-8 flex items-center gap-5 font-mono text-[10px] uppercase tracking-[0.14em] text-white/25"
              >
                <span>7 dias grátis</span>
                <span className="h-3 w-px bg-white/15" />
                <span>Sem cartão</span>
                <span className="h-3 w-px bg-white/15" />
                <span>Cancele quando quiser</span>
              </motion.div>
            </div>

            {/* PRODUCT */}
            <motion.div
              style={{
                y: imageY,
                scale: imageScale,
              }}
              className="relative flex min-h-[480px] items-center justify-center lg:min-h-[650px]"
            >
              {/* Huge editorial number */}
              <div className="pointer-events-none absolute right-0 top-[3%] font-display text-[clamp(150px,24vw,360px)] font-semibold leading-none tracking-[-0.1em] text-white/[0.025]">
                01
              </div>

              {/* Product halo */}
              <div
                className="absolute h-[520px] w-[520px] rounded-full blur-[100px]"
                style={{
                  background:
                    'radial-gradient(circle, rgba(255,255,255,0.09), transparent 68%)',
                }}
              />

              {/* Device */}
              <div
                className="relative z-10 w-[245px] sm:w-[285px] md:w-[320px] lg:w-[360px]"
                style={{
                  transform:
                    'perspective(1600px) rotateY(-8deg) rotateX(2deg)',
                }}
              >
                <div className="relative rounded-[3.4rem] border border-white/[0.15] bg-[#111] p-[8px] shadow-[0_80px_150px_-45px_rgba(0,0,0,1)]">
                  <div className="absolute inset-0 rounded-[3.4rem] ring-1 ring-inset ring-white/[0.04]" />

                  <span className="absolute left-1/2 top-[11px] z-20 h-[15px] w-[62px] -translate-x-1/2 rounded-full border border-white/10 bg-black" />

                  <div className="relative aspect-[9/19.5] overflow-hidden rounded-[2.8rem] bg-black">
                    <img
                      src={M.booking}
                      alt="Agendamento online Raffros"
                      className="absolute inset-0 h-full w-full object-cover object-top"
                      loading="eager"
                    />

                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.06] via-transparent to-black/20" />
                  </div>
                </div>
              </div>

              {/* Small technical label */}
              <motion.div
                animate={
                  reduce
                    ? {}
                    : {
                      y: [0, -7, 0],
                    }
                }
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
                className="absolute bottom-[14%] left-[3%] z-20 hidden border border-white/10 bg-black/80 px-4 py-3 backdrop-blur-xl sm:block"
              >
                <div className="flex items-center gap-3">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#F5A623]" />

                  <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/45">
                    agenda online
                  </span>
                </div>
              </motion.div>

              <motion.div
                animate={
                  reduce
                    ? {}
                    : {
                      y: [0, 7, 0],
                    }
                }
                transition={{
                  duration: 4.5,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: 0.6,
                }}
                className="absolute right-[0%] top-[19%] z-20 hidden border border-white/10 bg-black/80 px-4 py-3 backdrop-blur-xl sm:block"
              >
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-4 w-4 text-white" />

                  <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-white/45">
                    confirmado
                  </span>
                </div>
              </motion.div>
            </motion.div>
          </div>

          {/* BOTTOM */}
          <div className="flex items-end justify-between border-t border-white/[0.08] pt-5">
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/20">
              Raffros / 2026
            </span>

            <span className="hidden items-center gap-2 font-mono text-[9px] uppercase tracking-[0.2em] text-white/20 sm:flex">
              Role para explorar
              <ChevronDown className="h-3 w-3" />
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   STATEMENT
   ============================================================ */

function StatementSection() {
  const ref = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  const y = useTransform(
    scrollYProgress,
    [0, 1],
    ['-8%', '8%']
  );

  return (
    <section
      ref={ref}
      className="relative overflow-hidden bg-white px-5 py-[150px] md:px-10 md:py-[220px]"
    >
      <div className="mx-auto max-w-[1250px]">
        <SectionNumber
          number="02 / 14"
          dark
        />

        <motion.div style={{ y }} className="mt-16">
          <p className="max-w-[1100px] font-display text-[clamp(40px,7vw,100px)] font-medium leading-[0.94] tracking-[-0.065em] text-[#1D1D1F]">
            Você não abriu um negócio
            <span className="text-black/20">
              {' '}
              para passar o dia
            </span>{' '}
            respondendo
            <span className="text-black/20">
              {' '}
              “tem horário?”
            </span>
          </p>
        </motion.div>

        <Reveal delay={0.15}>
          <div className="mt-16 flex max-w-[650px] items-start gap-6">
            <div className="mt-2 h-px w-12 shrink-0 bg-black/20" />

            <p className="text-[16px] leading-[1.7] text-black/50">
              Enquanto você corta, pinta, faz unha ou
              atende em casa, sua agenda continua
              trabalhando. É exatamente essa parte que
              a Raffros resolve.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ============================================================
   PRODUCT INTRO
   ============================================================ */

function ProductSection() {
  const features = [
    {
      number: '01',
      title: 'Agenda online',
      text: 'Seu cliente escolhe o horário sem precisar mandar uma mensagem.',
      icon: CalendarDays,
    },
    {
      number: '02',
      title: 'Equipe organizada',
      text: 'Cada profissional com sua agenda, seus serviços e seus horários.',
      icon: Users,
    },
    {
      number: '03',
      title: 'Financeiro',
      text: 'Faturamento, comissões e movimentações em uma única visão.',
      icon: WalletCards,
    },
  ];

  return (
    <section
      id="produto"
      className="bg-[#f5f5f5] px-5 py-[120px] md:px-10 md:py-[180px]"
    >
      <div className="mx-auto max-w-[1500px]">
        <div className="grid gap-16 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <div className="lg:sticky lg:top-32 lg:self-start">
            <Reveal>
              <MonoLabel dark>
                O produto
              </MonoLabel>

              <h2 className="font-display text-[clamp(42px,6vw,82px)] font-medium leading-[0.93] tracking-[-0.06em] text-[#1D1D1F]">
                Tudo que seu
                <br />
                negócio precisa.
                <br />
                <span className="text-black/20">
                  Nada que atrapalhe.
                </span>
              </h2>

              <p className="mt-8 max-w-[460px] text-[15px] leading-[1.7] text-black/50">
                A Raffros reúne a operação inteira em
                uma experiência simples. Você vê o que
                importa e continua fazendo o que sabe
                fazer melhor.
              </p>
            </Reveal>
          </div>

          <div className="space-y-4">
            {features.map((item, index) => {
              const Icon = item.icon;

              return (
                <Reveal
                  key={item.number}
                  delay={index * 0.08}
                >
                  <div className="group border border-black/[0.08] bg-white p-7 transition-all duration-500 hover:border-black/20 md:p-10">
                    <div className="flex items-start justify-between gap-8">
                      <span className="font-mono text-[10px] text-black/25">
                        {item.number}
                      </span>

                      <Icon className="h-5 w-5 text-black/35 transition-colors group-hover:text-black" />
                    </div>

                    <h3 className="mt-20 font-display text-[30px] font-medium tracking-[-0.04em] text-[#1D1D1F] md:text-[40px]">
                      {item.title}
                    </h3>

                    <p className="mt-4 max-w-[520px] text-[15px] leading-[1.7] text-black/45">
                      {item.text}
                    </p>

                    <div className="mt-8 flex items-center gap-3 font-mono text-[9px] uppercase tracking-[0.15em] text-black/25">
                      Explorar
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   BOOKING EXPERIENCE
   ============================================================ */

function BookingExperience() {
  const [active, setActive] = useState(0);
  const reduce = useReducedMotion();

  const steps = [
    {
      index: '01',
      title: 'Seu cliente encontra você.',
      text: 'Um link próprio para sua agenda. Sem aplicativo. Sem conversa no WhatsApp.',
      image: M.booking,
    },
    {
      index: '02',
      title: 'Escolhe o que quer fazer.',
      text: 'Serviço, preço, duração e profissional. Tudo claro antes do horário.',
      image: M.services,
    },
    {
      index: '03',
      title: 'Escolhe quando.',
      text: 'Só aparecem os horários realmente disponíveis.',
      image: M.payment,
    },
    {
      index: '04',
      title: 'Confirma e pronto.',
      text: 'Pagamento, confirmação e atualização da agenda acontecem automaticamente.',
      image: M.pix,
    },
  ];

  return (
    <section
      id="experiencia"
      className="overflow-hidden bg-black px-5 py-[120px] text-white md:px-10 md:py-[180px]"
    >
      <div className="mx-auto max-w-[1500px]">
        <div className="mb-24 flex items-end justify-between gap-10">
          <Reveal>
            <MonoLabel>
              Experiência do cliente
            </MonoLabel>

            <h2 className="max-w-[900px] font-display text-[clamp(42px,7vw,92px)] font-medium leading-[0.9] tracking-[-0.07em]">
              Agendar ficou
              <br />
              <span className="text-white/30">
                ridiculamente simples.
              </span>
            </h2>
          </Reveal>

          <SectionNumber number="03 / 14" />
        </div>

        <div className="grid gap-16 lg:grid-cols-[0.9fr_0.8fr] lg:items-start lg:gap-28">
          <div className="space-y-1">
            {steps.map((step, index) => (
              <button
                key={step.index}
                type="button"
                onClick={() => {
                  setActive(index);

                  trackEvent(
                    'click_story_step',
                    {
                      metadata: {
                        step: index,
                      },
                    }
                  );
                }}
                className={cn(
                  'group w-full border-t border-white/[0.08] py-8 text-left transition-all duration-500',
                  active === index
                    ? 'opacity-100'
                    : 'opacity-35 hover:opacity-70'
                )}
              >
                <div className="flex gap-6">
                  <span className="font-mono text-[10px] text-white/30">
                    {step.index}
                  </span>

                  <div>
                    <h3 className="font-display text-[24px] font-medium tracking-[-0.035em] md:text-[31px]">
                      {step.title}
                    </h3>

                    <AnimatePresence mode="wait">
                      {active === index && (
                        <motion.p
                          initial={{
                            opacity: 0,
                            height: 0,
                          }}
                          animate={{
                            opacity: 1,
                            height: 'auto',
                          }}
                          exit={{
                            opacity: 0,
                            height: 0,
                          }}
                          transition={{
                            duration: reduce ? 0.15 : 0.4,
                            ease: EASE,
                          }}
                          className="mt-4 max-w-[500px] overflow-hidden text-[14px] leading-[1.7] text-white/45"
                        >
                          {step.text}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="flex justify-center lg:sticky lg:top-28">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{
                  opacity: 0,
                  y: reduce ? 0 : 25,
                  scale: reduce ? 1 : 0.98,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                  scale: 1,
                }}
                exit={{
                  opacity: 0,
                  y: reduce ? 0 : -20,
                }}
                transition={{
                  duration: reduce ? 0.15 : 0.5,
                  ease: EASE,
                }}
                className="w-[260px] md:w-[310px]"
              >
                <div
                  className="relative rounded-[3.2rem] border border-white/[0.12] bg-[#101010] p-[8px] shadow-[0_70px_140px_-45px_rgba(0,0,0,1)]"
                  style={{
                    transform:
                      'perspective(1300px) rotateY(-6deg)',
                  }}
                >
                  <span className="absolute left-1/2 top-[11px] z-10 h-[14px] w-[58px] -translate-x-1/2 rounded-full bg-black" />

                  <div className="relative aspect-[9/19.5] overflow-hidden rounded-[2.7rem]">
                    <img
                      src={steps[active].image}
                      alt={steps[active].title}
                      className="absolute inset-0 h-full w-full object-cover object-top"
                    />
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   DASHBOARD / BARBERS
   ============================================================ */

function DashboardSection() {
  return (
    <section className="bg-white px-5 py-[120px] md:px-10 md:py-[180px]">
      <div className="mx-auto max-w-[1500px]">
        <div className="grid gap-14 lg:grid-cols-[0.75fr_1.25fr] lg:items-end lg:gap-20">
          <Reveal>
            <MonoLabel dark>
              Para quem vive da cadeira
            </MonoLabel>

            <h2 className="font-display text-[clamp(44px,6vw,78px)] font-medium leading-[0.93] tracking-[-0.065em] text-[#1D1D1F]">
              Veja sua
              <br />
              operação.
              <br />
              <span className="text-black/20">
                Não imagine.
              </span>
            </h2>

            <p className="mt-8 max-w-[460px] text-[15px] leading-[1.7] text-black/45">
              Agenda, equipe, clientes e financeiro
              apresentados como deveriam ser:
              simples, rápidos e fáceis de entender.
            </p>
          </Reveal>

          <Reveal delay={0.12}>
            <div className="overflow-hidden border border-black/[0.08] bg-[#f5f5f5] shadow-[0_40px_100px_-50px_rgba(0,0,0,.35)]">
              <div className="flex h-11 items-center border-b border-black/[0.06] px-4">
                <div className="flex gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-black/15" />
                  <span className="h-2 w-2 rounded-full bg-black/10" />
                  <span className="h-2 w-2 rounded-full bg-black/10" />
                </div>

                <span className="ml-5 font-mono text-[9px] text-black/25">
                  app.raffros.com/agenda
                </span>
              </div>

              <img
                src={M.barber}
                alt="Dashboard da Raffros"
                className="block w-full"
                loading="lazy"
              />
            </div>
          </Reveal>
        </div>

        <div className="mt-20 grid border-t border-black/[0.08] md:grid-cols-4">
          {[
            {
              icon: CalendarDays,
              title: 'Agenda visual',
              text: 'O dia inteiro em uma única visão.',
            },
            {
              icon: Users,
              title: 'Equipe',
              text: 'Cada profissional no seu horário.',
            },
            {
              icon: Clock3,
              title: 'Disponibilidade',
              text: 'Só horários realmente livres.',
            },
            {
              icon: BarChart3,
              title: 'Desempenho',
              text: 'Veja como o negócio está indo.',
            },
          ].map(({ icon: Icon, title, text }, i) => (
            <Reveal
              key={title}
              delay={i * 0.06}
            >
              <div className="border-b border-black/[0.08] p-6 md:border-r md:last:border-r-0">
                <Icon className="h-5 w-5 text-black/35" />

                <h3 className="mt-12 font-display text-[19px] font-medium tracking-[-0.025em] text-[#1D1D1F]">
                  {title}
                </h3>

                <p className="mt-2 text-[13px] leading-relaxed text-black/40">
                  {text}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   SALON / TEAM
   ============================================================ */

function TeamSection() {
  return (
    <section className="bg-[#050505] px-5 py-[120px] text-white md:px-10 md:py-[180px]">
      <div className="mx-auto max-w-[1500px]">
        <div className="grid gap-16 lg:grid-cols-[0.7fr_1.3fr] lg:items-center lg:gap-24">
          <Reveal>
            <MonoLabel>
              Quando existe uma equipe
            </MonoLabel>

            <h2 className="font-display text-[clamp(42px,6vw,76px)] font-medium leading-[0.93] tracking-[-0.06em]">
              Crescer não
              <br />
              deveria
              <br />
              <span className="text-white/30">
                complicar.
              </span>
            </h2>

            <p className="mt-8 max-w-[450px] text-[15px] leading-[1.7] text-white/45">
              Profissionais, serviços, comissões e
              horários diferentes. Tudo continua
              organizado mesmo quando sua operação
              cresce.
            </p>

            <div className="mt-10 space-y-4">
              {[
                'Agenda por profissional',
                'Comissões automáticas',
                'Serviços personalizados',
                'Relatórios da equipe',
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-3"
                >
                  <Check className="h-4 w-4 text-white/60" />

                  <span className="text-[13px] text-white/45">
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.12}>
            <div className="overflow-hidden border border-white/[0.09]">
              <div className="flex h-11 items-center border-b border-white/[0.07] px-4">
                <div className="flex gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-white/20" />
                  <span className="h-2 w-2 rounded-full bg-white/10" />
                  <span className="h-2 w-2 rounded-full bg-white/10" />
                </div>

                <span className="ml-5 font-mono text-[9px] text-white/20">
                  app.raffros.com/equipe
                </span>
              </div>

              <img
                src={M.salon}
                alt="Gestão de equipe Raffros"
                className="block w-full"
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
   FINANCE
   ============================================================ */

function FinanceSection() {
  return (
    <section className="bg-[#f2f2f2] px-5 py-[120px] md:px-10 md:py-[180px]">
      <div className="mx-auto max-w-[1500px]">
        <div className="mb-20 flex flex-col justify-between gap-8 md:flex-row md:items-end">
          <Reveal>
            <MonoLabel dark>
              Visão do negócio
            </MonoLabel>

            <h2 className="font-display text-[clamp(44px,6vw,80px)] font-medium leading-[0.92] tracking-[-0.065em] text-[#1D1D1F]">
              O dinheiro
              <br />
              também
              <br />
              <span className="text-black/20">
                precisa aparecer.
              </span>
            </h2>
          </Reveal>

          <Reveal delay={0.1}>
            <p className="max-w-[400px] text-[15px] leading-[1.7] text-black/45">
              Faturamento, ocupação, clientes e
              comissões. Você não precisa montar
              planilhas para entender seu negócio.
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.12}>
          <div className="overflow-hidden border border-black/[0.08] bg-white shadow-[0_50px_100px_-60px_rgba(0,0,0,.4)]">
            <div className="flex h-11 items-center border-b border-black/[0.06] px-4">
              <div className="flex gap-1.5">
                <span className="h-2 w-2 rounded-full bg-black/15" />
                <span className="h-2 w-2 rounded-full bg-black/10" />
                <span className="h-2 w-2 rounded-full bg-black/10" />
              </div>

              <span className="ml-5 font-mono text-[9px] text-black/25">
                app.raffros.com/financeiro
              </span>
            </div>

            <img
              src={M.metrics}
              alt="Métricas financeiras Raffros"
              className="block w-full"
              loading="lazy"
            />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ============================================================
   ANTI FURO
   ============================================================ */

function PaymentSection() {
  return (
    <section className="overflow-hidden bg-black px-5 py-[130px] text-white md:px-10 md:py-[190px]">
      <div className="mx-auto max-w-[1500px]">
        <div className="grid items-center gap-20 lg:grid-cols-[1fr_0.8fr] lg:gap-28">
          <Reveal>
            <div className="relative flex items-end justify-center gap-[-10px]">
              <div
                className="relative z-10 w-[210px] md:w-[260px]"
                style={{
                  transform:
                    'perspective(1200px) rotateY(7deg)',
                }}
              >
                <div className="rounded-[3rem] border border-white/[0.12] bg-[#101010] p-[7px] shadow-[0_60px_100px_-45px_rgba(0,0,0,1)]">
                  <span className="absolute left-1/2 top-[10px] z-10 h-3 w-12 -translate-x-1/2 rounded-full bg-black" />

                  <div className="relative aspect-[9/19.5] overflow-hidden rounded-[2.5rem]">
                    <img
                      src={M.pix}
                      alt="Pagamento Pix Raffros"
                      className="absolute inset-0 h-full w-full object-cover object-top"
                    />
                  </div>
                </div>
              </div>

              <div
                className="relative -ml-12 w-[185px] opacity-65 md:w-[225px]"
                style={{
                  transform:
                    'perspective(1200px) rotateY(-7deg) translateY(50px)',
                }}
              >
                <div className="rounded-[2.8rem] border border-white/[0.1] bg-[#101010] p-[7px]">
                  <span className="absolute left-1/2 top-[10px] z-10 h-3 w-12 -translate-x-1/2 rounded-full bg-black" />

                  <div className="relative aspect-[9/19.5] overflow-hidden rounded-[2.3rem]">
                    <img
                      src={M.payment}
                      alt="Pagamento Raffros"
                      className="absolute inset-0 h-full w-full object-cover object-top"
                    />
                  </div>
                </div>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <MonoLabel>
              Anti-furo
            </MonoLabel>

            <h2 className="font-display text-[clamp(44px,6vw,78px)] font-medium leading-[0.93] tracking-[-0.065em]">
              Seu horário
              <br />
              tem valor.
            </h2>

            <p className="mt-8 max-w-[470px] text-[15px] leading-[1.7] text-white/45">
              Você define o sinal. O cliente paga via
              Pix. O horário é confirmado. Menos
              faltas, menos prejuízo e menos dor de
              cabeça.
            </p>

            <div className="mt-10 border-t border-white/[0.08]">
              {[
                'Você define o percentual',
                'Pagamento via Pix',
                'Confirmação automática',
              ].map((item, index) => (
                <div
                  key={item}
                  className="flex items-center justify-between border-b border-white/[0.08] py-5"
                >
                  <span className="font-mono text-[10px] text-white/25">
                    0{index + 1}
                  </span>

                  <span className="text-[13px] text-white/55">
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   DOMICILIO
   ============================================================ */

function DomicilioSection() {
  return (
    <section className="overflow-hidden bg-white px-5 py-[130px] md:px-10 md:py-[190px]">
      <div className="mx-auto max-w-[1500px]">
        <div className="grid items-center gap-20 lg:grid-cols-[0.9fr_1.1fr] lg:gap-28">
          <Reveal>
            <MonoLabel dark>
              Atendimento a domicílio
            </MonoLabel>

            <h2 className="font-display text-[clamp(44px,6vw,80px)] font-medium leading-[0.92] tracking-[-0.065em] text-[#1D1D1F]">
              Você escolhe
              <br />
              onde atende.
              <br />
              <span className="text-black/20">
                A Raffros calcula.
              </span>
            </h2>

            <p className="mt-8 max-w-[470px] text-[15px] leading-[1.7] text-black/45">
              Defina seu raio de atendimento. O cliente
              informa o endereço e o sistema verifica se
              ele está dentro da sua área.
            </p>

            <div className="mt-10 space-y-4">
              {[
                'Raio de atendimento configurável',
                'Endereço informado pelo cliente',
                'Taxa de deslocamento',
                'Agenda específica para domicílio',
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-3"
                >
                  <CheckCircle2 className="h-4 w-4 text-black/40" />

                  <span className="text-[13px] text-black/50">
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="relative flex min-h-[520px] items-center justify-center">
              <div
                className="absolute h-[430px] w-[430px] rounded-full border border-black/[0.07]"
              />

              <div
                className="absolute h-[300px] w-[300px] rounded-full border border-black/[0.07]"
              />

              <div
                className="absolute h-[160px] w-[160px] rounded-full border border-black/[0.07]"
              />

              <div className="absolute h-2 w-2 rounded-full bg-black" />

              <div className="absolute right-[13%] top-[24%] flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-black" />

                <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-black/40">
                  cliente
                </span>
              </div>

              <div className="absolute bottom-[23%] left-[15%] flex items-center gap-2">
                <span className="h-2 w-2 rounded-full border border-black/30" />

                <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-black/30">
                  fora do raio
                </span>
              </div>

              <div
                className="relative z-10 w-[220px] md:w-[270px]"
                style={{
                  transform:
                    'perspective(1300px) rotateY(-8deg) rotateX(2deg)',
                }}
              >
                <div className="rounded-[3rem] border border-black/10 bg-[#101010] p-[7px] shadow-[0_60px_100px_-45px_rgba(0,0,0,.5)]">
                  <span className="absolute left-1/2 top-[10px] z-10 h-3 w-12 -translate-x-1/2 rounded-full bg-black" />

                  <div className="relative aspect-[9/19.5] overflow-hidden rounded-[2.5rem]">
                    <img
                      src={M.domicilio}
                      alt="Atendimento a domicílio"
                      className="absolute inset-0 h-full w-full object-cover object-top"
                    />
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   PERSONALIZATION
   ============================================================ */

function PersonalizationSection() {
  const phones = [
    {
      image: M.themeA,
      title: 'Clássico',
    },
    {
      image: M.themeB,
      title: 'Noir',
    },
    {
      image: M.themeC,
      title: 'Elegante',
    },
  ];

  return (
    <section className="overflow-hidden bg-[#f4f4f4] px-5 py-[130px] md:px-10 md:py-[190px]">
      <div className="mx-auto max-w-[1500px]">
        <div className="text-center">
          <Reveal>
            <MonoLabel dark>
              Sua identidade
            </MonoLabel>

            <h2 className="font-display text-[clamp(46px,7vw,94px)] font-medium leading-[0.9] tracking-[-0.075em] text-[#1D1D1F]">
              Seu negócio.
              <br />
              <span className="text-black/20">
                Sua experiência.
              </span>
            </h2>

            <p className="mx-auto mt-8 max-w-[500px] text-[15px] leading-[1.7] text-black/45">
              Logo, cores, banner e estilo. A página
              onde seus clientes agendam tem a cara
              da sua marca.
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.1}>
          <div className="relative mx-auto mt-24 flex h-[470px] max-w-[760px] justify-center">
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{
                duration: 5,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="absolute left-[2%] top-[55px] z-[1] w-[150px] md:left-[8%] md:w-[190px]"
              style={{
                transform:
                  'perspective(1000px) rotateY(20deg) rotateZ(-4deg)',
              }}
            >
              <Phone image={phones[0].image} />
            </motion.div>

            <motion.div
              animate={{ y: [0, -14, 0] }}
              transition={{
                duration: 4.5,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="absolute left-1/2 top-0 z-10 w-[205px] -translate-x-1/2 md:w-[245px]"
            >
              <Phone image={phones[1].image} large />

              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap border border-black/10 bg-white px-4 py-2 font-mono text-[9px] uppercase tracking-[0.15em] text-black/45">
                sua identidade
              </div>
            </motion.div>

            <motion.div
              animate={{ y: [0, -7, 0] }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: 0.7,
              }}
              className="absolute right-[2%] top-[65px] z-[1] w-[150px] md:right-[8%] md:w-[190px]"
              style={{
                transform:
                  'perspective(1000px) rotateY(-20deg) rotateZ(4deg)',
              }}
            >
              <Phone image={phones[2].image} />
            </motion.div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Phone({
  image,
  large = false,
}: {
  image: string;
  large?: boolean;
}) {
  return (
    <div
      className={cn(
        'relative rounded-[2.8rem] border border-black/15 bg-[#111] p-[7px]',
        large
          ? 'shadow-[0_60px_100px_-35px_rgba(0,0,0,.45)]'
          : 'shadow-[0_35px_70px_-30px_rgba(0,0,0,.35)]'
      )}
    >
      <span
        className={cn(
          'absolute left-1/2 top-[9px] z-10 -translate-x-1/2 rounded-full bg-black',
          large ? 'h-[13px] w-[52px]' : 'h-[10px] w-[42px]'
        )}
      />

      <div className="relative aspect-[9/19.5] overflow-hidden rounded-[2.35rem]">
        <img
          src={image}
          alt="Página personalizada Raffros"
          className="absolute inset-0 h-full w-full object-cover object-top"
          loading="lazy"
        />
      </div>
    </div>
  );
}

/* ============================================================
   AUDIENCE
   ============================================================ */

function AudienceSection() {
  const audiences = [
    {
      icon: Scissors,
      title: 'Barbearias',
      description:
        'Agenda cheia, menos WhatsApp e mais cadeiras ocupadas.',
    },
    {
      icon: Sparkles,
      title: 'Salões',
      description:
        'Equipe, serviços, horários e comissões organizados.',
    },
    {
      icon: Zap,
      title: 'Autônomos',
      description:
        'Uma experiência profissional desde o primeiro cliente.',
    },
    {
      icon: Home,
      title: 'Atendimento a domicílio',
      description:
        'Seu raio, sua taxa e sua agenda.',
    },
  ];

  return (
    <section
      id="para-quem"
      className="bg-white px-5 py-[120px] md:px-10 md:py-[180px]"
    >
      <div className="mx-auto max-w-[1500px]">
        <div className="mb-20 flex flex-col justify-between gap-8 md:flex-row md:items-end">
          <Reveal>
            <MonoLabel dark>
              Para quem é
            </MonoLabel>

            <h2 className="font-display text-[clamp(45px,7vw,90px)] font-medium leading-[0.9] tracking-[-0.07em] text-[#1D1D1F]">
              Feita para
              <br />
              quem vive
              <br />
              <span className="text-black/20">
                de beleza.
              </span>
            </h2>
          </Reveal>

          <SectionNumber
            number="10 / 14"
            dark
          />
        </div>

        <div className="grid border-t border-black/[0.08] md:grid-cols-2">
          {audiences.map(
            ({ icon: Icon, title, description }, index) => (
              <Reveal
                key={title}
                delay={index * 0.06}
              >
                <div className="group border-b border-black/[0.08] p-7 md:p-10 md:nth-[odd]:border-r">
                  <div className="flex items-start justify-between">
                    <span className="font-mono text-[10px] text-black/25">
                      0{index + 1}
                    </span>

                    <Icon className="h-5 w-5 text-black/30 transition-colors group-hover:text-black" />
                  </div>

                  <h3 className="mt-24 font-display text-[28px] font-medium tracking-[-0.04em] text-[#1D1D1F] md:text-[36px]">
                    {title}
                  </h3>

                  <p className="mt-4 max-w-[430px] text-[14px] leading-[1.7] text-black/40">
                    {description}
                  </p>

                  <div className="mt-8 flex items-center gap-3 text-[11px] text-black/30">
                    <span className="h-px w-8 bg-black/20 transition-all group-hover:w-12 group-hover:bg-black/50" />

                    Saiba mais
                  </div>
                </div>
              </Reveal>
            )
          )}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   PRICING
   ============================================================ */

function PricingSection() {
  const plans = [
    {
      name: 'Solo',
      price: '27',
      description:
        'Para quem trabalha sozinho.',
      features: [
        'Agenda online',
        '1 profissional',
        'Atendimento a domicílio',
        'Lembretes automáticos',
        'Sinal via Pix',
      ],
    },
    {
      name: 'Studio',
      price: '47',
      description:
        'Para negócios com equipe.',
      features: [
        'Tudo do Solo',
        'Até 5 profissionais',
        'Gestão de equipe',
        'Relatórios',
        'Suporte prioritário',
      ],
      featured: true,
    },
    {
      name: 'Business',
      price: '97',
      description:
        'Para operações maiores.',
      features: [
        'Tudo do Studio',
        'Profissionais ilimitados',
        'Múltiplas unidades',
        'Gestão avançada',
      ],
    },
  ];

  return (
    <section
      id="planos"
      className="bg-[#050505] px-5 py-[130px] text-white md:px-10 md:py-[190px]"
    >
      <div className="mx-auto max-w-[1200px]">
        <div className="mb-20 text-center">
          <Reveal>
            <MonoLabel>
              Planos
            </MonoLabel>

            <h2 className="font-display text-[clamp(45px,7vw,86px)] font-medium leading-[0.9] tracking-[-0.07em]">
              Comece simples.
              <br />
              <span className="text-white/30">
                Cresça quando quiser.
              </span>
            </h2>

            <p className="mx-auto mt-8 max-w-[500px] text-[14px] leading-[1.7] text-white/40">
              Todos os planos começam com 7 dias grátis.
              Sem cartão. Cancele quando quiser.
            </p>
          </Reveal>
        </div>

        <div className="grid border-t border-white/[0.08] md:grid-cols-3">
          {plans.map((plan, index) => (
            <Reveal
              key={plan.name}
              delay={index * 0.08}
            >
              <div
                className={cn(
                  'relative flex h-full flex-col border-b border-white/[0.08] p-7 md:border-r md:p-9',
                  index === plans.length - 1 &&
                  'md:border-r-0',
                  plan.featured &&
                  'bg-white/[0.035]'
                )}
              >
                {plan.featured && (
                  <span className="absolute left-9 top-7 font-mono text-[9px] uppercase tracking-[0.15em] text-white/50">
                    Mais escolhido
                  </span>
                )}

                <div
                  className={cn(
                    plan.featured
                      ? 'mt-8'
                      : ''
                  )}
                >
                  <h3 className="font-display text-[27px] font-medium tracking-[-0.04em]">
                    {plan.name}
                  </h3>

                  <p className="mt-3 min-h-[44px] text-[13px] leading-relaxed text-white/35">
                    {plan.description}
                  </p>
                </div>

                <div className="mt-12">
                  <span className="font-display text-[60px] font-medium leading-none tracking-[-0.07em]">
                    <small className="mr-1 align-top text-[18px] text-white/40">
                      R$
                    </small>

                    {plan.price}
                  </span>

                  <span className="ml-2 font-mono text-[9px] uppercase text-white/25">
                    / mês
                  </span>
                </div>

                <div className="mt-10 border-t border-white/[0.08] pt-7">
                  <ul className="space-y-4">
                    {plan.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-center gap-3 text-[12.5px] text-white/55"
                      >
                        <Check className="h-3.5 w-3.5 text-white/35" />

                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>

                <Link
                  to="/cadastro"
                  onClick={() =>
                    trackEvent(
                      `click_plano_${plan.name.toLowerCase()}`,
                      {
                        metadata: {
                          plano: plan.name,
                          preco: plan.price,
                        },
                      }
                    )
                  }
                  className={cn(
                    'mt-auto flex h-13 min-h-[52px] items-center justify-center rounded-full text-[13px] font-semibold transition-all',
                    plan.featured
                      ? 'mt-12 bg-white text-black hover:bg-white/90'
                      : 'mt-12 border border-white/15 text-white hover:border-white/40'
                  )}
                >
                  Começar grátis
                </Link>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.2}>
          <div className="mt-10 text-center font-mono text-[9px] uppercase tracking-[0.15em] text-white/20">
            7 dias grátis · sem cartão · cancele quando quiser
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ============================================================
   FINAL CTA
   ============================================================ */

function FinalCTASection() {
  const ref = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  const y = useTransform(
    scrollYProgress,
    [0, 1],
    ['10%', '-10%']
  );

  return (
    <section
      ref={ref}
      className="relative overflow-hidden bg-white px-5 py-[170px] text-center md:py-[250px]"
    >
      <motion.div
        style={{ y }}
        className="pointer-events-none absolute left-1/2 top-[10%] -translate-x-1/2 select-none font-display text-[30vw] font-semibold leading-none tracking-[-0.1em] text-black/[0.025]"
      >
        R
      </motion.div>

      <div className="relative z-10 mx-auto max-w-[1000px]">
        <Reveal>
          <MonoLabel dark>
            Comece agora
          </MonoLabel>

          <h2 className="font-display text-[clamp(48px,8vw,108px)] font-medium leading-[0.87] tracking-[-0.075em] text-[#1D1D1F]">
            Menos tempo
            <br />
            administrando.
            <br />
            <span className="text-black/20">
              Mais tempo atendendo.
            </span>
          </h2>

          <p className="mx-auto mt-10 max-w-[480px] text-[15px] leading-[1.7] text-black/45">
            Configure seu espaço, coloque sua agenda
            online e deixe a Raffros cuidar do resto.
          </p>

          <Link
            to="/cadastro"
            onClick={() =>
              trackEvent('click_footer_comecar_agora')
            }
            className="group mx-auto mt-10 flex h-14 w-fit items-center gap-4 rounded-full bg-black px-7 text-[14px] font-semibold text-white transition-all hover:scale-[1.025]"
          >
            Começar grátis

            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-black">
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>

          <p className="mt-5 font-mono text-[9px] uppercase tracking-[0.15em] text-black/25">
            7 dias grátis · sem cartão · cancele quando quiser
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ============================================================
   FOOTER
   ============================================================ */

function Footer() {
  return (
    <footer className="bg-black px-5 pb-10 pt-16 text-white md:px-10">
      <div className="mx-auto max-w-[1500px]">
        <div className="flex flex-col justify-between gap-12 md:flex-row md:items-end">
          <div>
            <a
              href="#hero"
              className="flex items-center gap-3"
            >
              <img
                src="/logo.svg"
                alt="Raffros"
                className="h-7 w-auto"
              />

              <span className="font-display text-[18px] font-semibold tracking-[-0.04em]">
                Raffros
              </span>
            </a>

            <p className="mt-5 max-w-[300px] text-[12px] leading-relaxed text-white/25">
              Sistema de agendamento e gestão para
              barbearias, salões e profissionais da beleza.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-14 gap-y-4 sm:flex sm:gap-8">
            {[
              ['#produto', 'Produto'],
              ['#experiencia', 'Experiência'],
              ['#para-quem', 'Para quem'],
              ['#planos', 'Planos'],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="text-[12px] text-white/35 transition-colors hover:text-white"
              >
                {label}
              </a>
            ))}

            <Link
              to="/playlist"
              className="flex items-center gap-1.5 text-[12px] text-white/35 transition-colors hover:text-white"
            >
              <SpotifyGlyph className="h-3 w-3" />
              Playlist
            </Link>
          </div>
        </div>

        <div className="mt-16 flex flex-col justify-between gap-5 border-t border-white/[0.08] pt-7 md:flex-row">
          <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-white/20">
            © {new Date().getFullYear()} Raffros
          </span>

          <div className="flex gap-6">
            <a
              href="/privacidade"
              className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/20 hover:text-white"
            >
              Privacidade
            </a>

            <a
              href="/termos"
              className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/20 hover:text-white"
            >
              Termos
            </a>

            <Link
              to="/admin"
              className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/20 hover:text-white"
            >
              Entrar
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ============================================================
   MOBILE CTA
   ============================================================ */

function MobileCTA() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = () => {
      setVisible(window.scrollY > 650);
    };

    window.addEventListener('scroll', handler, {
      passive: true,
    });

    return () => {
      window.removeEventListener('scroll', handler);
    };
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{
            opacity: 0,
            y: 80,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          exit={{
            opacity: 0,
            y: 80,
          }}
          transition={{
            duration: 0.4,
            ease: EASE,
          }}
          className="fixed inset-x-0 bottom-0 z-[150] p-4 md:hidden"
        >
          <Link
            to="/cadastro"
            onClick={() =>
              trackEvent('click_mobile_sticky_cta')
            }
            className="flex h-14 w-full items-center justify-center gap-3 rounded-full bg-white text-[14px] font-semibold text-black shadow-[0_10px_50px_rgba(0,0,0,.4)]"
          >
            Começar grátis

            <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ============================================================
   SCROLL PROGRESS
   ============================================================ */

function ScrollProgress() {
  const { scrollYProgress } = useScroll();

  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  return (
    <motion.div
      className="fixed left-0 right-0 top-0 z-[1000] h-[2px] origin-left bg-white"
      style={{ scaleX }}
    />
  );
}

/* ============================================================
   PAGE
   ============================================================ */

export default function LandingPage() {
  usePageTracking();

  return (
    <div className="min-h-screen overflow-x-hidden bg-black font-body text-[#1D1D1F] selection:bg-black selection:text-white">
      <ScrollProgress />
      <Grain />
      <Header />

      <main>
        {/* 01 */}
        <HeroSection />

        {/* 02 */}
        <StatementSection />

        {/* 03 */}
        <ProductSection />

        {/* 04 */}
        <BookingExperience />

        {/* 05 */}
        <DashboardSection />

        {/* 06 */}
        <TeamSection />

        {/* 07 */}
        <FinanceSection />

        {/* 08 */}
        <PaymentSection />

        {/* 09 */}
        <DomicilioSection />

        {/* 10 */}
        <PersonalizationSection />

        {/* 11 */}
        <AudienceSection />

        {/* 12 */}
        <PricingSection />

        {/* 13 */}
        <FinalCTASection />
      </main>

      <Footer />

      <CookieConsentBanner />
      <FloatingPlaylistBadge />
      <MobileCTA />
    </div>
  );
}

//ameiiii