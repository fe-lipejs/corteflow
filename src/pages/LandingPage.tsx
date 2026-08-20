import { motion, animate, useInView, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useState, useEffect, useRef, type ReactNode } from 'react';
import CookieConsentBanner from '../components/cookies/CookieConsentBanner';

/* ============================================================
   TOKENS (hardcoded on purpose — self-contained, no config dependency)
   bg base      #0B0906   near-black, warm (not gray/blue)
   bg elevated  #14100A
   bg card      #1B140C
   border       #2A2116   /  strong #3A2E1D
   text         #F7F2E9   /  muted #B7A996  /  dim #8C8170
   accent       #E58415   /  soft #F5A94B
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

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.16em] uppercase text-[#E58415] mb-4">
      <span className="w-4 h-[1px] bg-[#E58415]" />
      {children}
    </span>
  );
}

function PhoneFrame({
  src, alt, className = '', tilt = 0, glow = false,
}: { src: string; alt: string; className?: string; tilt?: number; glow?: boolean }) {
  return (
    <div className={className} style={tilt ? { transform: `rotate(${tilt}deg)` } : undefined}>
      <div
        className="relative rounded-[2.3rem] border border-[#3A2E1D] bg-[#0B0906] p-[7px] shadow-[0_50px_90px_-35px_rgba(0,0,0,0.8)]"
        style={glow ? { boxShadow: '0_50px_90px_-35px_rgba(0,0,0,0.8), 0 0 60px -10px rgba(229,132,21,0.25)' as unknown as string } : undefined}
      >
        <span className="absolute left-1/2 top-[9px] -translate-x-1/2 w-14 h-[12px] rounded-full bg-[#0B0906] border border-[#2A2116] z-10" />
        <div className="relative rounded-[1.8rem] overflow-hidden aspect-[9/19]">
          <img src={src} alt={alt} className="absolute inset-0 w-full h-full object-cover object-top" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-white/[0.04] pointer-events-none" />
        </div>
      </div>
    </div>
  );
}

function ServiceRadius() {
  return (
    <div className="relative w-[228px] h-[228px] mx-auto shrink-0">
      {[0, 38, 76].map((inset) => (
        <span key={inset} className="absolute rounded-full border border-dashed border-[#E58415]/25" style={{ inset }} />
      ))}
      <div className="absolute inset-0 rounded-full overflow-hidden">
        <div
          className="absolute inset-0 animate-spin"
          style={{
            animationDuration: '6s',
            background: 'conic-gradient(from 0deg, rgba(229,132,21,0.4), transparent 35%)',
          }}
        />
      </div>
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[56px] h-[56px] rounded-full flex items-center justify-center font-mono text-[10.5px] font-semibold text-[#1A1208]"
        style={{ background: 'linear-gradient(135deg,#E58415,#F5A94B)', boxShadow: '0 0 44px rgba(229,132,21,0.5)' }}
      >
        Você
      </div>
      <span className="absolute top-[10%] -right-[8%] font-mono text-[10px] px-2.5 py-[6px] rounded-full whitespace-nowrap bg-[#E58415]/15 text-[#F5A94B] border border-[#E58415]/40">
        Dentro do raio
      </span>
      <span className="absolute bottom-[6%] -left-[12%] font-mono text-[10px] px-2.5 py-[6px] rounded-full whitespace-nowrap bg-white/[0.04] text-[#8C8170] border border-white/10">
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
    <div className="font-body bg-[#0B0906] text-[#F7F2E9] selection:bg-[#E58415]/30 selection:text-white min-h-screen overflow-x-hidden">

      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <linearGradient id="flowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#E58415" />
            <stop offset="100%" stopColor="#F5A94B" />
          </linearGradient>
        </defs>
      </svg>

      {/* =========================
           NAV
      ========================== */}
      <header className={`fixed top-0 left-0 right-0 z-[100] px-6 md:px-12 transition-all duration-300 border-b ${isScrolled ? 'bg-[#0B0906]/85 backdrop-blur-[14px] border-[#2A2116] py-3' : 'border-transparent py-[18px]'}`}>
        <div className="max-w-[1280px] mx-auto flex items-center justify-between gap-6">
          <a href="#hero" className="inline-flex items-center gap-[9px] font-display font-semibold text-[19px] text-[#F7F2E9]">
            <span className="w-[9px] h-[9px] rounded-full" style={{ background: 'linear-gradient(135deg,#E58415,#F5A94B)', boxShadow: '0 0 14px rgba(229,132,21,0.7)' }} />
            Corte Flow
          </a>

          <nav className="hidden md:flex gap-8">
            <a href="#solucao" className="text-[14.5px] text-[#B7A996] hover:text-[#F5A94B] transition-colors">Solução</a>
            <a href="#domicilio" className="text-[14.5px] text-[#B7A996] hover:text-[#F5A94B] transition-colors">Domicílio</a>
            <a href="#para-quem" className="text-[14.5px] text-[#B7A996] hover:text-[#F5A94B] transition-colors">Para quem é</a>
            <a href="#planos" className="text-[14.5px] text-[#B7A996] hover:text-[#F5A94B] transition-colors">Planos</a>
          </nav>

          <div className="flex items-center gap-[14px]">
            <a
              href="#planos"
              className="hidden md:inline-flex items-center justify-center px-5 py-2.5 rounded-full font-semibold text-[13px] text-[#1A1208] shadow-[0_14px_30px_-12px_rgba(229,132,21,0.55)] hover:-translate-y-[2px] transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5A94B]"
              style={{ background: 'linear-gradient(135deg,#E58415,#F5A94B)' }}
            >
              Começar agora
            </a>

            <button
              aria-label="Abrir menu"
              className="md:hidden w-10 h-10 flex flex-col items-center justify-center gap-[5px]"
              onClick={() => setIsMobileMenuOpen((v) => !v)}
            >
              <span className={`block w-5 h-[2px] bg-[#F7F2E9] transition-all duration-300 ${isMobileMenuOpen ? 'translate-y-[7px] rotate-45' : ''}`} />
              <span className={`block w-5 h-[2px] bg-[#F7F2E9] transition-all duration-300 ${isMobileMenuOpen ? 'opacity-0' : ''}`} />
              <span className={`block w-5 h-[2px] bg-[#F7F2E9] transition-all duration-300 ${isMobileMenuOpen ? '-translate-y-[7px] -rotate-45' : ''}`} />
            </button>
          </div>
        </div>

        <div className={`fixed inset-0 top-[60px] bg-[#0B0906] flex flex-col items-center justify-center gap-[30px] transition-all duration-500 ${isMobileMenuOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-full pointer-events-none'}`}>
          <a href="#solucao" onClick={closeMobileNav} className="font-display text-[26px]">Solução</a>
          <a href="#domicilio" onClick={closeMobileNav} className="font-display text-[26px]">Atendimento a domicílio</a>
          <a href="#para-quem" onClick={closeMobileNav} className="font-display text-[26px]">Para quem é</a>
          <a href="#planos" onClick={closeMobileNav} className="font-display text-[26px]">Planos</a>
          <a
            href="#planos"
            onClick={closeMobileNav}
            className="mt-4 px-8 py-4 rounded-full font-semibold text-[16px] text-[#1A1208]"
            style={{ background: 'linear-gradient(135deg,#E58415,#F5A94B)' }}
          >
            Começar agora
          </a>
        </div>
      </header>

      <main>
        {/* =========================
             01 — HERO
        ========================== */}
        <section id="hero" className="relative min-h-[100svh] flex flex-col justify-center pt-[110px] overflow-hidden">

          <div className="absolute inset-0 z-0">
            <img src="/images/hero-atendimento.jpg" alt="" className="w-full h-full object-cover opacity-[0.16]" />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #0B0906 0%, rgba(11,9,6,0.75) 35%, #0B0906 88%), radial-gradient(55% 45% at 82% 8%, rgba(229,132,21,0.16), transparent 60%)' }} />
          </div>

          <div className="relative z-10 max-w-[1280px] w-full mx-auto px-6 md:px-12 grid md:grid-cols-[1.05fr_0.95fr] gap-14 md:gap-10 items-center">

            <motion.div {...fadeUp()} className="text-left">
              <Eyebrow>Agendamento &amp; gestão · Beleza e estética</Eyebrow>
              <h1 className="font-display font-semibold text-[clamp(40px,9vw,74px)] leading-[1.03] tracking-[-0.02em] m-0 mb-[22px]">
                Seu negócio agenda.<br />
                <em className="not-italic" style={{ background: 'linear-gradient(135deg,#E58415,#F5A94B)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
                  Você atende.
                </em>
              </h1>
              <p className="text-[clamp(16px,2vw,19px)] text-[#B7A996] max-w-[50ch] mb-[34px]">
                O Corte Flow assume sua agenda, organiza sua equipe e confirma atendimento a
                domicílio sozinho — pra você focar em quem está na cadeira, não no WhatsApp.
              </p>

              <div className="flex flex-wrap gap-[14px] mb-[46px]">
                <a
                  href="#planos"
                  className="inline-flex items-center justify-center px-8 py-[17px] rounded-full font-semibold text-[16px] text-[#1A1208] shadow-[0_20px_40px_-16px_rgba(229,132,21,0.5)] hover:-translate-y-[2px] transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5A94B]"
                  style={{ background: 'linear-gradient(135deg,#E58415,#F5A94B)' }}
                >
                  Começar agora
                </a>
                <a
                  href="#solucao"
                  className="inline-flex items-center justify-center px-8 py-[17px] rounded-full font-semibold text-[16px] text-[#F7F2E9] border border-[#3A2E1D] hover:border-[#F5A94B] hover:text-[#F5A94B] transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5A94B]"
                >
                  Conhecer o Corte Flow
                </a>
              </div>

              <div className="flex gap-[30px] flex-wrap">
                <div className="flex flex-col">
                  <span className="font-display text-[28px] font-semibold text-[#F5A94B]"><CountUp to={24} suffix="h" /></span>
                  <span className="text-[12px] text-[#8C8170] max-w-[13ch]">devolvidas por mês</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-display text-[28px] font-semibold text-[#F5A94B]"><CountUp to={10} suffix="km" /></span>
                  <span className="text-[12px] text-[#8C8170] max-w-[13ch]">de raio configurável</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-display text-[28px] font-semibold text-[#F5A94B]"><CountUp to={100} suffix="%" /></span>
                  <span className="text-[12px] text-[#8C8170] max-w-[13ch]">da agenda no automático</span>
                </div>
              </div>
            </motion.div>

            <motion.div {...fadeUp(0.12)} className="relative w-full max-w-[320px] mx-auto md:max-w-none md:mx-0 md:justify-self-end">
              <PhoneFrame src="/images/custom-dark.png" alt="Agenda do Corte Flow" glow tilt={-4} className="w-[230px] md:w-[260px] mx-auto" />

              <div className="absolute top-[6%] -left-[8%] md:-left-[14%] z-20 flex items-center gap-2.5 p-3 px-4 rounded-[18px] bg-[#151009]/95 backdrop-blur-[10px] border border-[#2A2116] animate-float" style={{ animationDelay: '0.3s' }}>
                <span className="text-[16px]">📍</span>
                <div>
                  <strong className="block text-[12.5px] font-semibold">Dentro do raio</strong>
                  <span className="block text-[10.5px] text-[#8C8170]">Atendimento confirmado</span>
                </div>
              </div>

              <div className="absolute bottom-[4%] -right-[6%] md:-right-[12%] z-20 flex items-center gap-2.5 p-3 px-4 rounded-[18px] bg-[#151009]/95 backdrop-blur-[10px] border border-[#2A2116] animate-float" style={{ animationDelay: '1.1s' }}>
                <span className="text-[16px]">✅</span>
                <div>
                  <strong className="block text-[12.5px] font-semibold">09:03 reservado</strong>
                  <span className="block text-[10.5px] text-[#8C8170]">Agenda atualizada sozinha</span>
                </div>
              </div>
            </motion.div>

          </div>

          <div className="relative z-10 flex items-center justify-center gap-2 mt-16 font-mono text-[11px] tracking-[0.1em] uppercase text-[#8C8170]">
            <span className="w-[1px] h-6 bg-gradient-to-b from-[#E58415] to-transparent animate-scrollcue" />
            role para ver
          </div>
        </section>

        {/* =========================
             02 — DOR
        ========================== */}
        <section className="text-center py-16 md:py-[150px] px-6">
          <motion.div {...fadeUp()}>
            <p className="font-mono text-[12.5px] tracking-[0.03em] text-[#8C8170] max-w-[46ch] mx-auto mb-5">
              Responder mensagem. Perguntar endereço. Confirmar horário. Torcer pra não esquecer.
            </p>
            <h2 className="font-display text-[clamp(26px,5vw,40px)] font-medium max-w-[19ch] mx-auto leading-[1.2]">
              Sua agenda virou um <em className="not-italic text-[#F5A94B]">segundo trabalho</em>.
            </h2>
          </motion.div>
        </section>

        {/* =========================
             03 — SOLUÇÃO
        ========================== */}
        <section id="solucao" className="py-[80px] md:py-[150px] px-6 md:px-12">
          <div className="max-w-[1280px] mx-auto grid md:grid-cols-2 gap-12 md:gap-[72px] items-center">

            <motion.div {...fadeUp()}>
              <Eyebrow>O Corte Flow</Eyebrow>
              <h2 className="font-display font-semibold text-[clamp(28px,5.5vw,44px)] leading-[1.15] tracking-[-0.01em]">
                Não é uma agenda.<br />É o motor do seu negócio.
              </h2>
              <p className="text-[clamp(16px,2vw,18px)] text-[#B7A996] max-w-[46ch] mt-5">
                Menos mensagem, menos confusão, mais clientes na cadeira. O Corte Flow assume
                o agendamento, organiza sua equipe e ainda resolve o atendimento a domicílio —
                sozinho, sem você no meio de cada conversa.
              </p>

              <div className="flex flex-wrap gap-3 mt-[30px]">
                {['Agenda online', 'Gestão completa', 'Atendimento a domicílio'].map((tag) => (
                  <span key={tag} className="text-[13px] font-medium px-[16px] py-[9px] rounded-full border border-[#3A2E1D] text-[#B7A996]">
                    {tag}
                  </span>
                ))}
              </div>
            </motion.div>

            <motion.div {...fadeUp(0.1)} className="rounded-[28px] overflow-hidden border border-[#2A2116] aspect-[16/11]">
              <img src="/images/barbearia.jpg" alt="Barbearia usando o Corte Flow" className="w-full h-full object-cover" />
            </motion.div>

          </div>
        </section>

        {/* =========================
             04 — AGENDA ONLINE
        ========================== */}
        <section id="agenda" className="py-[80px] md:py-[150px] px-6 md:px-12 bg-[#0E0B07]">
          <div className="max-w-[1280px] mx-auto grid md:grid-cols-[0.85fr_1fr] gap-10 md:gap-20 items-center">

            <motion.div {...fadeUp()} className="relative flex justify-center">
              <div className="absolute inset-0 rounded-[32px] overflow-hidden -z-10 opacity-30">
                <img src="/images/cliente-app.jpg" alt="" className="w-full h-full object-cover object-top blur-[2px]" />
                <div className="absolute inset-0 bg-[#0E0B07]/60" />
              </div>
              <PhoneFrame src="/images/custom-light.png" alt="Página do cliente no Corte Flow" className="w-[230px] my-10" />
            </motion.div>

            <motion.div {...fadeUp(0.1)}>
              <Eyebrow>Agenda online</Eyebrow>
              <h2 className="font-display font-semibold text-[clamp(28px,5.5vw,44px)] leading-[1.15] tracking-[-0.01em]">Seu cliente agenda sozinho.</h2>
              <p className="text-[clamp(16px,2vw,18px)] text-[#B7A996] max-w-[46ch] mt-5">
                Pare de responder mensagem pra marcar horário. O cliente escolhe o serviço,
                o profissional e o horário — a qualquer hora, sem esperar você ficar livre.
              </p>

              <ul className="mt-[26px] flex flex-col gap-[14px]">
                {[
                  'Sem trocar mensagem pra confirmar disponibilidade',
                  'Sem cliente esperando resposta e desistindo',
                  'Sem horário perdido por falta de organização',
                ].map((item) => (
                  <li key={item} className="relative pl-[28px] text-[15px] text-[#B7A996]">
                    <span className="absolute left-0 top-[3px] w-[16px] h-[16px] rounded-full border border-[#E58415]/60 flex items-center justify-center text-[10px] text-[#F5A94B]">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>

          </div>
        </section>

        {/* =========================
             05 — MOTOR DE GESTÃO
        ========================== */}
        <section id="gestao" className="py-[80px] md:py-[150px] px-6 md:px-12">
          <div className="max-w-[640px] mx-auto text-center mb-16">
            <Eyebrow>Motor de gestão</Eyebrow>
            <h2 className="font-display font-semibold text-[clamp(28px,5.5vw,44px)] leading-[1.15] tracking-[-0.01em]">Administre o negócio inteiro em um lugar.</h2>
            <p className="text-[clamp(16px,2vw,18px)] text-[#B7A996] max-w-[46ch] mt-5 mx-auto">
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
              <motion.div key={node.num} {...fadeUp(i * 0.08)} className="relative z-10 bg-[#151009] border border-[#2A2116] rounded-[18px] p-[24px_22px]">
                <span className="inline-flex font-mono text-[11px] text-[#E58415] mb-2.5">{node.num}</span>
                <h3 className="font-display text-[18px] font-semibold mb-2">{node.title}</h3>
                <p className="text-[14px] text-[#8C8170]">{node.desc}</p>
              </motion.div>
            ))}
          </div>

          <motion.div {...fadeUp()} className="max-w-[1100px] mx-auto rounded-[32px] border border-[#2A2116] bg-[#0E0B07] p-8 md:p-14 grid md:grid-cols-[1fr_auto] gap-10 items-center">
            <div>
              <h3 className="font-display text-[22px] md:text-[26px] font-semibold max-w-[20ch]">O painel que mostra tudo isso, ao vivo.</h3>
              <p className="text-[15px] text-[#B7A996] mt-3 max-w-[42ch]">
                Agendamentos do dia, faturamento previsto, ocupação e novos clientes — sem
                precisar abrir uma planilha ou contar no caderno.
              </p>
            </div>
            <PhoneFrame src="/images/dashboard-dark.png" alt="Painel do administrador" className="w-[210px] mx-auto" tilt={2} />
          </motion.div>
        </section>

        {/* =========================
             06 — EQUIPES
        ========================== */}
        <section className="py-[80px] md:py-[150px] px-6 md:px-12">
          <div className="max-w-[1280px] mx-auto grid md:grid-cols-[1fr_0.85fr] gap-10 md:gap-20 items-center">

            <motion.div {...fadeUp(0.1)} className="md:order-2 rounded-[28px] overflow-hidden border border-[#2A2116]">
              <img src="/images/salao-cachos.jpg" alt="Profissional atendendo cliente" className="w-full aspect-[4/5] object-cover" />
            </motion.div>

            <motion.div {...fadeUp()} className="md:order-1">
              <Eyebrow>Equipes</Eyebrow>
              <h2 className="font-display font-semibold text-[clamp(28px,5.5vw,44px)] leading-[1.15] tracking-[-0.01em]">
                Começou sozinho? Perfeito.<br />Tem equipe? Melhor ainda.
              </h2>
              <p className="text-[clamp(16px,2vw,18px)] text-[#B7A996] max-w-[46ch] mt-5">
                Cadastre seus profissionais e organize a equipe em minutos. Cada um vê só os
                próprios agendamentos, enquanto você tem a visão completa do negócio.
              </p>
              <p className="mt-[26px] font-display italic text-[20px] text-[#F5A94B]">
                Seu negócio cresce. O Corte Flow cresce junto.
              </p>
            </motion.div>

          </div>
        </section>

        {/* =========================
             07 — DOMICÍLIO (diferencial)
        ========================== */}
        <section id="domicilio" className="bg-[#0E0B07] border-y border-[#2A2116] py-[80px] md:py-[150px] px-6 md:px-12 overflow-hidden">
          <div className="max-w-[1280px] mx-auto grid md:grid-cols-[1fr_0.8fr] gap-12 md:gap-20 items-center mb-[76px]">

            <motion.div {...fadeUp()}>
              <Eyebrow>Grande diferencial</Eyebrow>
              <h2 className="font-display font-semibold text-[clamp(28px,5.5vw,44px)] leading-[1.15] tracking-[-0.01em]">
                Você define o raio.<br />O Corte Flow faz o resto.
              </h2>
              <p className="text-[clamp(16px,2vw,18px)] text-[#B7A996] max-w-[46ch] mt-5">
                Manicures, barbeiros e cabeleireiros que atendem em domicílio não precisam
                mais perguntar endereço, verificar distância e combinar horário no WhatsApp.
                O cliente informa onde está — o sistema confere se está dentro da área de
                atendimento e libera o horário na hora.
              </p>

              <div className="mt-10">
                <ServiceRadius />
                <p className="text-[13px] text-[#8C8170] italic text-center mt-4">Ex.: "Atendo clientes em um raio de até 10 km."</p>
              </div>
            </motion.div>

            <motion.div {...fadeUp(0.1)} className="rounded-[28px] overflow-hidden border border-[#2A2116] md:order-2">
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
              <motion.div key={step} {...fadeUp(i * 0.08)} className="relative z-10 flex items-center gap-3 text-[13.5px] text-[#B7A996] bg-[#151009] border border-[#2A2116] rounded-full px-[16px] py-[11px]">
                <span className="inline-flex items-center justify-center w-[20px] h-[20px] rounded-full text-[#1A1208] text-[10.5px] font-bold font-mono shrink-0" style={{ background: 'linear-gradient(135deg,#E58415,#F5A94B)' }}>{i + 1}</span>
                {step}
              </motion.div>
            ))}
          </div>

          <p className="text-center font-display italic text-[clamp(21px,3.2vw,28px)] text-[#F5A94B] mt-[68px]">"Você atende. O Corte Flow organiza."</p>
        </section>

        {/* =========================
             08 — PERSONALIZAÇÃO
        ========================== */}
        <section className="py-[80px] md:py-[140px] px-6 md:px-12">
          <div className="max-w-[640px] mx-auto text-center mb-14">
            <Eyebrow>Sua marca, do seu jeito</Eyebrow>
            <h2 className="font-display font-semibold text-[clamp(26px,5vw,40px)] leading-[1.15] tracking-[-0.01em]">A página do seu cliente, com a sua cara.</h2>
            <p className="text-[15.5px] text-[#B7A996] mt-4 mx-auto max-w-[44ch]">
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
                <PhoneFrame src={theme.src} alt={`Tema ${theme.label}`} className="w-[150px] md:w-[170px]" tilt={i === 1 ? 0 : i === 0 ? -3 : 3} />
                <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-[#8C8170]">{theme.label}</span>
              </motion.div>
            ))}
          </div>
        </section>

        {/* =========================
             09 — PARA QUEM É
        ========================== */}
        <section id="para-quem" className="py-[80px] md:py-[150px] px-6 md:px-12 bg-[#0E0B07]">
          <div className="max-w-[1280px] mx-auto">
            <Eyebrow>Para quem é</Eyebrow>
            <h2 className="font-display font-semibold text-[clamp(28px,5.5vw,44px)] leading-[1.15] tracking-[-0.01em] max-w-[16ch]">
              Feito para quem vive de deixar gente bonita.
            </h2>

            <div className="mt-14 grid md:grid-cols-3 gap-[16px] md:auto-rows-[minmax(150px,auto)]">

              <motion.div {...fadeUp(0.1)} className="rounded-[28px] overflow-hidden border border-[#2A2116] md:row-span-2">
                <img src="/images/estilo-corte.jpg" alt="Estilo de corte" className="w-full h-full object-cover aspect-[3/4]" />
              </motion.div>

              {[
                { icon: '💈', title: 'Barbearias', desc: 'Mais clientes. Menos mensagens.' },
                { icon: '💇', title: 'Salões de beleza', desc: 'Toda a equipe organizada em um só lugar.' },
                { icon: '💅', title: 'Manicures', desc: 'Agenda cheia sem ficar respondendo o celular.' },
              ].map((card, i) => (
                <motion.div key={card.title} {...fadeUp(0.15 + i * 0.08)} className="bg-[#151009] border border-[#2A2116] rounded-[18px] p-[26px_24px] transition-all hover:border-[#E58415]/40 hover:-translate-y-1">
                  <span className="text-[24px]">{card.icon}</span>
                  <h3 className="font-display text-[18px] font-semibold my-2.5">{card.title}</h3>
                  <p className="text-[13.5px] text-[#8C8170]">{card.desc}</p>
                </motion.div>
              ))}

              <motion.div {...fadeUp(0.5)} className="rounded-[28px] overflow-hidden border border-[#2A2116] md:row-span-2">
                <img src="/images/barbeiro-corte.jpg" alt="Barbeiro atendendo" className="w-full h-full object-cover aspect-[3/4]" />
              </motion.div>

              {[
                { icon: '✂️', title: 'Profissionais autônomos', desc: 'Seu negócio profissional desde o primeiro cliente.' },
                { icon: '🏠', title: 'Atendimento a domicílio', desc: 'Você define onde atende. O sistema verifica o resto.' },
              ].map((card, i) => (
                <motion.div key={card.title} {...fadeUp(0.6 + i * 0.08)} className="bg-[#151009] border border-[#2A2116] rounded-[18px] p-[26px_24px] transition-all hover:border-[#E58415]/40 hover:-translate-y-1">
                  <span className="text-[24px]">{card.icon}</span>
                  <h3 className="font-display text-[18px] font-semibold my-2.5">{card.title}</h3>
                  <p className="text-[13.5px] text-[#8C8170]">{card.desc}</p>
                </motion.div>
              ))}

            </div>
          </div>
        </section>

        {/* =========================
             10 — AUTOMAÇÃO
        ========================== */}
        <section className="py-[80px] md:py-[150px] px-6 md:px-12 text-center overflow-hidden">
          <motion.div {...fadeUp()}>
            <Eyebrow>Automação</Eyebrow>
            <h2 className="font-display font-semibold text-[clamp(28px,5.5vw,44px)] leading-[1.15] tracking-[-0.01em] max-w-[22ch] mx-auto">
              Enquanto você corta, tinge ou faz unha — o sistema trabalha.
            </h2>
          </motion.div>

          <div className="relative max-w-[1100px] mx-auto mt-14 grid sm:grid-cols-2 md:grid-cols-5 gap-4 md:gap-[16px]">
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
              'Cliente agenda',
              'Sistema registra',
              'Horário fica ocupado',
              'Profissional é avisado',
              'Agenda continua organizada',
            ].map((step, i) => (
              <motion.div key={step} {...fadeUp(i * 0.08)} className="relative z-10 flex items-center justify-center gap-2.5 text-[13.5px] text-[#B7A996] bg-[#151009] border border-[#2A2116] rounded-full px-[16px] py-[11px]">
                <span className="w-[6px] h-[6px] rounded-full bg-[#E58415] shrink-0" />
                {step}
              </motion.div>
            ))}
          </div>

          <motion.div {...fadeUp(0.2)} className="max-w-[720px] mx-auto mt-16 flex flex-col md:flex-row items-center gap-8 bg-[#0E0B07] border border-[#2A2116] rounded-[28px] p-8 text-left">
            <PhoneFrame src="/images/map-dark.png" alt="Local e horários do estabelecimento" className="w-[140px] shrink-0 mx-auto md:mx-0" />
            <div>
              <h3 className="font-display text-[19px] font-semibold">Local, horários e como chegar — tudo automático.</h3>
              <p className="text-[14px] text-[#8C8170] mt-2">
                Seu cliente encontra o endereço, o horário de funcionamento e a rota até você,
                sem precisar perguntar nada.
              </p>
            </div>
          </motion.div>
        </section>

        {/* =========================
             11 — PLANOS
        ========================== */}
        <section id="planos" className="py-[80px] md:py-[150px] px-6 md:px-12 text-center bg-[#0E0B07]">
          <motion.div {...fadeUp()}>
            <Eyebrow>Planos</Eyebrow>
            <h2 className="font-display font-semibold text-[clamp(28px,5.5vw,44px)] leading-[1.15] tracking-[-0.01em] max-w-[20ch] mx-auto">
              Quanto vale recuperar horas do seu dia?
            </h2>
            <p className="text-[16px] text-[#B7A996] mt-4 mx-auto">
              Escolha o plano que combina com o seu momento.
            </p>
          </motion.div>

          <div className="max-w-[1280px] mx-auto mt-14 grid md:grid-cols-3 gap-[20px] text-left">

            <motion.div {...fadeUp(0.1)} className="bg-[#151009] border border-[#2A2116] rounded-[28px] p-[34px_28px] flex flex-col transition-all hover:-translate-y-1.5">
              <h3 className="font-display text-[22px] font-semibold">Solo</h3>
              <p className="text-[13.5px] text-[#8C8170] mt-2.5 min-h-[42px]">Pra quem trabalha sozinho e quer parar de agendar pelo WhatsApp.</p>
              <p className="font-display text-[40px] font-semibold mt-6">
                <span className="text-[18px] align-super mr-0.5">R$</span>49<small className="text-[13px] font-normal text-[#8C8170]">/mês</small>
              </p>
              <ul className="mt-[24px] flex flex-col gap-3 grow">
                {['Agenda online ilimitada', '1 profissional', 'Atendimento a domicílio', 'Lembretes automáticos'].map((item) => (
                  <li key={item} className="text-[13.5px] text-[#B7A996] pl-[20px] relative">
                    <span className="absolute left-0 text-[#F5A94B] font-bold">+</span>{item}
                  </li>
                ))}
              </ul>
              <Link to="/cadastro" className="mt-7 w-full inline-flex items-center justify-center px-6 py-3.5 rounded-full font-semibold text-[14.5px] border border-[#3A2E1D] text-[#F7F2E9] hover:border-[#F5A94B] hover:text-[#F5A94B] transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5A94B]">
                Começar agora
              </Link>
            </motion.div>

            <motion.div
              {...fadeUp(0.2)}
              className="relative bg-[#1B140C] border border-[#E58415]/50 rounded-[28px] p-[34px_28px] flex flex-col transition-all md:scale-105 hover:md:-translate-y-1.5"
              style={{ background: 'linear-gradient(160deg, rgba(229,132,21,0.09), rgba(21,16,9,0.4) 60%), #1B140C' }}
            >
              <span className="absolute -top-[12px] left-[28px] text-[#1A1208] font-mono text-[10.5px] font-semibold px-3.5 py-1.5 rounded-full" style={{ background: 'linear-gradient(135deg,#E58415,#F5A94B)' }}>
                Mais escolhido
              </span>
              <h3 className="font-display text-[22px] font-semibold">Studio</h3>
              <p className="text-[13.5px] text-[#8C8170] mt-2.5 min-h-[42px]">Pra quem já tem equipe e quer o negócio inteiro organizado.</p>
              <p className="font-display text-[40px] font-semibold mt-6">
                <span className="text-[18px] align-super mr-0.5">R$</span>89<small className="text-[13px] font-normal text-[#8C8170]">/mês</small>
              </p>
              <ul className="mt-[24px] flex flex-col gap-3 grow">
                {['Tudo do plano Solo', 'Até 5 profissionais', 'Gestão de equipe completa', 'Relatórios de desempenho', 'Suporte prioritário'].map((item) => (
                  <li key={item} className="text-[13.5px] text-[#B7A996] pl-[20px] relative">
                    <span className="absolute left-0 text-[#F5A94B] font-bold">+</span>{item}
                  </li>
                ))}
              </ul>
              <Link
                to="/cadastro"
                className="mt-7 w-full inline-flex items-center justify-center px-6 py-3.5 rounded-full font-semibold text-[14.5px] text-[#1A1208] shadow-[0_20px_40px_-16px_rgba(229,132,21,0.5)] hover:-translate-y-[2px] transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5A94B]"
                style={{ background: 'linear-gradient(135deg,#E58415,#F5A94B)' }}
              >
                Começar agora
              </Link>
            </motion.div>

            <motion.div {...fadeUp(0.3)} className="bg-[#151009] border border-[#2A2116] rounded-[28px] p-[34px_28px] flex flex-col transition-all hover:-translate-y-1.5">
              <h3 className="font-display text-[22px] font-semibold">Equipe</h3>
              <p className="text-[13.5px] text-[#8C8170] mt-2.5 min-h-[42px]">Pra estabelecimentos maiores, com operação em escala.</p>
              <p className="font-display text-[40px] font-semibold mt-6">
                <span className="text-[18px] align-super mr-0.5">R$</span>149<small className="text-[13px] font-normal text-[#8C8170]">/mês</small>
              </p>
              <ul className="mt-[24px] flex flex-col gap-3 grow">
                {['Tudo do plano Studio', 'Profissionais ilimitados', 'Múltiplas unidades', 'Gerente de conta dedicado'].map((item) => (
                  <li key={item} className="text-[13.5px] text-[#B7A996] pl-[20px] relative">
                    <span className="absolute left-0 text-[#F5A94B] font-bold">+</span>{item}
                  </li>
                ))}
              </ul>
              <Link to="/cadastro" className="mt-7 w-full inline-flex items-center justify-center px-6 py-3.5 rounded-full font-semibold text-[14.5px] border border-[#3A2E1D] text-[#F7F2E9] hover:border-[#F5A94B] hover:text-[#F5A94B] transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5A94B]">
                Começar agora
              </Link>
            </motion.div>

          </div>
          <p className="text-[12px] text-[#8C8170] mt-7">Preços ilustrativos — ajuste conforme sua tabela real.</p>
        </section>

        {/* =========================
             12 — CTA FINAL
        ========================== */}
        <section className="relative text-center py-[110px] px-6 overflow-hidden">
          <div className="absolute inset-0 -z-10" style={{ background: 'radial-gradient(55% 75% at 50% 0%, rgba(229,132,21,0.14), transparent 65%), #0B0906' }} />
          <motion.div {...fadeUp()}>
            <h2 className="font-display font-semibold text-[clamp(30px,6vw,52px)] leading-[1.15] max-w-[18ch] mx-auto mb-[20px]">
              Você cuida do cliente.<br />
              <em className="not-italic text-[#F5A94B]">O Corte Flow cuida da agenda.</em>
            </h2>
            <p className="text-[#B7A996] text-[16.5px] mb-9">Seu próximo cliente pode estar tentando agendar agora. Comece hoje.</p>
            <Link
              to="/cadastro"
              className="inline-flex items-center justify-center px-8 py-[17px] rounded-full font-semibold text-[16px] text-[#1A1208] shadow-[0_20px_40px_-16px_rgba(229,132,21,0.5)] hover:-translate-y-[2px] transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5A94B]"
              style={{ background: 'linear-gradient(135deg,#E58415,#F5A94B)' }}
            >
              Começar agora
            </Link>
          </motion.div>
        </section>
      </main>

      {/* =========================
           FOOTER
      ========================== */}
      <footer className="pt-14 px-6 md:px-12 pb-12 border-t border-[#2A2116]">
        <div className="max-w-[1280px] mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <a href="#hero" className="inline-flex items-center gap-[9px] font-display font-semibold text-[19px] text-[#F7F2E9]">
            <span className="w-[9px] h-[9px] rounded-full" style={{ background: 'linear-gradient(135deg,#E58415,#F5A94B)', boxShadow: '0 0 14px rgba(229,132,21,0.7)' }} />
            Corte Flow
          </a>

          <nav className="flex flex-wrap justify-center gap-6 md:gap-[26px]">
            <a href="#solucao" className="text-[13px] text-[#8C8170] hover:text-[#F5A94B] transition-colors">Solução</a>
            <a href="#domicilio" className="text-[13px] text-[#8C8170] hover:text-[#F5A94B] transition-colors">Domicílio</a>
            <a href="#para-quem" className="text-[13px] text-[#8C8170] hover:text-[#F5A94B] transition-colors">Para quem é</a>
            <a href="#planos" className="text-[13px] text-[#8C8170] hover:text-[#F5A94B] transition-colors">Planos</a>
          </nav>

          <p className="text-[12px] text-[#8C8170]">© {new Date().getFullYear()} Corte Flow. Todos os direitos reservados.</p>
        </div>
      </footer>

      <CookieConsentBanner />
    </div>
  );
}