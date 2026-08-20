import { motion, animate, useMotionValue, useTransform } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import CookieConsentBanner from '../components/cookies/CookieConsentBanner';

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-8%' },
  transition: { duration: 0.9, delay, ease: [0.16, 0.8, 0.24, 1] as [number, number, number, number] }
});

function CountUp({ to, duration = 1.1 }: { to: number; duration?: number }) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, Math.round);
  
  return (
    <motion.span 
      whileInView={() => {
        const controls = animate(count, to, { duration, ease: [0.33, 1, 0.68, 1] });
        return controls.stop;
      }}
      viewport={{ once: true, margin: '-10%' }}
    >
      {rounded}
    </motion.span>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 24);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const closeMobileNav = () => setIsMobileMenuOpen(false);

  return (
    <div className="font-body bg-background text-text selection:bg-gold/30 selection:text-white min-h-screen overflow-x-hidden">
      
      {/* SVG Gradient definition for paths */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <linearGradient id="flowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#D4A24C"/>
            <stop offset="100%" stopColor="#E58C9E"/>
          </linearGradient>
        </defs>
      </svg>

      {/* =========================
           NAV
      ========================== */}
      <header className={`fixed top-0 left-0 right-0 z-[100] px-6 md:px-12 transition-all duration-300 border-b ${isScrolled ? 'bg-[#0B0D10]/80 backdrop-blur-[14px] border-line py-3' : 'border-transparent py-[18px]'}`}>
        <div className="max-w-[1280px] mx-auto flex items-center justify-between gap-6">
          <a href="#hero" className="inline-flex items-center gap-[9px] font-display font-semibold text-[19px] text-text">
            <span className="w-[9px] h-[9px] rounded-full bg-gradient-flow shadow-[0_0_14px_rgba(212,162,76,0.7)]"></span>
            Corte Flow
          </a>

          <nav className="hidden md:flex gap-8">
            <a href="#solucao" className="text-[14.5px] text-text-dim hover:text-gold-soft transition-colors">Solução</a>
            <a href="#domicilio" className="text-[14.5px] text-text-dim hover:text-gold-soft transition-colors">Domicílio</a>
            <a href="#para-quem" className="text-[14.5px] text-text-dim hover:text-gold-soft transition-colors">Para quem é</a>
            <a href="#planos" className="text-[14.5px] text-text-dim hover:text-gold-soft transition-colors">Planos</a>
          </nav>

          <div className="flex items-center gap-[14px]">
            <a href="#planos" className="hidden md:inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full font-semibold text-[13px] bg-gradient-flow text-[#16110A] shadow-card hover:-translate-y-[2px] hover:shadow-[0_20px_40px_-16px_rgba(212,162,76,0.45)] transition-all">
              Começar agora
            </a>
            
            <button className="md:hidden w-10 h-10 flex flex-col items-center justify-center gap-[5px]" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
              <span className={`block w-5 h-[2px] bg-text transition-all duration-300 ${isMobileMenuOpen ? 'translate-y-[7px] rotate-45' : ''}`}></span>
              <span className={`block w-5 h-[2px] bg-text transition-all duration-300 ${isMobileMenuOpen ? 'opacity-0' : ''}`}></span>
              <span className={`block w-5 h-[2px] bg-text transition-all duration-300 ${isMobileMenuOpen ? '-translate-y-[7px] -rotate-45' : ''}`}></span>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <div className={`fixed inset-0 top-[60px] bg-background flex flex-col items-center justify-center gap-[30px] transition-all duration-500 ease-[cubic-bezier(0.16,0.8,0.24,1)] ${isMobileMenuOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-full pointer-events-none'}`}>
          <a href="#solucao" onClick={closeMobileNav} className="font-display text-[26px]">Solução</a>
          <a href="#domicilio" onClick={closeMobileNav} className="font-display text-[26px]">Atendimento a domicílio</a>
          <a href="#para-quem" onClick={closeMobileNav} className="font-display text-[26px]">Para quem é</a>
          <a href="#planos" onClick={closeMobileNav} className="font-display text-[26px]">Planos</a>
          <a href="#planos" onClick={closeMobileNav} className="mt-4 px-8 py-4 rounded-full font-semibold text-[16px] bg-gradient-flow text-[#16110A] shadow-card">Começar agora</a>
        </div>
      </header>

      <main>
        {/* =========================
             01 - HERO
        ========================== */}
        <section id="hero" className="relative min-h-[100svh] flex flex-col justify-center pt-[120px]" 
          style={{ background: 'radial-gradient(60% 50% at 85% 10%, rgba(212,162,76,0.14), transparent 60%), radial-gradient(50% 40% at 10% 90%, rgba(229,140,158,0.10), transparent 60%), #0B0D10' }}>
          
          <div className="max-w-[1280px] w-full mx-auto px-6 md:px-12 grid md:grid-cols-[1.05fr_0.95fr] gap-14 md:gap-10 items-center">
            
            <motion.div {...fadeUp()} className="text-left">
              <span className="inline-block font-mono text-[12px] tracking-[0.12em] uppercase text-gold mb-[18px]">
                Agendamento + Gestão · Beleza & Estética
              </span>
              <h1 className="font-display font-semibold text-[clamp(40px,9vw,76px)] leading-[1.03] tracking-[-0.02em] m-0 mb-[22px]">
                Seu negócio agenda.<br />
                <em className="not-italic bg-gradient-flow text-transparent bg-clip-text">Você atende.</em>
              </h1>
              <p className="text-[clamp(16px,2vw,19px)] text-text-muted max-w-[52ch] mb-[34px]">
                O Corte Flow automatiza os agendamentos e organiza profissionais, serviços,
                horários e clientes — para o seu negócio funcionar sozinho enquanto você
                cuida de quem senta na cadeira.
              </p>

              <div className="flex flex-wrap gap-[14px] mb-[48px]">
                <a href="#planos" className="inline-flex items-center justify-center px-8 py-[17px] rounded-full font-semibold text-[16px] bg-gradient-flow text-[#16110A] shadow-card hover:-translate-y-[2px] hover:shadow-[0_20px_40px_-16px_rgba(212,162,76,0.45)] transition-all">
                  Começar agora
                </a>
                <a href="#solucao" className="inline-flex items-center justify-center px-8 py-[17px] rounded-full font-semibold text-[16px] text-text border border-line-strong hover:border-gold-soft hover:text-gold-soft transition-all">
                  Conhecer o Corte Flow
                </a>
              </div>

              <div className="flex gap-[34px] flex-wrap">
                <div className="flex flex-col">
                  <span className="font-display text-[30px] font-semibold text-gold-soft"><CountUp to={24} /></span>
                  <span className="text-[12.5px] text-text-muted max-w-[12ch]">horas devolvidas / mês</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-display text-[30px] font-semibold text-gold-soft"><CountUp to={10} /></span>
                  <span className="text-[12.5px] text-text-muted max-w-[12ch]">km de raio configurável</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-display text-[30px] font-semibold text-gold-soft"><CountUp to={100} /></span>
                  <span className="text-[12.5px] text-text-muted max-w-[12ch]">% da agenda automática</span>
                </div>
              </div>
            </motion.div>

            <motion.div {...fadeUp(0.1)} className="relative w-full max-w-[460px] mx-auto md:max-w-none md:m-0">
              <div className="absolute inset-[-10%_-10%_auto_auto] w-[70%] aspect-square bg-gradient-flow blur-[90px] opacity-25 rounded-full z-0"></div>
              
              <div className="relative z-10 bg-bg-elevated rounded-[32px] shadow-soft border border-line overflow-hidden aspect-[4/5] -rotate-[1.5deg]">
                <img src="/images/hero-atendimento.jpg" alt="Atendimento" className="w-full h-full object-cover" />
              </div>
              
              <div className="absolute top-[8%] -left-[6%] z-20 flex items-center gap-2.5 p-3 px-4 rounded-[20px] bg-[#15181D]/90 backdrop-blur-[10px] animate-float" style={{ animationDelay: '0.3s' }}>
                <span className="text-[18px]">📍</span>
                <div>
                  <strong className="block text-[13px] font-semibold">Dentro do raio</strong>
                  <span className="block text-[11.5px] text-text-muted">Atendimento confirmado</span>
                </div>
              </div>
              
              <div className="absolute bottom-[10%] -right-[8%] z-20 flex items-center gap-2.5 p-3 px-4 rounded-[20px] bg-[#15181D]/90 backdrop-blur-[10px] animate-float" style={{ animationDelay: '1.1s' }}>
                <span className="text-[18px]">🗓️</span>
                <div>
                  <strong className="block text-[13px] font-semibold">18:30 reservado</strong>
                  <span className="block text-[11.5px] text-text-muted">Agenda atualizada sozinha</span>
                </div>
              </div>
            </motion.div>

          </div>
          
          <div className="flex items-center justify-center gap-2 mt-16 font-mono text-[11px] tracking-[0.1em] uppercase text-text-muted">
            <span className="w-[1px] h-6 bg-gradient-to-b from-gold to-transparent animate-scrollcue"></span>
            role para ver
          </div>
        </section>

        {/* =========================
             02 - DOR
        ========================== */}
        <section className="text-center py-16 md:py-[160px] px-6">
          <motion.div {...fadeUp()}>
            <p className="font-mono text-[13px] tracking-[0.04em] text-text-muted max-w-[44ch] mx-auto mb-5">
              Responder mensagem. Perguntar horário. Confirmar endereço. Torcer pra não esquecer.
            </p>
            <h2 className="font-display text-[clamp(26px,5vw,40px)] font-medium max-w-[20ch] mx-auto">
              Sua agenda não deveria ser um <em className="not-italic text-rose-soft">segundo trabalho</em>.
            </h2>
          </motion.div>
        </section>

        {/* =========================
             03 - SOLUÇÃO
        ========================== */}
        <section id="solucao" className="py-[88px] md:py-[160px] px-6 md:px-12">
          <div className="max-w-[1280px] mx-auto grid md:grid-cols-2 gap-12 md:gap-[72px] items-center">
            
            <motion.div {...fadeUp()}>
              <span className="inline-block font-mono text-[12px] tracking-[0.12em] uppercase text-gold mb-[18px]">O Corte Flow</span>
              <h2 className="font-display font-semibold text-[clamp(28px,5.5vw,46px)] leading-[1.15] tracking-[-0.01em]">
                Não é só uma agenda.<br />É o motor do seu negócio.
              </h2>
              <p className="text-[clamp(16px,2vw,18px)] text-text-muted max-w-[46ch] mt-5">
                Menos mensagem, menos confusão, mais clientes. O Corte Flow cuida do
                agendamento, organiza sua equipe e ainda resolve o atendimento a domicílio
                — automaticamente, sem você precisar estar no meio de cada conversa.
              </p>
              
              <div className="flex flex-wrap gap-3 mt-[30px]">
                <a href="#agenda" className="text-[13.5px] font-medium px-[18px] py-[10px] rounded-full border border-line-strong text-text-dim hover:border-gold-soft hover:text-gold-soft transition-all">Agenda online</a>
                <a href="#gestao" className="text-[13.5px] font-medium px-[18px] py-[10px] rounded-full border border-line-strong text-text-dim hover:border-gold-soft hover:text-gold-soft transition-all">Gestão completa</a>
                <a href="#domicilio" className="text-[13.5px] font-medium px-[18px] py-[10px] rounded-full border border-line-strong text-text-dim hover:border-gold-soft hover:text-gold-soft transition-all">Atendimento a domicílio</a>
              </div>
            </motion.div>

            <motion.div {...fadeUp(0.1)} className="rounded-[32px] overflow-hidden shadow-soft border border-line aspect-[16/11]">
              <img src="/images/barbearia.jpg" alt="Barbearia" className="w-full h-full object-cover" />
            </motion.div>

          </div>
        </section>

        {/* =========================
             04 - AGENDA ONLINE
        ========================== */}
        <section id="agenda" className="py-[88px] md:py-[160px] px-6 md:px-12">
          <div className="max-w-[1280px] mx-auto grid md:grid-cols-[0.85fr_1fr] gap-10 md:gap-20 items-center">
            
            <motion.div {...fadeUp()} className="rounded-[32px] overflow-hidden shadow-soft border border-line">
              <img src="/images/cliente-app.jpg" alt="Cliente no App" className="w-full aspect-[4/5] object-cover" />
            </motion.div>

            <motion.div {...fadeUp(0.1)}>
              <span className="inline-block font-mono text-[12px] tracking-[0.12em] uppercase text-gold mb-[18px]">Agenda online</span>
              <h2 className="font-display font-semibold text-[clamp(28px,5.5vw,46px)] leading-[1.15] tracking-[-0.01em]">Seu cliente agenda sozinho.</h2>
              <p className="text-[clamp(16px,2vw,18px)] text-text-muted max-w-[46ch] mt-5">
                Pare de perder tempo respondendo mensagem pra marcar horário. O cliente
                escolhe o serviço, o profissional e o horário — sozinho, a qualquer hora do dia.
              </p>
              
              <ul className="mt-[26px] flex flex-col gap-[14px]">
                <li className="relative pl-[30px] text-[15.5px] text-text-dim">
                  <div className="absolute left-0 top-[5px] w-[18px] h-[18px] rounded-full bg-gradient-flow" style={{ WebkitMask: 'radial-gradient(circle 4px at 9px 9px, transparent 98%, #000 100%)', mask: 'radial-gradient(circle 4px at 9px 9px, transparent 98%, #000 100%)' }}></div>
                  Sem trocar mensagem pra confirmar disponibilidade
                </li>
                <li className="relative pl-[30px] text-[15.5px] text-text-dim">
                  <div className="absolute left-0 top-[5px] w-[18px] h-[18px] rounded-full bg-gradient-flow" style={{ WebkitMask: 'radial-gradient(circle 4px at 9px 9px, transparent 98%, #000 100%)', mask: 'radial-gradient(circle 4px at 9px 9px, transparent 98%, #000 100%)' }}></div>
                  Sem cliente esperando resposta e desistindo
                </li>
                <li className="relative pl-[30px] text-[15.5px] text-text-dim">
                  <div className="absolute left-0 top-[5px] w-[18px] h-[18px] rounded-full bg-gradient-flow" style={{ WebkitMask: 'radial-gradient(circle 4px at 9px 9px, transparent 98%, #000 100%)', mask: 'radial-gradient(circle 4px at 9px 9px, transparent 98%, #000 100%)' }}></div>
                  Sem horário perdido por falta de organização
                </li>
              </ul>
            </motion.div>

          </div>
        </section>

        {/* =========================
             05 - MOTOR DE GESTÃO
        ========================== */}
        <section id="gestao" className="bg-bg-soft py-[88px] md:py-[160px] px-6 md:px-12">
          <div className="max-w-[640px] mx-auto text-center mb-16">
            <span className="inline-block font-mono text-[12px] tracking-[0.12em] uppercase text-gold mb-[18px]">Motor de gestão</span>
            <h2 className="font-display font-semibold text-[clamp(28px,5.5vw,46px)] leading-[1.15] tracking-[-0.01em]">Administre seu negócio inteiro em um só lugar.</h2>
            <p className="text-[clamp(16px,2vw,18px)] text-text-muted max-w-[46ch] mt-5 mx-auto">
              Crie profissionais, monte equipes, defina serviços e horários. O Corte Flow
              conecta cada peça da sua operação — e cada profissional acompanha só os
              próprios agendamentos.
            </p>
          </div>

          <div className="relative max-w-[1100px] mx-auto grid md:grid-cols-4 gap-5 md:gap-6">
            <svg className="absolute hidden md:block overflow-visible top-1/2 left-0 w-full h-[2px] z-0" viewBox="0 0 800 4" preserveAspectRatio="none">
              <motion.path 
                d="M0,2 L800,2" 
                fill="none" stroke="url(#flowGradient)" strokeWidth="2"
                strokeDasharray="820"
                initial={{ strokeDashoffset: 820 }}
                whileInView={{ strokeDashoffset: 0 }}
                viewport={{ once: true, margin: '-20%' }}
                transition={{ duration: 1.4, ease: [0.16, 0.8, 0.24, 1] }}
              />
            </svg>

            {[
              { num: '01', title: 'Administrador', desc: 'Visão completa da operação: agenda, equipe e desempenho do negócio.' },
              { num: '02', title: 'Equipe', desc: 'Organize quantos profissionais precisar, sob um único negócio.' },
              { num: '03', title: 'Profissionais', desc: 'Cada um com sua própria agenda, serviços e horários de trabalho.' },
              { num: '04', title: 'Agendamentos', desc: 'Tudo conectado — do primeiro clique do cliente até o atendimento.' }
            ].map((node, i) => (
              <motion.div key={node.num} {...fadeUp(i * 0.1)} className="relative z-10 bg-bg-card border border-line rounded-[20px] p-[26px_24px]">
                <span className="inline-flex font-mono text-[12px] text-gold mb-2.5">{node.num}</span>
                <h3 className="font-display text-[19px] font-semibold mb-2">{node.title}</h3>
                <p className="text-[14.5px] text-text-muted">{node.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* =========================
             06 - EQUIPES
        ========================== */}
        <section className="py-[88px] md:py-[160px] px-6 md:px-12">
          <div className="max-w-[1280px] mx-auto grid md:grid-cols-[1fr_0.85fr] gap-10 md:gap-20 items-center">
            
            <motion.div {...fadeUp(0.1)} className="md:order-2 rounded-[32px] overflow-hidden shadow-soft border border-line">
              <img src="/images/salao-cachos.jpg" alt="Equipe de Salão" className="w-full aspect-[4/5] object-cover" />
            </motion.div>

            <motion.div {...fadeUp()} className="md:order-1">
              <span className="inline-block font-mono text-[12px] tracking-[0.12em] uppercase text-gold mb-[18px]">Equipes</span>
              <h2 className="font-display font-semibold text-[clamp(28px,5.5vw,46px)] leading-[1.15] tracking-[-0.01em]">Começou sozinho? Perfeito.<br />Tem equipe? Melhor ainda.</h2>
              <p className="text-[clamp(16px,2vw,18px)] text-text-muted max-w-[46ch] mt-5">
                Cadastre seus profissionais e organize a equipe em minutos. Cada um vê
                só os próprios agendamentos, enquanto você tem a visão completa do negócio.
              </p>
              <p className="mt-[28px] font-display italic text-[21px] text-gold-soft">
                Seu negócio cresce. O Corte Flow cresce junto.
              </p>
            </motion.div>

          </div>
        </section>

        {/* =========================
             07 - DOMICÍLIO
        ========================== */}
        <section id="domicilio" className="bg-bg-elevated border-y border-line py-[88px] md:py-[160px] px-6 md:px-12 overflow-hidden">
          <div className="max-w-[1280px] mx-auto grid md:grid-cols-[1fr_0.8fr] gap-12 md:gap-20 items-center mb-[80px]">
            
            <motion.div {...fadeUp()}>
              <span className="inline-block font-mono text-[12px] tracking-[0.12em] uppercase text-gold-soft mb-[18px]">Grande diferencial</span>
              <h2 className="font-display font-semibold text-[clamp(28px,5.5vw,46px)] leading-[1.15] tracking-[-0.01em] text-text">
                Você define o raio.<br />O Corte Flow faz o resto.
              </h2>
              <p className="text-[clamp(16px,2vw,18px)] text-[#F5F3EF]/70 max-w-[46ch] mt-5">
                Manicures, barbeiros e cabeleireiros que atendem em domicílio não precisam
                mais perguntar endereço, verificar distância e combinar horário no
                WhatsApp. O cliente informa onde está — o sistema confere se está dentro
                da área de atendimento e libera o horário na hora.
              </p>

              <div className="relative w-[220px] h-[220px] mt-10 mb-3">
                <span className="absolute inset-[66px] rounded-full border border-dashed border-gold/30 animate-pulse-ring"></span>
                <span className="absolute inset-[33px] rounded-full border border-dashed border-gold/30 animate-pulse-ring" style={{ animationDelay: '0.5s' }}></span>
                <span className="absolute inset-0 rounded-full border border-dashed border-gold/30 animate-pulse-ring" style={{ animationDelay: '1s' }}></span>
                
                <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[54px] h-[54px] rounded-full bg-gradient-flow flex items-center justify-center font-mono text-[10.5px] font-semibold text-[#16110A] shadow-[0_0_30px_rgba(212,162,76,0.5)]">Você</span>
                
                <span className="absolute top-[12%] -right-[4%] font-mono text-[10.5px] px-2.5 py-1.5 rounded-full whitespace-nowrap bg-gold/15 text-gold-soft border border-gold/40">Dentro do raio</span>
                <span className="absolute bottom-[4%] -left-[10%] font-mono text-[10.5px] px-2.5 py-1.5 rounded-full whitespace-nowrap bg-[#F5F3EF]/5 text-text-muted border border-line-strong">Fora do raio</span>
              </div>
              <p className="text-[13.5px] text-text-muted italic">Ex.: “Atendo clientes em um raio de até 10 km.”</p>
            </motion.div>

            <motion.div {...fadeUp(0.1)} className="rounded-[32px] overflow-hidden shadow-soft border border-line md:order-2">
              <img src="/images/manicure-celular.jpg" alt="Domicílio" className="w-full aspect-[4/5] object-cover" />
            </motion.div>
          </div>

          <div className="relative max-w-[1100px] mx-auto grid md:grid-cols-5 gap-5 md:gap-[22px]">
            <svg className="absolute hidden md:block overflow-visible top-1/2 left-0 w-full h-[2px] z-0" viewBox="0 0 800 4" preserveAspectRatio="none">
              <motion.path 
                d="M0,2 L800,2" 
                fill="none" stroke="url(#flowGradient)" strokeWidth="2"
                strokeDasharray="820"
                initial={{ strokeDashoffset: 820 }}
                whileInView={{ strokeDashoffset: 0 }}
                viewport={{ once: true, margin: '-20%' }}
                transition={{ duration: 1.4, ease: [0.16, 0.8, 0.24, 1] }}
              />
            </svg>

            {[
              "Cliente escolhe o serviço",
              "Informa o endereço",
              "Sistema verifica a distância",
              "Horário disponível aparece",
              "Agendamento confirmado"
            ].map((step, i) => (
              <motion.div key={i} {...fadeUp(i * 0.1)} className="relative z-10 flex items-center gap-3 text-[14.5px] text-text-dim bg-[#F5F3EF]/[0.03] border border-line rounded-full px-[18px] py-3">
                <span className="inline-flex items-center justify-center w-[22px] h-[22px] rounded-full bg-gradient-flow text-[#16110A] text-[11px] font-bold font-mono shrink-0">{i + 1}</span>
                {step}
              </motion.div>
            ))}
          </div>

          <p className="text-center font-display italic text-[clamp(22px,3.5vw,30px)] text-gold-soft mt-[72px]">“Você atende. O Corte Flow organiza.”</p>
        </section>

        {/* =========================
             08 - PARA QUEM É
        ========================== */}
        <section id="para-quem" className="py-[88px] md:py-[160px] px-6 md:px-12">
          <div className="max-w-[1280px] mx-auto">
            <span className="inline-block font-mono text-[12px] tracking-[0.12em] uppercase text-gold mb-[18px]">Para quem é</span>
            <h2 className="font-display font-semibold text-[clamp(28px,5.5vw,46px)] leading-[1.15] tracking-[-0.01em] max-w-[16ch]">
              Feito para quem vive de deixar gente bonita.
            </h2>

            <div className="mt-14 grid md:grid-cols-3 gap-[18px] md:auto-rows-[minmax(160px,auto)]">
              
              <motion.div {...fadeUp(0.1)} className="rounded-[32px] overflow-hidden border border-line md:row-span-2">
                <img src="/images/estilo-corte.jpg" alt="Estilo" className="w-full h-full object-cover aspect-[3/4]" />
              </motion.div>

              <motion.div {...fadeUp(0.2)} className="bg-bg-card border border-line rounded-[20px] p-[30px_26px] transition-all hover:border-gold/40 hover:-translate-y-1">
                <span className="text-[26px]">💈</span>
                <h3 className="font-display text-[19px] font-semibold my-3">Barbearias</h3>
                <p className="text-[14px] text-text-muted">Mais clientes. Menos mensagens.</p>
              </motion.div>

              <motion.div {...fadeUp(0.3)} className="bg-bg-card border border-line rounded-[20px] p-[30px_26px] transition-all hover:border-gold/40 hover:-translate-y-1">
                <span className="text-[26px]">💇</span>
                <h3 className="font-display text-[19px] font-semibold my-3">Salões de beleza</h3>
                <p className="text-[14px] text-text-muted">Toda a equipe organizada em um só lugar.</p>
              </motion.div>

              <motion.div {...fadeUp(0.4)} className="bg-bg-card border border-line rounded-[20px] p-[30px_26px] transition-all hover:border-gold/40 hover:-translate-y-1">
                <span className="text-[26px]">💅</span>
                <h3 className="font-display text-[19px] font-semibold my-3">Manicures</h3>
                <p className="text-[14px] text-text-muted">Agenda cheia sem ficar respondendo o celular.</p>
              </motion.div>

              <motion.div {...fadeUp(0.5)} className="rounded-[32px] overflow-hidden border border-line md:row-span-2">
                <img src="/images/barbeiro-corte.jpg" alt="Barbeiro" className="w-full h-full object-cover aspect-[3/4]" />
              </motion.div>

              <motion.div {...fadeUp(0.6)} className="bg-bg-card border border-line rounded-[20px] p-[30px_26px] transition-all hover:border-gold/40 hover:-translate-y-1">
                <span className="text-[26px]">✂️</span>
                <h3 className="font-display text-[19px] font-semibold my-3">Profissionais autônomos</h3>
                <p className="text-[14px] text-text-muted">Seu negócio profissional desde o primeiro cliente.</p>
              </motion.div>

              <motion.div {...fadeUp(0.7)} className="bg-bg-card border border-line rounded-[20px] p-[30px_26px] transition-all hover:border-gold/40 hover:-translate-y-1">
                <span className="text-[26px]">🏠</span>
                <h3 className="font-display text-[19px] font-semibold my-3">Atendimento a domicílio</h3>
                <p className="text-[14px] text-text-muted">Você define onde atende. O sistema verifica o resto.</p>
              </motion.div>

            </div>
          </div>
        </section>

        {/* =========================
             09 - AUTOMAÇÃO
        ========================== */}
        <section className="bg-bg-soft py-[88px] md:py-[160px] px-6 md:px-12 text-center overflow-hidden">
          <motion.div {...fadeUp()}>
            <span className="inline-block font-mono text-[12px] tracking-[0.12em] uppercase text-gold mb-[18px]">Automação</span>
            <h2 className="font-display font-semibold text-[clamp(28px,5.5vw,46px)] leading-[1.15] tracking-[-0.01em] max-w-[22ch] mx-auto">
              Enquanto você trabalha, o sistema trabalha por você.
            </h2>
          </motion.div>

          <div className="relative max-w-[1100px] mx-auto mt-14 grid md:grid-cols-5 gap-[18px]">
            <svg className="absolute hidden md:block overflow-visible top-1/2 left-0 w-full h-[2px] z-0" viewBox="0 0 800 4" preserveAspectRatio="none">
              <motion.path 
                d="M0,2 L800,2" 
                fill="none" stroke="url(#flowGradient)" strokeWidth="2"
                strokeDasharray="820"
                initial={{ strokeDashoffset: 820 }}
                whileInView={{ strokeDashoffset: 0 }}
                viewport={{ once: true, margin: '-20%' }}
                transition={{ duration: 1.4, ease: [0.16, 0.8, 0.24, 1] }}
              />
            </svg>

            {[
              "Cliente agenda",
              "Sistema registra",
              "Horário fica ocupado",
              "Profissional é avisado",
              "Agenda continua organizada"
            ].map((step, i) => (
              <motion.div key={i} {...fadeUp(i * 0.1)} className="relative z-10 flex items-center gap-3 text-[14.5px] text-text-dim bg-[#F5F3EF]/[0.03] border border-line rounded-full px-[18px] py-3">
                <span className="inline-flex items-center justify-center w-[22px] h-[22px] rounded-full bg-gradient-flow text-[#16110A] text-[11px] font-bold font-mono shrink-0">·</span>
                {step}
              </motion.div>
            ))}
          </div>
        </section>

        {/* =========================
             10 - PLANOS
        ========================== */}
        <section id="planos" className="py-[88px] md:py-[160px] px-6 md:px-12 text-center">
          <motion.div {...fadeUp()}>
            <span className="inline-block font-mono text-[12px] tracking-[0.12em] uppercase text-gold mb-[18px]">Planos</span>
            <h2 className="font-display font-semibold text-[clamp(28px,5.5vw,46px)] leading-[1.15] tracking-[-0.01em] max-w-[20ch] mx-auto">
              Quanto vale recuperar horas do seu dia?
            </h2>
            <p className="text-[clamp(16px,2vw,18px)] text-text-muted mt-4 mx-auto">
              Escolha o plano que combina com o seu momento.
            </p>
          </motion.div>

          <div className="max-w-[1280px] mx-auto mt-14 grid md:grid-cols-3 gap-[22px] text-left">
            
            {/* PLANO SOLO */}
            <motion.div {...fadeUp(0.1)} className="bg-bg-card border border-line rounded-[32px] p-[38px_30px] flex flex-col transition-all hover:-translate-y-1.5">
              <h3 className="font-display text-[24px] font-semibold">Solo</h3>
              <p className="text-[14px] text-text-muted mt-2.5 min-h-[42px]">Pra quem trabalha sozinho e quer parar de agendar pelo WhatsApp.</p>
              <p className="font-display text-[44px] font-semibold mt-6">
                <span className="text-[20px] align-super mr-0.5">R$</span>49<small className="text-[14px] font-normal text-text-muted">/mês</small>
              </p>
              <ul className="mt-[26px] flex flex-col gap-3 grow">
                {['Agenda online ilimitada', '1 profissional', 'Atendimento a domicílio', 'Lembretes automáticos'].map((item) => (
                  <li key={item} className="text-[14px] text-text-dim pl-[22px] relative">
                    <span className="absolute left-0 text-gold-soft font-bold">+</span>{item}
                  </li>
                ))}
              </ul>
              <Link to="/cadastro" className="mt-7 w-full inline-flex items-center justify-center px-6 py-3.5 rounded-full font-semibold text-[15px] border border-line-strong text-text hover:border-gold-soft hover:text-gold-soft transition-all">Começar agora</Link>
            </motion.div>

            {/* PLANO STUDIO */}
            <motion.div {...fadeUp(0.2)} className="relative bg-bg-card border border-gold/50 rounded-[32px] p-[38px_30px] flex flex-col transition-all md:scale-105 hover:md:scale-105 hover:md:-translate-y-1.5" style={{ background: 'linear-gradient(160deg, rgba(212,162,76,0.08), rgba(229,140,158,0.04) 60%), #191D23' }}>
              <span className="absolute -top-[13px] left-[30px] bg-gradient-flow text-[#16110A] font-mono text-[11px] font-semibold px-3.5 py-1.5 rounded-full">Mais escolhido</span>
              <h3 className="font-display text-[24px] font-semibold">Studio</h3>
              <p className="text-[14px] text-text-muted mt-2.5 min-h-[42px]">Pra quem já tem equipe e quer o negócio inteiro organizado.</p>
              <p className="font-display text-[44px] font-semibold mt-6">
                <span className="text-[20px] align-super mr-0.5">R$</span>89<small className="text-[14px] font-normal text-text-muted">/mês</small>
              </p>
              <ul className="mt-[26px] flex flex-col gap-3 grow">
                {['Tudo do plano Solo', 'Até 5 profissionais', 'Gestão de equipe completa', 'Relatórios de desempenho', 'Suporte prioritário'].map((item) => (
                  <li key={item} className="text-[14px] text-text-dim pl-[22px] relative">
                    <span className="absolute left-0 text-gold-soft font-bold">+</span>{item}
                  </li>
                ))}
              </ul>
              <Link to="/cadastro" className="mt-7 w-full inline-flex items-center justify-center px-6 py-3.5 rounded-full font-semibold text-[15px] bg-gradient-flow text-[#16110A] shadow-card hover:-translate-y-[2px] hover:shadow-[0_20px_40px_-16px_rgba(212,162,76,0.45)] transition-all">Começar agora</Link>
            </motion.div>

            {/* PLANO EQUIPE */}
            <motion.div {...fadeUp(0.3)} className="bg-bg-card border border-line rounded-[32px] p-[38px_30px] flex flex-col transition-all hover:-translate-y-1.5">
              <h3 className="font-display text-[24px] font-semibold">Equipe</h3>
              <p className="text-[14px] text-text-muted mt-2.5 min-h-[42px]">Pra estabelecimentos maiores, com operação em escala.</p>
              <p className="font-display text-[44px] font-semibold mt-6">
                <span className="text-[20px] align-super mr-0.5">R$</span>149<small className="text-[14px] font-normal text-text-muted">/mês</small>
              </p>
              <ul className="mt-[26px] flex flex-col gap-3 grow">
                {['Tudo do plano Studio', 'Profissionais ilimitados', 'Múltiplas unidades', 'Gerente de conta dedicado'].map((item) => (
                  <li key={item} className="text-[14px] text-text-dim pl-[22px] relative">
                    <span className="absolute left-0 text-gold-soft font-bold">+</span>{item}
                  </li>
                ))}
              </ul>
              <Link to="/cadastro" className="mt-7 w-full inline-flex items-center justify-center px-6 py-3.5 rounded-full font-semibold text-[15px] border border-line-strong text-text hover:border-gold-soft hover:text-gold-soft transition-all">Começar agora</Link>
            </motion.div>

          </div>
          <p className="text-[12.5px] text-text-muted mt-7">Preços ilustrativos — ajuste conforme sua tabela real.</p>
        </section>

        {/* =========================
             11 - CTA FINAL
        ========================== */}
        <section className="text-center py-[120px] px-6" style={{ background: 'radial-gradient(60% 80% at 50% 0%, rgba(212,162,76,0.12), transparent 65%), #0B0D10' }}>
          <motion.div {...fadeUp()}>
            <h2 className="font-display font-semibold text-[clamp(30px,6vw,54px)] leading-[1.15] max-w-[18ch] mx-auto mb-[22px]">
              Você cuida do seu cliente.<br />
              <em className="not-italic text-gold-soft">O Corte Flow cuida da sua agenda.</em>
            </h2>
            <p className="text-text-muted text-[17px] mb-9">Comece a transformar a maneira como você administra seu negócio.</p>
            <Link to="/cadastro" className="inline-flex items-center justify-center px-8 py-[17px] rounded-full font-semibold text-[16px] bg-gradient-flow text-[#16110A] shadow-card hover:-translate-y-[2px] hover:shadow-[0_20px_40px_-16px_rgba(212,162,76,0.45)] transition-all">
              Começar agora
            </Link>
          </motion.div>
        </section>
      </main>

      {/* =========================
           FOOTER
      ========================== */}
      <footer className="pt-14 px-6 md:px-12 pb-12 border-t border-line">
        <div className="max-w-[1280px] mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <a href="#hero" className="inline-flex items-center gap-[9px] font-display font-semibold text-[19px] text-text">
            <span className="w-[9px] h-[9px] rounded-full bg-gradient-flow shadow-[0_0_14px_rgba(212,162,76,0.7)]"></span>
            Corte Flow
          </a>
          
          <nav className="flex flex-wrap justify-center gap-6 md:gap-[26px]">
            <a href="#solucao" className="text-[13.5px] text-text-muted hover:text-gold-soft transition-colors">Solução</a>
            <a href="#domicilio" className="text-[13.5px] text-text-muted hover:text-gold-soft transition-colors">Domicílio</a>
            <a href="#para-quem" className="text-[13.5px] text-text-muted hover:text-gold-soft transition-colors">Para quem é</a>
            <a href="#planos" className="text-[13.5px] text-text-muted hover:text-gold-soft transition-colors">Planos</a>
          </nav>
          
          <p className="text-[12px] text-text-muted">© {new Date().getFullYear()} Corte Flow. Todos os direitos reservados.</p>
        </div>
      </footer>

      <CookieConsentBanner />
    </div>
  );
}
