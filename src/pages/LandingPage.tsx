import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion, useScroll, useSpring } from "framer-motion";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Globe2,
  MapPin,
  Menu,
  Scissors,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { trackEvent } from '../lib/analytics';
import { usePageTracking } from '../hooks/usePageTracking';
import { useAttentionTracker } from '../hooks/useAttentionTracker';

/* =========================================================
   RAFFROS — LANDING PAGE
   Visual direction:
   Apple × Nothing × Raffros
   ========================================================= */

const ACCENT = "#FC761D";
const M = {
  booking: "/Mockups/Iphone - Tela de Agendamento.PNG",
  booking2: "/Mockups/Iphone - Tela de Agendamento2.jpg",
  services: "/Mockups/Iphone - Serviços.PNG",
  domicilio: "/Mockups/Iphone - Tela de Escolha Domicilio.PNG",
  pix: "/Mockups/Iphone - Tela de Pagamento Pix.PNG",
  payment: "/Mockups/Iphone - Tela de Pagamento.PNG",
  themeA: "/Mockups/Iphone - Personalização Tema 1.PNG",
  themeB: "/Mockups/Iphone - Personalização Tema 2.PNG",
  themeC: "/Mockups/Iphone - Personalização Tema 3.PNG",
  barber: "/Mockups/Tablet Horizontal - Tela de Agendamento Barbearia.png",
  salon: "/Mockups/Tablet Horizontal - Tela de Agendamento Salão.png",
  metrics: "/Mockups/Tablet Horizontal - Visão Geral Metricas.jpg",
} as const;


type FAQItem = {
  question: string;
  answer: string;
};

const faqs: FAQItem[] = [
  {
    question: "Tem mesmo 7 dias grátis, sem cartão?",
    answer:
      "Tem. Você começa hoje, testa com seus clientes reais, vê funcionar na prática. Se não servir, cancela e não paga nada. Mas quem testou não voltou para o WhatsApp.",
  },
  {
    question: "Minhas clientes agendam sozinhas de verdade?",
    answer:
      "De verdade. Você recebe uma página própria para colocar no Instagram, WhatsApp, Google ou onde quiser. A cliente escolhe o serviço (manicure, escova, coloração...), a profissional, o dia e o horário — sem mandar mensagem pra você.",
  },
  {
    question: "E se minhas clientes estiverem acostumadas com o WhatsApp?",
    answer:
      "Melhor ainda. Você compartilha o link da sua página por lá. A cliente clica, agenda em 30 segundos e você não precisa largar o pincel nem a escova pra responder. Elas acostumam rápido quando é fácil.",
  },
  {
    question: "Consigo ver o dinheiro entrando?",
    answer:
      "Sim. Faturamento, ocupação, desempenho por profissional — tudo em uma tela. Você para de adivinhar como o mês foi e começa a tomar decisões com dado real.",
  },
];

const plans = [
  {
    name: "Solo",
    price: "27",
    description: "Para quem está começando.",
    features: [
      "Agendamento online",
      "Agenda profissional",
      "Clientes",
      "Serviços",
    ],
  },
  {
    name: "Studio",
    price: "49,90",
    description: "Para negócios com equipe.",
    featured: true,
    features: [
      "Tudo do Solo",
      "Profissionais",
      "Permissões de acesso",
      "Gestão completa",
    ],
  },
  {
    name: "Business",
    price: "89,90",
    description: "Para operações maiores.",
    features: [
      "Tudo do Studio",
      "Financeiro",
      "Mais controle",
      "Estrutura avançada",
    ],
  },
];

/* =========================================================
   HELPERS
   ========================================================= */

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

function goTo(path: string) {
  window.location.href = path;
}

/* =========================================================
   SMALL COMPONENTS
   ========================================================= */

function Noise() {
  return (
    <div
      aria-hidden="true"
      className="rf-noise"
    />
  );
}

function GridLines({ dark = false }: { dark?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={`rf-grid-lines ${dark ? "rf-grid-lines-dark" : ""}`}
    >
      <span />
      <span />
      <span />
      <span />
      <span />
    </div>
  );
}

function SectionEyebrow({
  children,
  dark = false,
}: {
  children: ReactNode;
  dark?: boolean;
}) {
  return (
    <div className={`rf-eyebrow ${dark ? "rf-eyebrow-dark" : ""}`}>
      <span className="rf-eyebrow-dot" />
      {children}
    </div>
  );
}

function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={
        reduced
          ? false
          : {
            opacity: 0,
            y: 28,
          }
      }
      whileInView={
        reduced
          ? undefined
          : {
            opacity: 1,
            y: 0,
          }
      }
      viewport={{
        once: true,
        amount: 0.15,
      }}
      transition={{
        duration: 0.75,
        delay,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.div>
  );
}

/* =========================================================
   MOCKUP — PUBLIC BOOKING
   ========================================================= */

function BookingPhone({ imageSrc = M.booking }: { imageSrc?: string } = {}) {
  const reduced = useReducedMotion();

  return (
    <div className="rf-real-phone-wrap">
      <motion.div
        aria-hidden="true"
        className="rf-real-phone-glow"
        animate={
          reduced
            ? undefined
            : {
              opacity: [0.18, 0.34, 0.18],
              scale: [0.96, 1.04, 0.96],
            }
        }
        transition={
          reduced
            ? undefined
            : {
              duration: 5,
              repeat: Infinity,
              ease: "easeInOut",
            }
        }
      />

      <div className="rf-real-phone">
        <div className="rf-real-phone-frame">
          <span className="rf-real-phone-island" />
          <div className="rf-real-phone-screen">
            <img
              src={imageSrc}
              alt="Tela de agendamento online da Raffros"
              className="rf-real-phone-image"
              loading="eager"
            />
            <div className="rf-real-phone-shine" aria-hidden="true" />
          </div>
        </div>
      </div>

      <motion.div
        className="rf-real-floating-card rf-real-floating-top"
        animate={reduced ? undefined : { y: [0, -3, 0] }}
        transition={
          reduced
            ? undefined
            : { duration: 4.5, repeat: Infinity, ease: "easeInOut" }
        }
      >
        <span className="rf-real-floating-check">
          <Check size={12} />
        </span>
        <span>
          <strong>Horário reservado</strong>
          <small>Agendamento confirmado</small>
        </span>
      </motion.div>
      {/* 
      <motion.div
        className="rf-real-floating-card rf-real-floating-top"
        animate={reduced ? undefined : { y: [80, 77, 80] }}
        transition={
          reduced
            ? undefined
            : { duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }
        }
      ><br />
        <small>PRÓXIMO HORÁRIO</small>
        <strong>Hoje · 16:30</strong>
      </motion.div> */}
    </div>
  );
}

/* =========================================================
   MOCKUP — DASHBOARD
   ========================================================= */

function DashboardMockup() {
  return (
    <div className="rf-real-browser">
      <div className="rf-real-browser-top">
        <div className="rf-real-browser-dots">
          <span />
          <span />
          <span />
        </div>
        <span>app.raffros.com / agenda</span>
        <div className="rf-real-browser-secure">
          <ShieldCheck size={11} />
          seguro
        </div>
      </div>

      <div className="rf-real-browser-image-wrap">
        <img
          src={M.salon}
          alt="Tela de agendamento e gestão da Raffros"
          className="rf-real-browser-image"
          loading="lazy"
        />
      </div>
    </div>
  );
}

/* =========================================================
   MOCKUP — MACBOOK / TELAS GRANDES
   ========================================================= */

function MacbookMockup({ image, alt, path, className = "" }: { image: string; alt: string; path: string; className?: string }) {
  return (
    <div className={cn("rf-macbook-wrap", className)}>
      <div className="rf-macbook-screen-shell">
        <div className="rf-macbook-browser-top">
          <div className="rf-real-browser-dots">
            <span style={{ background: '#ff5f56', border: '1px solid #e0443e' }} />
            <span style={{ background: '#ffbd2e', border: '1px solid #dea123' }} />
            <span style={{ background: '#27c93f', border: '1px solid #1aab29' }} />
          </div>
          <span>{path}</span>
          <div className="rf-real-browser-secure"><ShieldCheck size={10} />seguro</div>
        </div>
        <div className="rf-macbook-screen-image"><img src={image} alt={alt} loading="lazy" /></div>
      </div>
      <div className="rf-macbook-shadow" aria-hidden="true" style={{ bottom: '-15px' }} />
    </div>
  );
}

/* =========================================================
   HEADER
   ========================================================= */

function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let lastScroll = window.scrollY;

    const handleScroll = () => {
      const currentScroll = window.scrollY;
      setScrolled(currentScroll > 20);

      if (currentScroll > lastScroll && currentScroll > 200) {
        setHidden(true);
      } else if (currentScroll < lastScroll) {
        setHidden(false);
      }
      lastScroll = currentScroll <= 0 ? 0 : currentScroll;
    };

    window.addEventListener("scroll", handleScroll, {
      passive: true,
    });

    handleScroll();

    return () =>
      window.removeEventListener("scroll", handleScroll);
  }, []);

  const links = [
    { label: "Como funciona", href: "#como-funciona" },
    { label: "Gestão", href: "#gestao" },
    // { label: "Para quem", href: "#para-quem" },
    { label: "Planos", href: "#planos" },
    { label: "Dúvidas", href: "#faq" },
    { label: "♫ Playlist", href: "/playlist", isExternal: true },
  ];

  return (
    <>
      <header
        className={[
          "rf-header",
          scrolled ? "rf-header-scrolled" : "",
          hidden ? "rf-header-hidden" : ""
        ].join(" ")}
      >
        <a
          href="#inicio"
          className="rf-logo"
          aria-label="Raffros"
        >
          <img
            src="/logo.svg"
            alt="Raffros"
            style={{ height: '32px', filter: 'invert(1)' }}
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              const fallback = e.currentTarget.nextElementSibling as HTMLElement;
              if (fallback) fallback.style.display = 'flex';
            }}
          />
          <div style={{ display: 'none', alignItems: 'center', gap: '6px', color: '#fff' }}>
            <span className="rf-logo-mark" style={{ background: '#fff', color: '#000' }}>R</span>
            <span style={{ color: '#fff', fontWeight: 700 }}>raffros</span>
            <i style={{ color: 'var(--rf-accent)', fontStyle: 'normal' }}>.</i>
          </div>
        </a>

        <nav className="rf-desktop-nav">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={(e) => {
                if (link.href.startsWith('#')) {
                  e.preventDefault();
                  const targetId = link.href.replace('#', '');
                  const element = document.getElementById(targetId);
                  if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                } else if (link.href === '/playlist') {
                  trackEvent('click_playlist_nav_desktop');
                }
              }}
              style={(link as { isExternal?: boolean }).isExternal ? { color: '#1DB954', fontWeight: 600 } : undefined}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="rf-header-actions">
          <button
            className="rf-login"
            onClick={() => goTo("/login")}
          >
            Entrar
          </button>

          <button
            className="rf-header-cta"
            onClick={() => {
              trackEvent('click_cta_header_desktop');
              goTo("/cadastro");
            }}
          >
            Começar grátis
            <ArrowUpRight size={14} />
          </button>
        </div>

        <button
          className="rf-mobile-menu"
          onClick={() => setOpen((value) => !value)}
          aria-label="Abrir menu"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            className="rf-menu"
            initial={{ opacity: 0, clipPath: "circle(0% at 92% 4%)" }}
            animate={{ opacity: 1, clipPath: "circle(150% at 92% 4%)" }}
            exit={{ opacity: 0, clipPath: "circle(0% at 92% 4%)" }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="rf-hero-light" aria-hidden="true">
              <span className="rf-hero-light-beam rf-hero-light-beam-one" />
              <span className="rf-hero-light-beam rf-hero-light-beam-two" />
              <span className="rf-hero-light-glow" />
            </div>

            <div className="rf-menu-inner">
              <div className="rf-menu-top">
                <a href="/" onClick={() => setOpen(false)} className="rf-menu-logo" aria-label="Raffros">
                  <img src="/logo.svg" alt="Raffros" />
                </a>
                <button className="rf-menu-close" onClick={() => setOpen(false)} aria-label="Fechar menu">
                  <X size={20} />
                </button>
              </div>

              <div className="rf-menu-eyebrow">
                <span className="rf-menu-dot" />
                Salões · Esmalterias · Barbearias
              </div>

              <nav className="rf-menu-links">
                {links.filter(l => !(l as { isExternal?: boolean }).isExternal).map((link, index) => (
                  <motion.a
                    key={link.href}
                    href={link.href}
                    className="rf-menu-link"
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, delay: 0.12 + index * 0.06, ease: [0.22, 1, 0.36, 1] }}
                    onClick={(e) => {
                      e.preventDefault();
                      setOpen(false);
                      const targetId = link.href.replace('#', '');
                      const element = document.getElementById(targetId);
                      if (element) {
                        setTimeout(() => {
                          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }, 120);
                      }
                    }}
                  >
                    <span className="rf-menu-link-number">0{index + 1}</span>
                    <span className="rf-menu-link-label">{link.label}</span>
                    <ArrowUpRight size={20} className="rf-menu-link-arrow" />
                  </motion.a>
                ))}
              </nav>

              <motion.div
                className="rf-menu-bottom"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
              >
                <a
                  href="/playlist"
                  className="rf-menu-glass-card"
                  onClick={(e) => {
                    e.preventDefault();
                    setOpen(false);
                    trackEvent('click_playlist_nav_mobile');
                    goTo("/playlist");
                  }}
                >
                  <span className="rf-menu-glass-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424a.623.623 0 01-.857.208c-2.348-1.435-5.304-1.76-8.785-.964a.623.623 0 11-.277-1.215c3.809-.87 7.076-.496 9.712 1.115a.623.623 0 01.207.856zm1.223-2.72a.78.78 0 01-1.072.257C14.1 12.29 10.539 11.88 7.2 12.84a.78.78 0 01-.48-1.485c3.754-1.09 7.72-.562 10.832 1.277a.78.78 0 01.257 1.072zm.105-2.832C15.16 9.15 10.481 9 7.2 9.983a.937.937 0 11-.543-1.794C10.317 7.071 15.494 7.25 19.2 9.638a.937.937 0 01-1.286 1.234z" fill="#1DB954" />
                    </svg>
                  </span>
                  <span className="rf-menu-glass-text">
                    <strong>Som da Casa</strong>
                    <small>Músicas &amp; Palavra do Dia</small>
                  </span>
                  <ArrowUpRight size={16} className="rf-menu-glass-arrow" />
                </a>

                <button
                  type="button"
                  className="rf-menu-cta"
                  onClick={() => {
                    setOpen(false);
                    trackEvent('click_mobile_sticky_cta');
                    goTo("/cadastro");
                  }}
                >
                  Começar grátis
                  <ArrowRight size={17} />
                </button>

                <button
                  type="button"
                  className="rf-menu-login"
                  onClick={() => {
                    setOpen(false);
                    goTo("/login");
                  }}
                >
                  Já tem conta? <strong>Entrar</strong>
                </button>

                <p className="rf-menu-note">7 dias grátis · Sem cartão · Cancele quando quiser</p>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* =========================================================
   HERO
   ========================================================= */

function Hero() {
  return (
    <section
      id="inicio"
      className="rf-hero"
    >
      <Noise />
      <GridLines dark />

      <div className="rf-hero-orb rf-hero-orb-one" />
      <div className="rf-hero-orb rf-hero-orb-two" />

      {/* Iluminação ambiente: feixes de luz passando lentamente por trás */}
      <div className="rf-hero-light" aria-hidden="true">
        <span className="rf-hero-light-beam rf-hero-light-beam-one" />
        <span className="rf-hero-light-beam rf-hero-light-beam-two" />
        <span className="rf-hero-light-glow" />
      </div>

      <div className="rf-container rf-hero-container">
        <div className="rf-hero-copy">
          <br />


          <Reveal delay={0.08}>
            <h1>
              Você não abriu
              <br />
              seu salão
              <br />
              pra ficar{" "}
              <br className="rf-hero-mobile-br" />
              <span>
                respondendo
                <br />
                WhatsApp.
              </span>
            </h1>
          </Reveal>

          <Reveal delay={0.16}>
            <p className="rf-hero-description">
              Agendamento online e gestão simples. Seu cliente agenda sozinho pelo Instagram ou WhatsApp, 24 horas por dia.
            </p>
          </Reveal>

          <Reveal delay={0.22}>
            <div className="rf-hero-actions">
              <button
                className="rf-primary-button"
                onClick={() => {
                  trackEvent('click_comecar_gratis_hero');
                  goTo("/cadastro");
                }}
              >
                Começar grátis
                <ArrowRight size={17} />
              </button>

              <a
                href="#como-funciona"
                className="rf-secondary-button"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById("como-funciona")?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                Como funciona
                <ArrowDown size={15} />
              </a>
            </div>
          </Reveal>



          <Reveal delay={0.36} className="rf-hero-trust-slot">
            <div className="rf-hero-trust">
              <div className="rf-trust-item">
                <span className="rf-trust-value">100%</span>
                <span className="rf-trust-label">
                  online
                </span>
              </div>

              <div className="rf-trust-line" />

              <div className="rf-trust-item">
                <span className="rf-trust-value">7 dias</span>
                <span className="rf-trust-label">
                  grátis
                </span>
              </div>

              <div className="rf-trust-line" />

              <div className="rf-trust-item">
                <span className="rf-trust-value">0 furos</span>
                <span className="rf-trust-label">
                  na agenda
                </span>
              </div>
            </div>
          </Reveal>
        </div>

        <div className="rf-hero-product -translate-y-10">
          <BookingPhone imageSrc={M.booking2} />
        </div>

        <Reveal delay={0.28} className="rf-hero-spotify-slot">
          <a
            href="/playlist"
            className="rf-spotify-card"
            aria-label="Som da Casa e Palavra do Dia — ver playlist"
            onClick={() => trackEvent('click_spotify_card_hero', { metadata: { origem: 'hero' } })}
          >
            <div className="rf-spotify-card-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424a.623.623 0 01-.857.208c-2.348-1.435-5.304-1.76-8.785-.964a.623.623 0 11-.277-1.215c3.809-.87 7.076-.496 9.712 1.115a.623.623 0 01.207.856zm1.223-2.72a.78.78 0 01-1.072.257C14.1 12.29 10.539 11.88 7.2 12.84a.78.78 0 01-.48-1.485c3.754-1.09 7.72-.562 10.832 1.277a.78.78 0 01.257 1.072zm.105-2.832C15.16 9.15 10.481 9 7.2 9.983a.937.937 0 11-.543-1.794C10.317 7.071 15.494 7.25 19.2 9.638a.937.937 0 01-1.286 1.234z" fill="#1DB954" />
              </svg>
            </div>
            <div className="rf-spotify-card-text">
              <span className="rf-spotify-card-title">Som da Casa</span>
              <span className="rf-spotify-card-sub">& Palavra do Dia</span>
            </div>
            <div className="rf-spotify-card-arrow">
              <ArrowUpRight size={14} />
            </div>
          </a>
        </Reveal>
        <br />
      </div>



      <div className="rf-scroll-indicator">
        <span>SCROLL</span>
        <div />
      </div>

      <div className="rf-hero-bottom-label">
        RAFFROS / 01
      </div>
      <br />
    </section>

  );
}

/* =========================================================
   STATEMENT
   ========================================================= */

function Statement() {
  return (
    <section id="produto" className="rf-statement">
      <GridLines />

      <div className="rf-container">
        <div className="rf-statement-grid">
          <div>
            <Reveal>
              <SectionEyebrow>
                O PROBLEMA QUE TODOS IGNORAM
              </SectionEyebrow>
            </Reveal>

            <Reveal delay={0.1}>
              <h2>
                Seu negócio não cresce
                <br />
                se você estiver preso
                <br />
                <em>no operacional.</em>
              </h2>
            </Reveal>

            <Reveal delay={0.18}>
              <p>
                Enquanto você está com o pincel ou a escova na mão, a próxima cliente já deveria ter o horário confirmado. Não pelo WhatsApp. Automaticamente.
              </p>
            </Reveal>
          </div>

          <Reveal delay={0.24}>
            <div className="rf-statement-visual" style={{ position: 'relative', width: '100%', minHeight: '550px', display: 'flex', alignItems: 'center', justifyContent: 'center', perspective: '1200px' }}>
              <img
                src={M.themeA}
                alt="Tema Claro"
                style={{ position: 'absolute', width: '42%', left: '5%', zIndex: 1, filter: 'blur(1px) brightness(0.8)', transform: 'rotate(-16deg) translateY(20px) scale(0.9)', borderRadius: '24px', boxShadow: '0 20px 30px rgba(0,0,0,0.3)' }}
                loading="lazy"
              />
              <img
                src={M.themeC}
                alt="Tema Elegante"
                style={{ position: 'absolute', width: '42%', right: '5%', zIndex: 1, filter: 'blur(1px) brightness(0.8)', transform: 'rotate(16deg) translateY(20px) scale(0.9)', borderRadius: '24px', boxShadow: '0 20px 30px rgba(0,0,0,0.3)' }}
                loading="lazy"
              />
              <img
                src={M.themeB}
                alt="Raffros App"
                style={{ position: 'relative', width: '52%', zIndex: 3, transform: 'translateY(-10px) scale(1.05)', borderRadius: '24px', boxShadow: '0 30px 60px rgba(0,0,0,0.6)' }}
                loading="lazy"
              />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* =========================================================
   PROBLEM / PAIN
   ========================================================= */

function ProblemSection() {
  const problems = [
    {
      number: "01",
      title: "\"Tem horário amanhã?\"",
      text: "Cada mensagem respondida no celular é um minuto a menos fazendo unhas, escova ou corte. Com a mão ocupada, isso vira horas perdidas por semana.",
    },
    {
      number: "02",
      title: "Cliente que some sem avisar",
      text: "Sem confirmação e sem sinal, o horário fica vago. Aquela cliente que queria encaixe não entrou porque o furo já estava lá.",
    },
    {
      number: "03",
      title: "Equipe sem agenda clara",
      text: "Cada manicure, cabeleireira ou barbeiro gerenciando o próprio WhatsApp significa horário duplicado, cliente esperando e problema que cai no seu colo.",
    },
  ];

  return (
    <section className="rf-problem">
      <div className="rf-container">
        <div className="rf-problem-heading">
          <Reveal>
            <SectionEyebrow dark>
              OS TRÊS PROBLEMAS QUE CUSTAM DINHEIRO TODO DIA
            </SectionEyebrow>
          </Reveal>

          <Reveal delay={0.08}>
            <h2>
              Três motivos
              <br />
              que travam
              <br />
              <span>qualquer salão.</span>
            </h2>
          </Reveal>
        </div>

        <div className="rf-problem-list">
          {problems.map((problem, index) => (
            <Reveal
              key={problem.number}
              delay={index * 0.08}
            >
              <div className="rf-problem-row">
                <span className="rf-problem-number">
                  {problem.number}
                </span>

                <div className="rf-problem-title">
                  {problem.title}
                </div>

                <p>{problem.text}</p>

                <ArrowUpRight size={20} />
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* =========================================================
   BOOKING SECTION
   ========================================================= */

function BookingSection() {
  return (
    <section
      id="como-funciona"
      className="rf-booking-section"
    >
      <div className="rf-container ">
        <div className="rf-section-intro">
          <Reveal>
            <SectionEyebrow>
              COMO FUNCIONA · O FIM DAS MENSAGENS
            </SectionEyebrow>
          </Reveal>

          <Reveal delay={0.08}>
            <h2>
              Sua agenda
              <br />
              <span>trabalha por você. 24h.</span>
            </h2>
          </Reveal>

          <Reveal delay={0.16}>
            <p>
              Às 23h, uma cliente abre seu Instagram, clica no link da bio e agenda a manicure de amanhã às 9h. Você não precisou responder nada. O horário está lá quando você acorda.
            </p>
          </Reveal>
        </div>

        <div className="rf-booking-layout ">
          <Reveal className="rf-booking-visual ">
            <BookingPhone imageSrc={M.services} />
          </Reveal>

          <div className="rf-booking-details">
            {[
              {
                icon: Globe2,
                title: "Link na bio. Agenda feita.",
                text: "Coloca o link no Instagram ou WhatsApp. A cliente abre, escolhe o serviço, a profissional e o horário. Em menos de 1 minuto.",
              },
              {
                icon: CalendarDays,
                title: "Só mostra o que está livre",
                text: "Cada profissional tem sua agenda. O sistema bloqueia automaticamente o que já foi preenchido. Zero conflito de horário.",
              },
              {
                icon: ShieldCheck,
                title: "Confirmado. Sem WhatsApp.",
                text: "A cliente recebe a confirmação na hora. Você abre o painel e vê a agenda cheia. Simples assim.",
              },
            ].map((item, index) => {
              const Icon = item.icon;

              return (
                <Reveal
                  key={item.title}
                  delay={index * 0.08}
                >
                  <div className="rf-detail-row">
                    <div className="rf-detail-icon">
                      <Icon size={19} />
                    </div>

                    <div>
                      <h3>{item.title}</h3>
                      <p>{item.text}</p>
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

/* =========================================================
   DASHBOARD SECTION
   ========================================================= */

function DashboardSection() {
  return (
    <section
      id="gestao"
      className="rf-dashboard-section"
    >
      <div className="rf-container">
        <div className="rf-dashboard-copy">
          <Reveal>
            <SectionEyebrow dark>
              PAINEL DE GESTÃO · TUDO EM UM SÓ LUGAR
            </SectionEyebrow>
          </Reveal>

          <Reveal delay={0.08}>
            <h2>
              <span className="rf-highlight-orange">Você administra o salão</span>
              <br />
              <span className="rf-highlight-white">sem largar o pincel.</span>
            </h2>
          </Reveal>

          <Reveal delay={0.16}>
            <p>
              Agenda, clientes, equipe, serviços e caixa em uma tela só. Sem planilha, sem caderninho, sem depender de ninguém.
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.1}>
          <MacbookMockup image={M.salon} alt="Tela de agendamento e gestão da Raffros para salões e esmalterias" path="app.raffros.com / agenda" className="rf-dashboard-macbook" />
        </Reveal>

        <div className="rf-feature-strip">
          <div>
            <span>01</span>
            <strong>Agenda</strong>
            <p>Dia inteiro na palma da mão.</p>
          </div>

          <div>
            <span>02</span>
            <strong>Equipe</strong>
            <p>Cada um sabe o que faz.</p>
          </div>

          <div>
            <span>03</span>
            <strong>Clientes</strong>
            <p>Histórico de todo mundo.</p>
          </div>

          <div>
            <span>04</span>
            <strong>Financeiro</strong>
            <p>Número real, não chute.</p>
          </div>
        </div>
      </div>
    </section>
  );
}


/* =========================================================
   REAL PRODUCT GALLERY
   ========================================================= */

function RealProductGallery() {
  const screens = [
    { number: "01", label: "AGENDAMENTO", title: "30 segundos. Horário marcado.", text: "O cliente escolhe o serviço, o profissional e o horário sem precisar mandar uma mensagem sequer.", image: M.booking, className: "rf-gallery-main" },
    { number: "02", label: "SERVIÇOS", title: "Unhas, escova, coloração...tudo lá.", text: "Cada serviço com duração e preço exibidos antes de confirmar. A cliente sabe exatamente o que vai pagar.", image: M.services, className: "" },
    { number: "03", label: "PIX", title: "Sinal na hora. Furo nunca.", text: "Você define o percentual de entrada. O cliente paga na hora de marcar. Sem sinal, sem horário.", image: M.pix, className: "" },
  ];

  return (
    <section className="rf-real-gallery">
      <div className="rf-container">
        <div className="rf-real-gallery-heading">
          <Reveal>
            <SectionEyebrow dark>
              A EXPERIÊNCIA DO CLIENTE · LEVA MENOS DE 1 MINUTO
            </SectionEyebrow>
          </Reveal>

          <Reveal delay={0.08}>
            <h2>
              A primeira impressão
              <br />
              <span>já é sua.</span>
            </h2>
          </Reveal>

          <Reveal delay={0.16}>
            <p>
              Seu cliente julga o negócio antes de entrar pela porta. Uma página de agendamento profissional já diz que você é diferente.
            </p>
          </Reveal>
        </div>

        <div className="rf-real-gallery-grid">
          {screens.map((screen, index) => (
            <Reveal key={screen.number} delay={index * 0.08}>
              <article className={cn("rf-real-gallery-card", screen.className)}>
                <div className="rf-real-gallery-copy">
                  <div>
                    <span className="rf-real-gallery-number">{screen.number}</span>
                    <span className="rf-real-gallery-label">{screen.label}</span>
                  </div>
                  <h3>{screen.title}</h3>
                  <p>{screen.text}</p>
                </div>

                <div className="rf-real-gallery-device">
                  <div className="rf-real-gallery-phone">
                    <span className="rf-real-gallery-island" />
                    <img
                      src={screen.image}
                      alt={screen.title}
                      loading="lazy"
                    />
                  </div>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* =========================================================
   TEAM
   ========================================================= */


function TeamSection() {
  return (
    <section className="rf-team-section">
      <div className="rf-container">
        <div className="rf-team-grid">
          <div className="rf-team-copy">
            <Reveal>
              <SectionEyebrow>
                SUA EQUIPE · CADA UM NO SEU LUGAR
              </SectionEyebrow>
            </Reveal>

            <Reveal delay={0.08}>
              <h2>
                Cada manicure.
                <br />
                Cada cabeleireira.
                <br />
                <span>Sua própria agenda.</span>
              </h2>
            </Reveal>

            <Reveal delay={0.16}>
              <p>
                Cadastre cada profissional com seus serviços, horários e permissões. Cada um vê só o que precisa. Você vê tudo — sem precisar ser o intermediador de nada.
              </p>
            </Reveal>
          </div>

          <Reveal
            delay={0.14}
            className="rf-team-visual"
          >
            <div className="rf-team-real-wrap">
              <MacbookMockup image={M.salon} alt="Gestão de equipe da Raffros" path="app.raffros.com / equipe" className="rf-team-macbook" />

              <div className="rf-team-real-badge">
                <span />
                <div>
                  <strong>Equipe independente</strong>
                  <small>Cada um sabe o que tem hoje</small>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* =========================================================
   BIG TYPOGRAPHY SECTION
   ========================================================= */

function PhilosophySection() {
  return (
    <section className="rf-philosophy">
      <div className="rf-container">
        <Reveal>
          <div className="rf-philosophy-label">
            RAFFROS / VERDADE
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <h2>
            Cada horário vazio
            <br />
            é dinheiro
            <br />
            que foi embora.
          </h2>
        </Reveal>

        <Reveal delay={0.16}>
          <p>
            Uma escova não feita não volta. Um alongamento perdido não se recupera. Cada furo na agenda é receita que não entrou. A Raffros existe para isso não acontecer mais.
          </p>
        </Reveal>

        <Reveal delay={0.22}>
          <div className="rf-philosophy-mark">
            <Sparkles size={18} />
            <span>MENOS OPERAÇÃO. MAIS NEGÓCIO. RAFFROS.</span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* =========================================================
   AUDIENCE
   ========================================================= */

function AudienceSection() {
  const audiences = [
    {
      index: "01",
      title: "Salões de beleza",
      description:
        "Equipe, serviços e clientes organizados em uma única operação.",
      icon: Sparkles,
      bgImage: "/images/salao-cachos.jpg"
    },
    {
      index: "02",
      title: "Esmalterias",
      description:
        "Uma agenda simples para você cuidar da experiência.",
      icon: CalendarDays,
      bgImage: "/images/manicure-celular.jpg"
    },
    {
      index: "03",
      title: "Studios & autônomas",
      description:
        "Mais horários preenchidos. Menos conversa para fechar cada atendimento.",
      icon: Scissors,
      bgImage: "/images/barbearia.jpg"
    },
  ];

  return (
    <section
      id="para-quem"
      className="rf-audience"
    >
      <div className="rf-container">
        <div className="rf-audience-header">
          <Reveal>
            <SectionEyebrow>
              PARA QUEM É O RAFFROS
            </SectionEyebrow>
          </Reveal>

          <Reveal delay={0.08}>
            <h2>
              Um sistema.
              <br />
              Seu jeito de trabalhar.
            </h2>
          </Reveal>
        </div>

        <div className="rf-audience-grid">
          {audiences.map((item, index) => {
            const Icon = item.icon;

            return (
              <Reveal
                key={item.title}
                delay={index * 0.08}
              >
                <div
                  className="rf-audience-card"
                  style={{
                    backgroundImage: `linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.5) 40%, rgba(0,0,0,0.1) 100%), url(${item.bgImage})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    color: '#fff',
                    border: 'none',
                    minHeight: '380px'
                  }}
                >
                  <div className="rf-audience-top">
                    <span style={{ color: 'rgba(255,255,255,0.7)' }}>{item.index}</span>
                    <Icon size={22} style={{ color: 'rgba(255,255,255,0.7)' }} />
                  </div>

                  <div className="rf-audience-content">
                    <h3 style={{ color: '#fff' }}>{item.title}</h3>
                    <p style={{ color: 'rgba(255,255,255,0.8)' }}>{item.description}</p>
                  </div>

                  <ArrowUpRight className="rf-audience-arrow" style={{ color: 'rgba(255,255,255,0.7)' }} />
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}


/* =========================================================
   FINANCE / REAL MOCKUP
   ========================================================= */

function FinanceRealSection() {
  return (
    <section className="rf-finance-real">
      <div className="rf-container">
        <div className="rf-finance-real-heading">
          <Reveal>
            <SectionEyebrow dark>
              FINANCEIRO · PARE DE ADIVINHAR QUANTO ENTROU
            </SectionEyebrow>
          </Reveal>

          <Reveal delay={0.08}>
            <h2>
              Quanto entrou
              <br />
              <span>hoje no salão?</span>
            </h2>
          </Reveal>

          <Reveal delay={0.16}>
            <p>
              Se você não sabe responder isso em 10 segundos, a Raffros resolve. Faturamento, ocupação por profissional e desempenho do dia — na tela.
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.12}>
          <MacbookMockup image={M.metrics} alt="Visão geral de métricas da Raffros" path="app.raffros.com / visão geral" className="rf-finance-macbook" />
        </Reveal>
      </div>
    </section>
  );
}

/* =========================================================
   PAYMENT / ANTI-FURO
   ========================================================= */

function PaymentRealSection() {
  return (
    <section className="rf-payment-real">
      <div className="rf-container">
        <div className="rf-payment-real-grid">
          <Reveal>
            <div className="rf-payment-real-devices">
              <div className="rf-payment-device rf-payment-device-back">
                <span className="rf-real-phone-island" />
                <img src={M.payment} alt="Pagamento Raffros" loading="lazy" />
              </div>

              <div className="rf-payment-device rf-payment-device-front">
                <span className="rf-real-phone-island" />
                <img src={M.pix} alt="Pagamento via Pix Raffros" loading="lazy" />
              </div>

              <div className="rf-payment-tag">
                <Check size={12} />
                Horário protegido
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <SectionEyebrow dark>
              ANTI-FURO · CLIENTE PAGOU, HORÁRIO GARANTIDO
            </SectionEyebrow>

            <h2>
              Sumiu sem avisar?
              <br />
              <span>Não acontece mais.</span>
            </h2>

            <p>
              Você define a entrada. A cliente paga via Pix antes de confirmar. Se não pagou, o horário não é dela. Fim do furo.
            </p>

            <div className="rf-payment-cards-list">
              {[
                {
                  number: "01",
                  title: "Você define o percentual",
                  desc: "Defina o valor da entrada que faz sentido para cada serviço.",
                },
                {
                  number: "02",
                  title: "Pagamento via Pix na hora",
                  desc: "Cai direto na sua conta, em segundos, sem mandar comprovante.",
                },
                {
                  number: "03",
                  title: "Horário confirmado só com sinal",
                  desc: "Se não pagou, a vaga continua aberta. Fim do furo na agenda.",
                },
              ].map((step) => (
                <div key={step.number}>
                  <span>{step.number}</span>
                  <strong>{step.title}</strong>
                  <p>{step.desc}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* =========================================================
   DOMICÍLIO / REAL MOCKUP
   ========================================================= */

function DomicilioRealSection() {
  return (
    <section className="rf-domicilio-real">
      <div className="rf-container">
        <div className="rf-domicilio-real-grid">
          <Reveal>
            <SectionEyebrow dark>
              10 / ATENDIMENTO A DOMICÍLIO
            </SectionEyebrow>

            <h2>
              Você escolhe
              <br />
              onde atende.
              <br />
              <span>Sem complicar.</span>
            </h2>

            <p>
              Ativar atendimento a domicílio é um clique. Você define o raio, o cliente informa o endereço e o sistema valida na hora. Sem WhatsApp. Sem vai-e-vem.
            </p>

            <div className="rf-domicilio-real-points">
              {[
                "Raio configurável",
                "Endereço do cliente",
                "Taxa de deslocamento",
                "Agenda específica",
              ].map((item) => (
                <div key={item}>
                  <CheckCircle2 size={15} />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.12}>
            <div className="rf-domicilio-real-device">
              <div className="rf-domicilio-real-ring ring-one" />
              <div className="rf-domicilio-real-ring ring-two" />
              <div className="rf-domicilio-real-ring ring-three" />

              <div className="rf-domicilio-phone">
                <span className="rf-real-phone-island" />
                <img
                  src={M.domicilio}
                  alt="Escolha de atendimento a domicílio na Raffros"
                  loading="lazy"
                />
              </div>

              <div className="rf-domicilio-location">
                <MapPin size={13} />
                cliente dentro do raio
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* =========================================================
   PERSONALIZATION / REAL THEMES
   ========================================================= */

function PersonalizationRealSection() {
  const themes = [
    { image: M.themeA, label: "Clássico" },
    { image: M.themeB, label: "Noir" },
    { image: M.themeC, label: "Elegante" },
  ];

  return (
    <section className="rf-personalization-real">
      <div className="rf-container">
        <div className="rf-personalization-real-heading">
          <Reveal>
            <SectionEyebrow dark>
              11 / SUA IDENTIDADE
            </SectionEyebrow>
          </Reveal>

          <Reveal delay={0.08}>
            <h2>
              Sua página.
              <br />
              <span>Sua identidade.</span>
            </h2>
          </Reveal>

          <Reveal delay={0.16}>
            <p>
              Escolha um tema e pronto. A página onde seu cliente agenda já parece que foi feita por um designer — porque foi.
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.12}>
          <div className="rf-theme-stage">
            {themes.map((theme, index) => (
              <motion.div
                key={theme.label}
                className={cn(
                  "rf-theme-phone",
                  index === 0 && "rf-theme-phone-left",
                  index === 1 && "rf-theme-phone-center",
                  index === 2 && "rf-theme-phone-right"
                )}
                animate={{ y: [0, index === 1 ? -10 : -6, 0] }}
                transition={{
                  duration: 5 - index * 0.35,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: index * 0.35,
                }}
              >
                <div className="rf-theme-phone-frame">
                  <span className="rf-real-phone-island" />
                  <img src={theme.image} alt={`Tema ${theme.label}`} loading="lazy" />
                </div>
                {index === 1 && (
                  <span className="rf-theme-label">{theme.label}</span>
                )}
              </motion.div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* =========================================================
   PRICING
   ========================================================= */


function PricingSection() {
  return (
    <section
      id="planos"
      className="rf-pricing"
    >
      <div className="rf-container">
        <div className="rf-pricing-header">
          <Reveal>
            <SectionEyebrow dark>
              PLANOS E PREÇOS · COMECE HOJE
            </SectionEyebrow>
          </Reveal>

          <Reveal delay={0.08}>
            <h2>
              Custa menos
              <br />
              <span>do que um furo na agenda.</span>
            </h2>
          </Reveal>

          <Reveal delay={0.16}>
            <p>
              Um único horário perdido já cobre o plano inteiro do mês.
              7 dias grátis, sem cartão, sem enrolação.
            </p>
          </Reveal>
        </div>

        <div className="rf-pricing-grid">
          {plans.map((plan, index) => (
            <Reveal
              key={plan.name}
              delay={index * 0.08}
            >
              <div
                className={`rf-price-card ${plan.featured
                  ? "rf-price-featured"
                  : ""
                  }`}
              >
                {plan.featured && (
                  <div className="rf-price-badge">
                    MAIS ESCOLHIDO
                  </div>
                )}

                <div className="rf-price-top">
                  <span>{plan.name}</span>
                  <small>{plan.description}</small>
                </div>

                <div className="rf-price-value">
                  <small>R$</small>
                  <strong>{plan.price}</strong>
                  <span>/mês</span>
                </div>

                <div className="rf-price-divider" />

                <div className="rf-price-features">
                  {plan.features.map((feature) => (
                    <div key={feature}>
                      <Check size={15} />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
                <br />
                <button
                  className={
                    plan.featured
                      ? "rf-price-button featured"
                      : "rf-price-button"
                  }
                  onClick={() => {
                    trackEvent(`click_plan_${plan.name.toLowerCase()}`);
                    goTo("/cadastro");
                  }}
                >
                  Começar grátis
                  <ArrowRight size={15} />
                </button>

                <small className="rf-price-foot">
                  7 dias grátis · cancele quando quiser
                </small>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* =========================================================
   CTA
   ========================================================= */

function FinalCTA() {
  return (
    <section className="rf-final-cta">
      <Noise />
      <GridLines dark />

      <div className="rf-container">
        <Reveal>
          <SectionEyebrow dark>
            AGORA É A HORA
          </SectionEyebrow>
        </Reveal>

        <Reveal delay={0.08}>
          <h2>
            Amanhã você
            <br />
            pode abrir o salão
            <br />
            <span>com agenda cheia.</span>
          </h2>
        </Reveal>

        <Reveal delay={0.16}>
          <p>
            Ou pode abrir o WhatsApp mais uma vez, responder mais uma vez e fechar o dia sem saber quanto entrou. Quem assinou a Raffros não volta atrás.
          </p>
        </Reveal>

        <Reveal delay={0.22}>
          <button
            className="rf-final-button"
            onClick={() => {
              trackEvent('click_cta_final');
              goTo("/cadastro");
            }}
          >
            Começar grátis
            <ArrowUpRight size={18} />
          </button>
        </Reveal>

        <Reveal delay={0.28}>
          <div className="rf-final-note">
            7 dias grátis
            <span />
            Sem cartão para começar
            <span />
            Cancele quando quiser
            <span />
            Leva 2 minutos para configurar
          </div>
        </Reveal>
      </div>

      <div className="rf-final-number">
        RAFFROS / 04
      </div>
    </section>
  );
}

/* =========================================================
   FAQ
   ========================================================= */

function FAQSection() {
  const [active, setActive] = useState<number | null>(null);

  return (
    <section id="faq" className="rf-faq">
      <div className="rf-container rf-faq-grid">
        <div className="rf-faq-intro">
          <Reveal>
            <SectionEyebrow>
              DÚVIDAS FREQUENTES
            </SectionEyebrow>
          </Reveal>

          <Reveal delay={0.08}>
            <h2>
              Dúvidas rápidas
              <br />
              antes de
              <br />
              começar.
            </h2>
          </Reveal>
        </div>

        <div className="rf-faq-list">
          {faqs.map((faq, index) => {
            const isOpen = active === index;

            return (
              <Reveal
                key={faq.question}
                delay={index * 0.04}
              >
                <div
                  className={`rf-faq-item ${isOpen ? "open" : ""
                    }`}
                >
                  <button
                    onClick={() =>
                      setActive(
                        isOpen ? null : index
                      )
                    }
                  >
                    <span>{faq.question}</span>

                    <motion.div
                      animate={{
                        rotate: isOpen ? 180 : 0,
                      }}
                    >
                      <ChevronDown size={18} />
                    </motion.div>
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{
                          height: 0,
                          opacity: 0,
                        }}
                        animate={{
                          height: "auto",
                          opacity: 1,
                        }}
                        exit={{
                          height: 0,
                          opacity: 0,
                        }}
                        transition={{
                          duration: 0.3,
                          ease: "easeOut",
                        }}
                        className="rf-faq-answer-wrap"
                      >
                        <p>{faq.answer}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* =========================================================
   FOOTER
   ========================================================= */

function Footer() {
  return (
    <footer className="rf-footer">
      <div className="rf-container">
        <div className="rf-footer-top">
          <div>
            <a
              href="#inicio"
              className="rf-footer-logo rf-footer-logo-img"
              aria-label="Raffros — voltar ao início"
            >
              <img src="/logo.svg" alt="Raffros" />
            </a>

            <p>
              A operação do seu negócio
              <br />
              de beleza, finalmente em ordem.
            </p>
          </div>

          <div className="rf-footer-links">
            <div>
              <small>PRODUTO</small>

              <a href="#produto">Visão geral</a>
              <a href="#como-funciona">Como funciona</a>
              <a href="#gestao">Gestão</a>
              <a href="#para-quem">Para quem</a>
            </div>

            <div>
              <small>EMPRESA</small>

              <a href="#como-funciona">
                Como funciona
              </a>
              <a href="#para-quem">
                Para quem
              </a>
              <a href="#planos">Planos</a>
              <a href="#faq">Dúvidas</a>
            </div>

            <div>
              <small>CONTA</small>

              <button
                onClick={() => goTo("/login")}
              >
                Entrar
              </button>

              <button
                onClick={() => {
                  trackEvent('click_cta_footer');
                  goTo("/cadastro");
                }}
              >
                Começar grátis
              </button>
            </div>
          </div>
        </div>

        <div className="rf-footer-bottom">
          <span>
            © {new Date().getFullYear()} Raffros.
            Todos os direitos reservados.
          </span>

          <div>
            <a href="#inicio">Privacidade</a>
            <a href="#inicio">Termos</a>
          </div>

          <span>BR / PT-BR</span>
        </div>
      </div>
    </footer>
  );
}

/* =========================================================
   MAIN
   ========================================================= */

export default function LandingPage() {
  usePageTracking();
  useAttentionTracker();
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  return (
    <>
      <motion.div
        style={{
          scaleX,
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: "3px",
          transformOrigin: "0%",
          backgroundColor: "#FC761D",
          zIndex: 999999,
        }}
      />
      <Header />
      <style>{`
        /* =====================================================
           RAFFROS DESIGN SYSTEM
           ===================================================== */

        :root {
          --rf-black: #0F172E;
          --rf-black-2: #141D38;
          --rf-black-3: #1B2645;

          --rf-white: #ffffff;
          --rf-paper: #FAF9F7;
          --rf-paper-2: #F3F1ED;

          --rf-text: #1A1F2E;
          --rf-muted: #6B7280;
          --rf-muted-dark: #9a9a95;

          --rf-line: rgba(16,16,16,.10);
          --rf-line-dark: rgba(255,255,255,.11);

          --rf-accent: #FC761D;
          --rf-accent-on-dark: #FF8738;
          --rf-accent-dark: #E45E0B;

          --rf-max: 1240px;

          --rf-ease: cubic-bezier(.22,1,.36,1);
        }

        * {
          box-sizing: border-box;
        }

        html {
          scroll-behavior: smooth;
          scroll-padding-top: 84px;
        }

        section[id] {
          scroll-margin-top: 84px;
        }

        body {
          margin: 0;
          padding: 0;
          background: var(--rf-paper);
          color: var(--rf-text);
          font-family:
            Inter,
            -apple-system,
            BlinkMacSystemFont,
            "SF Pro Display",
            "SF Pro Text",
            "Helvetica Neue",
            Arial,
            sans-serif;
          -webkit-font-smoothing: antialiased;
          text-rendering: optimizeLegibility;
        }

        body,
        button,
        input,
        textarea,
        select {
          font-family: inherit;
        }

        button,
        a {
          -webkit-tap-highlight-color: transparent;
        }

        button {
          border: 0;
          cursor: pointer;
        }

        a {
          color: inherit;
          text-decoration: none;
        }

        ::selection {
          color: var(--rf-black);
          background: var(--rf-accent);
        }

        /* =====================================================
           BASE
           ===================================================== */

        .rf-container {
          width: min(
            calc(100% - 64px),
            var(--rf-max)
          );
          margin: 0 auto;
          position: relative;
          z-index: 2;
        }

        .rf-noise {
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: .035;
          z-index: 1;
          background-image:
            url("data:image/svg+xml,%3Csvg viewBox='0 0 160 160' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.8'/%3E%3C/svg%3E");
        }

        .rf-grid-lines {
          position: absolute;
          inset: 0;
          pointer-events: none;
          overflow: hidden;
          opacity: .65;
        }

        .rf-grid-lines span {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 1px;
          background: rgba(0,0,0,.045);
        }

        .rf-grid-lines span:nth-child(1) {
          left: 8%;
        }

        .rf-grid-lines span:nth-child(2) {
          left: 30%;
        }

        .rf-grid-lines span:nth-child(3) {
          left: 50%;
        }

        .rf-grid-lines span:nth-child(4) {
          left: 70%;
        }

        .rf-grid-lines span:nth-child(5) {
          left: 92%;
        }

        .rf-grid-lines-dark span {
          background: rgba(255,255,255,.055);
        }

        .rf-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          color: #777771;
          font-size: 9px;
          line-height: 1;
          letter-spacing: .18em;
          font-weight: 700;
          text-transform: uppercase;
        }

        .rf-eyebrow-dark {
          color: #9d9d98;
        }

        .rf-eyebrow-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--rf-accent);
          flex: 0 0 auto;
          box-shadow: 0 0 16px rgba(252,118,29,.45);
        }

        /* =====================================================
           HEADER
           ===================================================== */

        .rf-header {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 99999;
          height: 64px;

          display: flex;
          align-items: center;
          justify-content: space-between;

          width: 100%;
          max-width: 100%;
          padding: 0 24px;
          box-sizing: border-box;
          margin: 0;

          background: transparent;
          border-bottom: 1px solid transparent;
          transform: none;

          transition:
            transform .3s cubic-bezier(.16,1,.3,1),
            background .3s ease,
            backdrop-filter .3s ease,
            border-color .3s ease,
            box-shadow .3s ease;
        }

        .rf-header-scrolled {
          background: rgba(10,10,10,.65);
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
          border-bottom: 1px solid rgba(255,255,255,.1);
          box-shadow: 0 8px 32px rgba(0,0,0,.35);
          transform: none;
        }

        .rf-header-hidden {
          transform: translateY(-100%) !important;
        }

        .rf-logo {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: white;
          font-size: 16px;
          font-weight: 700;
          letter-spacing: -.045em;
        }

        .rf-header:not(.rf-header-dark) .rf-logo {
          color: var(--rf-black);
        }

        .rf-logo i,
        .rf-footer-logo i {
          color: var(--rf-accent);
          font-style: normal;
        }

        .rf-logo-mark {
          width: 22px;
          height: 22px;
          display: grid;
          place-items: center;
          border-radius: 6px;
          background: white;
          color: black;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: -.05em;
        }

        .rf-header:not(.rf-header-dark) .rf-logo-mark {
          background: var(--rf-black);
          color: white;
        }

        .rf-desktop-nav {
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          gap: 29px;
        }

        .rf-desktop-nav a {
          color: rgba(255,255,255,.56);
          font-size: 10px;
          font-weight: 500;
          letter-spacing: .01em;
          transition: color .2s ease;
        }

        .rf-header:not(.rf-header-dark) .rf-desktop-nav a {
          color: #73736f;
        }

        .rf-desktop-nav a:hover {
          color: white;
        }

        .rf-header:not(.rf-header-dark)
        .rf-desktop-nav a:hover {
          color: black;
        }

        .rf-header-actions {
          display: flex;
          align-items: center;
          gap: 15px;
        }

        .rf-login {
          color: rgba(255,255,255,.72);
          background: transparent;
          font-size: 10px;
          font-weight: 600;
        }

        .rf-header:not(.rf-header-dark) .rf-login {
          color: #4e4e4a;
        }

        .rf-header-cta {
          height: 34px;
          padding: 0 14px;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          border-radius: 999px;
          color: #080808;
          background: var(--rf-accent);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: -.01em;
          box-shadow:
            0 0 0 1px rgba(252,118,29,.15),
            0 5px 25px rgba(252,118,29,.10);
          transition:
            transform .2s ease,
            box-shadow .2s ease;
        }

        .rf-header-cta:hover {
          transform: translateY(-1px);
          box-shadow:
            0 0 0 1px rgba(252,118,29,.25),
            0 8px 32px rgba(252,118,29,.18);
        }

        .rf-mobile-menu {
          display: none;
          color: white;
          background: transparent;
        }

        .rf-header:not(.rf-header-dark) .rf-mobile-menu {
          color: black;
        }

        .rf-mobile-nav {
          display: none;
        }

        /* =====================================================
           HERO
           ===================================================== */

        .rf-hero {
          position: relative;
          min-height: 820px;
          height: min(960px, 100svh);
          overflow: hidden;
          background:
            radial-gradient(
              circle at 70% 46%,
              rgba(0,127,189,.06),
              transparent 26%
            ),
            var(--rf-black);
          color: white;
        }

        .rf-hero-orb {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
          filter: blur(1px);
        }

        .rf-hero-orb-one {
          width: 420px;
          height: 420px;
          right: 10%;
          top: 25%;
          background:
            radial-gradient(
              circle,
              rgba(0,127,189,.08),
              transparent 68%
            );
        }

        .rf-hero-orb-two {
          width: 650px;
          height: 650px;
          left: 48%;
          top: 3%;
          background:
            radial-gradient(
              circle,
              rgba(255,255,255,.018),
              transparent 70%
            );
        }

        .rf-hero-container {
          min-height: 820px;
          height: 100%;
          display: grid;
          grid-template-columns:
            minmax(0, 1fr)
            minmax(420px, .9fr);
          align-items: center;
          gap: 40px;
          padding-top: 62px;
        }

        .rf-hero-copy {
          position: relative;
          z-index: 4;
          padding-top: 25px;
        }

        .rf-hero-mobile-br {
          display: none;
        }

        .rf-hero h1 {
          margin: 25px 0 22px;
          max-width: 680px;
          font-size: clamp(
            54px,
            5.8vw,
            84px
          );
          line-height: .93;
          letter-spacing: -.065em;
          font-weight: 750;
        }

        .rf-hero h1 span {
          color: var(--rf-accent);
        }

        .rf-hero-description {
          max-width: 510px;
          margin: 0;
          color: rgba(255,255,255,.53);
          font-size: 14px;
          line-height: 1.6;
          letter-spacing: -.01em;
        }

        .rf-hero-actions {
          display: flex;
          align-items: center;
          gap: 11px;
          margin-top: 27px;
        }

        .rf-primary-button {
          height: 45px;
          padding: 0 18px;
          display: inline-flex;
          align-items: center;
          gap: 9px;
          border-radius: 999px;
          background: var(--rf-accent);
          color: #070707;
          font-size: 11px;
          font-weight: 800;
          transition:
            transform .2s ease,
            box-shadow .2s ease;
        }

        .rf-primary-button:hover {
          transform: translateY(-2px);
          box-shadow:
            0 12px 35px rgba(252,118,29,.16);
        }

        .rf-secondary-button {
          height: 45px;
          padding: 0 17px;
          display: inline-flex;
          align-items: center;
          gap: 9px;
          border: 1px solid rgba(255,255,255,.13);
          border-radius: 999px;
          color: rgba(255,255,255,.76);
          font-size: 11px;
          font-weight: 600;
          background: rgba(255,255,255,.025);
          transition:
            background .2s ease,
            border-color .2s ease;
        }

        .rf-secondary-button:hover {
          background: rgba(255,255,255,.06);
          border-color: rgba(255,255,255,.23);
        }

        .rf-hero-trust {
          display: flex;
          align-items: center;
          gap: 22px;
          margin-top: 34px;
          padding-top: 18px;
          width: min(100%, 490px);
          border-top: 1px solid rgba(255,255,255,.10);
        }

        .rf-trust-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .rf-trust-value {
          color: var(--rf-accent);
          font-size: 14px;
          font-weight: 800;
          letter-spacing: -.02em;
        }

        .rf-trust-label {
          color: rgba(255,255,255,.34);
          font-size: 8px;
          text-transform: uppercase;
          letter-spacing: .13em;
        }

        .rf-trust-line {
          width: 1px;
          height: 28px;
          background: rgba(255,255,255,.11);
        }

        .rf-hero-product {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100%;
          position: relative;
          z-index: 3;
        }

        .rf-scroll-indicator {
          position: absolute;
          bottom: 28px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 9px;
          color: rgba(255,255,255,.27);
          font-size: 7px;
          letter-spacing: .2em;
          z-index: 5;
        }

        .rf-scroll-indicator div {
          width: 1px;
          height: 30px;
          background: linear-gradient(
            to bottom,
            rgba(255,255,255,.35),
            transparent
          );
        }

        .rf-hero-bottom-label {
          position: absolute;
          bottom: 30px;
          right: 31px;
          color: rgba(255,255,255,.17);
          font-size: 7px;
          letter-spacing: .2em;
        }

        /* =====================================================
           PHONE
           ===================================================== */

        .rf-phone-wrap {
          width: 430px;
          height: 610px;
          position: relative;
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .rf-phone-glow {
          position: absolute;
          width: 330px;
          height: 480px;
          border-radius: 50%;
          background:
            radial-gradient(
              ellipse,
              rgba(0,127,189,.12),
              transparent 67%
            );
          filter: blur(15px);
        }

        .rf-phone {
          width: 235px;
          height: 480px;
          position: relative;
          z-index: 2;
          filter:
            drop-shadow(
              0 35px 40px rgba(0,0,0,.65)
            );
        }

        .rf-phone-frame {
          width: 100%;
          height: 100%;
          padding: 7px;
          position: relative;
          border-radius: 37px;
          background:
            linear-gradient(
              145deg,
              #292929,
              #080808 35%,
              #1d1d1d
            );
          border: 1px solid rgba(255,255,255,.18);
          box-shadow:
            inset 1px 1px 1px rgba(255,255,255,.18),
            inset -1px -1px 2px rgba(0,0,0,.8);
        }

        .rf-phone-speaker {
          position: absolute;
          top: 12px;
          left: 50%;
          transform: translateX(-50%);
          width: 70px;
          height: 18px;
          border-radius: 0 0 12px 12px;
          background: #030303;
          z-index: 5;
        }

        .rf-phone-screen {
          height: 100%;
          border-radius: 31px;
          overflow: hidden;
          position: relative;
          background:
            linear-gradient(
              180deg,
              #121212,
              #090909
            );
          border: 1px solid rgba(255,255,255,.06);
        }

        .rf-phone-status {
          height: 37px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 7px 18px 0;
          color: rgba(255,255,255,.7);
          font-size: 7px;
          font-weight: 700;
        }

        .rf-phone-cover {
          height: 82px;
          margin: 0 8px;
          border-radius: 14px;
          display: grid;
          place-items: center;
          background:
            radial-gradient(
              circle at 50% 30%,
              rgba(252,118,29,.16),
              transparent 48%
            ),
            #141414;
          border: 1px solid rgba(255,255,255,.06);
        }

        .rf-brand-symbol {
          width: 39px;
          height: 39px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(0,127,189,.45);
          border-radius: 50%;
          color: var(--rf-accent);
          font-weight: 800;
          font-size: 15px;
        }

        .rf-phone-profile {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 12px 14px 7px;
        }

        .rf-avatar {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background: var(--rf-accent);
          color: black;
          font-size: 9px;
          font-weight: 900;
        }

        .rf-phone-profile div:last-child {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .rf-phone-profile strong {
          color: white;
          font-size: 8px;
        }

        .rf-phone-profile span {
          color: rgba(255,255,255,.38);
          font-size: 6px;
        }

        .rf-phone-socials {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;
          padding: 0 14px 9px;
        }

        .rf-phone-socials div {
          padding: 7px 0;
          text-align: center;
          border: 1px solid rgba(255,255,255,.07);
          border-radius: 7px;
          color: rgba(255,255,255,.55);
          font-size: 6px;
        }

        .rf-phone-info {
          margin: 0 10px;
          border: 1px solid rgba(255,255,255,.07);
          border-radius: 9px;
          overflow: hidden;
        }

        .rf-phone-info div {
          min-height: 30px;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 0 9px;
          color: rgba(255,255,255,.52);
          font-size: 6px;
        }

        .rf-phone-info div + div {
          border-top: 1px solid rgba(255,255,255,.06);
        }

        .rf-phone-info svg {
          color: var(--rf-accent);
          flex: 0 0 auto;
        }

        .rf-phone-info div svg:last-child {
          margin-left: auto;
          color: rgba(255,255,255,.3);
        }

        .rf-phone-progress {
          display: flex;
          gap: 4px;
          margin: 13px 16px 10px;
        }

        .rf-phone-progress span {
          height: 2px;
          flex: 1;
          border-radius: 4px;
          background: rgba(255,255,255,.1);
        }

        .rf-phone-progress span.active {
          background: var(--rf-accent);
        }

        .rf-phone-question {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 0 15px;
        }

        .rf-phone-question small {
          color: rgba(255,255,255,.3);
          font-size: 5px;
          letter-spacing: .16em;
        }

        .rf-phone-question strong {
          color: white;
          font-size: 12px;
          letter-spacing: -.03em;
        }

        .rf-phone-days {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 5px;
          padding: 10px 12px;
        }

        .rf-phone-days div {
          min-height: 47px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          gap: 5px;
          border: 1px solid rgba(255,255,255,.06);
          border-radius: 8px;
          background: rgba(255,255,255,.015);
        }

        .rf-phone-days small {
          color: rgba(255,255,255,.25);
          font-size: 5px;
        }

        .rf-phone-days strong {
          color: rgba(255,255,255,.68);
          font-size: 9px;
        }

        .rf-phone-days .selected {
          background: var(--rf-accent);
          border-color: var(--rf-accent);
        }

        .rf-phone-days .selected small,
        .rf-phone-days .selected strong {
          color: #070707;
        }

        .rf-phone-bottom {
          margin: 0 12px;
          padding: 9px 10px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-radius: 8px;
          background: rgba(255,255,255,.04);
          color: rgba(255,255,255,.43);
          font-size: 6px;
        }

        .rf-phone-bottom svg {
          color: var(--rf-accent);
        }

        .rf-floating-card {
          position: absolute;
          z-index: 5;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 11px;
          border: 1px solid rgba(255,255,255,.12);
          border-radius: 10px;
          background: rgba(16,16,16,.76);
          backdrop-filter: blur(14px);
          box-shadow:
            0 16px 35px rgba(0,0,0,.3);
        }

        .rf-floating-top {
          top: 108px;
          left: 12px;
        }

        .rf-floating-bottom {
          right: 4px;
          bottom: 94px;
          flex-direction: column;
          align-items: flex-start;
          gap: 3px;
        }

        .rf-floating-icon {
          width: 23px;
          height: 23px;
          display: grid;
          place-items: center;
          border-radius: 7px;
          background: rgba(252,118,29,.13);
          color: var(--rf-accent);
        }

        .rf-floating-card div:last-child,
        .rf-floating-card {
          color: rgba(255,255,255,.5);
          font-size: 6px;
        }

        .rf-floating-card strong {
          display: block;
          color: white;
          font-size: 7px;
        }

        .rf-floating-card span {
          display: block;
          color: rgba(255,255,255,.35);
        }

        /* =====================================================
           STATEMENT
           ===================================================== */

        .rf-statement {
          position: relative;
          overflow: hidden;
          padding: 170px 0 175px;
          background: var(--rf-paper);
        }

        .rf-statement-grid {
          display: grid;
          grid-template-columns: 1fr 2.15fr;
          column-gap: 80px;
          row-gap: 35px;
          align-items: start;
        }

        .rf-statement h2 {
          grid-column: 2;
          margin: -5px 0 0;
          font-size: clamp(
            48px,
            6vw,
            82px
          );
          line-height: .96;
          letter-spacing: -.065em;
          font-weight: 720;
        }

        .rf-statement h2 em {
          color: #8a8a85;
          font-style: normal;
        }

        .rf-statement p {
          grid-column: 2;
          max-width: 550px;
          margin: 5px 0 0;
          color: #777771;
          font-size: 15px;
          line-height: 1.65;
        }

        /* =====================================================
           PROBLEM
           ===================================================== */

        .rf-problem {
          position: relative;
          overflow: hidden;
          padding: 150px 0;
          background: var(--rf-black);
          color: white;
        }

        .rf-problem-heading h2 {
          margin: 25px 0 80px;
          font-size: clamp(
            55px,
            7vw,
            100px
          );
          line-height: .9;
          letter-spacing: -.07em;
          font-weight: 730;
        }

        .rf-problem-heading h2 span {
          color: var(--rf-accent);
        }

        .rf-problem-list {
          border-top: 1px solid rgba(255,255,255,.11);
        }

        .rf-problem-row {
          min-height: 150px;
          display: grid;
          grid-template-columns: 100px 1fr 1.3fr 30px;
          align-items: center;
          gap: 35px;
          border-bottom: 1px solid rgba(255,255,255,.11);
        }

        .rf-problem-number {
          color: var(--rf-accent);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: .1em;
        }

        .rf-problem-title {
          font-size: 30px;
          font-weight: 650;
          letter-spacing: -.04em;
        }

        .rf-problem-row p {
          max-width: 400px;
          margin: 0;
          color: rgba(255,255,255,.43);
          font-size: 13px;
          line-height: 1.55;
        }

        .rf-problem-row > svg {
          color: rgba(255,255,255,.3);
        }

        /* =====================================================
           BOOKING
           ===================================================== */

        .rf-booking-section {
          position: relative;
          padding: 170px 0;
          overflow: hidden;
          background: var(--rf-paper);
        }

        .rf-section-intro {
          max-width: 760px;
        }

        .rf-section-intro h2 {
          margin: 25px 0 20px;
          font-size: clamp(
            55px,
            7vw,
            100px
          );
          line-height: .91;
          letter-spacing: -.075em;
          font-weight: 730;
        }

        .rf-section-intro h2 span {
          color: #8b8b86;
        }

        .rf-section-intro > p {
          max-width: 520px;
          margin: 0;
          color: #777771;
          font-size: 15px;
          line-height: 1.65;
        }

        .rf-booking-layout {
          display: grid;
          grid-template-columns: 1.15fr .85fr;
          align-items: center;
          gap: 80px;
          margin-top: 100px;
        }

        .rf-booking-visual {
          min-height: 590px;
          display: grid;
          place-items: center;
          border-radius: 2px;
          background:
            radial-gradient(
              circle at 50% 50%,
              rgba(0,127,189,.07),
              transparent 35%
            ),
            #eaeae6;
          overflow: hidden;
        }

        .rf-booking-visual .rf-phone-wrap {
          transform: scale(1.06);
        }

        .rf-booking-details {
          display: flex;
          flex-direction: column;
          border-top: 1px solid var(--rf-line);
        }

        .rf-detail-row {
          display: grid;
          grid-template-columns: 50px 1fr;
          gap: 20px;
          padding: 30px 0;
          border-bottom: 1px solid var(--rf-line);
        }

        .rf-detail-icon {
          width: 40px;
          height: 40px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: #e9e9e5;
          color: #161616;
        }

        .rf-detail-row h3 {
          margin: 0 0 7px;
          font-size: 17px;
          letter-spacing: -.03em;
        }

        .rf-detail-row p {
          max-width: 350px;
          margin: 0;
          color: #7a7a75;
          font-size: 12px;
          line-height: 1.6;
        }

        /* =====================================================
           DASHBOARD
           ===================================================== */

        .rf-dashboard-section {
          position: relative;
          overflow: hidden;
          padding: 165px 0 125px;
          background: var(--rf-black);
          color: white;
        }

        .rf-dashboard-copy {
          display: grid;
          grid-template-columns: 1fr 2fr;
          gap: 70px;
          align-items: start;
          margin-bottom: 90px;
        }

        .rf-dashboard-copy h2 {
          margin: 0;
          font-size: clamp(
            54px,
            6.5vw,
            92px
          );
          line-height: .91;
          letter-spacing: -.07em;
          font-weight: 730;
        }

        .rf-dashboard-copy h2 span {
          color: #81817d;
        }

        .rf-dashboard-copy p {
          grid-column: 2;
          max-width: 490px;
          margin: -40px 0 0;
          color: rgba(255,255,255,.42);
          font-size: 14px;
          line-height: 1.65;
        }

        .rf-dashboard-shell {
          position: relative;
          width: 100%;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,.10);
          background: #0c0c0c;
          box-shadow:
            0 50px 120px rgba(0,0,0,.5);
        }

        .rf-dashboard-window {
          min-height: 625px;
          background: #111;
        }

        .rf-dashboard-topbar {
          height: 58px;
          display: grid;
          grid-template-columns: 180px 1fr 180px;
          align-items: center;
          padding: 0 20px;
          border-bottom: 1px solid rgba(255,255,255,.08);
        }

        .rf-dashboard-brand {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .rf-mini-logo {
          width: 23px;
          height: 23px;
          display: grid;
          place-items: center;
          border-radius: 6px;
          background: var(--rf-accent);
          color: #080808;
          font-size: 9px;
          font-weight: 900;
        }

        .rf-dashboard-brand span {
          color: white;
          font-size: 10px;
          font-weight: 700;
        }

        .rf-dashboard-date {
          text-align: center;
          color: rgba(255,255,255,.34);
          font-size: 8px;
        }

        .rf-dashboard-user {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 7px;
          color: rgba(255,255,255,.4);
        }

        .rf-dashboard-user span {
          width: 21px;
          height: 21px;
          border-radius: 50%;
          background: #272727;
        }

        .rf-dashboard-user small {
          font-size: 7px;
        }

        .rf-dashboard-body {
          display: grid;
          grid-template-columns: 165px 1fr;
          min-height: 565px;
        }

        .rf-dashboard-sidebar {
          padding: 25px 15px;
          border-right: 1px solid rgba(255,255,255,.08);
        }

        .rf-sidebar-section {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .rf-sidebar-section > small {
          margin: 0 9px 9px;
          color: rgba(255,255,255,.22);
          font-size: 6px;
          letter-spacing: .15em;
        }

        .rf-sidebar-item {
          height: 34px;
          padding: 0 9px;
          display: flex;
          align-items: center;
          gap: 9px;
          border-radius: 6px;
          color: rgba(255,255,255,.37);
          font-size: 8px;
        }

        .rf-sidebar-item.active {
          background: rgba(0,127,189,.09);
          color: var(--rf-accent);
        }

        .rf-sidebar-bottom {
          margin-top: 35px;
        }

        .rf-dashboard-main {
          padding: 28px;
          overflow: hidden;
        }

        .rf-dashboard-heading {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 22px;
        }

        .rf-dashboard-heading > div {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .rf-dashboard-heading small {
          color: rgba(255,255,255,.25);
          font-size: 6px;
          letter-spacing: .13em;
        }

        .rf-dashboard-heading h3 {
          margin: 0;
          color: white;
          font-size: 20px;
          letter-spacing: -.04em;
        }

        .rf-dashboard-heading button {
          padding: 9px 13px;
          border-radius: 6px;
          background: var(--rf-accent);
          color: #070707;
          font-size: 7px;
          font-weight: 800;
        }

        .rf-dashboard-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          margin-bottom: 10px;
        }

        .rf-dashboard-stats > div {
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          border: 1px solid rgba(255,255,255,.07);
          background: rgba(255,255,255,.018);
        }

        .rf-dashboard-stats small {
          color: rgba(255,255,255,.25);
          font-size: 6px;
          letter-spacing: .1em;
        }

        .rf-dashboard-stats strong {
          color: white;
          font-size: 21px;
          letter-spacing: -.05em;
        }

        .rf-dashboard-stats span {
          color: rgba(255,255,255,.27);
          font-size: 6px;
        }

        .rf-dashboard-content {
          display: grid;
          grid-template-columns: 1.4fr .6fr;
          gap: 10px;
        }

        .rf-agenda-card,
        .rf-summary-card {
          border: 1px solid rgba(255,255,255,.07);
          background: rgba(255,255,255,.015);
        }

        .rf-card-head {
          display: flex;
          justify-content: space-between;
          padding: 15px;
          border-bottom: 1px solid rgba(255,255,255,.07);
        }

        .rf-card-head div {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .rf-card-head small {
          color: rgba(255,255,255,.24);
          font-size: 6px;
          letter-spacing: .13em;
        }

        .rf-card-head strong {
          color: white;
          font-size: 12px;
        }

        .rf-card-head > span {
          align-self: center;
          color: var(--rf-accent);
          font-size: 7px;
        }

        .rf-appointment {
          min-height: 62px;
          display: grid;
          grid-template-columns: 38px 15px 1fr auto;
          gap: 7px;
          align-items: center;
          padding: 0 15px;
          border-bottom: 1px solid rgba(255,255,255,.05);
        }

        .rf-appointment time {
          color: rgba(255,255,255,.28);
          font-size: 7px;
        }

        .rf-appointment-line {
          height: 100%;
          display: flex;
          justify-content: center;
          position: relative;
        }

        .rf-appointment-line span {
          width: 1px;
          background: rgba(0,127,189,.3);
        }

        .rf-appointment-line span::before {
          content: "";
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%,-50%);
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--rf-accent);
        }

        .rf-appointment-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .rf-appointment-info strong {
          color: rgba(255,255,255,.82);
          font-size: 8px;
        }

        .rf-appointment-info small {
          color: rgba(255,255,255,.27);
          font-size: 6px;
        }

        .rf-appointment-status {
          color: rgba(0,127,189,.7);
          font-size: 5px;
          letter-spacing: .08em;
        }

        .rf-side-summary {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .rf-summary-card {
          padding: 15px;
        }

        .rf-summary-card > small {
          color: rgba(255,255,255,.23);
          font-size: 6px;
          letter-spacing: .13em;
        }

        .rf-professional-row {
          display: grid;
          grid-template-columns: 25px 1fr auto;
          gap: 8px;
          align-items: center;
          padding: 13px 0;
          border-bottom: 1px solid rgba(255,255,255,.05);
        }

        .rf-professional-avatar {
          width: 25px;
          height: 25px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: #252525;
          color: rgba(255,255,255,.65);
          font-size: 7px;
        }

        .rf-professional-row > div:nth-child(2) {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .rf-professional-row strong {
          color: rgba(255,255,255,.68);
          font-size: 7px;
        }

        .rf-professional-row span {
          color: rgba(255,255,255,.23);
          font-size: 5px;
        }

        .rf-professional-row b {
          color: white;
          font-size: 9px;
        }

        .rf-revenue {
          flex: 1;
        }

        .rf-revenue > strong {
          display: block;
          margin-top: 13px;
          color: white;
          font-size: 23px;
          letter-spacing: -.05em;
        }

        .rf-bars {
          height: 60px;
          margin-top: 15px;
          display: flex;
          align-items: flex-end;
          gap: 4px;
        }

        .rf-bars span {
          flex: 1;
          border-radius: 2px 2px 0 0;
          background: rgba(0,127,189,.55);
        }

        .rf-feature-strip {
          display: grid;
          grid-template-columns: repeat(4,1fr);
          border-top: 1px solid rgba(255,255,255,.1);
          margin-top: 80px;
        }

        .rf-feature-strip > div {
          min-height: 130px;
          padding: 24px 25px;
          border-right: 1px solid rgba(255,255,255,.1);
        }

        .rf-feature-strip > div:last-child {
          border-right: 0;
        }

        .rf-feature-strip span {
          display: block;
          margin-bottom: 20px;
          color: var(--rf-accent);
          font-size: 7px;
          letter-spacing: .1em;
        }

        .rf-feature-strip strong {
          display: block;
          color: white;
          font-size: 13px;
          margin-bottom: 5px;
        }

        .rf-feature-strip p {
          margin: 0;
          color: rgba(255,255,255,.3);
          font-size: 9px;
        }

        /* =====================================================
           TEAM
           ===================================================== */

        .rf-team-section {
          position: relative;
          padding: 165px 0;
          overflow: hidden;
          background: var(--rf-paper);
        }

        .rf-team-grid {
          display: grid;
          grid-template-columns: .9fr 1.1fr;
          gap: 110px;
          align-items: center;
        }

        .rf-team-copy h2 {
          margin: 26px 0 23px;
          font-size: clamp(
            55px,
            6.5vw,
            90px
          );
          line-height: .91;
          letter-spacing: -.07em;
          font-weight: 730;
        }

        .rf-team-copy h2 span {
          color: #8b8b86;
        }

        .rf-team-copy p {
          max-width: 430px;
          margin: 0;
          color: #767671;
          font-size: 14px;
          line-height: 1.65;
        }

        .rf-team-visual {
          width: 100%;
        }

        .rf-team-panel {
          border: 1px solid rgba(0,0,0,.09);
          background: #f9f9f6;
          box-shadow:
            0 30px 90px rgba(0,0,0,.07);
        }

        .rf-panel-header {
          min-height: 100px;
          padding: 22px 25px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid rgba(0,0,0,.08);
        }

        .rf-panel-header div {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .rf-panel-header small {
          color: #9b9b95;
          font-size: 7px;
          letter-spacing: .14em;
        }

        .rf-panel-header h3 {
          margin: 0;
          font-size: 19px;
          letter-spacing: -.04em;
        }

        .rf-panel-header > span {
          padding: 7px 9px;
          border-radius: 999px;
          background: rgba(252,118,29,.25);
          color: #6B3600;
          font-size: 7px;
          font-weight: 700;
        }

        .rf-team-person {
          min-height: 92px;
          display: grid;
          grid-template-columns: 40px 1fr auto 45px;
          align-items: center;
          gap: 14px;
          padding: 0 25px;
          border-bottom: 1px solid rgba(0,0,0,.07);
        }

        .rf-person-avatar {
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: #e5e5e0;
          color: #202020;
          font-size: 10px;
          font-weight: 800;
        }

        .rf-person-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .rf-person-info strong {
          font-size: 10px;
        }

        .rf-person-info span {
          color: #9a9a95;
          font-size: 7px;
        }

        .rf-person-status {
          display: flex;
          align-items: center;
          gap: 5px;
          color: #85857f;
          font-size: 7px;
        }

        .rf-person-status i {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--rf-accent-dark);
        }

        .rf-person-bookings {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 3px;
        }

        .rf-person-bookings small {
          color: #a1a19c;
          font-size: 5px;
        }

        .rf-person-bookings strong {
          font-size: 12px;
        }

        /* =====================================================
           PHILOSOPHY
           ===================================================== */

        .rf-philosophy {
          position: relative;
          overflow: hidden;
          padding: 180px 0 190px;
          background: #e9e9e5;
        }

        .rf-philosophy-label {
          margin-bottom: 32px;
          color: #8a8a84;
          font-size: 8px;
          letter-spacing: .18em;
        }

        .rf-philosophy h2 {
          max-width: 950px;
          margin: 0;
          font-size: clamp(
            60px,
            9vw,
            128px
          );
          line-height: .86;
          letter-spacing: -.08em;
          font-weight: 730;
        }

        .rf-philosophy p {
          max-width: 470px;
          margin: 55px 0 0 auto;
          color: #74746f;
          font-size: 14px;
          line-height: 1.7;
        }

        .rf-philosophy-mark {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          margin-top: 45px;
          color: #5e5e59;
          font-size: 8px;
          font-weight: 700;
          letter-spacing: .13em;
        }

        .rf-philosophy-mark svg {
          color: #C26D12;
        }

        /* =====================================================
           AUDIENCE
           ===================================================== */

        .rf-audience {
          position: relative;
          padding: 165px 0;
          background: var(--rf-paper);
        }

        .rf-audience-header h2 {
          margin: 26px 0 80px;
          font-size: clamp(
            55px,
            7vw,
            100px
          );
          line-height: .9;
          letter-spacing: -.07em;
          font-weight: 730;
        }

        .rf-audience-grid {
          display: grid;
          grid-template-columns: repeat(3,1fr);
          gap: 1px;
          background: rgba(0,0,0,.1);
          border: 1px solid rgba(0,0,0,.1);
        }

        .rf-audience-card {
          min-height: 440px;
          position: relative;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 28px;
          background: var(--rf-paper);
          transition:
            background .35s ease,
            color .35s ease;
        }

        .rf-audience-card:hover {
          background: var(--rf-black);
          color: white;
        }

        .rf-audience-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .rf-audience-top span {
          color: #9a9a95;
          font-size: 8px;
        }

        .rf-audience-top svg {
          color: #666661;
          transition: color .3s ease;
        }

        .rf-audience-card:hover
        .rf-audience-top svg {
          color: var(--rf-accent);
        }

        .rf-audience-content h3 {
          margin: 0 0 13px;
          font-size: 30px;
          letter-spacing: -.05em;
        }

        .rf-audience-content p {
          max-width: 250px;
          margin: 0;
          color: #858580;
          font-size: 12px;
          line-height: 1.6;
          transition: color .3s ease;
        }

        .rf-audience-card:hover
        .rf-audience-content p {
          color: rgba(255,255,255,.42);
        }

        .rf-audience-arrow {
          position: absolute;
          right: 27px;
          bottom: 28px;
          color: #8d8d87;
          transition:
            color .3s ease,
            transform .3s ease;
        }

        .rf-audience-card:hover
        .rf-audience-arrow {
          color: var(--rf-accent);
          transform: translate(3px,-3px);
        }

        /* =====================================================
           PRICING
           ===================================================== */

        .rf-pricing {
          position: relative;
          padding: 165px 0;
          background: var(--rf-black);
          color: white;
          overflow: hidden;
        }

        .rf-pricing-header {
          max-width: 780px;
        }

        .rf-pricing-header h2 {
          margin: 27px 0 22px;
          font-size: clamp(
            54px,
            6.5vw,
            92px
          );
          line-height: .91;
          letter-spacing: -.07em;
          font-weight: 730;
        }

        .rf-pricing-header h2 span {
          color: #777773;
        }

        .rf-pricing-header p {
          margin: 0;
          color: rgba(255,255,255,.4);
          font-size: 14px;
          line-height: 1.6;
        }

        .rf-pricing-grid {
          display: grid;
          grid-template-columns: repeat(3,1fr);
          gap: 10px;
          margin-top: 85px;
        }

        .rf-price-card {
          min-height: 530px;
          position: relative;
          display: flex;
          flex-direction: column;
          padding: 28px;
          border: 1px solid rgba(255,255,255,.1);
          background: #0b0b0b;
          transition:
            border-color .3s ease,
            transform .3s ease;
        }

        .rf-price-card:hover {
          transform: translateY(-4px);
          border-color: rgba(255,255,255,.2);
        }

        .rf-price-featured {
          background: #f2f2ee;
          color: #0a0a0a;
          border-color: #f2f2ee;
        }

        .rf-price-badge {
          position: absolute;
          top: 17px;
          right: 17px;
          padding: 6px 8px;
          border-radius: 999px;
          background: var(--rf-accent);
          color: #070707;
          font-size: 6px;
          font-weight: 900;
          letter-spacing: .08em;
        }

        .rf-price-top {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .rf-price-top > span {
          font-size: 22px;
          font-weight: 700;
          letter-spacing: -.04em;
        }

        .rf-price-top small {
          color: rgba(255,255,255,.35);
          font-size: 9px;
        }

        .rf-price-featured
        .rf-price-top small {
          color: #7d7d77;
        }

        .rf-price-value {
          display: flex;
          align-items: flex-end;
          gap: 4px;
          margin-top: 55px;
        }

        .rf-price-value small {
          padding-bottom: 8px;
          color: rgba(255,255,255,.35);
          font-size: 9px;
        }

        .rf-price-value strong {
          font-size: 58px;
          line-height: .85;
          letter-spacing: -.08em;
          font-weight: 700;
        }

        .rf-price-value span {
          padding-bottom: 5px;
          color: rgba(255,255,255,.3);
          font-size: 8px;
        }

        .rf-price-featured
        .rf-price-value small,
        .rf-price-featured
        .rf-price-value span {
          color: #888883;
        }

        .rf-price-divider {
          height: 1px;
          margin: 32px 0 24px;
          background: rgba(255,255,255,.1);
        }

        .rf-price-featured .rf-price-divider {
          background: rgba(0,0,0,.1);
        }

        .rf-price-features {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .rf-price-features div {
          display: flex;
          align-items: center;
          gap: 9px;
          color: rgba(255,255,255,.56);
          font-size: 10px;
        }

        .rf-price-featured
        .rf-price-features div {
          color: #4f4f4b;
        }

        .rf-price-features svg {
          color: var(--rf-accent);
        }

        .rf-price-button {
          width: 100%;
          height: 45px;
          margin-top: auto;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: 1px solid rgba(255,255,255,.16);
          border-radius: 999px;
          background: transparent;
          color: white;
          font-size: 9px;
          font-weight: 700;
          transition: .2s ease;
        }

        .rf-price-button:hover {
          background: white;
          color: black;
        }

        .rf-price-button.featured {
          border-color: #080808;
          background: #080808;
          color: white;
        }

        .rf-price-button.featured:hover {
          background: var(--rf-accent);
          border-color: var(--rf-accent);
          color: black;
        }

        .rf-price-foot {
          display: block;
          margin-top: 12px;
          text-align: center;
          color: rgba(255,255,255,.22);
          font-size: 7px;
        }

        .rf-price-featured
        .rf-price-foot {
          color: #888883;
        }

        /* =====================================================
           FINAL CTA
           ===================================================== */

        .rf-final-cta {
          position: relative;
          overflow: hidden;
          padding: 190px 0 175px;
          background:
            radial-gradient(
              circle at 50% 50%,
              rgba(0,127,189,.07),
              transparent 30%
            ),
            var(--rf-black);
          color: white;
          text-align: center;
        }

        .rf-final-cta .rf-container {
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .rf-final-cta h2 {
          margin: 28px 0 22px;
          font-size: clamp(
            60px,
            9vw,
            128px
          );
          line-height: .86;
          letter-spacing: -.08em;
          font-weight: 730;
        }

        .rf-final-cta h2 span {
          color: var(--rf-accent);
        }

        .rf-final-cta p {
          margin: 0;
          color: rgba(255,255,255,.4);
          font-size: 14px;
        }

        .rf-final-button {
          height: 53px;
          margin-top: 32px;
          padding: 0 22px;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          border-radius: 999px;
          background: var(--rf-accent);
          color: #050505;
          font-size: 11px;
          font-weight: 850;
          transition:
            transform .2s ease,
            box-shadow .2s ease;
        }

        .rf-final-button:hover {
          transform: translateY(-2px);
          box-shadow:
            0 15px 50px rgba(252,118,29,.18);
        }

        .rf-final-note {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 22px;
          color: rgba(255,255,255,.25);
          font-size: 7px;
          letter-spacing: .04em;
        }

        .rf-final-note span {
          width: 3px;
          height: 3px;
          border-radius: 50%;
          background: rgba(255,255,255,.2);
        }

        .rf-final-number {
          position: absolute;
          bottom: 30px;
          right: 31px;
          color: rgba(255,255,255,.15);
          font-size: 7px;
          letter-spacing: .2em;
        }

        /* =====================================================
           FAQ
           ===================================================== */

        .rf-faq {
          position: relative;
          padding: 160px 0;
          background: var(--rf-paper);
        }

        .rf-faq-grid {
          display: grid;
          grid-template-columns: .75fr 1.25fr;
          gap: 100px;
        }

        .rf-faq-intro h2 {
          margin: 26px 0 0;
          font-size: clamp(
            54px,
            6vw,
            82px
          );
          line-height: .91;
          letter-spacing: -.07em;
          font-weight: 730;
        }

        .rf-faq-list {
          border-top: 1px solid var(--rf-line);
        }

        .rf-faq-item {
          border-bottom: 1px solid var(--rf-line);
        }

        .rf-faq-item button {
          width: 100%;
          min-height: 85px;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 25px;
          background: transparent;
          color: var(--rf-text);
          text-align: left;
          font-size: 15px;
          font-weight: 600;
          letter-spacing: -.025em;
        }

        .rf-faq-item button svg {
          color: #858580;
          flex: 0 0 auto;
        }

        .rf-faq-answer-wrap {
          overflow: hidden;
        }

        .rf-faq-answer-wrap p {
          max-width: 650px;
          margin: -2px 0 25px;
          color: #7a7a75;
          font-size: 12px;
          line-height: 1.7;
        }

        /* =====================================================
           FOOTER
           ===================================================== */

        .rf-footer {
          padding: 80px 0 30px;
          background: #e8e8e4;
          color: var(--rf-text);
        }

        .rf-footer-top {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 100px;
          padding-bottom: 80px;
        }

        .rf-footer-logo {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 19px;
          font-weight: 750;
          letter-spacing: -.05em;
        }

        .rf-footer-logo .rf-logo-mark {
          background: var(--rf-black);
          color: white;
        }

        .rf-footer-top > div:first-child p {
          margin: 25px 0 0;
          color: #858580;
          font-size: 12px;
          line-height: 1.6;
        }

        .rf-footer-links {
          display: grid;
          grid-template-columns: repeat(3,1fr);
          gap: 30px;
        }

        .rf-footer-links > div {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 11px;
        }

        .rf-footer-links small {
          margin-bottom: 8px;
          color: #9a9a95;
          font-size: 7px;
          letter-spacing: .15em;
        }

        .rf-footer-links a,
        .rf-footer-links button {
          padding: 0;
          background: transparent;
          color: #555550;
          font-size: 9px;
          text-align: left;
          transition: color .2s ease;
        }

        .rf-footer-links a:hover,
        .rf-footer-links button:hover {
          color: black;
        }

        .rf-footer-bottom {
          min-height: 55px;
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 20px;
          padding-top: 20px;
          border-top: 1px solid rgba(0,0,0,.09);
          color: #999994;
          font-size: 7px;
        }

        .rf-footer-bottom > div {
          display: flex;
          gap: 20px;
        }

        .rf-footer-bottom > div a:hover {
          color: black;
        }

        .rf-footer-bottom > span:last-child {
          text-align: right;
        }

        /* =====================================================
           RESPONSIVE
           ===================================================== */

        @media (max-width: 1100px) {
          .rf-hero-container {
            grid-template-columns: 1fr .8fr;
          }

          .rf-hero h1 {
            font-size: clamp(
              52px,
              6vw,
              72px
            );
          }

          .rf-phone-wrap {
            transform: scale(.9);
          }

          .rf-team-grid {
            gap: 60px;
          }

          .rf-dashboard-copy {
            grid-template-columns: 1fr 1.6fr;
          }
        }


        /* =====================================================
           REAL PRODUCT MOCKUPS
           The previous Raffros product screens are intentionally
           used as the visual source of truth.
           ===================================================== */

        .rf-real-phone-wrap {
          width: 470px;
          height: 650px;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .rf-real-phone-glow {
          position: absolute;
          width: 360px;
          height: 520px;
          border-radius: 50%;
          background:
            radial-gradient(
              ellipse,
              rgba(252,118,29,.16),
              transparent 68%
            );
          filter: blur(25px);
        }

        .rf-real-phone {
          width: min(305px, 68vw);
          position: relative;
          z-index: 2;
          filter:
            drop-shadow(0 0px 0px rgba(0,0,0,.10));
        }

        .rf-real-phone-frame {
          position: relative;
          padding: 8px;
          border-radius: 50px;
          border: 1px solid rgba(255,255,255,.18);
          background:
            linear-gradient(145deg,#2a2a2a,#080808 38%,#171717);
          box-shadow:
            inset 1px 1px 1px rgba(255,255,255,.16),
            inset -2px -2px 4px rgba(0,0,0,.85),
            0 55px 120px rgba(0,0,0,.6);
        }

        .rf-real-phone-island {
          position: absolute;
          z-index: 4;
          top: 12px;
          left: 50%;
          width: 64px;
          height: 17px;
          transform: translateX(-50%);
          border-radius: 999px;
          background: #030303;
          box-shadow: inset 0 1px 2px rgba(255,255,255,.04);
        }

        .rf-real-phone-screen {
          position: relative;
          overflow: hidden;
          border-radius: 43px;
          background: #000;
          border: 1px solid rgba(255,255,255,.06);
          aspect-ratio: 9 / 19.5;
        }

        .rf-real-phone-image {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: top center;
        }

        .rf-real-phone-shine {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            linear-gradient(
              112deg,
              rgba(255,255,255,.12),
              transparent 18%,
              transparent 68%,
              rgba(255,255,255,.025)
            );
          mix-blend-mode: screen;
        }

        .rf-real-floating-card {
          position: absolute;
          z-index: 5;
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 10px 13px;
          border: 1px solid rgba(255,255,255,.13);
          background: rgba(12,12,12,.78);
          backdrop-filter: blur(18px);
          box-shadow: 0 20px 50px rgba(0,0,0,.35);
        }

        .rf-real-floating-top {
          left: 0;
          top: 17%;
          border-radius: 10px;
        }

        .rf-real-floating-bottom {
          right: 1%;
          bottom: 17%;
          min-width: 135px;
          flex-direction: column;
          align-items: flex-start;
          gap: 3px;
          border-radius: 10px;
        }

        .rf-real-floating-check {
          width: 25px;
          height: 25px;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          border-radius: 7px;
          background: rgba(252,118,29,.13);
          color: var(--rf-accent);
        }

        .rf-real-floating-card strong {
          display: block;
          color: white;
          font-size: 8px;
          line-height: 1.3;
        }

        .rf-real-floating-card small {
          display: block;
          margin-top: 2px;
          color: rgba(255,255,255,.38);
          font-size: 6px;
          line-height: 1.3;
        }

        .rf-real-browser {
          width: 100%;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,.1);
          background: #090909;
          box-shadow: 0 50px 120px rgba(0,0,0,.5);
        }

        .rf-real-browser-top {
          height: 48px;
          display: grid;
          grid-template-columns: 120px 1fr 120px;
          align-items: center;
          padding: 0 16px;
          border-bottom: 1px solid rgba(255,255,255,.08);
          background: #0e0e0e;
          color: rgba(255,255,255,.28);
          font-family: ui-monospace,SFMono-Regular,Menlo,monospace;
          font-size: 8px;
        }

        .rf-real-browser-dots {
          display: flex;
          gap: 5px;
        }

        .rf-real-browser-dots span {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: rgba(255,255,255,.14);
        }

        .rf-real-browser-secure {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 5px;
          color: rgba(255,255,255,.24);
          font-size: 7px;
          text-transform: uppercase;
          letter-spacing: .08em;
        }

        .rf-real-browser-image-wrap {
          width: 100%;
          background: #000;
        }

        .rf-real-browser-image {
          display: block;
          width: 100%;
          height: auto;
        }

        .rf-real-gallery {
          position: relative;
          overflow: hidden;
          padding: 165px 0;
          background: #0b0b0b;
          color: white;
        }

        .rf-real-gallery-heading {
          max-width: 800px;
        }

        .rf-real-gallery-heading h2 {
          margin: 26px 0 22px;
          font-size: clamp(55px,7vw,100px);
          line-height: .9;
          letter-spacing: -.07em;
          font-weight: 730;
        }

        .rf-real-gallery-heading h2 span {
          color: rgba(255,255,255,.28);
        }

        .rf-real-gallery-heading p {
          max-width: 500px;
          margin: 0;
          color: rgba(255,255,255,.42);
          font-size: 14px;
          line-height: 1.7;
        }

        .rf-real-gallery-grid {
          display: grid;
          grid-template-columns: 1.15fr .85fr;
          gap: 10px;
          margin-top: 90px;
        }

        .rf-real-gallery-card {
          position: relative;
          min-height: 640px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,.09);
          background: #111;
          padding: 32px;
        }

        .rf-real-gallery-card.rf-gallery-main {
          grid-row: span 2;
          min-height: 760px;
          background:
            radial-gradient(circle at 75% 55%,rgba(0,127,189,.09),transparent 30%),
            #111;
        }

        .rf-real-gallery-copy {
          position: relative;
          z-index: 3;
          max-width: 350px;
        }

        .rf-real-gallery-copy > div {
          display: flex;
          align-items: center;
          gap: 13px;
        }

        .rf-real-gallery-number,
        .rf-real-gallery-label {
          font-family: ui-monospace,SFMono-Regular,Menlo,monospace;
          font-size: 8px;
          letter-spacing: .15em;
          text-transform: uppercase;
        }

        .rf-real-gallery-number {
          color: var(--rf-accent);
        }

        .rf-real-gallery-label {
          color: rgba(255,255,255,.27);
        }

        .rf-real-gallery-copy h3 {
          margin: 24px 0 10px;
          font-size: 29px;
          line-height: 1;
          letter-spacing: -.05em;
          font-weight: 650;
        }

        .rf-real-gallery-copy p {
          margin: 0;
          color: rgba(255,255,255,.38);
          font-size: 12px;
          line-height: 1.65;
        }

        .rf-real-gallery-device {
          position: absolute;
          left: 50%;
          bottom: -100px;
          width: 245px;
          transform: translateX(-50%) rotate(-4deg);
        }

        .rf-gallery-main .rf-real-gallery-device {
          width: 315px;
          bottom: -130px;
        }

        .rf-real-gallery-phone {
          position: relative;
          padding: 7px;
          border: 1px solid rgba(255,255,255,.13);
          border-radius: 42px;
          background: linear-gradient(145deg,#2a2a2a,#090909 38%,#181818);
          box-shadow: 0 60px 100px rgba(0,0,0,.7);
        }

        .rf-real-gallery-phone img {
          display: block;
          width: 100%;
          aspect-ratio: 9 / 19.5;
          object-fit: cover;
          object-position: top;
          overflow: hidden;
          border-radius: 36px;
        }

        .rf-real-gallery-island {
          position: absolute;
          z-index: 2;
          top: 10px;
          left: 50%;
          width: 54px;
          height: 13px;
          transform: translateX(-50%);
          border-radius: 999px;
          background: #030303;
        }

        .rf-real-gallery-card:not(.rf-gallery-main) .rf-real-gallery-device {
          width: 180px;
          bottom: -82px;
        }

        .rf-real-gallery-card:not(.rf-gallery-main) {
          min-height: 380px;
        }

        .rf-team-real-wrap {
          position: relative;
          width: 100%;
        }

        .rf-team-real-browser,
        .rf-finance-real-browser {
          overflow: hidden;
          border: 1px solid rgba(0,0,0,.1);
          background: #fff;
          box-shadow: 0 35px 90px rgba(0,0,0,.12);
        }

        .rf-real-browser-top-light {
          background: #f7f7f5;
          color: rgba(0,0,0,.28);
          border-bottom-color: rgba(0,0,0,.08);
        }

        .rf-real-browser-top-light .rf-real-browser-dots span {
          background: rgba(0,0,0,.13);
        }

        .rf-team-real-image,
        .rf-finance-real-image {
          display: block;
          width: 100%;
          height: auto;
        }

        .rf-team-real-badge {
          position: absolute;
          right: -20px;
          bottom: 35px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 13px 15px;
          border: 1px solid rgba(0,0,0,.08);
          background: rgba(255,255,255,.92);
          box-shadow: 0 18px 50px rgba(0,0,0,.13);
          backdrop-filter: blur(15px);
        }

        .rf-team-real-badge > span {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--rf-accent);
          box-shadow: 0 0 14px rgba(252,118,29,.35);
        }

        .rf-team-real-badge strong,
        .rf-team-real-badge small {
          display: block;
        }

        .rf-team-real-badge strong {
          font-size: 9px;
          letter-spacing: -.01em;
        }

        .rf-team-real-badge small {
          margin-top: 3px;
          color: rgba(0,0,0,.4);
          font-size: 7px;
        }

        .rf-finance-real {
          padding: 165px 0;
          background: #f2f2f0;
        }

        .rf-finance-real-heading {
          display: grid;
          grid-template-columns: 1fr 1.5fr;
          column-gap: 80px;
          align-items: end;
        }

        .rf-finance-real-heading h2 {
          grid-column: 2;
          margin: 26px 0 20px;
          font-size: clamp(55px,7vw,100px);
          line-height: .9;
          letter-spacing: -.07em;
          font-weight: 730;
          color: #101010;
        }

        .rf-finance-real-heading h2 span {
          color: rgba(0,0,0,.2);
        }

        .rf-finance-real-heading p {
          grid-column: 2;
          max-width: 470px;
          margin: 0 0 80px;
          color: rgba(0,0,0,.42);
          font-size: 14px;
          line-height: 1.7;
        }

        .rf-finance-real-browser {
          margin-top: 15px;
        }

        .rf-payment-real {
          padding: 170px 0;
          overflow: hidden;
          background: #050505;
          color: white;
        }

        .rf-payment-real-grid {
          display: grid;
          grid-template-columns: 1.05fr .95fr;
          gap: 100px;
          align-items: center;
        }

        .rf-payment-real-grid h2 {
          margin: 26px 0 20px;
          font-size: clamp(55px,7vw,95px);
          line-height: .9;
          letter-spacing: -.07em;
          font-weight: 730;
        }

        .rf-payment-real-grid h2 span {
          color: rgba(255,255,255,.25);
        }

        .rf-payment-real-grid > div:last-child > p {
          max-width: 460px;
          margin: 0;
          color: rgba(255,255,255,.42);
          font-size: 14px;
          line-height: 1.7;
        }

        .rf-payment-real-devices {
          position: relative;
          min-height: 610px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .rf-payment-device {
          position: relative;
          width: 245px;
          padding: 7px;
          border: 1px solid rgba(255,255,255,.13);
          border-radius: 43px;
          background: linear-gradient(145deg,#2a2a2a,#080808 40%,#171717);
          box-shadow: 0 55px 110px rgba(0,0,0,.7);
        }

        .rf-payment-device img,
        .rf-domicilio-phone img,
        .rf-theme-phone-frame img {
          display: block;
          width: 100%;
          height: auto;
          border-radius: 36px;
          object-fit: cover;
          object-position: top;
        }

        .rf-payment-device-back {
          margin-left: -105px;
          transform: perspective(1200px) rotateY(-9deg) translateY(50px) scale(.88);
          opacity: .62;
        }

        .rf-payment-device-front {
          z-index: 2;
          margin-left: -45px;
          transform: perspective(1200px) rotateY(7deg) rotateZ(-2deg);
        }

        .rf-payment-tag {
          position: absolute;
          right: 7%;
          bottom: 18%;
          z-index: 4;
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 9px 12px;
          border: 1px solid rgba(252,118,29,.28);
          background: rgba(252,118,29,.1);
          color: #ffb45c;
          font-family: ui-monospace,SFMono-Regular,Menlo,monospace;
          font-size: 8px;
          text-transform: uppercase;
          letter-spacing: .08em;
        }

        .rf-payment-real-list {
          margin-top: 40px;
          border-top: 1px solid rgba(255,255,255,.08);
        }

        .rf-payment-real-list div {
          display: grid;
          grid-template-columns: 35px 1fr;
          align-items: center;
          min-height: 57px;
          border-bottom: 1px solid rgba(255,255,255,.08);
        }

        .rf-payment-real-list span {
          color: rgba(255,255,255,.25);
          font-family: ui-monospace,SFMono-Regular,Menlo,monospace;
          font-size: 9px;
        }

        .rf-payment-real-list strong {
          color: rgba(255,255,255,.56);
          font-size: 12px;
          font-weight: 500;
        }

        .rf-domicilio-real {
          padding: 170px 0;
          background: #fff;
          overflow: hidden;
        }

        .rf-domicilio-real-grid {
          display: grid;
          grid-template-columns: .9fr 1.1fr;
          gap: 90px;
          align-items: center;
        }

        .rf-domicilio-real-grid h2 {
          margin: 26px 0 20px;
          color: #101010;
          font-size: clamp(55px,7vw,100px);
          line-height: .9;
          letter-spacing: -.07em;
          font-weight: 730;
        }

        .rf-domicilio-real-grid h2 span {
          color: rgba(0,0,0,.2);
        }

        .rf-domicilio-real-grid > div:first-child > p {
          max-width: 470px;
          margin: 0;
          color: rgba(0,0,0,.43);
          font-size: 14px;
          line-height: 1.7;
        }

        .rf-domicilio-real-points {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-top: 38px;
          max-width: 480px;
        }

        .rf-domicilio-real-points div {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 13px 0;
          border-top: 1px solid rgba(0,0,0,.08);
          color: rgba(0,0,0,.5);
          font-size: 11px;
        }

        .rf-domicilio-real-points svg {
          color: #9a9a95;
          flex: 0 0 auto;
        }

        .rf-domicilio-real-device {
          position: relative;
          min-height: 620px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .rf-domicilio-real-ring {
          position: absolute;
          border: 1px solid rgba(0,0,0,.07);
          border-radius: 50%;
        }

        .rf-domicilio-real-ring.ring-one {
          width: 540px;
          height: 540px;
        }

        .rf-domicilio-real-ring.ring-two {
          width: 390px;
          height: 390px;
        }

        .rf-domicilio-real-ring.ring-three {
          width: 230px;
          height: 230px;
        }

        .rf-domicilio-phone {
          position: relative;
          z-index: 2;
          width: 255px;
          padding: 7px;
          border: 1px solid rgba(0,0,0,.12);
          border-radius: 45px;
          background: linear-gradient(145deg,#2b2b2b,#090909 42%,#181818);
          box-shadow: 0 55px 100px rgba(0,0,0,.3);
          transform: perspective(1200px) rotateY(-8deg) rotateX(2deg);
        }

        .rf-domicilio-location {
          position: absolute;
          right: 2%;
          bottom: 18%;
          z-index: 3;
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 10px 12px;
          border: 1px solid rgba(0,0,0,.09);
          background: rgba(255,255,255,.92);
          box-shadow: 0 20px 50px rgba(0,0,0,.1);
          color: rgba(0,0,0,.5);
          font-family: ui-monospace,SFMono-Regular,Menlo,monospace;
          font-size: 8px;
          text-transform: uppercase;
          letter-spacing: .08em;
        }

        .rf-personalization-real {
          padding: 165px 0 150px;
          background: #f4f4f2;
          overflow: hidden;
        }

        .rf-personalization-real-heading {
          text-align: center;
        }

        .rf-personalization-real-heading h2 {
          margin: 26px 0 20px;
          color: #101010;
          font-size: clamp(55px,7vw,100px);
          line-height: .9;
          letter-spacing: -.07em;
          font-weight: 730;
        }

        .rf-personalization-real-heading h2 span {
          color: rgba(0,0,0,.2);
        }

        .rf-personalization-real-heading p {
          max-width: 480px;
          margin: 0 auto;
          color: rgba(0,0,0,.42);
          font-size: 14px;
          line-height: 1.7;
        }

        .rf-theme-stage {
          position: relative;
          height: 580px;
          max-width: 850px;
          margin: 90px auto 0;
        }

        .rf-theme-phone {
          position: absolute;
          width: 210px;
        }

        .rf-theme-phone-frame {
          position: relative;
          padding: 7px;
          border: 1px solid rgba(0,0,0,.14);
          border-radius: 44px;
          background: linear-gradient(145deg,#2b2b2b,#090909 42%,#181818);
          box-shadow: 0 55px 100px rgba(0,0,0,.2);
        }

        .rf-theme-phone-frame img {
          aspect-ratio: 9 / 19.5;
        }

        .rf-theme-phone-left {
          left: 7%;
          top: 65px;
          transform: rotate(-7deg);
        }

        .rf-theme-phone-center {
          left: 50%;
          top: 0;
          z-index: 3;
          width: 260px;
          transform: translateX(-50%);
        }

        .rf-theme-phone-right {
          right: 7%;
          top: 65px;
          transform: rotate(7deg);
        }

        .rf-theme-label {
          position: absolute;
          left: 50%;
          bottom: -35px;
          transform: translateX(-50%);
          white-space: nowrap;
          padding: 8px 13px;
          border: 1px solid rgba(0,0,0,.09);
          background: rgba(255,255,255,.9);
          color: rgba(0,0,0,.42);
          font-family: ui-monospace,SFMono-Regular,Menlo,monospace;
          font-size: 8px;
          text-transform: uppercase;
          letter-spacing: .12em;
        }

        /* Real mockup responsive behavior */
        @media (max-width: 1000px) {
          .rf-real-gallery-grid {
            grid-template-columns: 1fr;
          }

          .rf-real-gallery-card.rf-gallery-main {
            grid-row: auto;
          }

          .rf-finance-real-heading {
            grid-template-columns: 1fr;
          }

          .rf-finance-real-heading h2,
          .rf-finance-real-heading p {
            grid-column: 1;
          }

          .rf-finance-real-heading p {
            margin-bottom: 50px;
          }

          .rf-payment-real-grid,
          .rf-domicilio-real-grid {
            grid-template-columns: 1fr;
          }

          .rf-team-real-badge {
            right: 15px;
          }
        }

        @media (max-width: 900px) {
          .rf-container {
            width: min(
              calc(100% - 40px),
              var(--rf-max)
            );
          }

          .rf-header {
            width: 100%;
          }

          .rf-desktop-nav,
          .rf-header-actions {
            display: none;
          }

          .rf-mobile-menu {
            display: block;
          }

          .rf-mobile-nav {
            position: fixed;
            top: 76px;
            left: 20px;
            right: 20px;
            z-index: 99;
            display: flex;
            flex-direction: column;
            padding: 18px;
            border: 1px solid rgba(255,255,255,.1);
            border-radius: 16px;
            background: rgba(12,12,12,.95);
            backdrop-filter: blur(20px);
            box-shadow: 0 30px 70px rgba(0,0,0,.35);
          }

          .rf-mobile-nav > a {
            min-height: 48px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid rgba(255,255,255,.08);
            color: white;
            font-size: 12px;
          }

          .rf-mobile-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            margin-top: 15px;
          }

          .rf-mobile-actions button {
            height: 42px;
            border-radius: 999px;
            background: rgba(255,255,255,.08);
            color: white;
            font-size: 10px;
            font-weight: 700;
          }

          .rf-mobile-actions button.primary {
            background: var(--rf-accent);
            color: black;
          }

          .rf-hero {
            min-height: 900px;
            height: auto;
          }

          .rf-hero-container {
            min-height: 900px;
            height: auto;
            grid-template-columns: 1fr;
            padding-top: 130px;
            padding-bottom: 100px;
          }

          .rf-hero-copy {
            padding-top: 0;
          }

          .rf-hero-product {
            min-height: 490px;
          }

          .rf-hero h1 {
            max-width: 650px;
            font-size: clamp(
              52px,
              10vw,
              78px
            );
          }

          .rf-phone-wrap {
            transform: scale(.86);
          }

          .rf-statement-grid {
            grid-template-columns: 1fr;
            gap: 25px;
          }

          .rf-statement h2,
          .rf-statement p {
            grid-column: 1;
          }

          .rf-problem-row {
            grid-template-columns: 70px 1fr 1.2fr;
          }

          .rf-problem-row > svg {
            display: none;
          }

          .rf-booking-layout,
          .rf-team-grid {
            grid-template-columns: 1fr;
          }

          .rf-booking-details {
            margin-top: 20px;
          }

          .rf-dashboard-copy {
            grid-template-columns: 1fr;
            gap: 30px;
          }

          .rf-dashboard-copy p {
            grid-column: 1;
            margin: 0;
          }

          .rf-dashboard-content {
            grid-template-columns: 1fr;
          }

          .rf-feature-strip {
            grid-template-columns: repeat(2,1fr);
          }

          .rf-feature-strip > div:nth-child(2) {
            border-right: 0;
          }

          .rf-feature-strip > div:nth-child(1),
          .rf-feature-strip > div:nth-child(2) {
            border-bottom: 1px solid rgba(255,255,255,.1);
          }

          .rf-audience-grid,
          .rf-pricing-grid {
            grid-template-columns: 1fr;
          }

          .rf-audience-card {
            min-height: 340px;
          }

          .rf-pricing-grid {
            gap: 12px;
          }

          .rf-price-card {
            min-height: 500px;
          }

          .rf-faq-grid {
            grid-template-columns: 1fr;
            gap: 70px;
          }

          .rf-footer-top {
            grid-template-columns: 1fr;
            gap: 70px;
          }
        }

        @media (max-width: 600px) {
          .rf-container {
            width: calc(100% - 32px);
          }

          .rf-header {
            width: 100%;
            height: 64px;
          }

          .rf-header-scrolled {
            width: 100%;
            top: 0;
          }

          .rf-logo {
            font-size: 15px;
          }

          .rf-hero {
            min-height: 880px;
          }

          .rf-hero-container {
            min-height: 880px;
            padding-top: 112px;
          }

          .rf-hero h1 {
            margin-top: 21px;
            font-size: clamp(
              47px,
              14vw,
              66px
            );
            line-height: .91;
          }

          .rf-hero-description {
            max-width: 390px;
            font-size: 13px;
          }

          .rf-hero-actions {
            align-items: stretch;
            flex-direction: column;
            max-width: 280px;
          }

          .rf-primary-button,
          .rf-secondary-button {
            justify-content: center;
          }

          .rf-hero-trust {
            gap: 13px;
            max-width: 100%;
          }

          .rf-trust-line {
            height: 22px;
          }

          .rf-trust-value {
            font-size: 12px;
          }

          .rf-trust-label {
            font-size: 6px;
          }

          .rf-hero-product {
            min-height: 430px;
            margin-top: -15px;
          }

          .rf-phone-wrap {
            transform: scale(.7);
          }

          .rf-floating-top {
            left: -2px;
          }

          .rf-floating-bottom {
            right: -5px;
          }

          .rf-scroll-indicator {
            display: none;
          }

          .rf-hero-bottom-label {
            display: none;
          }

          .rf-statement,
          .rf-problem,
          .rf-booking-section,
          .rf-dashboard-section,
          .rf-team-section,
          .rf-philosophy,
          .rf-audience,
          .rf-pricing,
          .rf-final-cta,
          .rf-faq {
            padding-top: 105px;
            padding-bottom: 105px;
          }

          .rf-statement h2,
          .rf-section-intro h2,
          .rf-team-copy h2,
          .rf-pricing-header h2,
          .rf-faq-intro h2 {
            font-size: 48px;
          }

          .rf-problem-heading h2,
          .rf-dashboard-copy h2 {
            font-size: 50px;
          }

          .rf-philosophy h2 {
            font-size: 58px;
          }

          .rf-final-cta h2 {
            font-size: 57px;
          }

          .rf-problem-row {
            min-height: 135px;
            grid-template-columns: 42px 1fr;
            gap: 12px;
            padding: 22px 0;
          }

          .rf-problem-title {
            font-size: 22px;
          }

          .rf-problem-row p {
            grid-column: 2;
          }

          .rf-booking-layout {
            margin-top: 65px;
            gap: 40px;
          }

          .rf-booking-visual {
            min-height: 500px;
          }

          .rf-booking-visual .rf-phone-wrap {
            transform: scale(.72);
          }

          .rf-dashboard-shell {
            overflow-x: auto;
          }

          .rf-dashboard-window {
            min-width: 760px;
          }

          .rf-dashboard-section
          .rf-container {
            overflow: hidden;
          }

          .rf-feature-strip {
            grid-template-columns: 1fr 1fr;
          }

          .rf-feature-strip > div {
            padding: 20px 14px;
          }

          .rf-team-person {
            grid-template-columns: 36px 1fr auto;
            padding: 0 15px;
          }

          .rf-person-status {
            display: none;
          }

          .rf-person-bookings {
            grid-column: 3;
          }

          .rf-philosophy p {
            margin-left: 0;
          }

          .rf-audience-card {
            min-height: 300px;
          }

          .rf-price-card {
            min-height: 490px;
          }

          .rf-final-note {
            flex-wrap: wrap;
            justify-content: center;
            max-width: 280px;
            line-height: 1.5;
          }

          .rf-footer {
            padding-top: 65px;
          }

          .rf-footer-links {
            grid-template-columns: 1fr 1fr;
          }

          .rf-footer-links > div:last-child {
            grid-column: 1 / -1;
          }

          .rf-footer-bottom {
            grid-template-columns: 1fr;
            gap: 13px;
            padding-top: 25px;
          }

          .rf-footer-bottom > div {
            order: 3;
          }

          .rf-footer-bottom > span:last-child {
            text-align: left;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          *,
          *::before,
          *::after {
            scroll-behavior: auto !important;
            animation-duration: .01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: .01ms !important;
          }
        }


          /* =====================================================
             FINAL POLISH + RESPONSIVE SYSTEM
             Mantém a linguagem visual, a paleta laranja e os
             mockups reais; corrige overflow e escala entre
             desktop, tablet e mobile.
             ===================================================== */

          html, body, #root {
            max-width: 100%;
            overflow-x: clip;
          }

          img, svg, video {
            max-width: 100%;
          }

          .rf-container {
            width: min(1240px, calc(100% - 48px));
          }

          .rf-hero,
          .rf-real-gallery,
          .rf-finance-real,
          .rf-payment-real,
          .rf-domicilio-real,
          .rf-personalization-real {
            isolation: isolate;
          }

          .rf-primary-button,
          .rf-header-cta,
          .rf-price-button,
          .rf-final-button {
            will-change: transform;
            transition: transform .25s cubic-bezier(.22,1,.36,1), box-shadow .25s ease, filter .25s ease;
          }

          .rf-primary-button:hover,
          .rf-price-button:hover,
          .rf-final-button:hover {
            transform: translateY(-2px);
            filter: brightness(1.04);
          }

          .rf-price-card {
            position: relative;
            overflow: hidden;
            transition: transform .35s cubic-bezier(.22,1,.36,1), border-color .35s ease, box-shadow .35s ease;
          }

          .rf-price-card::before {
            content: '';
            position: absolute;
            inset: 0;
            pointer-events: none;
            background: radial-gradient(circle at 85% 5%, rgba(252,118,29,.10), transparent 34%);
            opacity: 0;
            transition: opacity .35s ease;
          }

          .rf-price-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 30px 80px rgba(0,0,0,.12);
          }

          .rf-price-card:hover::before { opacity: 1; }

          .rf-audience-card,
          .rf-team-panel,
          .rf-real-gallery-card,
          .rf-summary-card,
          .rf-price-card {
            min-width: 0;
          }

          .rf-real-phone-wrap,
          .rf-theme-stage,
          .rf-payment-real-devices,
          .rf-domicilio-real-device {
            max-width: 100%;
          }

          .rf-real-phone-wrap {
            margin-inline: auto;
          }

          @media (max-width: 1100px) {
            .rf-container {
              width: min(100% - 40px, 1100px);
            }

            .rf-hero-container {
              grid-template-columns: minmax(0, 1fr) minmax(360px, .8fr);
              gap: 20px;
            }

            .rf-hero h1 {
              font-size: clamp(54px, 6.3vw, 76px);
            }

            .rf-real-gallery-grid {
              grid-template-columns: 1fr 1fr;
            }

            .rf-real-gallery-card {
              min-height: 560px;
            }

            .rf-real-gallery-card.rf-gallery-main {
              min-height: 680px;
            }

            .rf-theme-stage {
              height: 540px;
            }

            .rf-theme-phone-left { left: 2%; }
            .rf-theme-phone-right { right: 2%; }
          }

          @media (max-width: 900px) {
            .rf-container {
              width: min(100% - 40px, 760px);
            }

            .rf-desktop-nav,
            .rf-header-actions {
              display: none;
            }

            .rf-mobile-menu {
              display: grid;
              place-items: center;
              width: 40px;
              height: 40px;
              border: 1px solid rgba(255,255,255,.10);
              border-radius: 999px;
              background: rgba(255,255,255,.045);
            }

            .rf-header:not(.rf-header-dark) .rf-mobile-menu {
              border-color: rgba(0,0,0,.08);
              background: rgba(0,0,0,.035);
            }

            .rf-mobile-nav {
              left: 20px;
              right: 20px;
              max-height: calc(100svh - 92px);
              overflow: auto;
              overscroll-behavior: contain;
            }

            .rf-hero {
              min-height: 0;
              height: auto;
            }

            .rf-hero-container {
              min-height: 0;
              grid-template-columns: 1fr;
              padding-top: 128px;
              padding-bottom: 88px;
            }

            .rf-hero-copy {
              max-width: 700px;
              padding-top: 0;
            }

            .rf-hero h1 {
              max-width: 680px;
              font-size: clamp(52px, 9vw, 78px);
            }

            .rf-hero-product {
              min-height: 520px;
              display: grid;
              place-items: center;
              margin-top: 0;
            }

            .rf-phone-wrap {
              transform: scale(.84);
              transform-origin: center center;
            }

            .rf-statement-grid,
            .rf-booking-layout,
            .rf-team-grid,
            .rf-payment-real-grid,
            .rf-domicilio-real-grid {
              grid-template-columns: 1fr;
            }

            .rf-dashboard-copy {
              grid-template-columns: 1fr;
              gap: 28px;
            }

            .rf-dashboard-copy p {
              grid-column: 1;
              margin: 0;
            }

            .rf-real-gallery-grid {
              grid-template-columns: 1fr;
            }

            .rf-real-gallery-card,
            .rf-real-gallery-card.rf-gallery-main {
              min-height: 540px;
            }

            .rf-finance-real-heading {
              grid-template-columns: 1fr;
            }

            .rf-finance-real-heading h2,
            .rf-finance-real-heading p {
              grid-column: 1;
            }

            .rf-feature-strip {
              grid-template-columns: repeat(2, 1fr);
            }

            .rf-audience-grid,
            .rf-pricing-grid {
              grid-template-columns: 1fr;
            }

            .rf-faq-grid,
            .rf-footer-top {
              grid-template-columns: 1fr;
            }

            .rf-theme-stage {
              height: 500px;
              margin-top: 65px;
            }

            .rf-theme-phone {
              width: 180px;
            }

            .rf-theme-phone-center {
              width: 220px;
            }

            .rf-theme-phone-left { left: 5%; }
            .rf-theme-phone-right { right: 5%; }
          }

          @media (max-width: 680px) {
            .rf-container {
              width: calc(100% - 32px);
            }

            .rf-header {
              width: 100%;
              height: 64px;
            }

            .rf-header-scrolled {
              width: 100%;
              top: 0;
            }

            .rf-mobile-nav {
              left: 10px;
              right: 10px;
              top: 70px;
            }

            .rf-hero-container {
              padding-top: 112px;
              padding-bottom: 52px;
            }

            .rf-hero h1 {
              margin-top: 20px;
              font-size: clamp(45px, 13.8vw, 66px);
              line-height: .92;
              letter-spacing: -.065em;
            }

            .rf-hero-description {
              max-width: 430px;
              font-size: 13px;
              line-height: 1.65;
            }

            .rf-hero-actions {
              width: 100%;
              max-width: 310px;
              flex-direction: column;
              align-items: stretch;
            }

            .rf-primary-button,
            .rf-secondary-button {
              min-height: 48px;
              justify-content: center;
            }

            .rf-hero-trust {
              width: 100%;
              max-width: 340px;
              gap: 10px;
            }

            .rf-trust-item {
              min-width: 0;
            }

            .rf-trust-value { font-size: 11px; }
            .rf-trust-label { font-size: 6px; letter-spacing: .08em; }

            .rf-hero-product {
              min-height: 420px;
              margin-top: -20px;
            }

            .rf-phone-wrap {
              transform: scale(.67);
            }

            .rf-floating-top { left: 0; }
            .rf-floating-bottom { right: 0; }

            .rf-statement,
            .rf-problem,
            .rf-booking-section,
            .rf-dashboard-section,
            .rf-team-section,
            .rf-philosophy,
            .rf-audience,
            .rf-pricing,
            .rf-final-cta,
            .rf-faq,
            .rf-real-gallery,
            .rf-finance-real,
            .rf-payment-real,
            .rf-domicilio-real,
            .rf-personalization-real {
              padding-top: 82px;
              padding-bottom: 82px;
            }

            .rf-statement h2,
            .rf-section-intro h2,
            .rf-team-copy h2,
            .rf-pricing-header h2,
            .rf-faq-intro h2,
            .rf-finance-real-heading h2,
            .rf-payment-real h2,
            .rf-domicilio-real h2,
            .rf-personalization-real-heading h2 {
              font-size: clamp(39px, 11.5vw, 54px);
              line-height: .94;
            }

            .rf-problem-heading h2,
            .rf-dashboard-copy h2,
            .rf-real-gallery-heading h2 {
              font-size: clamp(42px, 12.5vw, 58px);
              line-height: .93;
            }

            .rf-philosophy h2 {
              font-size: clamp(48px, 14vw, 64px);
            }

            .rf-final-cta h2 {
              font-size: clamp(46px, 14vw, 62px);
            }

            .rf-problem-row {
              min-height: 0;
              grid-template-columns: 38px 1fr;
              gap: 12px;
              padding: 22px 0;
            }

            .rf-problem-title { font-size: 21px; }
            .rf-problem-row p { grid-column: 2; margin-top: 4px; }

            .rf-booking-layout {
              margin-top: 45px;
              gap: 20px;
            }

            .rf-booking-visual {
              min-height: 420px;
            }

            .rf-booking-visual .rf-phone-wrap {
              transform: scale(.65);
            }

            .rf-real-gallery-heading p,
            .rf-finance-real-heading p,
            .rf-payment-real p,
            .rf-domicilio-real p,
            .rf-personalization-real-heading p {
              font-size: 13px;
              line-height: 1.7;
            }

            .rf-real-gallery-grid {
              margin-top: 48px;
              gap: 8px;
            }

            .rf-real-gallery-card,
            .rf-real-gallery-card.rf-gallery-main {
              min-height: 470px;
              padding: 22px;
            }

            .rf-real-gallery-copy h3 {
              font-size: 25px;
            }

            .rf-real-phone-wrap {
              height: 480px;
            }

            .rf-real-phone {
              width: min(265px, 72vw);
            }

            .rf-real-floating-card {
              transform: scale(.88);
              transform-origin: center;
            }

            .rf-real-floating-top { left: -5px; }
            .rf-real-floating-bottom { right: -5px; }

            .rf-real-browser-top {
              grid-template-columns: 55px 1fr 55px;
              height: 42px;
              padding: 0 10px;
              font-size: 6px;
            }

            .rf-real-browser {
              border-radius: 10px;
            }

            .rf-dashboard-shell {
              width: 100%;
              max-width: 100%;
              overflow: hidden;
              border-radius: 12px;
            }

            .rf-dashboard-window {
              width: 100%;
              min-width: 0;
            }

            .rf-dashboard-topbar {
              grid-template-columns: 1fr auto;
              height: 50px;
              padding: 0 12px;
            }

            .rf-dashboard-date { display: none; }

            .rf-dashboard-body {
              grid-template-columns: 1fr;
              min-height: 0;
            }

            .rf-dashboard-sidebar { display: none; }

            .rf-dashboard-main {
              min-width: 0;
              padding: 16px;
            }

            .rf-dashboard-heading {
              gap: 10px;
              align-items: flex-start;
            }

            .rf-dashboard-heading h3 { font-size: 17px; }

            .rf-dashboard-heading button {
              white-space: nowrap;
              padding: 9px 10px;
            }

            .rf-dashboard-stats {
              grid-template-columns: repeat(3, minmax(0,1fr));
            }

            .rf-dashboard-stats > div {
              min-width: 0;
              padding: 11px 9px;
            }

            .rf-dashboard-stats strong {
              font-size: 17px;
            }

            .rf-dashboard-content {
              grid-template-columns: 1fr;
            }

            .rf-feature-strip {
              grid-template-columns: 1fr 1fr;
            }

            .rf-feature-strip > div {
              padding: 18px 12px;
            }

            .rf-team-person {
              grid-template-columns: 36px minmax(0,1fr) auto;
              padding: 0 12px;
            }

            .rf-person-status { display: none; }

            .rf-person-info { min-width: 0; }
            .rf-person-info strong {
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }

            .rf-theme-stage {
              height: 410px;
              margin-top: 50px;
            }

            .rf-theme-phone { width: 125px; }
            .rf-theme-phone-center { width: 165px; }
            .rf-theme-phone-left { left: 0; top: 55px; }
            .rf-theme-phone-right { right: 0; top: 55px; }

            .rf-theme-label {
              bottom: -25px;
              font-size: 7px;
            }

            .rf-pricing-grid {
              gap: 10px;
            }

            .rf-price-card {
              min-height: 0;
              padding: 25px 22px;
            }

            .rf-price-value strong {
              font-size: 52px;
            }

            .rf-faq-grid { gap: 48px; }

            .rf-footer-links {
              grid-template-columns: 1fr 1fr;
              gap: 30px 20px;
            }

            .rf-footer-links > div:last-child {
              grid-column: 1 / -1;
            }

            .rf-footer-bottom {
              grid-template-columns: 1fr;
              gap: 12px;
            }

            .rf-footer-bottom > div { order: 3; }
            .rf-footer-bottom > span:last-child { text-align: left; }
          }

          @media (max-width: 420px) {
            .rf-container { width: calc(100% - 24px); }

            .rf-header { width: 100%; }

            .rf-header-scrolled { width: 100%; }

            .rf-hero h1 {
              font-size: clamp(42px, 13.2vw, 55px);
            }

            .rf-hero-trust { gap: 7px; }
            .rf-trust-line { height: 18px; }

            .rf-hero-product {
              min-height: 370px;
            }

            .rf-phone-wrap { transform: scale(.58); }
            .rf-booking-visual .rf-phone-wrap { transform: scale(.56); }

            .rf-floating-top,
            .rf-floating-bottom {
              display: none;
            }

            .rf-real-gallery-card,
            .rf-real-gallery-card.rf-gallery-main {
              min-height: 430px;
              padding: 18px;
            }

            .rf-real-phone-wrap { height: 440px; }
            .rf-real-phone { width: min(245px, 70vw); }

            .rf-dashboard-main { padding: 12px; }
            .rf-dashboard-stats strong { font-size: 15px; }
            .rf-dashboard-stats span { font-size: 6px; }

            .rf-feature-strip {
              grid-template-columns: 1fr;
            }

            .rf-feature-strip > div {
              border-right: 0 !important;
              border-bottom: 1px solid rgba(255,255,255,.1);
            }

            .rf-feature-strip > div:last-child { border-bottom: 0; }

            .rf-theme-stage { height: 340px; }
            .rf-theme-phone { width: 102px; }
            .rf-theme-phone-center { width: 138px; }
            .rf-theme-phone-left { top: 50px; }
            .rf-theme-phone-right { top: 50px; }

            .rf-footer-links {
              grid-template-columns: 1fr;
            }

            .rf-footer-links > div:last-child {
              grid-column: auto;
            }
          }



          /* REFINO DOS MOCKUPS */
          .rf-real-gallery-grid { grid-template-columns: 1.08fr .92fr; gap: 12px; }
          .rf-real-gallery-card { min-height: 560px; }
          .rf-real-gallery-card.rf-gallery-main { min-height: 680px; }

          .rf-macbook-wrap { position: relative; width: 100%; max-width: 980px; margin-inline: auto; padding-bottom: 34px; }
          .rf-macbook-screen-shell { position: relative; z-index: 2; overflow: hidden; padding: 0; border: 1px solid rgba(0,0,0,.15); border-radius: 12px; background: #fff; box-shadow: 0 35px 80px rgba(0,0,0,.16); }
          .rf-macbook-browser-top { height: 38px; display: grid; grid-template-columns: 70px 1fr 70px; align-items: center; gap: 8px; padding: 0 16px; border-bottom: 1px solid rgba(0,0,0,.08); background: #f5f5f5; color: rgba(0,0,0,.4); font-size: 11px; text-align: center; }
          .rf-macbook-browser-top .rf-real-browser-dots { justify-self: start; gap: 6px; }
          .rf-macbook-browser-top .rf-real-browser-secure { justify-self: end; color: rgba(0,0,0,.4); }
          .rf-macbook-screen-image { overflow: hidden; background: #fff; }
          .rf-macbook-screen-image img { display: block; width: 100%; height: auto; }
          .rf-macbook-shadow { position: absolute; left: 5%; right: 5%; bottom: 0; height: 30px; border-radius: 50%; background: rgba(0,0,0,.15); filter: blur(20px); }

          .rf-team-real-wrap { padding-bottom: 42px; }
          .rf-team-real-badge { z-index: 4; }
          .rf-booking-visual { overflow: visible; min-height: 650px; }
          .rf-booking-visual .rf-real-phone-wrap { width: min(470px,100%); height: 650px; }

          @media (max-width: 900px) {
            .rf-booking-visual { min-height: 610px; }
            .rf-booking-visual .rf-real-phone-wrap { height: 610px; }
            .rf-macbook-wrap { max-width: 760px; padding-bottom: 28px; }
            .rf-team-real-wrap { padding-bottom: 55px; }
            .rf-team-real-badge { right: 12px; bottom: 8px; max-width: calc(100% - 24px); }
          }

          .rf-header {
            position: fixed !important;
            z-index: 99999 !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            height: 64px !important;
            border-radius: 0 !important;
            padding: 0 24px !important;
            box-sizing: border-box !important;
            margin: 0 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            transform: none !important;
            background: transparent !important;
            border-bottom: 1px solid transparent !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), background 0.3s ease, border-color 0.3s ease, backdrop-filter 0.3s ease, box-shadow 0.3s ease !important;
          }

          @media (min-width: 768px) {
            .rf-header {
              height: 72px !important;
              padding: 0 48px !important;
            }
          }

          .rf-header.rf-header-scrolled {
            background: rgba(10, 10, 10, 0.65) !important;
            backdrop-filter: blur(20px) saturate(180%) !important;
            -webkit-backdrop-filter: blur(20px) saturate(180%) !important;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35) !important;
            transform: none !important;
          }

          .rf-header.rf-header-hidden {
            transform: translateY(-100%) !important;
          }

          .rf-header .rf-logo {
            color: #ffffff !important;
            display: inline-flex !important;
            align-items: center !important;
            gap: 8px !important;
            text-decoration: none !important;
          }

          .rf-header .rf-logo img {
            height: 32px !important;
            width: auto !important;
            filter: invert(1) !important;
          }

          .rf-header .rf-desktop-nav a {
            color: rgba(255, 255, 255, 0.75) !important;
            transition: color 0.2s ease !important;
          }

          .rf-header .rf-desktop-nav a:hover {
            color: #ffffff !important;
          }

          .rf-header .rf-login {
            color: rgba(255, 255, 255, 0.85) !important;
          }

          .rf-header .rf-login:hover {
            color: #ffffff !important;
          }

          .rf-header .rf-mobile-menu {
            color: #ffffff !important;
            background: transparent !important;
            border: none !important;
            display: none !important;
            align-items: center !important;
            justify-content: center !important;
            cursor: pointer !important;
            padding: 8px !important;
            margin: 0 !important;
          }

          @media (max-width: 900px) {
            .rf-header .rf-mobile-menu {
              display: flex !important;
            }
            .rf-header .rf-desktop-nav,
            .rf-header .rf-header-actions {
              display: none !important;
            }
          }

          .rf-mobile-nav-fullscreen { position: fixed; inset: 0; background: #000; z-index: 999999; display: flex; flex-direction: column; padding: 24px 24px 40px; }
          .rf-mobile-nav-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 60px; }
          .rf-mobile-close { background: none; border: none; color: #fff; display: flex; align-items: center; justify-content: center; }
          .rf-mobile-nav-links { display: flex; flex-direction: column; gap: 24px; padding-left: 8px; }
          .rf-mobile-nav-links a { font-size: 26px; font-weight: 700; color: #fff; text-decoration: none; }
          .rf-mobile-nav-divider { width: 24px; height: 2px; background: #fff; margin: 24px 0; opacity: 0.5; }

          /* ── Spotify glassmorphism card ── */
          .rf-spotify-card {
            display: inline-flex;
            align-items: center;
            gap: 12px;
            margin-top: 14px;
            padding: 10px 16px 10px 12px;
            border-radius: 14px;
            background: rgba(255, 255, 255, 0.06);
            backdrop-filter: blur(16px) saturate(160%);
            -webkit-backdrop-filter: blur(16px) saturate(160%);
            border: 1px solid rgba(255, 255, 255, 0.1);
            text-decoration: none;
            cursor: pointer;
            transition: background 0.25s ease, border-color 0.25s ease, transform 0.25s ease, box-shadow 0.25s ease;
            max-width: fit-content;
            box-shadow: 0 4px 24px rgba(0, 0, 0, 0.25);
          }
          .rf-spotify-card:hover {
            background: rgba(29, 185, 84, 0.12);
            border-color: rgba(29, 185, 84, 0.35);
            transform: translateY(-2px);
            box-shadow: 0 8px 32px rgba(29, 185, 84, 0.18);
          }
          .rf-spotify-card-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: rgba(29, 185, 84, 0.15);
            flex-shrink: 0;
            transition: background 0.25s ease;
          }
          .rf-spotify-card:hover .rf-spotify-card-icon {
            background: rgba(29, 185, 84, 0.25);
          }
          .rf-spotify-card-text {
            display: flex;
            flex-direction: column;
            gap: 1px;
          }
          .rf-spotify-card-title {
            font-size: 13px;
            font-weight: 700;
            color: #ffffff;
            line-height: 1.2;
            letter-spacing: 0.01em;
          }
          .rf-spotify-card-sub {
            font-size: 11px;
            font-weight: 400;
            color: rgba(255, 255, 255, 0.5);
            line-height: 1.2;
          }
          .rf-spotify-card-arrow {
            display: flex;
            align-items: center;
            justify-content: center;
            margin-left: 4px;
            color: rgba(255, 255, 255, 0.35);
            transition: color 0.25s ease, transform 0.25s ease;
          }
          .rf-spotify-card:hover .rf-spotify-card-arrow {
            color: #1DB954;
            transform: translate(2px, -2px);
          }

          .rf-real-gallery-card::after { content: ''; position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.6) 30%, transparent 60%); z-index: 1; pointer-events: none; border-radius: inherit; }
          .rf-real-gallery-copy { position: relative; z-index: 10; text-shadow: 0 4px 15px rgba(0,0,0,1), 0 8px 30px rgba(0,0,0,0.8); }

          @media (max-width: 680px) {
            .rf-real-gallery-grid { grid-template-columns: 1fr; margin-top: 42px; }
            .rf-real-gallery-card, .rf-real-gallery-card.rf-gallery-main { min-height: 540px; padding: 20px; }
            .rf-real-gallery-card.rf-gallery-main { min-height: 580px; }
            .rf-real-gallery-device { bottom: 0; width: 200px; }
            .rf-gallery-main .rf-real-gallery-device { width: 240px; bottom: 0; }
            .rf-real-gallery-card:not(.rf-gallery-main) .rf-real-gallery-device { width: 180px; bottom: 0; }
            .rf-booking-visual { min-height: 550px; padding: 0; }
            .rf-booking-visual .rf-real-phone-wrap { height: 550px; transform: scale(.92); }
            .rf-macbook-wrap { width: 100%; padding-bottom: 24px; }
            .rf-macbook-screen-shell { border-radius: 8px; }
            .rf-macbook-browser-top { height: 27px; grid-template-columns: 48px 1fr 48px; padding: 0 7px; font-size: 7px; }
            .rf-macbook-browser-top .rf-real-browser-secure { font-size: 7px; }
            .rf-team-real-wrap { padding-bottom: 60px; }
            .rf-team-real-badge { left: 12px; right: 12px; bottom: 4px; justify-content: flex-start; padding: 11px 12px; }
            .rf-team-real-badge strong { font-size: 8px; }
            .rf-team-real-badge small { font-size: 6px; }
          }

          @media (max-width: 420px) {
            .rf-booking-visual { min-height: 500px; }
            .rf-booking-visual .rf-real-phone-wrap { height: 500px; transform: scale(.85); }
            .rf-real-gallery-card, .rf-real-gallery-card.rf-gallery-main { min-height: 490px; }
            .rf-gallery-main .rf-real-gallery-device { width: 210px; bottom: 0; }
            .rf-real-gallery-card:not(.rf-gallery-main) .rf-real-gallery-device { width: 160px; bottom: 0; }
            .rf-macbook-browser-top { grid-template-columns: 38px 1fr 38px; }
            .rf-team-real-badge { left: 8px; right: 8px; }
          }


          /* =====================================================
             RAFFROS — PALETA FINAL
             Laranja = ação. Azul = secundário. Neutros = base.
             Contraste claro/escuro preservado. Sem arco-íris.
             ===================================================== */

          :root {
            --rf-accent: #FC761D;
            --rf-accent-dark: #E45E0B;
            --rf-blue: #2563EB;
            --rf-blue-muted: #60A5FA;
            --rf-rose: #F472B6;
            --rf-rose-light: #FBCFE8;
            --rf-ink: #0F172A;
            --rf-muted: #475569;
            --rf-line: #E2E8F0;
            --rf-paper: #FAF9F7;
            --rf-paper-2: #F1F5F9;
            --rf-dark: #0D2F66;
            --rf-dark-2: #123F84;
            --rf-dark-card: #184D9C;
          }

          /* ── CTAs: laranja puro ── */
          .rf-primary-button,
          .rf-header-cta,
          .rf-price-button,
          .rf-final-button,
          .rf-price-button.featured {
            background: var(--rf-accent) !important;
            border-color: var(--rf-accent) !important;
            color: #FFFFFF !important;
            -webkit-text-fill-color: #FFFFFF !important;
            box-shadow: 0 8px 22px rgba(252, 118, 29, 0.22) !important;
          }
          .rf-primary-button:hover,
          .rf-header-cta:hover,
          .rf-price-button:hover,
          .rf-final-button:hover,
          .rf-price-button.featured:hover {
            background: var(--rf-accent-dark) !important;
            border-color: var(--rf-accent-dark) !important;
            box-shadow: 0 10px 28px rgba(252, 118, 29, 0.28) !important;
          }
          .rf-price-badge {
            background: var(--rf-accent) !important;
            color: #FFFFFF !important;
          }
          .rf-eyebrow-dot {
            background: var(--rf-accent) !important;
            box-shadow: 0 0 0 4px rgba(252, 118, 29, 0.14) !important;
          }

          /* ── Header: claro, legível ── */
          .rf-header {
            background: transparent !important;
            border-bottom: 1px solid transparent !important;
            box-shadow: none !important;
          }
          .rf-header.rf-header-scrolled {
            background: rgba(250, 249, 247, 0.92) !important;
            backdrop-filter: blur(18px) saturate(160%) !important;
            -webkit-backdrop-filter: blur(18px) saturate(160%) !important;
            border-bottom: 1px solid var(--rf-line) !important;
            box-shadow: 0 4px 24px rgba(15, 23, 46, 0.06) !important;
          }
          .rf-header .rf-logo,
          .rf-header.rf-header-scrolled .rf-logo {
            color: var(--rf-ink) !important;
          }
          .rf-header .rf-logo img {
            filter: none !important;
          }
          .rf-header .rf-desktop-nav a {
            color: rgba(26, 31, 46, 0.6) !important;
          }
          .rf-header .rf-desktop-nav a:hover {
            color: var(--rf-ink) !important;
          }
          .rf-header .rf-login {
            color: rgba(26, 31, 46, 0.7) !important;
          }
          .rf-header .rf-login:hover {
            color: var(--rf-ink) !important;
          }
          .rf-header .rf-mobile-menu {
            color: var(--rf-ink) !important;
            border: none !important;
            background: transparent !important;
          }

          /* ── Menu Mobile: Fundo branco limpo, detalhes em azul e destaque em laranja (#FC761D) ── */
          .rf-mobile-nav-fullscreen {
            position: fixed !important;
            inset: 0 !important;
            background: #FFFFFF !important;
            color: #0F172A !important;
            z-index: 999999 !important;
            display: flex !important;
            flex-direction: column !important;
            padding: 22px 24px 36px !important;
            overflow-y: auto !important;
            box-sizing: border-box !important;
          }

          .rf-mobile-nav-top {
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
            margin-bottom: 18px !important;
          }

          .rf-mobile-logo-link img {
            height: 28px !important;
            filter: none !important;
          }

          .rf-mobile-close {
            width: 38px !important;
            height: 38px !important;
            border-radius: 50% !important;
            background: #F1F5F9 !important;
            border: 1px solid #E2E8F0 !important;
            color: #0F172A !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            cursor: pointer !important;
            transition: background 0.15s ease !important;
          }

          .rf-mobile-close:hover {
            background: #E2E8F0 !important;
          }

          .rf-mobile-nav-eyebrow {
            display: inline-flex !important;
            align-items: center !important;
            gap: 8px !important;
            font-size: 10px !important;
            font-weight: 700 !important;
            letter-spacing: 0.14em !important;
            text-transform: uppercase !important;
            color: #64748B !important;
            margin-bottom: 20px !important;
          }

          .rf-mobile-nav-eyebrow .rf-eyebrow-dot {
            width: 6px !important;
            height: 6px !important;
            border-radius: 50% !important;
            background: var(--rf-accent) !important;
            box-shadow: 0 0 10px rgba(252, 118, 29, 0.45) !important;
          }

          .rf-mobile-nav-links {
            display: flex !important;
            flex-direction: column !important;
            gap: 4px !important;
            padding-left: 0 !important;
          }

          .rf-mobile-nav-item {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            padding: 13px 4px !important;
            font-size: 18px !important;
            font-weight: 700 !important;
            letter-spacing: -0.02em !important;
            color: #0F172A !important;
            text-decoration: none !important;
            border-bottom: 1px solid #F1F5F9 !important;
            transition: color 0.15s ease, padding-left 0.15s ease !important;
          }

          .rf-mobile-nav-item:hover,
          .rf-mobile-nav-item:active {
            color: #103875 !important;
            padding-left: 6px !important;
          }

          .rf-mobile-nav-arrow {
            color: #94A3B8 !important;
            transition: transform 0.15s ease, color 0.15s ease !important;
          }

          .rf-mobile-nav-item:hover .rf-mobile-nav-arrow {
            color: #103875 !important;
            transform: translateX(3px) !important;
          }

          .rf-mobile-nav-divider {
            height: 1px !important;
            width: 100% !important;
            background: #E2E8F0 !important;
            margin: 14px 0 12px !important;
            opacity: 1 !important;
          }

          .rf-mobile-playlist-card {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            padding: 12px 14px !important;
            border-radius: 14px !important;
            background: rgba(16, 56, 117, 0.05) !important;
            border: 1px solid rgba(16, 56, 117, 0.14) !important;
            text-decoration: none !important;
            transition: background 0.15s ease, border-color 0.15s ease !important;
            margin-bottom: 14px !important;
          }

          .rf-mobile-playlist-card:hover {
            background: rgba(16, 56, 117, 0.10) !important;
            border-color: rgba(16, 56, 117, 0.25) !important;
          }

          .rf-mobile-playlist-left {
            display: flex !important;
            align-items: center !important;
            gap: 12px !important;
          }

          .rf-mobile-playlist-icon {
            width: 36px !important;
            height: 36px !important;
            border-radius: 10px !important;
            background: #FFFFFF !important;
            border: 1px solid #E2E8F0 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04) !important;
          }

          .rf-mobile-playlist-title {
            font-size: 14px !important;
            font-weight: 700 !important;
            color: #103875 !important;
            letter-spacing: -0.01em !important;
            line-height: 1.2 !important;
          }

          .rf-mobile-playlist-sub {
            font-size: 11px !important;
            color: #64748B !important;
            margin-top: 2px !important;
          }

          .rf-mobile-playlist-arrow {
            color: #103875 !important;
          }

          .rf-mobile-actions {
            display: flex !important;
            flex-direction: column !important;
            gap: 10px !important;
            margin-top: 8px !important;
          }

          .rf-mobile-login-btn {
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 8px !important;
            height: 44px !important;
            border-radius: 12px !important;
            background: #F8FAFC !important;
            border: 1px solid #E2E8F0 !important;
            color: #103875 !important;
            font-size: 13px !important;
            font-weight: 600 !important;
            text-decoration: none !important;
            transition: background 0.15s ease !important;
          }

          .rf-mobile-login-btn:hover {
            background: #F1F5F9 !important;
          }

          .rf-mobile-primary-cta {
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 8px !important;
            width: 100% !important;
            height: 50px !important;
            border-radius: 999px !important;
            background: var(--rf-accent) !important;
            color: #FFFFFF !important;
            font-size: 14px !important;
            font-weight: 800 !important;
            border: none !important;
            cursor: pointer !important;
            box-shadow: 0 10px 24px rgba(252, 118, 29, 0.28) !important;
            transition: transform 0.15s ease, box-shadow 0.15s ease !important;
          }

          .rf-mobile-primary-cta:active {
            transform: scale(0.98) !important;
          }

          .rf-mobile-trust-note {
            text-align: center !important;
            font-size: 11px !important;
            color: #94A3B8 !important;
            margin: 2px 0 0 !important;
          }

          /* ── HERO: fundo com azul vibrante como protagonista e azul-rosa claro tímido e sutil ── */
          main .rf-hero {
            background:
              radial-gradient(circle at 85% 15%, rgba(244, 114, 182, 0.16), transparent 38%),
              radial-gradient(circle at 15% 75%, rgba(37, 99, 235, 0.35), transparent 50%),
              radial-gradient(circle at 18% 24%, rgba(252, 118, 29, 0.10), transparent 30%),
              linear-gradient(165deg, #0B2958 0%, #0F3775 35%, #164894 70%, #1A3E78 100%) !important;
            color: #FFFFFF !important;
          }
          main .rf-hero h1 {
            color: #FFFFFF !important;
            -webkit-text-fill-color: #FFFFFF !important;
            background: none !important;
          }
          main .rf-hero h1 span {
            color: var(--rf-accent-on-dark) !important;
            -webkit-text-fill-color: var(--rf-accent-on-dark) !important;
            background: none !important;
            -webkit-background-clip: initial !important;
            background-clip: initial !important;
          }
          main .rf-hero .rf-primary-button {
            background: var(--rf-accent-on-dark) !important;
            border-color: var(--rf-accent-on-dark) !important;
            color: #FFFFFF !important;
            box-shadow: 0 10px 24px rgba(255, 135, 56, 0.32) !important;
          }
          main .rf-hero .rf-hero-description {
            color: rgba(255, 255, 255, 0.78) !important;
          }
          main .rf-hero .rf-eyebrow-dark {
            color: rgba(255, 255, 255, 0.65) !important;
          }
          main .rf-hero .rf-secondary-button {
            color: rgba(255, 255, 255, 0.88) !important;
            border-color: rgba(255, 255, 255, 0.20) !important;
            background: rgba(255, 255, 255, 0.08) !important;
          }
          main .rf-hero .rf-secondary-button:hover {
            background: rgba(255, 255, 255, 0.14) !important;
            border-color: rgba(255, 255, 255, 0.32) !important;
          }
          main .rf-hero .rf-trust-value {
            color: var(--rf-accent-on-dark) !important;
          }
          main .rf-hero .rf-trust-label {
            color: rgba(255, 255, 255, 0.5) !important;
          }
          main .rf-hero .rf-trust-line,
          main .rf-hero .rf-hero-trust {
            border-color: rgba(255, 255, 255, 0.14) !important;
            background-color: transparent;
          }
          main .rf-hero .rf-trust-line {
            background: rgba(255, 255, 255, 0.14) !important;
          }
          main .rf-hero .rf-scroll-indicator {
            color: rgba(255, 255, 255, 0.35) !important;
          }
          main .rf-hero .rf-scroll-indicator div {
            background: linear-gradient(to bottom, var(--rf-accent-on-dark), transparent) !important;
          }
          main .rf-hero .rf-hero-bottom-label {
            color: rgba(255, 255, 255, 0.25) !important;
          }
          main .rf-hero .rf-grid-lines-dark span {
            background: rgba(255, 255, 255, 0.06) !important;
          }
          main .rf-hero .rf-hero-orb-one {
            background: radial-gradient(circle, rgba(37, 99, 235, 0.25), rgba(244, 114, 182, 0.10) 50%, transparent 70%) !important;
          }
          main .rf-hero .rf-hero-orb-two {
            background: radial-gradient(circle, rgba(252, 118, 29, 0.12), transparent 70%) !important;
          }
          main .rf-hero .rf-real-phone-glow {
            background: radial-gradient(ellipse, rgba(37, 99, 235, 0.40), rgba(244, 114, 182, 0.12) 60%, transparent 70%) !important;
          }

          /* Spotify card no hero escuro */
          main .rf-hero .rf-spotify-card {
            background: rgba(255, 255, 255, 0.08) !important;
            border-color: rgba(255, 255, 255, 0.14) !important;
            box-shadow: 0 4px 24px rgba(0, 0, 0, 0.25) !important;
          }
          main .rf-hero .rf-spotify-card-title {
            color: #FFFFFF !important;
          }
          main .rf-hero .rf-spotify-card-sub {
            color: rgba(255, 255, 255, 0.55) !important;
          }
          main .rf-hero .rf-spotify-card-arrow {
            color: rgba(255, 255, 255, 0.45) !important;
          }
          main .rf-hero .rf-spotify-card:hover {
            background: rgba(2, 132, 199, 0.16) !important;
            border-color: rgba(2, 132, 199, 0.35) !important;
          }

          /* Header no hero: logo e nav brancos quando no topo (sem scroll) */
          .rf-header:not(.rf-header-scrolled) .rf-logo {
            color: #FFFFFF !important;
          }
          .rf-header:not(.rf-header-scrolled) .rf-logo img {
            filter: invert(1) !important;
          }
          .rf-header:not(.rf-header-scrolled) .rf-desktop-nav a {
            color: rgba(255, 255, 255, 0.65) !important;
          }
          .rf-header:not(.rf-header-scrolled) .rf-desktop-nav a:hover {
            color: #FFFFFF !important;
          }
          .rf-header:not(.rf-header-scrolled) .rf-login {
            color: rgba(255, 255, 255, 0.75) !important;
          }
          .rf-header:not(.rf-header-scrolled) .rf-mobile-menu {
            color: #FFFFFF !important;
          }

          /* ── Seções CLARAS ── */
          main .rf-statement,
          main .rf-booking-section,
          main .rf-team-section,
          main .rf-audience,
          main .rf-faq,
          main .rf-philosophy,
          main .rf-finance-real,
          main .rf-domicilio-real,
          main .rf-personalization-real {
            background: var(--rf-paper) !important;
            color: var(--rf-ink) !important;
          }
          main .rf-philosophy {
            background: var(--rf-paper-2) !important;
          }
          main .rf-statement h2,
          main .rf-booking-section h2,
          main .rf-team-section h2,
          main .rf-audience h2,
          main .rf-faq h2,
          main .rf-philosophy h2,
          main .rf-finance-real h2,
          main .rf-domicilio-real h2,
          main .rf-personalization-real h2 {
            color: var(--rf-ink) !important;
            -webkit-text-fill-color: var(--rf-ink) !important;
            background: none !important;
          }
          /* Span/em em seções claras: azul secundário */
          main .rf-statement h2 em,
          main .rf-team-section h2 span,
          main .rf-finance-real h2 span,
          main .rf-domicilio-real h2 span,
          main .rf-personalization-real h2 span {
            color: var(--rf-blue) !important;
            -webkit-text-fill-color: var(--rf-blue) !important;
            background: none !important;
            -webkit-background-clip: initial !important;
            background-clip: initial !important;
          }
          /* Span "trabalha por você. 24h." em laranja (#FC761D) */
          main .rf-booking-section h2 span {
            color: var(--rf-accent) !important;
            -webkit-text-fill-color: var(--rf-accent) !important;
            background: none !important;
            -webkit-background-clip: initial !important;
            background-clip: initial !important;
          }
          main .rf-statement p,
          main .rf-booking-section p,
          main .rf-team-section p,
          main .rf-audience p,
          main .rf-faq p,
          main .rf-philosophy p,
          main .rf-finance-real p,
          main .rf-domicilio-real p,
          main .rf-personalization-real p {
            color: var(--rf-muted) !important;
          }
          main .rf-eyebrow {
            color: var(--rf-muted) !important;
          }

          /* ── Seções ESCURAS: azul vibrante protagonista e azul-rosa tímido sutil ── */
          main .rf-problem,
          main .rf-dashboard-section,
          main .rf-pricing,
          main .rf-final-cta {
            background:
              radial-gradient(circle at 85% 15%, rgba(244, 114, 182, 0.14), transparent 36%),
              radial-gradient(circle at 15% 85%, rgba(37, 99, 235, 0.35), transparent 50%),
              radial-gradient(circle at 50% 50%, rgba(252, 118, 29, 0.06), transparent 35%),
              linear-gradient(165deg, #0C2E68 0%, #103A7C 45%, #164894 75%, #1A3E78 100%) !important;
            color: #FFFFFF !important;
          }
          main .rf-real-gallery,
          main .rf-payment-real {
            background:
              radial-gradient(circle at 20% 20%, rgba(244, 114, 182, 0.15), transparent 40%),
              radial-gradient(circle at 80% 80%, rgba(37, 99, 235, 0.35), transparent 55%),
              linear-gradient(165deg, #103874 0%, #164894 50%, #1E4684 100%) !important;
            color: #FFFFFF !important;
          }
          main .rf-problem h2,
          main .rf-dashboard-section h2,
          main .rf-pricing h2,
          main .rf-final-cta h2,
          main .rf-real-gallery h2,
          main .rf-payment-real h2 {
            color: #FFFFFF !important;
            -webkit-text-fill-color: #FFFFFF !important;
            background: none !important;
          }
          /* Spans em seções escuras com fundo azul: laranja mais claro e luminoso (#FF8738) */
          main .rf-problem h2 span,
          main .rf-payment-real h2 span,
          main .rf-pricing h2 span,
          main .rf-final-cta h2 span {
            color: var(--rf-accent-on-dark) !important;
            -webkit-text-fill-color: var(--rf-accent-on-dark) !important;
            background: none !important;
          }
          /* im2: Você administra o salão (laranja mais claro no azul) e sem largar o pincel (branco) */
          main .rf-dashboard-section h2 .rf-highlight-orange {
            color: var(--rf-accent-on-dark) !important;
            -webkit-text-fill-color: var(--rf-accent-on-dark) !important;
            background: none !important;
          }
          main .rf-pricing .rf-price-button.featured,
          main .rf-pricing .rf-price-badge,
          main .rf-final-cta .rf-primary-button,
          main .rf-final-cta .rf-final-button {
            background: var(--rf-accent-on-dark) !important;
            border-color: var(--rf-accent-on-dark) !important;
            color: #FFFFFF !important;
            box-shadow: 0 10px 24px rgba(255, 135, 56, 0.32) !important;
          }
          main .rf-hero .rf-eyebrow-dark .rf-eyebrow-dot,
          main .rf-problem .rf-eyebrow-dark .rf-eyebrow-dot,
          main .rf-pricing .rf-eyebrow-dark .rf-eyebrow-dot,
          main .rf-payment-real .rf-eyebrow-dark .rf-eyebrow-dot,
          main .rf-dashboard-section .rf-eyebrow-dark .rf-eyebrow-dot {
            background: var(--rf-accent-on-dark) !important;
            box-shadow: 0 0 14px rgba(255, 135, 56, 0.55) !important;
          }
          main .rf-dashboard-section h2 .rf-highlight-white {
            color: #FFFFFF !important;
            -webkit-text-fill-color: #FFFFFF !important;
            background: none !important;
          }
          main .rf-real-gallery h2 span {
            color: rgba(255, 255, 255, 0.5) !important;
            -webkit-text-fill-color: rgba(255, 255, 255, 0.5) !important;
            background: none !important;
          }
          main .rf-problem p,
          main .rf-dashboard-section p,
          main .rf-pricing p,
          main .rf-final-cta p,
          main .rf-real-gallery p,
          main .rf-payment-real p {
            color: rgba(255, 255, 255, 0.6) !important;
          }
          main .rf-eyebrow-dark {
            color: rgba(255, 255, 255, 0.55) !important;
          }

          /* Final CTA com orbs sutis */
          main .rf-final-cta {
            background:
              radial-gradient(circle at 30% 0%, rgba(28, 84, 168, 0.35), transparent 48%),
              radial-gradient(circle at 80% 100%, rgba(252, 118, 29, 0.15), transparent 45%),
              var(--rf-dark) !important;
          }

          /* ── Feature Strip (im3: textos com presença e legibilidade) ── */
          main .rf-feature-strip {
            margin-top: 54px !important;
            border-top: 1px solid rgba(255, 255, 255, 0.12) !important;
          }
          main .rf-feature-strip > div {
            min-height: auto !important;
            padding: 24px 22px !important;
          }
          main .rf-feature-strip span {
            font-size: 13px !important;
            font-weight: 800 !important;
            color: var(--rf-accent) !important;
            margin-bottom: 8px !important;
            letter-spacing: 0.08em !important;
            display: block !important;
          }
          main .rf-feature-strip strong {
            font-size: 20px !important;
            font-weight: 700 !important;
            color: #FFFFFF !important;
            margin-bottom: 6px !important;
            display: block !important;
            letter-spacing: -0.01em !important;
          }
          main .rf-feature-strip p {
            font-size: 14.5px !important;
            line-height: 1.5 !important;
            color: rgba(255, 255, 255, 0.78) !important;
            margin: 0 !important;
          }

          /* ── Pricing cards ── */
          main .rf-price-card:not(.rf-price-featured) {
            background: var(--rf-dark-card) !important;
            border-color: rgba(255, 255, 255, 0.1) !important;
            color: #FFFFFF !important;
          }
          main .rf-price-featured {
            background: #FFFFFF !important;
            border-color: rgba(252, 118, 29, 0.35) !important;
            color: var(--rf-ink) !important;
            box-shadow: 0 16px 40px rgba(0, 0, 0, 0.2) !important;
          }
          main .rf-price-features svg {
            color: var(--rf-accent) !important;
          }

          /* ── Acentos pontuais ── */
          main .rf-problem-number,
          main .rf-real-gallery-number,
          main .rf-feature-strip span,
          main .rf-trust-value {
            color: var(--rf-accent) !important;
          }
          main .rf-detail-icon {
            background: #EEF2F6 !important;
            color: var(--rf-blue) !important;
          }
          main .rf-payment-tag {
            border-color: rgba(252, 118, 29, 0.35) !important;
            background: rgba(252, 118, 29, 0.12) !important;
            color: #FFB45C !important;
          }
          main .rf-domicilio-real-points svg,
          main .rf-philosophy-mark svg {
            color: var(--rf-accent) !important;
          }

          /* Audience: mantém texto branco sobre foto */
          main .rf-audience-card h3,
          main .rf-audience-card p,
          main .rf-audience-card span,
          main .rf-audience-card svg {
            color: #FFFFFF !important;
            -webkit-text-fill-color: #FFFFFF !important;
          }

          /* FAQ */
          main .rf-faq-item button {
            color: var(--rf-ink) !important;
          }
          main .rf-faq-answer-wrap p {
            color: var(--rf-muted) !important;
          }

          /* Footer */
          main .rf-footer {
            background: #EEF0F4 !important;
            color: var(--rf-ink) !important;
          }
          main .rf-footer a,
          main .rf-footer button {
            color: var(--rf-muted) !important;
          }
          main .rf-footer a:hover,
          main .rf-footer button:hover {
            color: var(--rf-ink) !important;
          }

          /* Mobile: layout com tipografia imponente e celular despontando */
          @media (max-width: 680px) {
            main .rf-hero {
              height: auto !important;
              min-height: 0 !important;
              padding-bottom: 24px !important;
              background:
                radial-gradient(circle at 88% 12%, rgba(244, 114, 182, 0.15), transparent 36%),
                radial-gradient(circle at 18% 80%, rgba(37, 99, 235, 0.35), transparent 50%),
                linear-gradient(172deg, #0B2958 0%, #0F3775 35%, #164894 70%, #1A3E78 100%) !important;
            }

            .rf-hero-mobile-br {
              display: block !important;
            }

            main .rf-hero-container {
              padding-top: 54px !important;
              padding-bottom: 16px !important;
              display: flex !important;
              flex-direction: column !important;
              align-items: flex-start !important;
              width: calc(100% - 32px) !important;
              box-sizing: border-box !important;
            }

            main .rf-hero-copy {
              display: contents !important;
            }

            main .rf-hero h1 {
              font-size: clamp(44px, 13vw, 62px) !important;
              line-height: 0.88 !important;
              letter-spacing: -0.065em !important;
              font-weight: 850 !important;
              margin: 14px 0 12px !important;
            }

            main .rf-hero-description {
              font-size: 14px !important;
              line-height: 1.5 !important;
              margin: 0 0 16px !important;
              max-width: 350px !important;
              color: rgba(255, 255, 255, 0.82) !important;
            }

            main .rf-hero-actions {
              display: flex !important;
              flex-direction: column !important;
              width: 100% !important;
              max-width: 350px !important;
              gap: 8px !important;
              margin: 0 0 16px 0 !important;
              box-sizing: border-box !important;
            }

            main .rf-hero .rf-primary-button,
            main .rf-hero .rf-secondary-button {
              width: 100% !important;
              min-height: 44px !important;
              height: 44px !important;
              padding: 0 18px !important;
              box-sizing: border-box !important;
              display: inline-flex !important;
              align-items: center !important;
              justify-content: center !important;
              border-radius: 999px !important;
              font-size: 13px !important;
              font-weight: 700 !important;
              text-align: center !important;
              white-space: normal !important;
            }

            main .rf-hero .rf-primary-button {
              background: var(--rf-accent-on-dark) !important;
              color: #FFFFFF !important;
              box-shadow: 0 8px 22px rgba(255, 135, 56, 0.30) !important;
            }

            main .rf-hero .rf-secondary-button {
              color: rgba(255, 255, 255, 0.88) !important;
              border-color: rgba(255, 255, 255, 0.20) !important;
              background: rgba(255, 255, 255, 0.08) !important;
            }

            main .rf-hero-product {
              width: 100% !important;
              min-height: auto !important;
              margin-top: 4px !important;
              margin-bottom: 24px !important;
              display: flex !important;
              justify-content: center !important;
              overflow: visible !important;
              order: 5 !important;
            }

            main .rf-hero .rf-real-phone-wrap,
            main .rf-real-phone-wrap {
              width: 100% !important;
              max-width: 320px !important;
              height: auto !important;
              min-height: 590px !important;
              margin: 0 auto !important;
              transform: none !important;
              display: flex !important;
              align-items: center !important;
              justify-content: center !important;
            }

            main .rf-real-phone {
              width: min(290px, 82vw) !important;
              opacity: 1 !important;
              visibility: visible !important;
              display: block !important;
            }

            main .rf-real-floating-top {
              display: none !important;
            }

            main .rf-hero-spotify-slot {
              order: 5 !important;
              margin-top: 8px !important;
              margin-bottom: 12px !important;
              width: 100% !important;
              max-width: 340px !important;
              box-sizing: border-box !important;
            }

            main .rf-hero .rf-spotify-card {
              width: fit-content !important;
              max-width: 100% !important;
              box-sizing: border-box !important;
            }

            main .rf-hero-trust-slot {
              order: 6 !important;
              width: 100% !important;
              max-width: 340px !important;
            }

            main .rf-hero-trust {
              width: 100% !important;
              max-width: 340px !important;
              margin-top: 4px !important;
              padding-top: 14px !important;
              border-top: 1px solid rgba(255, 255, 255, 0.12) !important;
              box-sizing: border-box !important;
            }

            main .rf-feature-strip {
              grid-template-columns: 1fr !important;
              gap: 12px !important;
              margin-top: 36px !important;
              border-top: none !important;
            }

            main .rf-feature-strip > div {
              padding: 18px 20px !important;
              border: 1px solid rgba(255, 255, 255, 0.08) !important;
              border-radius: 16px !important;
              background: rgba(255, 255, 255, 0.03) !important;
            }

            main .rf-feature-strip strong {
              font-size: 18px !important;
            }

            main .rf-feature-strip p {
              font-size: 14px !important;
              color: rgba(255, 255, 255, 0.78) !important;
            }
          }

          /* =====================================================
             HERO — ILUMINAÇÃO AMBIENTE (feixes lentos e contínuos)
             ===================================================== */
          .rf-hero-light {
            position: absolute;
            inset: 0;
            overflow: hidden;
            pointer-events: none;
            z-index: 1;
          }
          .rf-hero-light-beam {
            position: absolute;
            top: -40%;
            left: -60%;
            width: 46%;
            height: 180%;
            transform: rotate(18deg);
            background: linear-gradient(
              90deg,
              transparent 0%,
              rgba(255, 255, 255, 0.025) 30%,
              rgba(173, 205, 255, 0.11) 50%,
              rgba(255, 255, 255, 0.025) 70%,
              transparent 100%
            );
            filter: blur(18px);
            animation: rfLightSweep 16s cubic-bezier(.45,.05,.55,.95) infinite;
            will-change: transform;
          }
          .rf-hero-light-beam-two {
            width: 28%;
            animation-duration: 22s;
            animation-delay: -9s;
            background: linear-gradient(
              90deg,
              transparent 0%,
              rgba(255, 210, 230, 0.03) 35%,
              rgba(255, 196, 160, 0.08) 50%,
              rgba(255, 210, 230, 0.03) 65%,
              transparent 100%
            );
          }
          .rf-hero-light-glow {
            position: absolute;
            width: 620px;
            height: 620px;
            top: -180px;
            right: -160px;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(120, 170, 255, 0.20), transparent 62%);
            filter: blur(10px);
            animation: rfLightBreath 9s ease-in-out infinite;
          }
          @keyframes rfLightSweep {
            0%   { transform: translateX(0) rotate(18deg); }
            100% { transform: translateX(380%) rotate(18deg); }
          }
          @keyframes rfLightBreath {
            0%, 100% { opacity: 0.55; transform: translate(0, 0) scale(1); }
            50%      { opacity: 1;    transform: translate(-60px, 40px) scale(1.12); }
          }
          main .rf-hero .rf-hero-container { position: relative; z-index: 2; }
          @media (prefers-reduced-motion: reduce) {
            .rf-hero-light-beam,
            .rf-hero-light-glow { animation: none !important; }
          }

          /* =====================================================
             ANTI-FURO — CARDS NO MESMO ESTILO DE RF-FEATURE-STRIP (IMG2)
             ===================================================== */
          .rf-payment-cards-list {
            display: flex;
            flex-direction: column;
            gap: 12px;
            margin-top: 36px;
            max-width: 520px;
          }
          .rf-payment-cards-list > div {
            padding: 18px 20px !important;
            border: 1px solid rgba(255, 255, 255, 0.08) !important;
            border-radius: 16px !important;
            background: rgba(255, 255, 255, 0.03) !important;
            transition: border-color .2s ease, background .2s ease;
          }
          .rf-payment-cards-list > div:hover {
            border-color: rgba(255, 255, 255, 0.16) !important;
            background: rgba(255, 255, 255, 0.05) !important;
          }
          main .rf-payment-cards-list span {
            font-size: 13px !important;
            font-weight: 800 !important;
            color: var(--rf-accent-on-dark) !important;
            -webkit-text-fill-color: var(--rf-accent-on-dark) !important;
            margin-bottom: 8px !important;
            letter-spacing: 0.08em !important;
            display: block !important;
            font-variant-numeric: tabular-nums;
          }
          main .rf-payment-cards-list strong {
            font-size: 18px !important;
            font-weight: 700 !important;
            color: #FFFFFF !important;
            -webkit-text-fill-color: #FFFFFF !important;
            margin-bottom: 6px !important;
            display: block !important;
            letter-spacing: -0.01em !important;
            line-height: 1.3 !important;
          }
          main .rf-payment-cards-list p {
            font-size: 14px !important;
            line-height: 1.5 !important;
            color: rgba(255, 255, 255, 0.78) !important;
            margin: 0 !important;
          }
          @media (min-width: 900px) {
            main .rf-payment-cards-list strong {
              font-size: 20px !important;
            }
            main .rf-payment-cards-list p {
              font-size: 14.5px !important;
            }
          }

          /* =====================================================
             FOOTER — LOGO OFICIAL
             ===================================================== */
          .rf-footer-logo-img {
            display: inline-flex;
            align-items: center;
          }
          .rf-footer-logo-img img {
            height: 38px;
            width: auto;
            display: block;
          }

          /* =====================================================
             MENU MOBILE — MESMA LINGUAGEM DA LANDING
             ===================================================== */
          .rf-menu {
            position: fixed;
            inset: 0;
            z-index: 999999;
            overflow: hidden;
            color: #FFFFFF;
            background:
              radial-gradient(circle at 85% 12%, rgba(244, 114, 182, 0.14), transparent 38%),
              radial-gradient(circle at 12% 85%, rgba(37, 99, 235, 0.38), transparent 52%),
              linear-gradient(165deg, #0B2958 0%, #0F3775 40%, #164894 75%, #1A3E78 100%);
          }
          .rf-menu-inner {
            position: relative;
            z-index: 2;
            height: 100%;
            display: flex;
            flex-direction: column;
            padding: 20px 24px calc(28px + env(safe-area-inset-bottom));
            overflow-y: auto;
            box-sizing: border-box;
          }
          .rf-menu-top {
            display: flex;
            align-items: center;
            justify-content: space-between;
            height: 44px;
          }
          .rf-menu-logo img {
            height: 30px;
            filter: invert(1);
            display: block;
          }
          .rf-menu-close {
            width: 42px;
            height: 42px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #FFFFFF;
            background: rgba(255,255,255,0.10);
            border: 1px solid rgba(255,255,255,0.18) !important;
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            transition: background .2s ease, transform .2s ease;
          }
          .rf-menu-close:active { transform: scale(0.94); background: rgba(255,255,255,0.18); }
          .rf-menu-eyebrow {
            display: inline-flex;
            align-items: center;
            gap: 9px;
            margin: 34px 0 10px;
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.18em;
            text-transform: uppercase;
            color: rgba(255,255,255,0.62);
          }
          .rf-menu-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: var(--rf-accent-on-dark);
            box-shadow: 0 0 14px rgba(255,135,56,0.6);
          }
          .rf-menu-links {
            display: flex;
            flex-direction: column;
            border-top: 1px solid rgba(255,255,255,0.12);
          }
          .rf-menu-link {
            display: flex;
            align-items: center;
            gap: 16px;
            padding: 18px 2px;
            border-bottom: 1px solid rgba(255,255,255,0.12);
            color: #FFFFFF;
            text-decoration: none;
          }
          .rf-menu-link-number {
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.04em;
            color: var(--rf-accent-on-dark);
            min-width: 22px;
            font-variant-numeric: tabular-nums;
          }
          .rf-menu-link-label {
            flex: 1;
            font-size: clamp(30px, 9vw, 40px);
            line-height: 1;
            font-weight: 800;
            letter-spacing: -0.055em;
            transition: color .2s ease, transform .25s var(--rf-ease);
          }
          .rf-menu-link-arrow {
            color: rgba(255,255,255,0.35);
            transition: color .2s ease, transform .25s var(--rf-ease);
          }
          .rf-menu-link:hover .rf-menu-link-label,
          .rf-menu-link:active .rf-menu-link-label {
            color: var(--rf-accent-on-dark);
            transform: translateX(4px);
          }
          .rf-menu-link:hover .rf-menu-link-arrow,
          .rf-menu-link:active .rf-menu-link-arrow {
            color: var(--rf-accent-on-dark);
            transform: translate(2px, -2px);
          }
          .rf-menu-bottom {
            margin-top: auto;
            padding-top: 28px;
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
          .rf-menu-glass-card {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 14px;
            border-radius: 16px;
            text-decoration: none;
            color: #FFFFFF;
            background: linear-gradient(135deg, rgba(255,255,255,0.13), rgba(255,255,255,0.05));
            border: 1px solid rgba(255,255,255,0.18);
            backdrop-filter: blur(16px) saturate(160%);
            -webkit-backdrop-filter: blur(16px) saturate(160%);
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.14);
          }
          .rf-menu-glass-icon {
            width: 38px;
            height: 38px;
            border-radius: 11px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(0,0,0,0.25);
            border: 1px solid rgba(255,255,255,0.12);
          }
          .rf-menu-glass-text { flex: 1; display: flex; flex-direction: column; gap: 2px; }
          .rf-menu-glass-text strong { font-size: 14px; font-weight: 700; letter-spacing: -0.01em; }
          .rf-menu-glass-text small { font-size: 11px; color: rgba(255,255,255,0.6); }
          .rf-menu-glass-arrow { color: rgba(255,255,255,0.6); }
          .rf-menu-cta {
            height: 54px;
            border-radius: 999px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 9px;
            font-size: 15px;
            font-weight: 800;
            letter-spacing: -0.01em;
            color: #FFFFFF;
            background: var(--rf-accent-on-dark);
            box-shadow: 0 14px 30px rgba(255,135,56,0.35);
            transition: transform .15s ease;
          }
          .rf-menu-cta:active { transform: scale(0.98); }
          .rf-menu-login {
            height: 46px;
            border-radius: 999px;
            font-size: 13px;
            font-weight: 500;
            color: rgba(255,255,255,0.78);
            background: transparent;
            border: 1px solid rgba(255,255,255,0.2) !important;
          }
          .rf-menu-login strong { color: #FFFFFF; font-weight: 700; }
          .rf-menu-note {
            margin: 2px 0 0;
            text-align: center;
            font-size: 11px;
            color: rgba(255,255,255,0.45);
          }

      `}</style>

      <main>
        <Hero />

        <ProblemSection />

        <BookingSection />

        <DashboardSection />

        <PhilosophySection />

        <PaymentRealSection />

        <PricingSection />

        <FAQSection />

        <FinalCTA />

        <Footer />
      </main>
    </>
  );
}
