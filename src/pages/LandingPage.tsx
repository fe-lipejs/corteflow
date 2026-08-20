import { motion, animate, useInView, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useState, useEffect, useRef, type ReactNode } from 'react';
import CookieConsentBanner from '../components/cookies/CookieConsentBanner';

/* ============================================================
   TOKENS & STYLING (Apple Noir + Pure White + Electric Yellow)
   Noir Dark:    #000000  /  #0A0A0C  /  Cards: #141418  /  Borders: rgba(255,255,255,0.08)
   Clean White:  #FFFFFF  /  #F5F5F7  /  Cards: #FFFFFF  /  Borders: rgba(0,0,0,0.08)
   Accent:       #F59E0B  /  Soft: #FBBF24  /  Dark Accent: #D97706
   ============================================================ */

const EASE: [number, number, number, number] = [0.16, 0.8, 0.24, 1];

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

  return <span ref={ref}>{value}{suffix}</span>;
}

function Eyebrow({ children, light = false }: { children: ReactNode; light?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.16em] uppercase font-semibold mb-4 ${light ? 'text-[#D97706]' : 'text-[#F59E0B]'}`}>
      <span className={`w-4 h-[1.5px] ${light ? 'bg-[#D97706]' : 'bg-[#F59E0B]'}`} />
      {children}
    </span>
  );
}

function PhoneFrame({
  src, alt, className = '', tilt = 0, glow = false, lightMode = false,
}: { src: string; alt: string; className?: string; tilt?: number; glow?: boolean; lightMode?: boolean }) {
  return (
    <div className={className} style={tilt ? { transform: `rotate(${tilt}deg)` } : undefined}>
      <div
        className={`relative rounded-[2.3rem] p-[7px] transition-transform duration-500 ${
          lightMode 
            ? 'border border-black/[0.12] bg-[#FFFFFF] shadow-[0_30px_70px_-20px_rgba(0,0,0,0.18)]' 
            : 'border border-white/[0.12] bg-[#0A0A0C] shadow-[0_50px_90px_-35px_rgba(0,0,0,0.9)]'
        }`}
        style={glow ? { boxShadow: '0 50px 90px -35px rgba(0,0,0,0.9), 0 0 60px -10px rgba(245,158,11,0.3)' } : undefined}
      >
        <span className={`absolute left-1/2 top-[9px] -translate-x-1/2 w-14 h-[12px] rounded-full z-10 ${
          lightMode ? 'bg-[#1D1D1F] border border-black/10' : 'bg-[#000000] border border-white/10'
        }`} />
        <div className="relative rounded-[1.8rem] overflow-hidden aspect-[9/19]">
          <img src={src} alt={alt} className="absolute inset-0 w-full h-full object-cover object-top" />
          <div className={`absolute inset-0 pointer-events-none ${lightMode ? 'bg-gradient-to-t from-black/10 via-transparent to-white/[0.04]' : 'bg-gradient-to-t from-black/30 via-transparent to-white/[0.04]'}`} />
        </div>
      </div>
    </div>
  );
}

function ServiceRadius() {
  return (
    <div className="relative w-[228px] h-[228px] mx-auto shrink-0">
      {[0, 38, 76].map((inset) => (
        <span key={inset} className="absolute rounded-full border border-dashed border-[#F59E0B]/30" style={{ inset }} />
      ))}
      <div className="absolute inset-0 rounded-full overflow-hidden">
        <div
          className="absolute inset-0 animate-spin"
          style={{
            animationDuration: '6s',
            background: 'conic-gradient(from 0deg, rgba(245,158,11,0.45), transparent 35%)',
          }}
        />
      </div>
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[56px] h-[56px] rounded-full flex items-center justify-center font-mono text-[11px] font-bold text-black"
        style={{ background: 'linear-gradient(135deg, #F59E0B, #FBBF24)', boxShadow: '0 0 44px rgba(245,158,11,0.6)' }}
      >
        Você
      </div>
      <span className="absolute top-[10%] -right-[8%] font-mono text-[10px] font-semibold px-3 py-[6px] rounded-full whitespace-nowrap bg-[#F59E0B]/15 text-[#FBBF24] border border-[#F59E0B]/40 shadow-lg">
        Dentro do raio
      </span>
      <span className="absolute bottom-[6%] -left-[12%] font-mono text-[10px] px-3 py-[6px] rounded-full whitespace-nowrap bg-white/[0.05] text-[#71717A] border border-white/10">
        Fora do raio
      </span>
    </div>
  );
}

export default function LandingPage() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const shouldReduce = useReducedMotion();

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const closeMobileNav = () => setIsMobileMenuOpen(false);

  const fadeUp = (delay = 0) => (
    shouldReduce
      ? { initial: { opacity: 0 }, whileInView: { opacity: 1 }, viewport: { once: true, margin: '-10%' as const }, transition: { duration: 0.4, delay } }
      : {
        initial: { opacity: 0, y: 26 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, margin: '-8%' as const },
        transition: { duration: 0.85, delay, ease: EASE },
      }
  );

  return (
    <div className="font-body bg-[#000000] text-[#F5F5F7] selection:bg-[#F59E0B] selection:text-black min-h-screen overflow-x-hidden">

      {/* SVG Gradient definitions */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <linearGradient id="flowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#FBBF24" />
          </linearGradient>
          <linearGradient id="flowGradientLight" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#D97706" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
        </defs>
      </svg>

      {/* =========================
           NAVBAR (Apple Noir Glass)
      ========================== */}
      <header className={`fixed top-0 left-0 right-0 z-[100] px-6 md:px-12 transition-all duration-300 border-b ${
        isScrolled ? 'bg-[#000000]/85 backdrop-blur-[16px] border-white/[0.08] py-3' : 'border-transparent py-[18px]'
      }`}>
        <div className="max-w-[1280px] mx-auto flex items-center justify-between gap-6">
          <a href="#hero" className="inline-flex items-center gap-[9px] font-display font-bold text-[20px] text-white tracking-tight">
            <span className="w-[10px] h-[10px] rounded-full bg-[#F59E0B] shadow-[0_0_14px_rgba(245,158,11,0.8)]" />
            Corte Flow
          </a>

          <nav className="hidden md:flex gap-8">
            <a href="#solucao" className="text-[14px] text-[#A1A1A6] hover:text-[#F59E0B] transition-colors font-medium">Solução</a>
            <a href="#domicilio" className="text-[14px] text-[#A1A1A6] hover:text-[#F59E0B] transition-colors font-medium">Domicílio</a>
            <a href="#para-quem" className="text-[14px] text-[#A1A1A6] hover:text-[#F59E0B] transition-colors font-medium">Para quem é</a>
            <a href="#planos" className="text-[14px] text-[#A1A1A6] hover:text-[#F59E0B] transition-colors font-medium">Planos</a>
          </nav>

          <div className="flex items-center gap-[14px]">
            <Link
              to="/login"
              className="hidden md:inline-flex text-[14px] font-medium text-[#A1A1A6] hover:text-white transition-colors mr-2"
            >
              Entrar
            </Link>
            
            <a
              href="#planos"
              className="hidden md:inline-flex items-center justify-center px-5 py-2.5 rounded-full font-bold text-[13px] text-black shadow-[0_14px_30px_-10px_rgba(245,158,11,0.5)] hover:scale-105 transition-all"
              style={{ background: 'linear-gradient(135deg, #F59E0B, #FBBF24)' }}
            >
              Começar agora
            </a>

            <button
              aria-label="Abrir menu"
              className="md:hidden w-10 h-10 flex flex-col items-center justify-center gap-[5px]"
              onClick={() => setIsMobileMenuOpen((v) => !v)}
            >
              <span className={`block w-5 h-[2px] bg-white transition-all duration-300 ${isMobileMenuOpen ? 'translate-y-[7px] rotate-45' : ''}`} />
              <span className={`block w-5 h-[2px] bg-white transition-all duration-300 ${isMobileMenuOpen ? 'opacity-0' : ''}`} />
              <span className={`block w-5 h-[2px] bg-white transition-all duration-300 ${isMobileMenuOpen ? '-translate-y-[7px] -rotate-45' : ''}`} />
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <div className={`fixed inset-0 top-[60px] bg-[#000000] flex flex-col items-center justify-center gap-[30px] transition-all duration-500 ${isMobileMenuOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-full pointer-events-none'}`}>
          <a href="#solucao" onClick={closeMobileNav} className="font-display text-[26px]">Solução</a>
          <a href="#domicilio" onClick={closeMobileNav} className="font-display text-[26px]">Atendimento a domicílio</a>
          <a href="#para-quem" onClick={closeMobileNav} className="font-display text-[26px]">Para quem é</a>
          <a href="#planos" onClick={closeMobileNav} className="font-display text-[26px]">Planos</a>
          <Link to="/login" onClick={closeMobileNav} className="text-[18px] text-[#A1A1A6]">Entrar</Link>
          <a
            href="#planos"
            onClick={closeMobileNav}
            className="mt-2 px-8 py-4 rounded-full font-bold text-[16px] text-black shadow-lg"
            style={{ background: 'linear-gradient(135deg, #F59E0B, #FBBF24)' }}
          >
            Começar agora
          </a>
        </div>
      </header>

      <main>
        {/* ============================================================
             01 — HERO (NOIR DARK + ELECTRIC YELLOW)
        ============================================================ */}
        <section id="hero" className="relative min-h-[100svh] flex flex-col justify-center pt-[110px] bg-[#000000] overflow-hidden">

          <div className="absolute inset-0 z-0">
            <img src="/images/hero-atendimento.jpg" alt="" className="w-full h-full object-cover opacity-[0.14]" />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #000000 0%, rgba(0,0,0,0.7) 40%, #000000 95%), radial-gradient(60% 50% at 85% 10%, rgba(245,158,11,0.18), transparent 60%)' }} />
          </div>

          <div className="relative z-10 max-w-[1280px] w-full mx-auto px-6 md:px-12 grid md:grid-cols-[1.05fr_0.95fr] gap-14 md:gap-10 items-center">

            <motion.div {...fadeUp()} className="text-left">
              <Eyebrow>Agendamento &amp; gestão · Beleza e estética</Eyebrow>
              <h1 className="font-display font-semibold text-[clamp(40px,9vw,74px)] leading-[1.03] tracking-[-0.02em] m-0 mb-[22px] text-white">
                Seu negócio agenda.<br />
                <em className="not-italic" style={{ background: 'linear-gradient(135deg, #F59E0B, #FBBF24)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
                  Você atende.
                </em>
              </h1>
              <p className="text-[clamp(16px,2vw,19px)] text-[#A1A1A6] max-w-[50ch] mb-[34px] leading-relaxed">
                O Corte Flow assume sua agenda, organiza sua equipe e confirma atendimento a
                domicílio sozinho — pra você focar em quem está na cadeira, não no WhatsApp.
              </p>

              <div className="flex flex-wrap gap-[14px] mb-[46px]">
                <a
                  href="#planos"
                  className="inline-flex items-center justify-center px-8 py-[17px] rounded-full font-bold text-[16px] text-black shadow-[0_20px_40px_-16px_rgba(245,158,11,0.55)] hover:scale-105 transition-all"
                  style={{ background: 'linear-gradient(135deg, #F59E0B, #FBBF24)' }}
                >
                  Começar agora
                </a>
                <a
                  href="#solucao"
                  className="inline-flex items-center justify-center px-8 py-[17px] rounded-full font-semibold text-[16px] text-white border border-white/[0.18] hover:border-[#F59E0B] hover:text-[#F59E0B] transition-all bg-[#0A0A0C]/50"
                >
                  Conhecer o Corte Flow
                </a>
              </div>

              <div className="flex gap-[30px] flex-wrap">
                <div className="flex flex-col">
                  <span className="font-display text-[28px] font-bold text-[#F59E0B]"><CountUp to={24} suffix="h" /></span>
                  <span className="text-[12px] text-[#71717A] max-w-[13ch]">devolvidas por mês</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-display text-[28px] font-bold text-[#F59E0B]"><CountUp to={10} suffix="km" /></span>
                  <span className="text-[12px] text-[#71717A] max-w-[13ch]">de raio configurável</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-display text-[28px] font-bold text-[#F59E0B]"><CountUp to={100} suffix="%" /></span>
                  <span className="text-[12px] text-[#71717A] max-w-[13ch]">da agenda no automático</span>
                </div>
              </div>
            </motion.div>

            <motion.div {...fadeUp(0.12)} className="relative w-full max-w-[320px] mx-auto md:max-w-none md:mx-0 md:justify-self-end">
              <PhoneFrame src="/images/custom-dark.png" alt="Agenda do Corte Flow" glow tilt={-4} className="w-[230px] md:w-[260px] mx-auto" />

              <div className="absolute top-[6%] -left-[8%] md:-left-[14%] z-20 flex items-center gap-2.5 p-3 px-4 rounded-[18px] bg-[#121216]/95 backdrop-blur-[10px] border border-white/[0.12] shadow-2xl animate-float" style={{ animationDelay: '0.3s' }}>
                <span className="text-[16px]">📍</span>
                <div>
                  <strong className="block text-[12.5px] font-semibold text-white">Dentro do raio</strong>
                  <span className="block text-[10.5px] text-[#A1A1A6]">Atendimento confirmado</span>
                </div>
              </div>

              <div className="absolute bottom-[4%] -right-[6%] md:-right-[12%] z-20 flex items-center gap-2.5 p-3 px-4 rounded-[18px] bg-[#121216]/95 backdrop-blur-[10px] border border-white/[0.12] shadow-2xl animate-float" style={{ animationDelay: '1.1s' }}>
                <span className="text-[16px]">✅</span>
                <div>
                  <strong className="block text-[12.5px] font-semibold text-white">09:03 reservado</strong>
                  <span className="block text-[10.5px] text-[#A1A1A6]">Agenda atualizada sozinha</span>
                </div>
              </div>
            </motion.div>

          </div>

          <div className="relative z-10 flex items-center justify-center gap-2 mt-16 pb-6 font-mono text-[11px] tracking-[0.1em] uppercase text-[#71717A]">
            <span className="w-[1px] h-6 bg-gradient-to-b from-[#F59E0B] to-transparent animate-scrollcue" />
            role para ver
          </div>
        </section>

        {/* ============================================================
             02 — DOR (PURE CRISP APPLE WHITE #FFFFFF)
        ============================================================ */}
        <section className="text-center py-20 md:py-[150px] px-6 bg-[#FFFFFF] text-[#1D1D1F]">
          <motion.div {...fadeUp()}>
            <p className="font-mono text-[12.5px] tracking-[0.03em] text-[#86868B] max-w-[46ch] mx-auto mb-5 font-semibold">
              Responder mensagem. Perguntar endereço. Confirmar horário. Torcer pra não esquecer.
            </p>
            <h2 className="font-display text-[clamp(26px,5vw,42px)] font-bold max-w-[20ch] mx-auto leading-[1.2] text-[#1D1D1F]">
              Sua agenda virou um <em className="not-italic text-[#D97706]">segundo trabalho</em>.
            </h2>
          </motion.div>
        </section>

        {/* ============================================================
             03 — SOLUÇÃO (NOIR JET BLACK #0A0A0C)
        ============================================================ */}
        <section id="solucao" className="py-[80px] md:py-[150px] px-6 md:px-12 bg-[#0A0A0C] text-white border-y border-white/[0.08]">
          <div className="max-w-[1280px] mx-auto grid md:grid-cols-2 gap-12 md:gap-[72px] items-center">

            <motion.div {...fadeUp()}>
              <Eyebrow>O Corte Flow</Eyebrow>
              <h2 className="font-display font-semibold text-[clamp(28px,5.5vw,44px)] leading-[1.15] tracking-[-0.01em] text-white">
                Não é uma agenda.<br />É o motor do seu negócio.
              </h2>
              <p className="text-[clamp(16px,2vw,18px)] text-[#A1A1A6] max-w-[46ch] mt-5 leading-relaxed">
                Menos mensagem, menos confusão, mais clientes na cadeira. O Corte Flow assume
                o agendamento, organiza sua equipe e ainda resolve o atendimento a domicílio —
                sozinho, sem você no meio de cada conversa.
              </p>

              <div className="flex flex-wrap gap-3 mt-[30px]">
                {['Agenda online', 'Gestão completa', 'Atendimento a domicílio'].map((tag) => (
                  <span key={tag} className="text-[13px] font-medium px-[16px] py-[9px] rounded-full border border-white/[0.12] bg-[#141418] text-[#D4D4D8]">
                    {tag}
                  </span>
                ))}
              </div>
            </motion.div>

            <motion.div {...fadeUp(0.1)} className="rounded-[28px] overflow-hidden border border-white/[0.12] aspect-[16/11] shadow-2xl">
              <img src="/images/barbearia.jpg" alt="Barbearia usando o Corte Flow" className="w-full h-full object-cover" />
            </motion.div>

          </div>
        </section>

        {/* ============================================================
             04 — AGENDA ONLINE (CLEAN CRISP WHITE #FFFFFF)
        ============================================================ */}
        <section id="agenda" className="py-[80px] md:py-[150px] px-6 md:px-12 bg-[#FFFFFF] text-[#1D1D1F]">
          <div className="max-w-[1280px] mx-auto grid md:grid-cols-[0.85fr_1fr] gap-10 md:gap-20 items-center">

            <motion.div {...fadeUp()} className="relative flex justify-center">
              <div className="absolute inset-0 rounded-[32px] overflow-hidden -z-10 opacity-15">
                <img src="/images/cliente-app.jpg" alt="" className="w-full h-full object-cover object-top blur-[2px]" />
              </div>
              <PhoneFrame src="/images/custom-light.png" alt="Página do cliente no Corte Flow" lightMode className="w-[230px] my-6" />
            </motion.div>

            <motion.div {...fadeUp(0.1)}>
              <Eyebrow light>Agenda online</Eyebrow>
              <h2 className="font-display font-semibold text-[clamp(28px,5.5vw,44px)] leading-[1.15] tracking-[-0.01em] text-[#1D1D1F]">
                Seu cliente agenda sozinho.
              </h2>
              <p className="text-[clamp(16px,2vw,18px)] text-[#6E6E73] max-w-[46ch] mt-5 leading-relaxed">
                Pare de responder mensagem pra marcar horário. O cliente escolhe o serviço,
                o profissional e o horário — a qualquer hora, sem esperar você ficar livre.
              </p>

              <ul className="mt-[26px] flex flex-col gap-[14px]">
                {[
                  'Sem trocar mensagem pra confirmar disponibilidade',
                  'Sem cliente esperando resposta e desistindo',
                  'Sem horário perdido por falta de organização',
                ].map((item) => (
                  <li key={item} className="relative pl-[28px] text-[15px] text-[#333336] font-medium">
                    <span className="absolute left-0 top-[3px] w-[18px] h-[18px] rounded-full bg-amber-500/15 border border-[#D97706]/40 flex items-center justify-center text-[10px] text-[#D97706] font-bold">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>

          </div>
        </section>

        {/* ============================================================
             05 — MOTOR DE GESTÃO (NOIR DARK #000000)
        ============================================================ */}
        <section id="gestao" className="py-[80px] md:py-[150px] px-6 md:px-12 bg-[#000000] text-white">
          <div className="max-w-[640px] mx-auto text-center mb-16">
            <Eyebrow>Motor de gestão</Eyebrow>
            <h2 className="font-display font-semibold text-[clamp(28px,5.5vw,44px)] leading-[1.15] tracking-[-0.01em] text-white">Administre o negócio inteiro em um lugar.</h2>
            <p className="text-[clamp(16px,2vw,18px)] text-[#A1A1A6] max-w-[46ch] mt-5 mx-auto">
              Crie profissionais, monte equipes, defina serviços e horários. O Corte Flow
              conecta cada peça da operação — e cada profissional acompanha só os próprios
              agendamentos.
            </p>
          </div>

          <div className="relative max-w-[1100px] mx-auto grid md:grid-cols-4 gap-5 md:gap-6 mb-20">
            <svg className="absolute hidden md:block overflow-visible top-1/2 left-0 w-full h-[2px] z-0" viewBox="0 0 800 4" preserveAspectRatio="none">
              <motion.path
                d="M0,2 L800,2" fill="none" stroke="url(#flowGradient)" strokeWidth="2"
                strokeDasharray="820"
                initial={{ strokeDashoffset: 820 }}
                whileInView={{ strokeDashoffset: 0 }}
                viewport={{ once: true, margin: '-20%' }}
                transition={{ duration: 1.3, ease: EASE }}
              />
            </svg>

            {[
              { num: '01', title: 'Administrador', desc: 'Visão completa da operação: agenda, equipe e desempenho do negócio.' },
              { num: '02', title: 'Equipe', desc: 'Organize quantos profissionais precisar, sob um único negócio.' },
              { num: '03', title: 'Profissionais', desc: 'Cada um com sua própria agenda, serviços e horários de trabalho.' },
              { num: '04', title: 'Agendamentos', desc: 'Tudo conectado — do primeiro clique do cliente até o atendimento.' },
            ].map((node, i) => (
              <motion.div key={node.num} {...fadeUp(i * 0.08)} className="relative z-10 bg-[#121216] border border-white/[0.08] rounded-[18px] p-[24px_22px] shadow-lg">
                <span className="inline-flex font-mono text-[12px] font-bold text-[#F59E0B] mb-2.5">{node.num}</span>
                <h3 className="font-display text-[18px] font-semibold mb-2 text-white">{node.title}</h3>
                <p className="text-[14px] text-[#A1A1A6]">{node.desc}</p>
              </motion.div>
            ))}
          </div>

          <motion.div {...fadeUp()} className="max-w-[1100px] mx-auto rounded-[32px] border border-white/[0.1] bg-[#0C0C0F] p-8 md:p-14 grid md:grid-cols-[1fr_auto] gap-10 items-center shadow-2xl">
            <div>
              <h3 className="font-display text-[22px] md:text-[26px] font-semibold max-w-[20ch] text-white">O painel que mostra tudo isso, ao vivo.</h3>
              <p className="text-[15px] text-[#A1A1A6] mt-3 max-w-[42ch]">
                Agendamentos do dia, faturamento previsto, ocupação e novos clientes — sem
                precisar abrir uma planilha ou contar no caderno.
              </p>
            </div>
            <PhoneFrame src="/images/dashboard-dark.png" alt="Painel do administrador" className="w-[210px] mx-auto" tilt={2} />
          </motion.div>
        </section>

        {/* ============================================================
             06 — EQUIPES (CLEAN CRISP WHITE #FFFFFF)
        ============================================================ */}
        <section className="py-[80px] md:py-[150px] px-6 md:px-12 bg-[#FFFFFF] text-[#1D1D1F]">
          <div className="max-w-[1280px] mx-auto grid md:grid-cols-[1fr_0.85fr] gap-10 md:gap-20 items-center">

            <motion.div {...fadeUp(0.1)} className="md:order-2 rounded-[28px] overflow-hidden border border-black/[0.1] shadow-xl">
              <img src="/images/salao-cachos.jpg" alt="Profissional atendendo cliente" className="w-full aspect-[4/5] object-cover" />
            </motion.div>

            <motion.div {...fadeUp()} className="md:order-1">
              <Eyebrow light>Equipes</Eyebrow>
              <h2 className="font-display font-semibold text-[clamp(28px,5.5vw,44px)] leading-[1.15] tracking-[-0.01em] text-[#1D1D1F]">
                Começou sozinho? Perfeito.<br />Tem equipe? Melhor ainda.
              </h2>
              <p className="text-[clamp(16px,2vw,18px)] text-[#6E6E73] max-w-[46ch] mt-5 leading-relaxed">
                Cadastre seus profissionais e organize a equipe em minutos. Cada um vê só os
                próprios agendamentos, enquanto você tem a visão completa do negócio.
              </p>
              <p className="mt-[26px] font-display italic text-[20px] text-[#D97706] font-medium">
                Seu negócio cresce. O Corte Flow cresce junto.
              </p>
            </motion.div>

          </div>
        </section>

        {/* ============================================================
             07 — DOMICÍLIO (NOIR DARK #0A0A0C)
        ============================================================ */}
        <section id="domicilio" className="bg-[#0A0A0C] border-y border-white/[0.08] py-[80px] md:py-[150px] px-6 md:px-12 overflow-hidden text-white">
          <div className="max-w-[1280px] mx-auto grid md:grid-cols-[1fr_0.8fr] gap-12 md:gap-20 items-center mb-[76px]">

            <motion.div {...fadeUp()}>
              <Eyebrow>Grande diferencial</Eyebrow>
              <h2 className="font-display font-semibold text-[clamp(28px,5.5vw,44px)] leading-[1.15] tracking-[-0.01em] text-white">
                Você define o raio.<br />O Corte Flow faz o resto.
              </h2>
              <p className="text-[clamp(16px,2vw,18px)] text-[#A1A1A6] max-w-[46ch] mt-5 leading-relaxed">
                Manicures, barbeiros e cabeleireiros que atendem em domicílio não precisam
                mais perguntar endereço, verificar distância e combinar horário no WhatsApp.
                O cliente informa onde está — o sistema confere se está dentro da área de
                atendimento e libera o horário na hora.
              </p>

              <div className="mt-10">
                <ServiceRadius />
                <p className="text-[13px] text-[#71717A] italic text-center mt-4">Ex.: "Atendo clientes em um raio de até 10 km."</p>
              </div>
            </motion.div>

            <motion.div {...fadeUp(0.1)} className="rounded-[28px] overflow-hidden border border-white/[0.1] md:order-2 shadow-2xl">
              <img src="/images/manicure-celular.jpg" alt="Atendimento a domicílio" className="w-full aspect-[4/5] object-cover" />
            </motion.div>
          </div>

          <div className="relative max-w-[1100px] mx-auto grid sm:grid-cols-2 md:grid-cols-5 gap-4 md:gap-[18px]">
            <svg className="absolute hidden md:block overflow-visible top-1/2 left-0 w-full h-[2px] z-0" viewBox="0 0 800 4" preserveAspectRatio="none">
              <motion.path
                d="M0,2 L800,2" fill="none" stroke="url(#flowGradient)" strokeWidth="2"
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
              <motion.div key={step} {...fadeUp(i * 0.08)} className="relative z-10 flex items-center gap-3 text-[13.5px] text-[#D4D4D8] bg-[#121216] border border-white/[0.08] rounded-full px-[16px] py-[11px] shadow-md">
                <span className="inline-flex items-center justify-center w-[20px] h-[20px] rounded-full text-black text-[10.5px] font-bold font-mono shrink-0" style={{ background: 'linear-gradient(135deg, #F59E0B, #FBBF24)' }}>{i + 1}</span>
                {step}
              </motion.div>
            ))}
          </div>

          <p className="text-center font-display italic text-[clamp(21px,3.2vw,28px)] text-[#F59E0B] mt-[68px]">"Você atende. O Corte Flow organiza."</p>
        </section>

        {/* ============================================================
             08 — PERSONALIZAÇÃO (CLEAN CRISP WHITE #FFFFFF)
        ============================================================ */}
        <section className="py-[80px] md:py-[140px] px-6 md:px-12 bg-[#FFFFFF] text-[#1D1D1F]">
          <div className="max-w-[640px] mx-auto text-center mb-14">
            <Eyebrow light>Sua marca, do seu jeito</Eyebrow>
            <h2 className="font-display font-semibold text-[clamp(26px,5vw,40px)] leading-[1.15] tracking-[-0.01em] text-[#1D1D1F]">A página do seu cliente, com a sua cara.</h2>
            <p className="text-[15.5px] text-[#6E6E73] mt-4 mx-auto max-w-[44ch]">
              Escolha as cores que combinam com o seu negócio. Cada estabelecimento tem uma
              identidade — o Corte Flow se adapta a ela, não o contrário.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-8 md:gap-10">
            {[
              { src: '/images/custom-pink.png', label: 'Rosé' },
              { src: '/images/custom-dark.png', label: 'Âmbar' },
              { src: '/images/custom-light.png', label: 'Clássico' },
            ].map((theme, i) => (
              <motion.div key={theme.label} {...fadeUp(i * 0.1)} className="flex flex-col items-center gap-3">
                <PhoneFrame src={theme.src} alt={`Tema ${theme.label}`} lightMode className="w-[150px] md:w-[170px]" tilt={i === 1 ? 0 : i === 0 ? -3 : 3} />
                <span className="font-mono text-[11px] uppercase tracking-[0.1em] font-semibold text-[#86868B]">{theme.label}</span>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ============================================================
             09 — PARA QUEM É (NOIR DARK #000000)
        ============================================================ */}
        <section id="para-quem" className="py-[80px] md:py-[150px] px-6 md:px-12 bg-[#000000] text-white">
          <div className="max-w-[1280px] mx-auto">
            <Eyebrow>Para quem é</Eyebrow>
            <h2 className="font-display font-semibold text-[clamp(28px,5.5vw,44px)] leading-[1.15] tracking-[-0.01em] max-w-[16ch] text-white">
              Feito para quem vive de deixar gente bonita.
            </h2>

            <div className="mt-14 grid md:grid-cols-3 gap-[16px] md:auto-rows-[minmax(150px,auto)]">

              <motion.div {...fadeUp(0.1)} className="rounded-[28px] overflow-hidden border border-white/[0.1] md:row-span-2 shadow-2xl">
                <img src="/images/estilo-corte.jpg" alt="Estilo de corte" className="w-full h-full object-cover aspect-[3/4]" />
              </motion.div>

              {[
                { icon: '💈', title: 'Barbearias', desc: 'Mais clientes. Menos mensagens.' },
                { icon: '💇', title: 'Salões de beleza', desc: 'Toda a equipe organizada em um só lugar.' },
                { icon: '💅', title: 'Manicures', desc: 'Agenda cheia sem ficar respondendo o celular.' },
              ].map((card, i) => (
                <motion.div key={card.title} {...fadeUp(0.15 + i * 0.08)} className="bg-[#121216] border border-white/[0.08] rounded-[18px] p-[26px_24px] transition-all hover:border-[#F59E0B]/50 hover:-translate-y-1 shadow-lg">
                  <span className="text-[24px]">{card.icon}</span>
                  <h3 className="font-display text-[18px] font-semibold my-2.5 text-white">{card.title}</h3>
                  <p className="text-[13.5px] text-[#A1A1A6]">{card.desc}</p>
                </motion.div>
              ))}

              <motion.div {...fadeUp(0.5)} className="rounded-[28px] overflow-hidden border border-white/[0.1] md:row-span-2 shadow-2xl">
                <img src="/images/barbeiro-corte.jpg" alt="Barbeiro atendendo" className="w-full h-full object-cover aspect-[3/4]" />
              </motion.div>

              {[
                { icon: '✂️', title: 'Profissionais autônomos', desc: 'Seu negócio profissional desde o primeiro cliente.' },
                { icon: '🏠', title: 'Atendimento a domicílio', desc: 'Você define onde atende. O sistema verifica o resto.' },
              ].map((card, i) => (
                <motion.div key={card.title} {...fadeUp(0.6 + i * 0.08)} className="bg-[#121216] border border-white/[0.08] rounded-[18px] p-[26px_24px] transition-all hover:border-[#F59E0B]/50 hover:-translate-y-1 shadow-lg">
                  <span className="text-[24px]">{card.icon}</span>
                  <h3 className="font-display text-[18px] font-semibold my-2.5 text-white">{card.title}</h3>
                  <p className="text-[13.5px] text-[#A1A1A6]">{card.desc}</p>
                </motion.div>
              ))}

            </div>
          </div>
        </section>

        {/* ============================================================
             10 — AUTOMAÇÃO (CLEAN CRISP WHITE #FFFFFF)
        ============================================================ */}
        <section className="py-[80px] md:py-[150px] px-6 md:px-12 text-center bg-[#FFFFFF] text-[#1D1D1F] overflow-hidden">
          <motion.div {...fadeUp()}>
            <Eyebrow light>Automação</Eyebrow>
            <h2 className="font-display font-semibold text-[clamp(28px,5.5vw,44px)] leading-[1.15] tracking-[-0.01em] max-w-[22ch] mx-auto text-[#1D1D1F]">
              Enquanto você corta, tinge ou faz unha — o sistema trabalha.
            </h2>
          </motion.div>

          <div className="relative max-w-[1100px] mx-auto mt-14 grid sm:grid-cols-2 md:grid-cols-5 gap-4 md:gap-[16px]">
            <svg className="absolute hidden md:block overflow-visible top-1/2 left-0 w-full h-[2px] z-0" viewBox="0 0 800 4" preserveAspectRatio="none">
              <motion.path
                d="M0,2 L800,2" fill="none" stroke="url(#flowGradientLight)" strokeWidth="2"
                strokeDasharray="820"
                initial={{ strokeDashoffset: 820 }}
                whileInView={{ strokeDashoffset: 0 }}
                viewport={{ once: true, margin: '-20%' }}
                transition={{ duration: 1.3, ease: EASE }}
              />
            </svg>

            {[
              'Cliente agenda',
              'Sistema registra',
              'Horário fica ocupado',
              'Profissional é avisado',
              'Agenda continua organizada',
            ].map((step, i) => (
              <motion.div key={step} {...fadeUp(i * 0.08)} className="relative z-10 flex items-center justify-center gap-2.5 text-[13.5px] font-medium text-[#1D1D1F] bg-[#FFFFFF] border border-black/[0.08] rounded-full px-[16px] py-[11px] shadow-sm">
                <span className="w-[6px] h-[6px] rounded-full bg-[#D97706] shrink-0" />
                {step}
              </motion.div>
            ))}
          </div>

          <motion.div {...fadeUp(0.2)} className="max-w-[720px] mx-auto mt-16 flex flex-col md:flex-row items-center gap-8 bg-[#F5F5F7] border border-black/[0.08] rounded-[28px] p-8 text-left shadow-md">
            <PhoneFrame src="/images/map-dark.png" alt="Local e horários do estabelecimento" lightMode className="w-[140px] shrink-0 mx-auto md:mx-0" />
            <div>
              <h3 className="font-display text-[19px] font-semibold text-[#1D1D1F]">Local, horários e como chegar — tudo automático.</h3>
              <p className="text-[14px] text-[#6E6E73] mt-2 leading-relaxed">
                Seu cliente encontra o endereço, o horário de funcionamento e a rota até você,
                sem precisar perguntar nada.
              </p>
            </div>
          </motion.div>
        </section>

        {/* ============================================================
             11 — PLANOS (NOIR DARK #0A0A0C)
        ============================================================ */}
        <section id="planos" className="py-[80px] md:py-[150px] px-6 md:px-12 text-center bg-[#0A0A0C] text-white border-t border-white/[0.08]">
          <motion.div {...fadeUp()}>
            <Eyebrow>Planos</Eyebrow>
            <h2 className="font-display font-semibold text-[clamp(28px,5.5vw,44px)] leading-[1.15] tracking-[-0.01em] max-w-[20ch] mx-auto text-white">
              Quanto vale recuperar horas do seu dia?
            </h2>
            <p className="text-[16px] text-[#A1A1A6] mt-4 mx-auto">
              Escolha o plano que combina com o seu momento.
            </p>
          </motion.div>

          <div className="max-w-[1280px] mx-auto mt-14 grid md:grid-cols-3 gap-[20px] text-left">

            {/* SOLO */}
            <motion.div {...fadeUp(0.1)} className="bg-[#121216] border border-white/[0.08] rounded-[28px] p-[34px_28px] flex flex-col transition-all hover:border-white/20 hover:-translate-y-1.5 shadow-xl">
              <h3 className="font-display text-[22px] font-semibold text-white">Solo</h3>
              <p className="text-[13.5px] text-[#A1A1A6] mt-2.5 min-h-[42px]">Pra quem trabalha sozinho e quer parar de agendar pelo WhatsApp.</p>
              <p className="font-display text-[40px] font-semibold mt-6 text-white">
                <span className="text-[18px] align-super mr-0.5">R$</span>49<small className="text-[13px] font-normal text-[#71717A]">/mês</small>
              </p>
              <ul className="mt-[24px] flex flex-col gap-3 grow">
                {['Agenda online ilimitada', '1 profissional', 'Atendimento a domicílio', 'Lembretes automáticos'].map((item) => (
                  <li key={item} className="text-[13.5px] text-[#D4D4D8] pl-[20px] relative">
                    <span className="absolute left-0 text-[#F59E0B] font-bold">+</span>{item}
                  </li>
                ))}
              </ul>
              <Link to="/cadastro" className="mt-7 w-full inline-flex items-center justify-center px-6 py-3.5 rounded-full font-semibold text-[14.5px] border border-white/20 text-white hover:border-[#F59E0B] hover:text-[#F59E0B] transition-all">
                Começar agora
              </Link>
            </motion.div>

            {/* STUDIO (FEATURED) */}
            <motion.div
              {...fadeUp(0.2)}
              className="relative bg-[#16161C] border-2 border-[#F59E0B] rounded-[28px] p-[34px_28px] flex flex-col transition-all md:scale-105 hover:md:-translate-y-1.5 shadow-[0_20px_60px_-15px_rgba(245,158,11,0.3)] z-10"
              style={{ background: 'linear-gradient(160deg, rgba(245,158,11,0.12), rgba(18,18,22,0.95) 60%)' }}
            >
              <span className="absolute -top-[12px] left-[28px] text-black font-mono text-[10.5px] font-bold px-3.5 py-1.5 rounded-full shadow-lg" style={{ background: 'linear-gradient(135deg, #F59E0B, #FBBF24)' }}>
                Mais escolhido
              </span>
              <h3 className="font-display text-[22px] font-semibold text-white">Studio</h3>
              <p className="text-[13.5px] text-[#D4D4D8] mt-2.5 min-h-[42px]">Pra quem já tem equipe e quer o negócio inteiro organizado.</p>
              <p className="font-display text-[40px] font-semibold mt-6 text-[#F59E0B]">
                <span className="text-[18px] align-super mr-0.5">R$</span>89<small className="text-[13px] font-normal text-[#A1A1A6]">/mês</small>
              </p>
              <ul className="mt-[24px] flex flex-col gap-3 grow">
                {['Tudo do plano Solo', 'Até 5 profissionais', 'Gestão de equipe completa', 'Relatórios de desempenho', 'Suporte prioritário'].map((item) => (
                  <li key={item} className="text-[13.5px] text-white font-medium pl-[20px] relative">
                    <span className="absolute left-0 text-[#F59E0B] font-bold">+</span>{item}
                  </li>
                ))}
              </ul>
              <Link
                to="/cadastro"
                className="mt-7 w-full inline-flex items-center justify-center px-6 py-3.5 rounded-full font-bold text-[14.5px] text-black shadow-[0_20px_40px_-16px_rgba(245,158,11,0.6)] hover:scale-105 transition-all"
                style={{ background: 'linear-gradient(135deg, #F59E0B, #FBBF24)' }}
              >
                Começar agora
              </Link>
            </motion.div>

            {/* EQUIPE */}
            <motion.div {...fadeUp(0.3)} className="bg-[#121216] border border-white/[0.08] rounded-[28px] p-[34px_28px] flex flex-col transition-all hover:border-white/20 hover:-translate-y-1.5 shadow-xl">
              <h3 className="font-display text-[22px] font-semibold text-white">Equipe</h3>
              <p className="text-[13.5px] text-[#A1A1A6] mt-2.5 min-h-[42px]">Pra estabelecimentos maiores, com operação em escala.</p>
              <p className="font-display text-[40px] font-semibold mt-6 text-white">
                <span className="text-[18px] align-super mr-0.5">R$</span>149<small className="text-[13px] font-normal text-[#71717A]">/mês</small>
              </p>
              <ul className="mt-[24px] flex flex-col gap-3 grow">
                {['Tudo do plano Studio', 'Profissionais ilimitados', 'Múltiplas unidades', 'Gerente de conta dedicado'].map((item) => (
                  <li key={item} className="text-[13.5px] text-[#D4D4D8] pl-[20px] relative">
                    <span className="absolute left-0 text-[#F59E0B] font-bold">+</span>{item}
                  </li>
                ))}
              </ul>
              <Link to="/cadastro" className="mt-7 w-full inline-flex items-center justify-center px-6 py-3.5 rounded-full font-semibold text-[14.5px] border border-white/20 text-white hover:border-[#F59E0B] hover:text-[#F59E0B] transition-all">
                Começar agora
              </Link>
            </motion.div>

          </div>
          <p className="text-[12px] text-[#71717A] mt-7 font-mono">Preços ilustrativos — ajuste conforme sua tabela real.</p>
        </section>

        {/* ============================================================
             12 — CTA FINAL (NOIR DARK #000000)
        ============================================================ */}
        <section className="relative text-center py-[110px] px-6 bg-[#000000] overflow-hidden">
          <div className="absolute inset-0 -z-10" style={{ background: 'radial-gradient(55% 75% at 50% 0%, rgba(245,158,11,0.2), transparent 65%), #000000' }} />
          <motion.div {...fadeUp()}>
            <h2 className="font-display font-semibold text-[clamp(30px,6vw,52px)] leading-[1.15] max-w-[18ch] mx-auto mb-[20px] text-white">
              Você cuida do cliente.<br />
              <em className="not-italic text-[#F59E0B]">O Corte Flow cuida da agenda.</em>
            </h2>
            <p className="text-[#A1A1A6] text-[16.5px] mb-9">Seu próximo cliente pode estar tentando agendar agora. Comece hoje.</p>
            <Link
              to="/cadastro"
              className="inline-flex items-center justify-center px-8 py-[17px] rounded-full font-bold text-[16px] text-black shadow-[0_20px_40px_-16px_rgba(245,158,11,0.6)] hover:scale-105 transition-all"
              style={{ background: 'linear-gradient(135deg, #F59E0B, #FBBF24)' }}
            >
              Começar agora
            </Link>
          </motion.div>
        </section>
      </main>

      {/* ============================================================
           FOOTER (NOIR PURE BLACK #000000)
      ============================================================ */}
      <footer className="pt-14 px-6 md:px-12 pb-12 border-t border-white/[0.08] bg-[#000000]">
        <div className="max-w-[1280px] mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <a href="#hero" className="inline-flex items-center gap-[9px] font-display font-bold text-[19px] text-white">
            <span className="w-[9px] h-[9px] rounded-full bg-[#F59E0B] shadow-[0_0_14px_rgba(245,158,11,0.8)]" />
            Corte Flow
          </a>

          <nav className="flex flex-wrap justify-center gap-6 md:gap-[26px]">
            <a href="#solucao" className="text-[13px] text-[#71717A] hover:text-[#F59E0B] transition-colors">Solução</a>
            <a href="#domicilio" className="text-[13px] text-[#71717A] hover:text-[#F59E0B] transition-colors">Domicílio</a>
            <a href="#para-quem" className="text-[13px] text-[#71717A] hover:text-[#F59E0B] transition-colors">Para quem é</a>
            <a href="#planos" className="text-[13px] text-[#71717A] hover:text-[#F59E0B] transition-colors">Planos</a>
          </nav>

          <p className="text-[12px] text-[#71717A]">© {new Date().getFullYear()} Corte Flow. Todos os direitos reservados.</p>
        </div>
      </footer>

      <CookieConsentBanner />
    </div>
  );
}