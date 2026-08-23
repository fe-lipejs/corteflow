import { motion, animate, useInView, useReducedMotion, AnimatePresence } from 'framer-motion';
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
  Calendar,
  DollarSign,
  Clock,
  UserPlus,
  Star,
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
   TOKENS — Apple Noir + Pure White + Electric Yellow
   Noir:   #000000 / #0A0A0C / Cards #121216 / Borders white/8%
   White:  #FFFFFF / #F5F5F7 / Borders black/8%
   Accent: #F59E0B / Soft #FBBF24 / Dark #D97706
   ============================================================ */

const EASE: [number, number, number, number] = [0.16, 0.8, 0.24, 1];

const IMAGES = {
  hero: '/images/hero-atendimento.jpg',
  barber: '/images/barbeiro-corte.jpg',
  salon: '/images/salao-cachos.jpg',
  manicure: '/images/manicure-celular.jpg',
  themeRose: '/images/custom-pink.png',
  themeAmber: '/images/custom-dark.png',
  themeClassic: '/images/custom-light.png',
};

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

/* ─── Utilities ─────────────────────────────────────────── */

function CountUp({ to, suffix = '' }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-10%' });
  const reduce = useReducedMotion();
  const [value, setValue] = useState(reduce ? to : 0);

  useEffect(() => {
    if (inView && !reduce) {
      const controls = animate(0, to, {
        duration: 1.2,
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
  y = 22,
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
      viewport={{ once: true, margin: '-10% 0px' }}
      transition={{
        duration: reduce ? 0.35 : 0.8,
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
      className={cn(
        'mb-4 inline-flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.16em]',
        light ? 'text-[#D97706]' : 'text-[#F59E0B]'
      )}
    >
      <span className={cn('h-[1.5px] w-4', light ? 'bg-[#D97706]' : 'bg-[#F59E0B]')} />
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
  if (failed) return <div className={cn('bg-[#16161A]', className)} />;
  return <img src={src} alt={alt} onError={() => setFailed(true)} className={className} />;
}

/* ─── Phone / Browser frames ────────────────────────────── */

function PhoneFrame({
  src,
  alt,
  className = '',
  tilt = 0,
  glow = false,
  lightMode = false,
  children,
}: {
  src?: string;
  alt?: string;
  className?: string;
  tilt?: number;
  glow?: boolean;
  lightMode?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className={className} style={tilt ? { transform: `rotate(${tilt}deg)` } : undefined}>
      <div
        className={cn(
          'relative rounded-[2.3rem] p-[7px] transition-transform duration-500',
          lightMode
            ? 'border border-black/[0.12] bg-white shadow-[0_30px_70px_-20px_rgba(0,0,0,0.18)]'
            : 'border border-white/[0.12] bg-[#0A0A0C] shadow-[0_50px_90px_-35px_rgba(0,0,0,0.9)]'
        )}
        style={
          glow
            ? {
              boxShadow:
                '0 50px 90px -35px rgba(0,0,0,0.9), 0 0 60px -10px rgba(245,158,11,0.3)',
            }
            : undefined
        }
      >
        <span
          className={cn(
            'absolute left-1/2 top-[9px] z-10 h-[12px] w-14 -translate-x-1/2 rounded-full',
            lightMode ? 'border border-black/10 bg-[#1D1D1F]' : 'border border-white/10 bg-black'
          )}
        />
        <div className="relative aspect-[9/19] overflow-hidden rounded-[1.8rem]">
          {src ? (
            <>
              <img src={src} alt={alt || ''} className="absolute inset-0 h-full w-full object-cover object-top" />
              <div
                className={cn(
                  'pointer-events-none absolute inset-0',
                  lightMode
                    ? 'bg-gradient-to-t from-black/10 via-transparent to-white/[0.04]'
                    : 'bg-gradient-to-t from-black/30 via-transparent to-white/[0.04]'
                )}
              />
            </>
          ) : (
            children
          )}
        </div>
      </div>
    </div>
  );
}

function BrowserFrame({
  children,
  title = 'Raffros',
  className = '',
}: {
  children: ReactNode;
  title?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-[22px] border border-white/[0.1] bg-[#0F0F12] shadow-2xl',
        className
      )}
    >
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-white/[0.07] bg-[#111114] px-4">
        <span className="h-2 w-2 rounded-full bg-[#FF5F57]" />
        <span className="h-2 w-2 rounded-full bg-[#FEBC2E]" />
        <span className="h-2 w-2 rounded-full bg-[#28C840]" />
        <span className="ml-3 font-mono text-[10px] text-[#71717A]">{title}</span>
      </div>
      <div className="relative flex-1 overflow-hidden">{children}</div>
    </div>
  );
}

/* ─── Service radius visual ─────────────────────────────── */

function ServiceRadius() {
  return (
    <div className="relative mx-auto h-[228px] w-[228px] shrink-0">
      {[0, 38, 76].map((inset) => (
        <span
          key={inset}
          className="absolute rounded-full border border-dashed border-[#F59E0B]/30"
          style={{ inset }}
        />
      ))}
      <div className="absolute inset-0 overflow-hidden rounded-full">
        <div
          className="absolute inset-0 animate-spin"
          style={{
            animationDuration: '6s',
            background: 'conic-gradient(from 0deg, rgba(245,158,11,0.45), transparent 35%)',
          }}
        />
      </div>
      <div
        className="absolute left-1/2 top-1/2 flex h-[56px] w-[56px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full font-mono text-[11px] font-bold text-black"
        style={{
          background: 'linear-gradient(135deg, #F59E0B, #FBBF24)',
          boxShadow: '0 0 44px rgba(245,158,11,0.6)',
        }}
      >
        Você
      </div>
      <span className="absolute -right-[8%] top-[10%] whitespace-nowrap rounded-full border border-[#F59E0B]/40 bg-[#F59E0B]/15 px-3 py-[6px] font-mono text-[10px] font-semibold text-[#FBBF24] shadow-lg">
        Dentro do raio
      </span>
      <span className="absolute -left-[12%] bottom-[6%] whitespace-nowrap rounded-full border border-white/10 bg-white/[0.05] px-3 py-[6px] font-mono text-[10px] text-[#71717A]">
        Fora do raio
      </span>
    </div>
  );
}

/* ─── Hero client mockup (React) ────────────────────────── */

function HeroClientMockup() {
  return (
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
        <div className="mt-1.5 flex items-center gap-1.5 rounded-full border border-white/5 bg-[#1A1A1E] px-2.5 py-1 text-[8px]">
          <Star className="h-2.5 w-2.5 fill-[#F59E0B] text-[#F59E0B]" />
          <span className="font-bold text-white">5.0</span>
          <span className="text-[#6E6E73]">•</span>
          <span className="text-[#A1A1A6]">Profissional</span>
        </div>
        <p className="mt-2 w-full truncate text-center text-[8px] text-[#A1A1A6]">
          O melhor serviço da região para você
        </p>
        <button
          type="button"
          className="mt-3 flex w-full shrink-0 items-center justify-center gap-1.5 rounded-xl border border-white/5 bg-[#1A1A1E] py-2.5 text-[9px] font-semibold transition-all hover:bg-white/5"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="#F59E0B">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
          </svg>
          WhatsApp
        </button>
      </div>

      <div className="mt-4 flex min-h-0 flex-1 flex-col px-4">
        <div className="shrink-0 overflow-hidden rounded-[14px] border border-white/5 bg-[#111114]">
          <div className="flex items-center gap-2 p-2.5">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#F59E0B]/10">
              <MapPin className="h-3 w-3 text-[#F59E0B]" />
            </div>
            <div className="min-w-0 flex-1">
              <strong className="block truncate text-[9px] font-semibold text-white">Local & Horários</strong>
              <span className="block truncate text-[7px] text-[#8A8A8F]">Rua Agamalie de Moraes, n 254</span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex shrink-0 items-center justify-center">
          {[1, 2, 3, 4].map((step, i) => (
            <div key={step} className="flex items-center">
              <div
                className={cn(
                  'flex h-4 w-4 items-center justify-center rounded-full text-[7px] font-bold',
                  i === 0
                    ? 'bg-[#F59E0B] text-black'
                    : 'border border-white/10 bg-[#111114] text-[#8A8A8F]'
                )}
              >
                {step}
              </div>
              {i < 3 && <div className="h-[1px] w-5 bg-white/10" />}
            </div>
          ))}
        </div>

        <div className="mt-3 flex-1 space-y-2 overflow-y-auto pb-4">
          {[
            ['Corte masculino', 'R$ 45', '45 min'],
            ['Corte + Barba', 'R$ 70', '30 min'],
            ['Barba', 'R$ 30', '30 min'],
          ].map(([service, price, duration]) => (
            <div
              key={service}
              className="relative shrink-0 overflow-hidden rounded-[12px] border border-white/5 bg-[#111114] p-3"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 pr-2">
                  <strong className="block truncate text-[9px] font-medium text-white">{service}</strong>
                  <span className="mt-1 block truncate text-[8px] text-[#A1A1A6]">{duration}</span>
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
  );
}

/* ─── Finance / dashboard mockup ────────────────────────── */

function FinanceMockup() {
  return (
    <BrowserFrame title="raffros.com / dashboard">
      <div className="flex min-h-[410px] w-full bg-[#0A0A0C] text-white">
        <aside className="hidden w-[160px] flex-col border-r border-white/[0.04] bg-[#0A0A0C] p-3 sm:flex">
          <div className="mb-6 mt-2 flex items-center gap-2 pl-2">
            <div className="h-7 w-7 shrink-0 overflow-hidden rounded-[8px]">
              <ImageOrPlaceholder src={IMAGES.manicure} alt="Profile" className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0">
              <strong className="block truncate text-[9px] font-bold">Maria Manicure</strong>
              <span className="block text-[6px] font-bold uppercase tracking-widest text-[#F59E0B]">
                Esmalteria
              </span>
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
              <div
                key={String(label)}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-[9px] font-medium transition-colors',
                  active ? 'bg-[#F59E0B] text-black' : 'text-[#A1A1A6]'
                )}
              >
                {String(label)}
              </div>
            ))}
          </nav>
        </aside>

        <main className="flex flex-1 flex-col overflow-hidden p-5">
          <div className="flex shrink-0 items-center justify-between">
            <div>
              <h2 className="font-display text-[22px] font-bold tracking-tight">
                Boa noite, <span className="text-[#F59E0B]">Maria.</span>
              </h2>
              <p className="text-[10px] text-[#71717A]">Você tem 5 agendamentos hoje.</p>
            </div>
            <button
              type="button"
              className="rounded-full bg-[#F59E0B] px-3 py-1.5 text-[9px] font-bold text-black shadow-lg shadow-[#F59E0B]/20"
            >
              + Agendar
            </button>
          </div>

          <div className="mt-5 grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ['Agendamentos', '5', 'hoje', Calendar],
              ['Faturamento', 'R$ 450', 'hoje', DollarSign],
              ['Ocupação', '85%', 'hoje', Clock],
              ['Novos', '4 clientes', 'últimos 7 dias', UserPlus],
            ].map(([t, val, sub, Icon], i) => {
              const IconComp = Icon as typeof Calendar;
              return (
                <div
                  key={i}
                  className="flex min-w-0 flex-col justify-between rounded-[14px] border border-white/[0.04] bg-[#111114] p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate pr-1 text-[9px] text-[#A1A1A6]">{t as string}</span>
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] bg-[#F59E0B]/10">
                      <IconComp className="h-2.5 w-2.5 text-[#F59E0B]" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <strong className="block truncate font-display text-[18px] font-bold leading-none md:text-[22px]">
                      {val as string}
                    </strong>
                    <span className="mt-1 truncate text-[8px] font-bold text-[#F59E0B]">{sub as string}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="relative mt-4 flex flex-1 flex-col overflow-hidden rounded-[14px] border border-white/[0.04] bg-[#111114] p-4">
            <div className="mb-2 flex shrink-0 items-center justify-between">
              <div>
                <strong className="block text-[12px] font-bold text-white">Agenda de hoje</strong>
                <span className="text-[8px] text-[#71717A]">5 horários confirmados</span>
              </div>
              <span className="cursor-pointer text-[8px] font-bold text-[#F59E0B]">Ver semana →</span>
            </div>
            <div className="mt-1 flex-1 space-y-2 overflow-y-auto pr-2">
              {[
                ['10:00', 'João Cliente', 'Corte + Barba', 'R$ 70,00'],
                ['11:30', 'Marcos', 'Pé e Mão', 'R$ 50,00'],
                ['14:00', 'Kauan', 'Corte Degradê', 'R$ 45,00'],
                ['15:30', 'Juliana', 'Coloração', 'R$ 120,00'],
              ].map(([time, name, serv, val], i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 p-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="w-8 shrink-0 text-[11px] font-bold text-[#F59E0B]">{time}</span>
                    <div className="min-w-0">
                      <span className="block truncate text-[10px] font-bold text-white">{name}</span>
                      <span className="block truncate text-[9px] text-[#8A8A8F]">{serv}</span>
                    </div>
                  </div>
                  <span className="shrink-0 pl-2 text-[10px] font-bold text-white">{val}</span>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </BrowserFrame>
  );
}

/* ─── Pricing cards ─────────────────────────────────────── */

function PricingCards() {
  const plans = [
    {
      name: 'Solo',
      price: 49,
      tag: 'Pra quem trabalha sozinho e quer parar de agendar pelo WhatsApp.',
      items: ['Agenda online ilimitada', '1 profissional', 'Atendimento a domicílio', 'Lembretes automáticos', 'Sinal anti-furo'],
      featured: false,
    },
    {
      name: 'Studio',
      price: 89,
      tag: 'Pra quem já tem equipe e quer o negócio inteiro organizado.',
      items: ['Tudo do plano Solo', 'Até 5 profissionais', 'Gestão de equipe completa', 'Relatórios de desempenho', 'Suporte prioritário'],
      featured: true,
    },
    {
      name: 'Equipe',
      price: 149,
      tag: 'Pra estabelecimentos maiores, com operação em escala.',
      items: ['Tudo do plano Studio', 'Profissionais ilimitados', 'Múltiplas unidades', 'Gerente de conta dedicado'],
      featured: false,
    },
  ];

  return (
    <div className="mx-auto mt-14 grid max-w-[1280px] gap-5 text-left md:grid-cols-3 md:gap-[20px]">
      {plans.map((plan) => (
        <div
          key={plan.name}
          className={cn(
            'relative flex flex-col rounded-[28px] p-[30px_26px] transition-all sm:p-[34px_28px]',
            plan.featured
              ? 'z-10 border-2 border-[#F59E0B] shadow-[0_20px_60px_-15px_rgba(245,158,11,0.35)] md:scale-105 hover:md:-translate-y-1.5'
              : 'border border-white/[0.08] bg-[#121216] shadow-xl hover:-translate-y-1.5 hover:border-white/20'
          )}
          style={
            plan.featured
              ? {
                background:
                  'linear-gradient(160deg, rgba(245,158,11,0.12), rgba(18,18,22,0.98) 60%)',
              }
              : undefined
          }
        >
          {plan.featured && (
            <span
              className="absolute -top-[12px] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-4 py-1 font-mono text-[10.5px] font-bold text-black shadow-lg"
              style={{ background: 'linear-gradient(135deg, #F59E0B, #FBBF24)' }}
            >
              Mais escolhido
            </span>
          )}
          <h3 className="font-display text-[22px] font-semibold text-white">{plan.name}</h3>
          <p className="mt-2.5 min-h-[42px] text-[13.5px] text-[#A1A1A6]">{plan.tag}</p>
          <p
            className={cn(
              'mt-6 font-display text-[40px] font-semibold',
              plan.featured ? 'text-[#F59E0B]' : 'text-white'
            )}
          >
            <span className="mr-0.5 align-super text-[18px]">R$</span>
            {plan.price}
            <small className="text-[13px] font-normal text-[#71717A]">/mês</small>
          </p>
          <ul className="mt-6 flex grow flex-col gap-3">
            {plan.items.map((item) => (
              <li
                key={item}
                className={cn(
                  'relative pl-5 text-[13.5px]',
                  plan.featured ? 'font-medium text-white' : 'text-[#D4D4D8]'
                )}
              >
                <span className="absolute left-0 font-bold text-[#F59E0B]">+</span>
                {item}
              </li>
            ))}
          </ul>
          <Link
            to="/cadastro"
            onClick={() =>
              trackEvent(`click_plano_${plan.name.toLowerCase()}`, {
                metadata: { plano: plan.name, preco: plan.price, secao: 'planos' },
              })
            }
            className={cn(
              'mt-7 inline-flex w-full items-center justify-center rounded-full px-6 py-3.5 text-[14.5px] font-semibold transition-all',
              plan.featured
                ? 'font-bold text-black shadow-[0_20px_40px_-16px_rgba(245,158,11,0.6)] hover:scale-105'
                : 'border border-white/20 text-white hover:border-[#F59E0B] hover:text-[#F59E0B]'
            )}
            style={
              plan.featured
                ? { background: 'linear-gradient(135deg, #F59E0B, #FBBF24)' }
                : undefined
            }
          >
            Começar agora
          </Link>
        </div>
      ))}
    </div>
  );
}

/* ============================================================
   HEADER + MOBILE MENU
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
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  const closeMobileNav = () => setIsMobileMenuOpen(false);

  const links = [
    ['solucao', 'Solução'],
    ['domicilio', 'Domicílio'],
    ['para-quem', 'Para quem é'],
    ['planos', 'Planos'],
  ] as const;

  return (
    <>
      <header
        className={cn(
          'fixed left-0 right-0 top-0 z-[100] border-b px-6 transition-all duration-300 md:px-12',
          isScrolled
            ? 'border-white/[0.08] bg-black/85 py-3 backdrop-blur-[16px]'
            : 'border-transparent py-[18px]'
        )}
      >
        <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-6">
          <a
            href="#hero"
            className="group inline-flex items-center gap-2.5 font-display text-[20px] font-bold tracking-tight text-white"
          >
            <img
              src="/logo.svg"
              alt="Raffros"
              className="h-8 w-auto object-contain drop-shadow-[0_0_12px_rgba(245,158,11,0.35)] md:h-9"
            />
            <span>Raffros</span>
          </a>

          <nav className="hidden gap-8 md:flex">
            {links.map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                onClick={() => trackEvent('click_nav_link', { metadata: { item: id } })}
                className="text-[14px] font-medium text-[#A1A1A6] transition-colors hover:text-[#F59E0B]"
              >
                {label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-[14px]">
            <Link
              to="/playlist"
              onClick={() => trackEvent('click_nav_playlist')}
              className="mr-1 hidden items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/10 px-3.5 py-1.5 text-[13px] font-medium text-[#F59E0B] transition-all hover:border-amber-500/40 hover:bg-amber-500/20 lg:inline-flex"
            >
              <SpotifyGlyph className="h-3.5 w-3.5" />
              Som da Casa
            </Link>

            <Link
              to="/login"
              onClick={() => trackEvent('click_nav_login')}
              className="mr-2 hidden text-[14px] font-medium text-[#A1A1A6] transition-colors hover:text-white md:inline-flex"
            >
              Entrar
            </Link>

            <a
              href="#planos"
              onClick={() => trackEvent('click_nav_comecar_agora')}
              className="hidden items-center justify-center rounded-full px-5 py-2.5 text-[13px] font-bold text-black shadow-[0_14px_30px_-10px_rgba(245,158,11,0.5)] transition-all hover:scale-105 md:inline-flex"
              style={{ background: 'linear-gradient(135deg, #F59E0B, #FBBF24)' }}
            >
              Começar agora
            </a>

            <button
              type="button"
              aria-label={isMobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.12] bg-white/[0.08] text-white transition-all active:scale-95 md:hidden"
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
            initial={{ opacity: 0, y: -15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="fixed inset-0 z-[200] flex h-[100dvh] w-full flex-col justify-between bg-black p-6 sm:p-10"
          >
            <div className="flex w-full items-center justify-between border-b border-white/[0.1] pb-4">
              <a
                href="#hero"
                onClick={() => {
                  closeMobileNav();
                  trackEvent('click_mobile_logo');
                }}
                className="inline-flex items-center gap-2.5 font-display text-[20px] font-bold tracking-tight text-white"
              >
                <img
                  src="/logo.svg"
                  alt="Raffros"
                  className="h-8 w-auto object-contain drop-shadow-[0_0_12px_rgba(245,158,11,0.35)]"
                />
                <span>Raffros</span>
              </a>
              <button
                type="button"
                aria-label="Fechar menu"
                onClick={() => {
                  closeMobileNav();
                  trackEvent('close_mobile_menu');
                }}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.12] bg-white/[0.08] text-white transition-all hover:bg-white/[0.15] active:scale-95"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="my-auto flex flex-col items-center justify-center gap-7 text-center">
              {links.map(([id, label]) => (
                <a
                  key={id}
                  href={`#${id}`}
                  onClick={() => {
                    closeMobileNav();
                    trackEvent('click_mobile_link', { metadata: { item: id } });
                  }}
                  className="font-display text-[26px] font-semibold text-white transition-colors hover:text-[#F59E0B]"
                >
                  {label}
                </a>
              ))}
              <a
                href="#playlist"
                onClick={() => {
                  closeMobileNav();
                  trackEvent('click_mobile_link', { metadata: { item: 'playlist' } });
                }}
                className="inline-flex items-center gap-2 font-display text-[22px] font-semibold text-[#F59E0B] transition-opacity hover:opacity-80"
              >
                <SpotifyGlyph className="h-[19px] w-[19px]" />
                Nossa playlist
              </a>
              <Link
                to="/login"
                onClick={() => {
                  closeMobileNav();
                  trackEvent('click_mobile_login');
                }}
                className="mt-2 font-mono text-[17px] text-[#A1A1A6] transition-colors hover:text-white"
              >
                Entrar na Conta →
              </Link>
            </div>

            <div className="w-full border-t border-white/[0.1] pt-4">
              <a
                href="#planos"
                onClick={() => {
                  closeMobileNav();
                  trackEvent('click_mobile_comecar_agora');
                }}
                className="inline-flex w-full items-center justify-center rounded-full py-4 text-[16px] font-bold text-black shadow-[0_20px_40px_-16px_rgba(245,158,11,0.6)]"
                style={{ background: 'linear-gradient(135deg, #F59E0B, #FBBF24)' }}
              >
                Começar agora
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ============================================================
   SECTIONS
   ============================================================ */

function HeroSection() {
  return (
    <section
      id="hero"
      className="relative flex min-h-[100svh] flex-col justify-center overflow-hidden bg-black pb-10 pt-[128px]"
    >
      <div className="absolute inset-0 z-0">
        <img src={IMAGES.hero} alt="" className="h-full w-full object-cover opacity-[0.14]" />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, #000000 0%, rgba(0,0,0,0.7) 40%, #000000 95%), radial-gradient(60% 50% at 85% 10%, rgba(245,158,11,0.18), transparent 60%)',
          }}
        />
      </div>

      <div className="relative z-10 mx-auto grid w-full max-w-[1280px] items-center gap-16 px-6 md:grid-cols-[1.05fr_0.95fr] md:gap-10 md:px-12">
        <Reveal>
          <h1 className="m-0 mb-[22px] font-display text-[clamp(36px,8vw,64px)] font-semibold leading-[1.03] tracking-[-0.02em] text-white">
            Barbeiro, Salão ou Manicure: <br />
            Pare de agendar no <br />
            <em
              className="not-italic"
              style={{
                background: 'linear-gradient(135deg, #25D366, #128C7E)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              WhatsApp.
            </em>
          </h1>
          <p className="mb-[38px] max-w-[48ch] text-[clamp(16px,2vw,19px)] leading-relaxed text-[#A1A1A6]">
            Agenda personalizada com link para seu cliente. Faturamento na palma da mão e sem
            dores de cabeça com furos.
          </p>

          <div className="mb-[32px] flex flex-wrap gap-[14px]">
            <a
              href="#planos"
              onClick={() => trackEvent('click_hero_comecar_agora')}
              className="inline-flex items-center justify-center rounded-full px-8 py-[17px] text-[16px] font-bold text-black shadow-[0_20px_40px_-16px_rgba(245,158,11,0.55)] transition-all hover:scale-105"
              style={{ background: 'linear-gradient(135deg, #F59E0B, #FBBF24)' }}
            >
              Começar agora
            </a>
            <a
              href="#solucao"
              onClick={() => trackEvent('click_hero_conhecer')}
              className="inline-flex items-center justify-center rounded-full border border-white/[0.18] bg-[#0A0A0C]/50 px-8 py-[17px] text-[16px] font-semibold text-white transition-all hover:border-[#F59E0B] hover:text-[#F59E0B]"
            >
              Conhecer a Raffros
            </a>
          </div>

          {/* Spotify — linha discreta do código 1 */}
          <HeroPlaylistLine />

          <div className="mt-8 flex flex-wrap gap-x-[36px] gap-y-6">
            <div className="flex flex-col">
              <span className="font-display text-[28px] font-bold text-[#F59E0B]">
                <CountUp to={100} suffix="%" />
              </span>
              <span className="max-w-[14ch] text-[12px] text-[#71717A]">
                da sua agenda rodando no piloto automático.
              </span>
            </div>
            <div className="flex flex-col">
              <span className="font-display text-[28px] font-bold text-[#F59E0B]">
                <CountUp to={30} suffix=" dias" />
              </span>
              <span className="max-w-[14ch] text-[12px] text-[#71717A]">
                de controle financeiro na palma da mão, todo mês.
              </span>
            </div>
            <div className="flex flex-col">
              <span className="font-display text-[28px] font-bold text-[#F59E0B]">
                <CountUp to={10} suffix="x" />
              </span>
              <span className="max-w-[14ch] text-[12px] text-[#71717A]">
                mais rapidez para o cliente agendar e confirmar.
              </span>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.12} className="relative mx-auto w-full max-w-[320px] md:mx-0 md:max-w-none md:justify-self-end">
          <div className="relative mx-auto w-[230px] md:w-[260px]">
            <div
              className="relative rounded-[2.3rem] border border-white/[0.12] bg-[#0A0A0C] p-[7px] shadow-[0_50px_90px_-35px_rgba(0,0,0,0.9)]"
              style={{
                transform: 'rotate(-4deg)',
                boxShadow:
                  '0 50px 90px -35px rgba(0,0,0,0.9), 0 0 60px -10px rgba(245,158,11,0.3)',
              }}
            >
              <span className="absolute left-1/2 top-[9px] z-10 h-[12px] w-14 -translate-x-1/2 rounded-full border border-white/10 bg-black" />
              <div className="relative aspect-[9/19] overflow-hidden rounded-[1.8rem]">
                <HeroClientMockup />
              </div>
            </div>
          </div>

          <div
            className="absolute left-[-8%] top-[6%] z-20 flex animate-float items-center gap-2.5 rounded-[18px] border border-white/[0.12] bg-[#121216]/95 p-3 px-4 shadow-2xl backdrop-blur-[10px] md:left-[-14%]"
            style={{ animationDelay: '0.3s' }}
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/15">
              <MapPin className="h-3.5 w-3.5 text-[#F59E0B]" />
            </div>
            <div>
              <strong className="block text-[12.5px] font-semibold text-white">Dentro do raio</strong>
              <span className="block text-[10.5px] text-[#A1A1A6]">Atendimento confirmado</span>
            </div>
          </div>

          <div
            className="absolute bottom-[4%] right-[-6%] z-20 flex animate-float items-center gap-2.5 rounded-[18px] border border-white/[0.12] bg-[#121216]/95 p-3 px-4 shadow-2xl backdrop-blur-[10px] md:right-[-12%]"
            style={{ animationDelay: '1.1s' }}
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/15">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            </div>
            <div>
              <strong className="block text-[12.5px] font-semibold text-white">09:03 reservado</strong>
              <span className="block text-[10.5px] text-[#A1A1A6]">Agenda atualizada sozinha</span>
            </div>
          </div>
        </Reveal>
      </div>

      <div className="relative z-10 mt-20 flex items-center justify-center gap-2 pb-8 font-mono text-[11px] uppercase tracking-[0.1em] text-[#71717A]">
        <span className="h-6 w-[1px] animate-scrollcue bg-gradient-to-b from-[#F59E0B] to-transparent" />
        role para ver
      </div>
    </section>
  );
}

function SolucaoSection() {
  return (
    <section id="solucao" className="border-y border-black/[0.08] bg-white px-6 py-24 md:py-[150px]">
      <div className="mx-auto mb-16 max-w-[1000px] text-center md:mb-24">
        <Reveal>
          <h2 className="font-display text-[clamp(28px,5vw,48px)] font-bold leading-[1.1] text-[#1D1D1F]">
            Quantos clientes você já perdeu porque <br className="hidden md:block" />
            não conseguiu responder na hora?
          </h2>
          <p className="mx-auto mt-6 max-w-[46ch] text-[clamp(16px,2vw,18px)] text-[#6E6E73]">
            O cliente agenda e não aparece. O celular não para de tocar enquanto você atende.
            Sua agenda virou um segundo trabalho não remunerado.
            <strong className="mt-3 block text-[#1D1D1F]">A Raffros acaba com isso hoje.</strong>
          </p>
        </Reveal>
      </div>

      <div className="mx-auto grid max-w-[1280px] gap-6 md:grid-cols-3 md:gap-8">
        {[
          {
            icon: Scissors,
            title: 'Agenda 100% Automática',
            desc: 'O cliente entra no seu link, escolhe o serviço e marca sozinho. Você só recebe a notificação da reserva.',
          },
          {
            icon: CheckCircle2,
            title: 'Sinal Obrigatório (Anti-furo)',
            desc: 'Exija uma % de garantia via Pix no agendamento. Se o cliente der bolo, o dinheiro fica no seu bolso.',
          },
          {
            icon: Zap,
            title: 'Gestão Descomplicada',
            desc: 'Saiba exatamente quanto faturou no dia, na semana e no mês. Sem planilhas, direto na tela do celular.',
          },
        ].map((feature, i) => {
          const Icon = feature.icon;
          return (
            <Reveal key={feature.title} delay={i * 0.1}>
              <div className="rounded-[28px] border border-black/[0.05] bg-[#F5F5F7] p-8 transition-all hover:border-[#F59E0B]/30 hover:shadow-lg md:p-10">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10">
                  <Icon className="h-6 w-6 text-[#D97706]" />
                </div>
                <h3 className="mb-3 font-display text-[20px] font-semibold text-[#1D1D1F]">
                  {feature.title}
                </h3>
                <p className="text-[15px] leading-relaxed text-[#6E6E73]">{feature.desc}</p>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

function ProductSection() {
  return (
    <section id="produto" className="bg-[#0A0A0C] px-6 py-24 text-white md:px-12 md:py-[140px]">
      <div className="mx-auto max-w-[1280px]">
        <div className="grid items-end gap-10 md:grid-cols-[1fr_0.75fr]">
          <Reveal>
            <Eyebrow>Seu negócio em uma tela</Eyebrow>
            <h2 className="max-w-[800px] font-display text-[clamp(28px,5.5vw,48px)] font-semibold leading-[1.05] tracking-[-0.03em]">
              A agenda que parece simples porque ela foi pensada para você.
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="max-w-[430px] text-[15px] leading-7 text-[#8A8A8F] md:ml-auto">
              Não é um sistema cheio de telas que você nunca abre. É uma operação visual para quem
              precisa atender, vender e saber o que entrou.
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.08}>
          <div className="mt-16 flex w-full justify-center">
            <div className="w-full max-w-[800px]">
              <FinanceMockup />
            </div>
          </div>
        </Reveal>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {[
            {
              icon: CalendarDays,
              title: 'Agenda visual',
              text: 'Veja o seu dia inteiro sem depender de mensagens.',
            },
            {
              icon: Users,
              title: 'Equipe organizada',
              text: 'Cada profissional tem seus horários e serviços.',
            },
            {
              icon: WalletCards,
              title: 'Dinheiro visível',
              text: 'Acompanhe sinais, faturamento e comissão.',
            },
          ].map((item, index) => {
            const Icon = item.icon;
            return (
              <Reveal key={item.title} delay={index * 0.06}>
                <div className="h-full rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6">
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

function ParaQuemSection() {
  return (
    <section id="para-quem" className="bg-black px-6 py-[104px] text-white md:px-12 md:py-[150px]">
      <div className="mx-auto max-w-[1280px]">
        <Reveal>
          <Eyebrow>Para quem é</Eyebrow>
          <h2 className="max-w-[16ch] font-display text-[clamp(28px,5.5vw,44px)] font-semibold leading-[1.15] tracking-[-0.01em] text-white">
            Feito para quem vive de deixar gente bonita.
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-5 md:auto-rows-[minmax(150px,auto)] md:grid-cols-3 md:gap-4">
          <Reveal delay={0.1} className="overflow-hidden rounded-[28px] border border-white/[0.1] shadow-2xl md:row-span-2">
            <img
              src={IMAGES.barber}
              alt="Barbeiro atendendo"
              className="aspect-[3/4] h-full w-full object-cover"
            />
          </Reveal>

          {[
            { icon: Scissors, title: 'Barbearias', desc: 'Mais clientes. Menos mensagens.' },
            { icon: Sparkles, title: 'Salões de beleza', desc: 'Toda a equipe organizada em um só lugar.' },
            { icon: Heart, title: 'Manicures e Esmalterias', desc: 'Agenda cheia sem ficar respondendo o celular.' },
          ].map((card, i) => {
            const IconComponent = card.icon;
            return (
              <Reveal key={card.title} delay={0.15 + i * 0.08}>
                <div className="rounded-[18px] border border-white/[0.08] bg-[#121216] p-[28px_24px] shadow-lg transition-all hover:-translate-y-1 hover:border-[#F59E0B]/50">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10">
                    <IconComponent className="h-5 w-5 text-[#F59E0B]" />
                  </div>
                  <h3 className="my-2 font-display text-[18px] font-semibold text-white">{card.title}</h3>
                  <p className="text-[13.5px] text-[#A1A1A6]">{card.desc}</p>
                </div>
              </Reveal>
            );
          })}

          <Reveal delay={0.5} className="overflow-hidden rounded-[28px] border border-white/[0.1] shadow-2xl md:row-span-2">
            <img
              src={IMAGES.salon}
              alt="Salão de beleza"
              className="aspect-[3/4] h-full w-full object-cover"
            />
          </Reveal>

          {[
            {
              icon: User,
              title: 'Profissionais autônomos',
              desc: 'Seu negócio profissional desde o primeiro cliente.',
            },
            {
              icon: Home,
              title: 'Atendimento a domicílio',
              desc: 'Você define onde atende. O sistema verifica o resto.',
            },
          ].map((card, i) => {
            const IconComponent = card.icon;
            return (
              <Reveal key={card.title} delay={0.6 + i * 0.08}>
                <div className="rounded-[18px] border border-white/[0.08] bg-[#121216] p-[28px_24px] shadow-lg transition-all hover:-translate-y-1 hover:border-[#F59E0B]/50">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10">
                    <IconComponent className="h-5 w-5 text-[#F59E0B]" />
                  </div>
                  <h3 className="my-2 font-display text-[18px] font-semibold text-white">{card.title}</h3>
                  <p className="text-[13.5px] text-[#A1A1A6]">{card.desc}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function DomicilioSection() {
  return (
    <section
      id="domicilio"
      className="overflow-hidden border-y border-white/[0.08] bg-[#0A0A0C] px-6 py-[104px] text-white md:px-12 md:py-[150px]"
    >
      <div className="mx-auto mb-[76px] grid max-w-[1280px] items-center gap-12 md:grid-cols-[1fr_0.8fr] md:gap-20">
        <Reveal>
          <Eyebrow>Grande diferencial</Eyebrow>
          <h2 className="font-display text-[clamp(28px,5.5vw,44px)] font-semibold leading-[1.15] tracking-[-0.01em] text-white">
            Você define o raio.
            <br />
            A Raffros faz o resto.
          </h2>
          <p className="mt-5 max-w-[46ch] text-[clamp(16px,2vw,18px)] leading-relaxed text-[#A1A1A6]">
            Manicures, barbeiros e cabeleireiros que atendem em domicílio não precisam mais
            perguntar endereço, verificar distância e combinar horário no WhatsApp. O cliente
            informa onde está — o sistema confere se está dentro da área de atendimento e libera
            o horário na hora.
          </p>
          <div className="mt-10">
            <ServiceRadius />
            <p className="mt-4 text-center text-[13px] italic text-[#71717A]">
              Ex.: &quot;Atendo clientes em um raio de até 10 km.&quot;
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.1} className="overflow-hidden rounded-[28px] border border-white/[0.1] shadow-2xl md:order-2">
          <img
            src={IMAGES.manicure}
            alt="Atendimento a domicílio"
            className="aspect-[4/5] w-full object-cover"
          />
        </Reveal>
      </div>

      <div className="relative mx-auto grid max-w-[1100px] gap-5 sm:grid-cols-2 md:grid-cols-5 md:gap-[18px]">
        <svg
          className="absolute left-0 top-1/2 z-0 hidden h-[2px] w-full overflow-visible md:block"
          viewBox="0 0 800 4"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="flowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#FBBF24" />
            </linearGradient>
          </defs>
          <motion.path
            d="M0,2 L800,2"
            fill="none"
            stroke="url(#flowGradient)"
            strokeWidth="2"
            strokeDasharray="820"
            initial={{ strokeDashoffset: 820 }}
            whileInView={{ strokeDashoffset: 0 }}
            viewport={{ once: true, margin: '-20%' }}
            transition={{ duration: 1.3, ease: EASE }}
          />
        </svg>

        {[
          'Cliente escolhe o serviço',
          'Informa o endereço',
          'Sistema verifica a distância',
          'Horário disponível aparece',
          'Agendamento confirmado',
        ].map((step, i) => (
          <Reveal key={step} delay={i * 0.08}>
            <div className="relative z-10 flex items-center gap-3 rounded-full border border-white/[0.08] bg-[#121216] px-4 py-[11px] text-[13.5px] text-[#D4D4D8] shadow-md">
              <span
                className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[10.5px] font-bold text-black"
                style={{ background: 'linear-gradient(135deg, #F59E0B, #FBBF24)' }}
              >
                {i + 1}
              </span>
              {step}
            </div>
          </Reveal>
        ))}
      </div>

      <p className="mt-[68px] text-center font-display text-[clamp(21px,3.2vw,28px)] italic text-[#F59E0B]">
        &quot;Você atende. A Raffros organiza.&quot;
      </p>
    </section>
  );
}

function PersonalizacaoSection() {
  return (
    <section className="bg-white px-6 py-[104px] text-[#1D1D1F] md:px-12 md:py-[140px]">
      <div className="mx-auto mb-[72px] max-w-[640px] text-center">
        <Reveal>
          <Eyebrow light>Sua marca, do seu jeito</Eyebrow>
          <h2 className="font-display text-[clamp(26px,5vw,40px)] font-semibold leading-[1.15] tracking-[-0.01em] text-[#1D1D1F]">
            A página do seu cliente, com a sua cara.
          </h2>
          <p className="mx-auto mt-4 max-w-[44ch] text-[15.5px] text-[#6E6E73]">
            Escolha as cores que combinam com o seu negócio. Cada estabelecimento tem uma
            identidade — a Raffros se adapta a ela, não o contrário.
          </p>
        </Reveal>
      </div>

      <div className="flex flex-wrap justify-center gap-10">
        {[
          { src: IMAGES.themeRose, label: 'Rosé' },
          { src: IMAGES.themeAmber, label: 'Âmbar' },
          { src: IMAGES.themeClassic, label: 'Clássico' },
        ].map((theme, i) => (
          <Reveal key={theme.label} delay={i * 0.1}>
            <div className="flex flex-col items-center gap-3">
              <PhoneFrame
                src={theme.src}
                alt={`Tema ${theme.label}`}
                lightMode
                className="w-[150px] md:w-[170px]"
                tilt={i === 1 ? 0 : i === 0 ? -3 : 3}
              />
              <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-[#86868B]">
                {theme.label}
              </span>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function PlanosSection() {
  return (
    <section
      id="planos"
      className="border-t border-white/[0.08] bg-[#0A0A0C] px-6 py-[104px] text-center text-white md:px-12 md:py-[150px]"
    >
      <Reveal>
        <Eyebrow>Planos</Eyebrow>
        <h2 className="mx-auto max-w-[20ch] font-display text-[clamp(28px,5.5vw,44px)] font-semibold leading-[1.15] tracking-[-0.01em] text-white">
          O sistema que se paga no primeiro furo evitado.
        </h2>
        <p className="mx-auto mt-4 text-[16px] text-[#A1A1A6]">
          Escolha o plano que combina com o seu momento. 7 dias grátis · sem fidelidade.
        </p>
      </Reveal>

      <PricingCards />

      <p className="mt-7 font-mono text-[12px] text-[#71717A]">
        Preços ilustrativos — ajuste conforme sua tabela real.
      </p>
    </section>
  );
}

function FinalCTASection() {
  return (
    <section className="relative overflow-hidden bg-black px-6 py-[120px] text-center">
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(55% 75% at 50% 0%, rgba(245,158,11,0.2), transparent 65%), #000000',
        }}
      />
      <Reveal>
        <h2 className="mx-auto mb-5 max-w-[18ch] font-display text-[clamp(30px,6vw,52px)] font-semibold leading-[1.15] text-white">
          Você cuida do cliente.
          <br />
          <em className="not-italic text-[#F59E0B]">A Raffros cuida da agenda.</em>
        </h2>
        <p className="mb-9 text-[16.5px] text-[#A1A1A6]">
          Seu próximo cliente pode estar tentando agendar agora. Comece hoje.
        </p>
        <Link
          to="/cadastro"
          onClick={() => trackEvent('click_footer_comecar_agora')}
          className="inline-flex items-center justify-center gap-2 rounded-full px-8 py-[17px] text-[16px] font-bold text-black shadow-[0_20px_40px_-16px_rgba(245,158,11,0.6)] transition-all hover:scale-105"
          style={{ background: 'linear-gradient(135deg, #F59E0B, #FBBF24)' }}
        >
          Começar agora
          <ArrowRight className="h-4 w-4" />
        </Link>
        <p className="mt-5 font-mono text-[10px] text-[#52525B]">7 dias grátis · sem fidelidade</p>
      </Reveal>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/[0.08] bg-black px-6 pb-14 pt-16 md:px-12">
      <div className="mx-auto flex max-w-[1280px] flex-col items-center justify-between gap-8 text-center md:flex-row md:text-left">
        <a href="#hero" className="inline-flex items-center gap-2.5 font-display text-[19px] font-bold text-white">
          <img
            src="/logo.svg"
            alt="Raffros"
            className="h-7 w-auto object-contain drop-shadow-[0_0_10px_rgba(245,158,11,0.3)]"
          />
          <span>Raffros</span>
        </a>

        <nav className="flex flex-wrap justify-center gap-6 md:gap-[26px]">
          {[
            ['solucao', 'Solução'],
            ['domicilio', 'Domicílio'],
            ['para-quem', 'Para quem é'],
            ['planos', 'Planos'],
          ].map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              onClick={() => trackEvent('click_footer_link', { metadata: { item: id } })}
              className="text-[13px] text-[#71717A] transition-colors hover:text-[#F59E0B]"
            >
              {label}
            </a>
          ))}
          <a
            href="#playlist"
            onClick={() => trackEvent('click_footer_playlist')}
            className="inline-flex items-center gap-1.5 text-[13px] text-[#71717A] transition-colors hover:text-[#F59E0B]"
          >
            <SpotifyGlyph className="h-[13px] w-[13px]" />
            Playlist
          </a>
        </nav>

        <p className="text-[12px] text-[#71717A]">
          © {new Date().getFullYear()} Raffros. Todos os direitos reservados.
        </p>
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
            onClick={() => trackEvent('click_mobile_sticky_cta')}
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

/* ============================================================
   PAGE
   ============================================================ */

export default function LandingPage() {
  usePageTracking();

  return (
    <div className="min-h-screen overflow-x-hidden bg-black font-body text-[#F5F5F7] selection:bg-[#F59E0B] selection:text-black">
      <Header />

      <main className="pb-16 md:pb-0">
        <HeroSection />
        <SolucaoSection />
        <ProductSection />
        <ParaQuemSection />
        <DomicilioSection />
        <PersonalizacaoSection />
        <PlanosSection />
        <FinalCTASection />
      </main>

      <Footer />
      <CookieConsentBanner />
      <FloatingPlaylistBadge />
      <MobileCTA />
    </div>
  );
}