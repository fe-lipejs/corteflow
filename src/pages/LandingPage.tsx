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

/* =========================================================
   RAFFROS — LANDING PAGE
   Visual direction:
   Apple × Nothing × Raffros
   ========================================================= */

const ACCENT = "#FF9D2E";
const M = {
  booking: "/Mockups/Iphone - Tela de Agendamento.PNG",
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
    question: "Preciso instalar algum aplicativo?",
    answer:
      "Não. O Raffros funciona direto no navegador. Você e sua equipe podem acessar de computador, tablet ou celular.",
  },
  {
    question: "Meus clientes conseguem agendar sozinhos?",
    answer:
      "Sim. Você recebe uma página de agendamento própria para compartilhar no Instagram, WhatsApp, Google ou onde quiser.",
  },
  {
    question: "O Raffros serve para barbearia e salão?",
    answer:
      "Sim. A plataforma foi pensada para negócios de beleza, incluindo barbearias, salões e esmalterias.",
  },
  {
    question: "Posso cadastrar minha equipe?",
    answer:
      "Sim. Você pode cadastrar profissionais, serviços, horários e permissões de acesso para cada pessoa da equipe.",
  },
  {
    question: "Existe período grátis?",
    answer:
      "Sim. Você começa com 7 dias grátis. Não precisa pagar para começar e pode cancelar quando quiser.",
  },
  {
    question: "Consigo controlar o financeiro?",
    answer:
      "Sim. O Raffros centraliza informações financeiras junto com agenda, clientes, serviços e profissionais.",
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

function BookingPhone() {
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

      <motion.div
        className="rf-real-phone"
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.35 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <div className="rf-real-phone-frame">
          <span className="rf-real-phone-island" />
          <div className="rf-real-phone-screen">
            <img
              src={M.booking}
              alt="Tela de agendamento online da Raffros"
              className="rf-real-phone-image"
              loading="eager"
            />
            <div className="rf-real-phone-shine" aria-hidden="true" />
          </div>
        </div>
      </motion.div>

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
      </motion.div>
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
          src={M.barber}
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
    { label: "Para quem", href: "#para-quem" },
    { label: "Planos", href: "#planos" },
    { label: "Dúvidas", href: "#faq" },
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
                }
              }}
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
            onClick={() => goTo("/cadastro")}
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
            className="rf-mobile-nav-fullscreen"
            initial={{ opacity: 0, y: "-100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "-100%" }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <div className="rf-mobile-nav-top">
              <img src="/logo.svg" alt="Raffros" style={{ height: '32px', filter: 'invert(1)' }} />
              <button className="rf-mobile-close" onClick={() => setOpen(false)} aria-label="Fechar menu">
                <X size={32} />
              </button>
            </div>

            <div className="rf-mobile-nav-links">
              {links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => {
                    e.preventDefault();
                    setOpen(false);
                    const targetId = link.href.replace('#', '');
                    const element = document.getElementById(targetId);
                    if (element) {
                      setTimeout(() => {
                        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }, 100);
                    }
                  }}
                >
                  {link.label}
                </a>
              ))}
              <div className="rf-mobile-nav-divider" />
              <a
                href="/login"
                onClick={(e) => {
                  e.preventDefault();
                  setOpen(false);
                  goTo("/login");
                }}
              >
                Entrar
              </a>
              <a
                href="/cadastro"
                onClick={(e) => {
                  e.preventDefault();
                  setOpen(false);
                  goTo("/cadastro");
                }}
              >
                Começar grátis
              </a>
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

      <div className="rf-container rf-hero-container">
        <div className="rf-hero-copy">
          <Reveal>
            <SectionEyebrow dark>
              PARA BARBEARIAS, SALÕES E ESMALTERIAS
            </SectionEyebrow>
          </Reveal>

          <Reveal delay={0.08}>
            <h1>
              Você não abriu
              <br />
              uma barbearia
              <br />
              pra ficar{" "}
              <span>
                respondendo
                <br />
                mensagem.
              </span>
            </h1>
          </Reveal>

          <Reveal delay={0.16}>
            <p className="rf-hero-description">
              Agendamento online, página própria, controle da
              equipe e gestão do negócio. Seus clientes agendam.
              Você cuida do que importa.
            </p>
          </Reveal>

          <Reveal delay={0.22}>
            <div className="rf-hero-actions">
              <button
                className="rf-primary-button"
                onClick={() => goTo("/cadastro")}
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

          <Reveal delay={0.28}>
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

        <div className="rf-hero-product">
          <BookingPhone />
        </div>
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
                MENOS OPERAÇÃO. MAIS NEGÓCIO.
              </SectionEyebrow>
            </Reveal>

            <Reveal delay={0.1}>
              <h2>
                Sua agenda não deveria
                <br />
                depender do{" "}
                <em>seu celular.</em>
              </h2>
            </Reveal>

            <Reveal delay={0.18}>
              <p>
                Enquanto você responde “qual horário tem?”, o
                Raffros trabalha por você. O cliente escolhe,
                confirma e recebe as informações sem precisar
                esperar uma resposta.
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
      title: "Mensagens",
      text: "Pare de perder tempo perguntando horário, serviço e profissional.",
    },
    {
      number: "02",
      title: "Furos na agenda",
      text: "Uma agenda organizada mostra exatamente o que acontece no seu dia.",
    },
    {
      number: "03",
      title: "Equipe perdida",
      text: "Cada profissional sabe seus horários, serviços e atendimentos.",
    },
  ];

  return (
    <section className="rf-problem">
      <div className="rf-container">
        <div className="rf-problem-heading">
          <Reveal>
            <SectionEyebrow dark>
              O PROBLEMA
            </SectionEyebrow>
          </Reveal>

          <Reveal delay={0.08}>
            <h2>
              O que deveria
              <br />
              ser simples
              <br />
              <span>não é.</span>
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
      <div className="rf-container">
        <div className="rf-section-intro">
          <Reveal>
            <SectionEyebrow>
              COMO FUNCIONA / AGENDAMENTO ONLINE
            </SectionEyebrow>
          </Reveal>

          <Reveal delay={0.08}>
            <h2>
              Sua agenda
              <br />
              <span>aberta 24 horas.</span>
            </h2>
          </Reveal>

          <Reveal delay={0.16}>
            <p>
              Seu cliente não precisa mandar mensagem.
              Ele entra na sua página, escolhe o serviço,
              profissional, dia e horário.
            </p>
          </Reveal>
        </div>

        <div className="rf-booking-layout">
          <Reveal className="rf-booking-visual">
            <BookingPhone />
          </Reveal>

          <div className="rf-booking-details">
            {[
              {
                icon: Globe2,
                title: "Página própria",
                text: "Uma experiência simples para o cliente marcar sozinho.",
              },
              {
                icon: CalendarDays,
                title: "Disponibilidade real",
                text: "Os horários respeitam sua agenda e a da sua equipe.",
              },
              {
                icon: ShieldCheck,
                title: "Confirmação automática",
                text: "O cliente recebe as informações do agendamento.",
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
              PAINEL DE GESTÃO
            </SectionEyebrow>
          </Reveal>

          <Reveal delay={0.08}>
            <h2>
              Tudo que você
              <br />
              precisa.
              <br />
              <span>Em um só lugar.</span>
            </h2>
          </Reveal>

          <Reveal delay={0.16}>
            <p>
              Agenda, clientes, profissionais, serviços e
              financeiro. Sem abrir cinco sistemas diferentes
              para administrar um único negócio.
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.1}>
          <MacbookMockup image={M.barber} alt="Tela de agendamento e gestão da Raffros" path="app.raffros.com / agenda" className="rf-dashboard-macbook" />
        </Reveal>

        <div className="rf-feature-strip">
          <div>
            <span>01</span>
            <strong>Agenda</strong>
            <p>Visualize seu dia inteiro.</p>
          </div>

          <div>
            <span>02</span>
            <strong>Equipe</strong>
            <p>Controle profissionais e horários.</p>
          </div>

          <div>
            <span>03</span>
            <strong>Clientes</strong>
            <p>Tenha tudo organizado.</p>
          </div>

          <div>
            <span>04</span>
            <strong>Financeiro</strong>
            <p>Saiba como o negócio está.</p>
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
    { number: "01", label: "AGENDAMENTO", title: "O cliente escolhe.", text: "Serviço, profissional, dia e horário em poucos toques.", image: M.booking, className: "rf-gallery-main" },
    { number: "02", label: "SERVIÇOS", title: "Tudo claro antes de marcar.", text: "O cliente vê serviço, duração e preço antes de confirmar.", image: M.services, className: "" },
    { number: "03", label: "PIX", title: "Menos furos na agenda.", text: "Você pode receber um sinal e proteger o horário reservado.", image: M.pix, className: "" },
  ];

  return (
    <section className="rf-real-gallery">
      <div className="rf-container">
        <div className="rf-real-gallery-heading">
          <Reveal>
            <SectionEyebrow dark>
              04 / A EXPERIÊNCIA REAL
            </SectionEyebrow>
          </Reveal>

          <Reveal delay={0.08}>
            <h2>
              O que seu cliente vê
              <br />
              <span>também importa.</span>
            </h2>
          </Reveal>

          <Reveal delay={0.16}>
            <p>
              Não é só uma agenda bonita para você. É uma experiência
              profissional do primeiro toque até a confirmação.
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
                05 / SUA EQUIPE
              </SectionEyebrow>
            </Reveal>

            <Reveal delay={0.08}>
              <h2>
                Cada pessoa.
                <br />
                Seu espaço.
                <br />
                <span>Seu controle.</span>
              </h2>
            </Reveal>

            <Reveal delay={0.16}>
              <p>
                Cadastre profissionais, defina serviços,
                horários e permissões. O Raffros organiza
                a operação sem tirar o controle das suas mãos.
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
                  <strong>Equipe sincronizada</strong>
                  <small>Horários e serviços em um só lugar</small>
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
            RAFFROS / PRINCÍPIO
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <h2>
            A tecnologia
            <br />
            deve desaparecer.
          </h2>
        </Reveal>

        <Reveal delay={0.16}>
          <p>
            Você não precisa aprender um sistema complicado.
            O Raffros foi feito para que a tecnologia fique
            em segundo plano e o seu negócio fique em primeiro.
          </p>
        </Reveal>

        <Reveal delay={0.22}>
          <div className="rf-philosophy-mark">
            <Sparkles size={18} />
            <span>PRECISO. SIMPLES. RAFFROS.</span>
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
      title: "Barbearias",
      description:
        "Mais horários preenchidos. Menos conversa para marcar um corte.",
      icon: Scissors,
      bgImage: "/images/barbearia.jpg"
    },
    {
      index: "02",
      title: "Salões",
      description:
        "Equipe, serviços e clientes organizados em uma única operação.",
      icon: Sparkles,
      bgImage: "/images/salao-cachos.jpg"
    },
    {
      index: "03",
      title: "Esmalterias",
      description:
        "Uma agenda simples para você cuidar da experiência.",
      icon: CalendarDays,
      bgImage: "/images/manicure-celular.jpg"
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
              08 / VISÃO DO NEGÓCIO
            </SectionEyebrow>
          </Reveal>

          <Reveal delay={0.08}>
            <h2>
              O dinheiro
              <br />
              <span>também precisa aparecer.</span>
            </h2>
          </Reveal>

          <Reveal delay={0.16}>
            <p>
              Faturamento, ocupação e desempenho deixam de ser uma
              dúvida no fim do mês.
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
              09 / ANTI-FURO
            </SectionEyebrow>

            <h2>
              Seu horário
              <br />
              <span>tem valor.</span>
            </h2>

            <p>
              Você define o sinal. O cliente paga. O horário é confirmado.
              Menos faltas e menos dinheiro deixado na mesa.
            </p>

            <div className="rf-payment-real-list">
              {[
                "Você define o percentual",
                "Pagamento via Pix",
                "Confirmação automática",
              ].map((item, index) => (
                <div key={item}>
                  <span>0{index + 1}</span>
                  <strong>{item}</strong>
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
              <span>A Raffros calcula.</span>
            </h2>

            <p>
              Defina seu raio de atendimento. O cliente informa o endereço
              e o sistema verifica se ele está dentro da sua área.
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
              Seu negócio.
              <br />
              <span>Sua experiência.</span>
            </h2>
          </Reveal>

          <Reveal delay={0.16}>
            <p>
              A página onde seu cliente agenda acompanha a identidade
              do seu negócio.
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
              PLANOS E PREÇOS
            </SectionEyebrow>
          </Reveal>

          <Reveal delay={0.08}>
            <h2>
              Comece pequeno.
              <br />
              <span>Cresça sem trocar de sistema.</span>
            </h2>
          </Reveal>

          <Reveal delay={0.16}>
            <p>
              7 dias grátis em todos os planos.
              <br />
              Cancele quando quiser.
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

                <button
                  className={
                    plan.featured
                      ? "rf-price-button featured"
                      : "rf-price-button"
                  }
                  onClick={() => goTo("/cadastro")}
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
            PRONTO PARA MUDAR?
          </SectionEyebrow>
        </Reveal>

        <Reveal delay={0.08}>
          <h2>
            Pare de responder.
            <br />
            <span>Comece a receber.</span>
          </h2>
        </Reveal>

        <Reveal delay={0.16}>
          <p>
            Coloque sua agenda para trabalhar por você.
          </p>
        </Reveal>

        <Reveal delay={0.22}>
          <button
            className="rf-final-button"
            onClick={() => goTo("/cadastro")}
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
              Tudo claro
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
              className="rf-footer-logo"
            >
              <span className="rf-logo-mark">R</span>
              <span>raffros</span>
              <i>.</i>
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
                onClick={() => goTo("/cadastro")}
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
          backgroundColor: "#FF9D2E",
          zIndex: 999999,
        }}
      />
      <Header />
      <style>{`
        /* =====================================================
           RAFFROS DESIGN SYSTEM
           ===================================================== */

        :root {
          --rf-black: #050505;
          --rf-black-2: #0b0b0b;
          --rf-black-3: #111111;

          --rf-white: #ffffff;
          --rf-paper: #f5f5f2;
          --rf-paper-2: #eeeeeb;

          --rf-text: #101010;
          --rf-muted: #747470;
          --rf-muted-dark: #9a9a95;

          --rf-line: rgba(16,16,16,.10);
          --rf-line-dark: rgba(255,255,255,.11);

          --rf-accent: #FF9D2E;
          --rf-accent-dark: #E8841A;

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
          box-shadow: 0 0 16px rgba(255,157,46,.45);
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
            0 0 0 1px rgba(255,157,46,.15),
            0 5px 25px rgba(255,157,46,.10);
          transition:
            transform .2s ease,
            box-shadow .2s ease;
        }

        .rf-header-cta:hover {
          transform: translateY(-1px);
          box-shadow:
            0 0 0 1px rgba(255,157,46,.25),
            0 8px 32px rgba(255,157,46,.18);
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
          min-height: 760px;
          height: min(900px, 100svh);
          overflow: hidden;
          background:
            radial-gradient(
              circle at 70% 46%,
              rgba(255,157,46,.055),
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
              rgba(255,157,46,.08),
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
          min-height: 760px;
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
            0 12px 35px rgba(255,157,46,.16);
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
              rgba(255,157,46,.12),
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
              rgba(255,157,46,.16),
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
          border: 1px solid rgba(255,157,46,.5);
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
          background: rgba(255,157,46,.13);
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
              rgba(255,157,46,.07),
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
          background: rgba(255,157,46,.09);
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
          background: rgba(255,157,46,.3);
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
          color: rgba(255,157,46,.7);
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
          background: rgba(255,157,46,.55);
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
          background: rgba(255,157,46,.25);
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
              rgba(255,157,46,.07),
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
            0 15px 50px rgba(255,157,46,.18);
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
              rgba(255,157,46,.16),
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
          background: rgba(255,157,46,.13);
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
            radial-gradient(circle at 75% 55%,rgba(255,157,46,.09),transparent 30%),
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
          box-shadow: 0 0 14px rgba(255,157,46,.35);
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
          border: 1px solid rgba(255,157,46,.28);
          background: rgba(255,157,46,.1);
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
            background: radial-gradient(circle at 85% 5%, rgba(255,157,46,.10), transparent 34%);
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
      `}</style>

      <main>
        <Hero />

        <Statement />

        <ProblemSection />

        <BookingSection />

        <RealProductGallery />

        <DashboardSection />

        <TeamSection />

        <PhilosophySection />

        <FinanceRealSection />

        <PaymentRealSection />

        <DomicilioRealSection />

        <AudienceSection />

        <PricingSection />

        <FAQSection />

        <FinalCTA />

        <Footer />
      </main>
    </>
  );
}