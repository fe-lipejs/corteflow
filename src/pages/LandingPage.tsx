import { motion, useScroll, useTransform } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import CookieConsentBanner from '../components/cookies/CookieConsentBanner';

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-50px' },
  transition: { duration: 0.8, delay, ease: [0.22, 0.61, 0.36, 1] as [number, number, number, number] }
});

export default function LandingPage() {
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 30);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="font-sans text-[#090909] bg-white overflow-x-hidden selection:bg-black selection:text-white">
      
      {/* =========================
           NAVBAR
      ========================== */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-shadow duration-300 ${isScrolled ? 'shadow-[0_10px_30px_rgba(0,0,0,0.05)]' : ''} bg-white/80 backdrop-blur-[20px] border-b border-black/[0.06] h-[76px]`}>
        <div className="max-w-[1180px] mx-auto px-6 h-full flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 font-extrabold text-[17px] tracking-tight">
            <span className="grid place-items-center w-[30px] h-[30px] rounded-[9px] bg-accent text-white text-[15px]">C</span>
            <span className="font-title">Corte Flow</span>
          </Link>
          
          <div className="hidden md:flex items-center gap-[34px]">
            <a href="#recursos" className="text-[#707070] text-[13px] font-medium hover:text-accent transition-colors">Recursos</a>
            <a href="#domicilio" className="text-[#707070] text-[13px] font-medium hover:text-accent transition-colors">Domicílio</a>
            <a href="#equipe" className="text-[#707070] text-[13px] font-medium hover:text-accent transition-colors">Equipes</a>
            <a href="#planos" className="text-[#707070] text-[13px] font-medium hover:text-accent transition-colors">Planos</a>
          </div>

          <div className="hidden md:flex items-center gap-6">
            <Link to="/login" className="text-[13px] font-semibold text-[#090909] hover:text-accent transition-colors">Entrar</Link>
            <Link to="/cadastro" className="px-[17px] py-[11px] rounded-full bg-accent text-white text-[12px] font-bold hover:-translate-y-[2px] hover:shadow-lg hover:shadow-accent/30 transition-all">Começar agora</Link>
          </div>

          <button className="md:hidden w-[42px] h-[42px]" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            <span className="block w-[21px] h-[2px] bg-[#090909] mx-auto mb-[5px]"></span>
            <span className="block w-[21px] h-[2px] bg-[#090909] mx-auto"></span>
          </button>
        </div>
      </nav>

      {/* =========================
           MOBILE MENU
      ========================== */}
      {isMobileMenuOpen && (
        <div className="fixed inset-x-0 top-[76px] z-[999] bg-white/95 backdrop-blur-[20px] border-b border-[#eeeeee] p-6 flex flex-col gap-5 md:hidden">
          <a href="#recursos" onClick={() => setIsMobileMenuOpen(false)} className="font-semibold text-[16px]">Recursos</a>
          <a href="#domicilio" onClick={() => setIsMobileMenuOpen(false)} className="font-semibold text-[16px]">Atendimento a domicílio</a>
          <a href="#equipe" onClick={() => setIsMobileMenuOpen(false)} className="font-semibold text-[16px]">Equipes</a>
          <a href="#planos" onClick={() => setIsMobileMenuOpen(false)} className="font-semibold text-[16px]">Planos</a>
          <Link to="/cadastro" onClick={() => setIsMobileMenuOpen(false)} className="mt-2 p-[15px] text-center rounded-[14px] bg-accent text-white font-semibold">Começar agora</Link>
        </div>
      )}

      <main>
        {/* =========================
             HERO
        ========================== */}
        <section className="relative min-h-[100vh] flex items-center pt-[150px] pb-[100px] overflow-hidden" style={{ background: 'radial-gradient(circle at 80% 35%, rgba(0,0,0,0.07), transparent 30%), #fafafa' }}>
          <div className="max-w-[1180px] w-full mx-auto px-6 grid md:grid-cols-[0.95fr_1.05fr] items-center gap-[70px]">
            
            <motion.div className="relative z-10 text-center md:text-left" {...fadeUp()}>
              <div className="inline-flex items-center gap-[9px] px-3 py-2 border border-[#dddddd] rounded-full bg-white/70 text-[#707070] text-[11px] font-semibold mb-7 mx-auto md:mx-0">
                <span className="w-[7px] h-[7px] rounded-full bg-accent"></span>
                Gestão inteligente para profissionais de beleza
              </div>

              <h1 className="font-title text-[clamp(48px,6vw,92px)] leading-[0.94] tracking-[-4px] md:tracking-[-6px] font-extrabold max-w-[700px]">
                Seu negócio <span className="text-accent">agenda.</span> Você atende.
              </h1>

              <p className="mt-[30px] text-[#707070] text-[14px] md:text-[17px] leading-[1.7] max-w-[550px] mx-auto md:mx-0">
                O Corte Flow organiza seus agendamentos, sua equipe e seus
                clientes para que você pare de administrar tudo pelo celular
                e volte a focar no que realmente importa.
              </p>

              <div className="flex flex-col md:flex-row items-center justify-center md:justify-start gap-[13px] mt-[36px]">
                <Link to="/cadastro" className="inline-flex items-center justify-center gap-[14px] min-h-[50px] px-5 rounded-full text-[13px] font-bold transition-all bg-accent text-white hover:-translate-y-[3px] hover:shadow-lg hover:shadow-accent/30 w-full md:w-auto">
                  Começar agora <span>→</span>
                </Link>
                <a href="#recursos" className="inline-flex items-center justify-center gap-[14px] min-h-[50px] px-5 rounded-full text-[13px] font-bold transition-all border border-[#dddddd] bg-white hover:bg-[#f7f7f7] hover:text-accent hover:border-accent/30 w-full md:w-auto">
                  Conhecer o Corte Flow
                </a>
              </div>

              <div className="flex items-center justify-center md:justify-start gap-5 mt-[60px]">
                <div className="flex flex-col gap-[3px]">
                  <strong className="text-[16px] leading-tight">24h</strong>
                  <span className="text-[#999999] text-[10px]">agendamento online</span>
                </div>
                <div className="w-px h-[28px] bg-[#dddddd]"></div>
                <div className="flex flex-col gap-[3px]">
                  <strong className="text-[16px] leading-tight">100%</strong>
                  <span className="text-[#999999] text-[10px]">online</span>
                </div>
                <div className="w-px h-[28px] bg-[#dddddd]"></div>
                <div className="flex flex-col gap-[3px]">
                  <strong className="text-[16px] leading-tight">∞</strong>
                  <span className="text-[#999999] text-[10px]">possibilidades</span>
                </div>
              </div>
            </motion.div>

            <motion.div className="relative w-full max-w-[620px] mx-auto" {...fadeUp(0.2)}>
              <div className="absolute z-10 flex items-center gap-[11px] p-3 px-4 bg-white/90 border border-accent/20 rounded-[16px] shadow-[0_20px_50px_rgba(233,152,37,0.15)] backdrop-blur-[20px] top-[7%] md:top-[12%] -left-[5px] md:-left-[45px]">
                <span className="grid place-items-center w-[30px] h-[30px] rounded-[9px] bg-accent text-white text-[12px]">✓</span>
                <div>
                  <strong className="block text-[9px] md:text-[11px]">Agendamento confirmado</strong>
                  <small className="block mt-[3px] text-[#999999] text-[8px] md:text-[9px]">Hoje · 14:30</small>
                </div>
              </div>

              <img src="/images/barbeiro-hero.jpg" alt="Corte Flow" className="aspect-[4/5] object-cover rounded-[30px] md:rounded-[40px] shadow-[0_40px_90px_rgba(0,0,0,0.14)]" />

              <div className="absolute z-10 flex items-center gap-[11px] p-3 px-4 bg-white/90 border border-black/10 rounded-[16px] shadow-[0_20px_50px_rgba(0,0,0,0.12)] backdrop-blur-[20px] bottom-[7%] md:bottom-[12%] -right-[5px] md:-right-[35px]">
                <div className="flex">
                  <span className="w-[26px] h-[26px] rounded-full border-2 border-white bg-[#dddddd]"></span>
                  <span className="w-[26px] h-[26px] rounded-full border-2 border-white bg-[#dddddd] -ml-[6px]"></span>
                  <span className="w-[26px] h-[26px] rounded-full border-2 border-white bg-[#dddddd] -ml-[6px]"></span>
                </div>
                <div>
                  <strong className="block text-[9px] md:text-[11px]">Equipe conectada</strong>
                  <small className="block mt-[3px] text-[#999999] text-[8px] md:text-[9px]">Todos os profissionais</small>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* =========================
             PROBLEM
        ========================== */}
        <section className="bg-white py-[95px] md:py-[150px]">
          <div className="max-w-[1180px] mx-auto px-6">
            <motion.div className="max-w-[720px] mx-auto text-center" {...fadeUp()}>
              <span className="block mb-5 text-accent text-[11px] font-extrabold uppercase tracking-[1.6px]">O problema</span>
              <h2 className="font-title text-[43px] md:text-[clamp(40px,5vw,68px)] leading-none tracking-[-3px] md:tracking-[-4px] font-bold">
                Você começou para atender.<br /> Não para ficar respondendo mensagens.
              </h2>
              <p className="max-w-[590px] mx-auto mt-[25px] text-[#707070] text-[16px] leading-[1.7]">
                WhatsApp, agenda de papel, planilhas, clientes perguntando
                horário e você tentando organizar tudo ao mesmo tempo.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-3 mt-[50px] md:mt-[75px] border-t border-[#dddddd]">
              <motion.div className="p-[30px_5px] md:p-[45px_35px] border-b md:border-b-0 md:border-r border-[#dddddd] hover:bg-[#f7f7f7] transition-colors" {...fadeUp(0.1)}>
                <span className="text-accent text-[11px] font-extrabold">01</span>
                <h3 className="font-title mt-[25px] md:mt-[55px] text-[22px] tracking-[-0.8px] font-bold">“Tem horário amanhã?”</h3>
                <p className="mt-[13px] text-[#707070] text-[14px] leading-[1.7]">
                  Enquanto você atende um cliente, chegam várias mensagens
                  perguntando sobre horários.
                </p>
              </motion.div>
              <motion.div className="p-[30px_5px] md:p-[45px_35px] border-b md:border-b-0 md:border-r border-[#dddddd] hover:bg-[#f7f7f7] transition-colors" {...fadeUp(0.2)}>
                <span className="text-accent text-[11px] font-extrabold">02</span>
                <h3 className="font-title mt-[25px] md:mt-[55px] text-[22px] tracking-[-0.8px] font-bold">Agenda desorganizada.</h3>
                <p className="mt-[13px] text-[#707070] text-[14px] leading-[1.7]">
                  Horários espalhados, conflitos e aquele medo constante
                  de marcar duas pessoas no mesmo horário.
                </p>
              </motion.div>
              <motion.div className="p-[30px_5px] md:p-[45px_35px] hover:bg-[#f7f7f7] transition-colors" {...fadeUp(0.3)}>
                <span className="text-accent text-[11px] font-extrabold">03</span>
                <h3 className="font-title mt-[25px] md:mt-[55px] text-[22px] tracking-[-0.8px] font-bold">Você faz tudo.</h3>
                <p className="mt-[13px] text-[#707070] text-[14px] leading-[1.7]">
                  Cliente, agenda, equipe, serviços, horários e ainda
                  precisa lembrar quem atende cada pessoa.
                </p>
              </motion.div>
            </div>
          </div>
        </section>

        {/* =========================
             TRANSFORMATION
        ========================== */}
        <section id="recursos" className="bg-[#f7f7f7] py-[95px] md:py-[150px]">
          <div className="max-w-[1180px] mx-auto px-6">
            <div className="grid md:grid-cols-[0.8fr_1.2fr] gap-[60px] md:gap-[100px] items-center">
              <motion.div {...fadeUp()}>
                <span className="block mb-5 text-accent text-[11px] font-extrabold uppercase tracking-[1.6px]">Conheça o Corte Flow</span>
                <h2 className="font-title text-[43px] md:text-[clamp(40px,5vw,68px)] leading-none tracking-[-3px] md:tracking-[-4px] font-bold">
                  Menos mensagens.<br /> Mais tempo para atender.
                </h2>
                <p className="max-w-[500px] mt-[25px] text-[#707070] leading-[1.8]">
                  O Corte Flow transforma seu negócio em uma operação
                  organizada, onde seu cliente encontra um horário,
                  agenda sozinho e você acompanha tudo em um só lugar.
                </p>
                <a href="#planos" className="inline-flex gap-3 mt-[35px] text-[13px] font-extrabold text-accent hover:opacity-70 transition-opacity">
                  Quero organizar meu negócio <span>→</span>
                </a>
              </motion.div>

              <motion.div className="relative min-h-[430px] md:min-h-[620px]" {...fadeUp(0.2)}>
                <div className="absolute w-[85%] md:w-[80%] right-0 top-0">
                  <img src="/images/cliente-app.jpg" alt="Agenda do Corte Flow" className="aspect-[4/5] object-cover rounded-[35px]" />
                </div>
                <div className="absolute z-10 w-[50%] md:w-[42%] bottom-0 left-0 p-2 md:p-2.5 bg-white rounded-[28px] shadow-[0_25px_60px_rgba(0,0,0,0.14)]">
                  <img src="/images/barbearia.jpg" alt="Agendamento" className="rounded-[20px] aspect-square object-cover" />
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* =========================
             MANAGEMENT ENGINE
        ========================== */}
        <section className="bg-white py-[95px] md:py-[150px]">
          <div className="max-w-[1180px] mx-auto px-6">
            <motion.div className="max-w-[720px] mx-auto text-center" {...fadeUp()}>
              <span className="block mb-5 text-accent text-[11px] font-extrabold uppercase tracking-[1.6px]">Muito mais que uma agenda</span>
              <h2 className="font-title text-[43px] md:text-[clamp(40px,5vw,68px)] leading-none tracking-[-3px] md:tracking-[-4px] font-bold">
                Um motor de gestão<br /> para o seu negócio.
              </h2>
              <p className="max-w-[590px] mx-auto mt-[25px] text-[#707070] text-[16px] leading-[1.7]">
                Tudo que você precisa para transformar seus atendimentos
                em uma operação organizada.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 gap-[60px] md:gap-[90px] items-center mt-[50px] md:mt-[80px]">
              <motion.div {...fadeUp(0.2)}>
                <img src="/images/salao-cachos.jpg" alt="Gestão do Corte Flow" className="aspect-square object-cover rounded-[35px]" />
              </motion.div>

              <div className="flex flex-col">
                <motion.article className="grid grid-cols-[35px_1fr] md:grid-cols-[50px_1fr] gap-5 py-[30px] border-t border-b border-[#dddddd] group" {...fadeUp(0.1)}>
                  <span className="text-accent text-[11px] font-extrabold group-hover:scale-110 transition-transform">01</span>
                  <div>
                    <h3 className="font-title text-[19px] tracking-[-0.5px] font-bold">Agenda inteligente</h3>
                    <p className="mt-[9px] text-[#707070] text-[13px] leading-[1.7]">
                      Seus clientes encontram os horários disponíveis
                      e fazem o agendamento sem precisar falar com você.
                    </p>
                  </div>
                </motion.article>
                <motion.article className="grid grid-cols-[35px_1fr] md:grid-cols-[50px_1fr] gap-5 py-[30px] border-b border-[#dddddd] group" {...fadeUp(0.2)}>
                  <span className="text-accent text-[11px] font-extrabold group-hover:scale-110 transition-transform">02</span>
                  <div>
                    <h3 className="font-title text-[19px] tracking-[-0.5px] font-bold">Serviços organizados</h3>
                    <p className="mt-[9px] text-[#707070] text-[13px] leading-[1.7]">
                      Cadastre seus serviços, preços, duração e deixe
                      tudo pronto para o cliente escolher.
                    </p>
                  </div>
                </motion.article>
                <motion.article className="grid grid-cols-[35px_1fr] md:grid-cols-[50px_1fr] gap-5 py-[30px] border-b border-[#dddddd] group" {...fadeUp(0.3)}>
                  <span className="text-accent text-[11px] font-extrabold group-hover:scale-110 transition-transform">03</span>
                  <div>
                    <h3 className="font-title text-[19px] tracking-[-0.5px] font-bold">Clientes no lugar certo</h3>
                    <p className="mt-[9px] text-[#707070] text-[13px] leading-[1.7]">
                      Tenha sua operação organizada sem depender de
                      dezenas de conversas espalhadas pelo WhatsApp.
                    </p>
                  </div>
                </motion.article>
                <motion.article className="grid grid-cols-[35px_1fr] md:grid-cols-[50px_1fr] gap-5 py-[30px] border-b border-[#dddddd] group" {...fadeUp(0.4)}>
                  <span className="text-accent text-[11px] font-extrabold group-hover:scale-110 transition-transform">04</span>
                  <div>
                    <h3 className="font-title text-[19px] tracking-[-0.5px] font-bold">Você no controle</h3>
                    <p className="mt-[9px] text-[#707070] text-[13px] leading-[1.7]">
                      Acompanhe tudo de uma única plataforma, onde
                      sua operação realmente acontece.
                    </p>
                  </div>
                </motion.article>
              </div>
            </div>
          </div>
        </section>

        {/* =========================
             TEAM
        ========================== */}
        <section id="equipe" className="bg-[#f7f7f7] py-[95px] md:py-[150px]">
          <div className="max-w-[1180px] mx-auto px-6">
            <div className="grid md:grid-cols-[0.9fr_1.1fr] gap-[60px] md:gap-[90px] items-center">
              <motion.div {...fadeUp()}>
                <span className="block mb-5 text-accent text-[11px] font-extrabold uppercase tracking-[1.6px]">Para equipes</span>
                <h2 className="font-title text-[43px] md:text-[clamp(40px,5vw,68px)] leading-none tracking-[-3px] md:tracking-[-4px] font-bold">
                  Começou sozinho?<br /> <span className="text-[#999999]">Cresceu? Melhor ainda.</span>
                </h2>
                <p className="max-w-[500px] mt-[25px] text-[#707070] leading-[1.8]">
                  Crie sua equipe, cadastre seus profissionais e
                  organize a agenda de cada um.
                </p>
                <p className="max-w-[500px] mt-[15px] text-[#707070] leading-[1.8]">
                  Cada profissional pode acompanhar seus próprios
                  agendamentos enquanto você mantém a visão completa
                  do negócio.
                </p>
                <Link to="/cadastro" className="inline-flex items-center justify-center gap-[14px] min-h-[50px] px-5 mt-[35px] rounded-full text-[13px] font-bold transition-all bg-accent text-white hover:-translate-y-[3px] hover:shadow-lg hover:shadow-accent/30 w-full md:w-auto">
                  Criar minha equipe <span>→</span>
                </Link>
              </motion.div>

              <motion.div className="relative" {...fadeUp(0.2)}>
                <img src="/images/barbeiro-corte.jpg" alt="Equipe de profissionais" className="aspect-[4/3] object-cover rounded-[35px]" />
                <div className="absolute left-[10px] md:-left-[25px] bottom-[10px] md:bottom-[25px] flex items-center gap-[15px] p-[15px_18px] bg-white/95 rounded-[18px] shadow-[0_20px_50px_rgba(233,152,37,0.15)]">
                  <div className="flex">
                    <span className="grid place-items-center w-[30px] h-[30px] -ml-[7px] first:ml-0 border-2 border-white rounded-full bg-[#dddddd] text-[10px]"></span>
                    <span className="grid place-items-center w-[30px] h-[30px] -ml-[7px] first:ml-0 border-2 border-white rounded-full bg-[#dddddd] text-[10px]"></span>
                    <span className="grid place-items-center w-[30px] h-[30px] -ml-[7px] first:ml-0 border-2 border-white rounded-full bg-[#dddddd] text-[10px]"></span>
                    <span className="grid place-items-center w-[30px] h-[30px] -ml-[7px] first:ml-0 border-2 border-white rounded-full bg-accent text-white text-[10px] font-bold">+</span>
                  </div>
                  <div>
                    <strong className="block text-[12px]">Sua equipe</strong>
                    <small className="block mt-[3px] text-[#999999] text-[10px]">Todos conectados</small>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* =========================
             HOME SERVICE
        ========================== */}
        <section id="domicilio" className="pb-[95px] md:pb-[150px] bg-[#f7f7f7]">
          <div className="max-w-[1180px] mx-auto px-6">
            <div className="relative grid md:grid-cols-2 gap-[50px] p-[45px_25px] md:p-[90px] rounded-[30px] md:rounded-[45px] overflow-hidden text-white" style={{ background: 'radial-gradient(circle at 80% 30%, rgba(233,152,37,0.15), transparent 35%), #0b0b0b' }}>
              <div className="absolute w-[400px] h-[400px] right-[-150px] top-[-150px] rounded-full bg-accent/20 blur-[60px]"></div>

              <motion.div className="relative z-10" {...fadeUp()}>
                <span className="block mb-5 text-accent text-[11px] font-extrabold uppercase tracking-[1.6px]">Uma novidade que muda o jogo</span>
                <h2 className="font-title text-[45px] md:text-[clamp(42px,5vw,70px)] leading-none tracking-[-3px] md:tracking-[-4px] font-bold">
                  Você define o raio.<br />
                  <span className="text-white/40">O sistema faz o resto.</span>
                </h2>
                <p className="max-w-[490px] mt-[25px] text-white/60 text-[15px] leading-[1.8]">
                  Trabalha a domicílio? Deixe o Corte Flow verificar
                  automaticamente se o endereço do cliente está dentro
                  da sua área de atendimento.
                </p>
                <Link to="/cadastro" className="inline-flex items-center justify-center gap-[14px] min-h-[50px] px-5 mt-[35px] rounded-full text-[13px] font-bold transition-all bg-accent text-white hover:-translate-y-[3px] shadow-lg shadow-accent/20 w-full md:w-auto">
                  Quero atender a domicílio <span>→</span>
                </Link>
              </motion.div>

              <motion.div className="relative min-h-[350px] md:min-h-[440px]" {...fadeUp(0.2)}>
                <div className="absolute inset-0 overflow-hidden rounded-[30px] border border-accent/20" style={{ background: 'radial-gradient(circle, rgba(233,152,37,0.15) 1px, transparent 1px)', backgroundSize: '30px 30px' }}>
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(30deg, transparent 49%, rgba(255,255,255,0.04) 50%, transparent 51%), linear-gradient(-30deg, transparent 49%, rgba(255,255,255,0.04) 50%, transparent 51%)', backgroundSize: '80px 80px' }}></div>
                  <div className="absolute w-[240px] h-[240px] md:w-[300px] md:h-[300px] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-accent/50 bg-accent/10"></div>
                  
                  <div className="absolute p-[9px_13px] rounded-full bg-accent text-white text-[10px] font-bold shadow-[0_15px_40px_rgba(233,152,37,0.4)] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                    <span>Seu negócio</span>
                  </div>
                  <div className="absolute p-[9px_13px] rounded-full bg-white text-black text-[10px] font-bold shadow-[0_15px_40px_rgba(0,0,0,0.3)] left-[68%] top-[29%]">
                    <span>Cliente</span>
                  </div>

                  <div className="absolute bottom-[22px] left-[22px] p-[14px_17px] bg-black/70 border border-accent/30 rounded-[15px] backdrop-blur-[15px]">
                    <strong className="block text-[18px] text-accent">8,4 km</strong>
                    <small className="text-white/70 text-[9px]">Dentro do raio de atendimento</small>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* =========================
             HOME SERVICE EXPLANATION
        ========================== */}
        <section className="bg-[#f7f7f7] py-[95px] md:py-[150px]">
          <div className="max-w-[1180px] mx-auto px-6">
            <motion.div className="max-w-[720px] mx-auto text-center" {...fadeUp()}>
              <span className="block mb-5 text-accent text-[11px] font-extrabold uppercase tracking-[1.6px]">Atendimento a domicílio</span>
              <h2 className="font-title text-[43px] md:text-[clamp(40px,5vw,68px)] leading-none tracking-[-3px] md:tracking-[-4px] font-bold">
                O cliente escolhe.<br /> O Corte Flow resolve.
              </h2>
            </motion.div>

            <div className="max-w-[900px] mx-auto mt-[55px] md:mt-[80px]">
              <motion.div className="grid grid-cols-[50px_1fr] md:grid-cols-[70px_1fr] gap-[18px] md:gap-[30px] items-center" {...fadeUp(0.1)}>
                <div className="grid place-items-center w-[48px] h-[48px] md:w-[60px] md:h-[60px] rounded-full bg-accent text-white text-[12px] font-extrabold shadow-[0_10px_25px_rgba(233,152,37,0.3)]">01</div>
                <div>
                  <h3 className="font-title text-[20px] font-bold">Cliente escolhe o serviço</h3>
                  <p className="mt-[7px] text-[#707070] text-[13px]">Ele entra no seu site e escolhe o que deseja.</p>
                </div>
              </motion.div>
              <div className="w-px h-[50px] bg-accent/20 ml-[24px] md:ml-[29px] my-2"></div>
              
              <motion.div className="grid grid-cols-[50px_1fr] md:grid-cols-[70px_1fr] gap-[18px] md:gap-[30px] items-center" {...fadeUp(0.2)}>
                <div className="grid place-items-center w-[48px] h-[48px] md:w-[60px] md:h-[60px] rounded-full bg-accent text-white text-[12px] font-extrabold shadow-[0_10px_25px_rgba(233,152,37,0.3)]">02</div>
                <div>
                  <h3 className="font-title text-[20px] font-bold">Informa o endereço</h3>
                  <p className="mt-[7px] text-[#707070] text-[13px]">O cliente escolhe atendimento a domicílio e informa onde está.</p>
                </div>
              </motion.div>
              <div className="w-px h-[50px] bg-accent/20 ml-[24px] md:ml-[29px] my-2"></div>
              
              <motion.div className="grid grid-cols-[50px_1fr] md:grid-cols-[70px_1fr] gap-[18px] md:gap-[30px] items-center" {...fadeUp(0.3)}>
                <div className="grid place-items-center w-[48px] h-[48px] md:w-[60px] md:h-[60px] rounded-full bg-accent text-white text-[12px] font-extrabold shadow-[0_10px_25px_rgba(233,152,37,0.3)]">03</div>
                <div>
                  <h3 className="font-title text-[20px] font-bold">O sistema verifica</h3>
                  <p className="mt-[7px] text-[#707070] text-[13px]">O Corte Flow verifica automaticamente se o endereço está dentro do seu raio.</p>
                </div>
              </motion.div>
              <div className="w-px h-[50px] bg-accent/20 ml-[24px] md:ml-[29px] my-2"></div>
              
              <motion.div className="grid grid-cols-[50px_1fr] md:grid-cols-[70px_1fr] gap-[18px] md:gap-[30px] items-center" {...fadeUp(0.4)}>
                <div className="grid place-items-center w-[48px] h-[48px] md:w-[60px] md:h-[60px] rounded-full bg-accent text-white text-[12px] font-extrabold shadow-[0_10px_25px_rgba(233,152,37,0.3)]">04</div>
                <div>
                  <h3 className="font-title text-[20px] font-bold">Agendamento confirmado</h3>
                  <p className="mt-[7px] text-[#707070] text-[13px]">Pronto. Você recebe o agendamento sem precisar ficar parando o atendimento para organizar tudo.</p>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* =========================
             FOR EVERY BUSINESS
        ========================== */}
        <section className="bg-white py-[95px] md:py-[150px]">
          <div className="max-w-[1180px] mx-auto px-6">
            <motion.div className="max-w-[720px]" {...fadeUp()}>
              <span className="block mb-5 text-accent text-[11px] font-extrabold uppercase tracking-[1.6px]">Feito para quem vive de atendimento</span>
              <h2 className="font-title text-[43px] md:text-[clamp(40px,5vw,68px)] leading-none tracking-[-3px] md:tracking-[-4px] font-bold">
                Seu negócio.<br /> Do seu jeito.
              </h2>
            </motion.div>

            <div className="flex flex-col md:grid md:grid-cols-[1.5fr_1fr_1fr] md:grid-rows-[360px_360px] gap-4 mt-[45px] md:mt-[70px]">
              
              <motion.article className="relative min-h-[420px] md:min-h-0 md:row-span-2 overflow-hidden rounded-[30px] p-[35px]" {...fadeUp(0.1)}>
                <img src="/images/barbearia.jpg" alt="Barbearia" className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent p-[35px] flex flex-col justify-end text-white">
                  <span className="text-accent text-[10px] font-extrabold">01</span>
                  <h3 className="font-title mt-3 text-[25px] tracking-[-1px] font-bold">Barbearias</h3>
                  <p className="mt-[7px] text-white/65 text-[12px] leading-[1.6]">Menos mensagens. Mais clientes na cadeira.</p>
                </div>
              </motion.article>

              <motion.article className="relative min-h-[330px] md:min-h-0 overflow-hidden rounded-[30px] p-[35px] bg-[#f7f7f7] flex flex-col hover:bg-white hover:shadow-[0_20px_50px_rgba(233,152,37,0.1)] transition-all" {...fadeUp(0.2)}>
                <div className="text-[30px] mb-[80px] text-accent">✦</div>
                <div className="mt-auto">
                  <span className="text-accent text-[10px] font-extrabold">02</span>
                  <h3 className="font-title mt-3 text-[25px] tracking-[-1px] font-bold">Salões de beleza</h3>
                  <p className="mt-[7px] text-[#707070] text-[12px] leading-[1.6]">Organize sua equipe e deixe cada profissional cuidar da própria agenda.</p>
                </div>
              </motion.article>

              <motion.article className="relative min-h-[330px] md:min-h-0 overflow-hidden rounded-[30px] p-[35px] bg-[#f7f7f7] flex flex-col hover:bg-white hover:shadow-[0_20px_50px_rgba(233,152,37,0.1)] transition-all" {...fadeUp(0.3)}>
                <div className="text-[30px] mb-[80px] text-accent">✧</div>
                <div className="mt-auto">
                  <span className="text-accent text-[10px] font-extrabold">03</span>
                  <h3 className="font-title mt-3 text-[25px] tracking-[-1px] font-bold">Manicures</h3>
                  <p className="mt-[7px] text-[#707070] text-[12px] leading-[1.6]">Sua agenda disponível para clientes a qualquer hora.</p>
                </div>
              </motion.article>

              <motion.article className="relative min-h-[330px] md:min-h-0 md:col-span-2 overflow-hidden rounded-[30px] p-[35px]" {...fadeUp(0.4)}>
                <img src="/images/estilo-corte.jpg" alt="Profissional de beleza" className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent p-[35px] flex flex-col justify-end text-white">
                  <span className="text-accent text-[10px] font-extrabold">04</span>
                  <h3 className="font-title mt-3 text-[25px] tracking-[-1px] font-bold">Profissionais autônomos</h3>
                  <p className="mt-[7px] text-white/65 text-[12px] leading-[1.6]">Comece profissional desde o primeiro cliente.</p>
                </div>
              </motion.article>

            </div>
          </div>
        </section>

        {/* =========================
             BENEFITS
        ========================== */}
        <section className="bg-[#f7f7f7] py-[95px] md:py-[150px]">
          <div className="max-w-[1180px] mx-auto px-6">
            <div className="grid md:grid-cols-2 gap-[50px] md:gap-[120px]">
              
              <motion.div {...fadeUp()}>
                <span className="block mb-5 text-accent text-[11px] font-extrabold uppercase tracking-[1.6px]">O resultado</span>
                <h2 className="font-title text-[43px] md:text-[clamp(40px,5vw,68px)] leading-none tracking-[-3px] md:tracking-[-4px] font-bold">
                  Você não precisa <span className="text-accent/50">trabalhar mais.</span> Precisa trabalhar melhor.
                </h2>
              </motion.div>

              <div className="border-t border-[#dddddd]">
                <motion.div className="grid grid-cols-[50px_1fr] gap-5 py-[30px] border-b border-[#dddddd]" {...fadeUp(0.1)}>
                  <strong className="text-accent text-[11px]">01</strong>
                  <div>
                    <h3 className="font-title text-[18px] font-bold">Mais tempo</h3>
                    <p className="mt-[8px] text-[#707070] text-[13px] leading-[1.7]">Pare de interromper seus atendimentos para organizar horários.</p>
                  </div>
                </motion.div>
                <motion.div className="grid grid-cols-[50px_1fr] gap-5 py-[30px] border-b border-[#dddddd]" {...fadeUp(0.2)}>
                  <strong className="text-accent text-[11px]">02</strong>
                  <div>
                    <h3 className="font-title text-[18px] font-bold">Mais organização</h3>
                    <p className="mt-[8px] text-[#707070] text-[13px] leading-[1.7]">Tudo em um só lugar, sem depender de anotações.</p>
                  </div>
                </motion.div>
                <motion.div className="grid grid-cols-[50px_1fr] gap-5 py-[30px] border-b border-[#dddddd]" {...fadeUp(0.3)}>
                  <strong className="text-accent text-[11px]">03</strong>
                  <div>
                    <h3 className="font-title text-[18px] font-bold">Mais autonomia</h3>
                    <p className="mt-[8px] text-[#707070] text-[13px] leading-[1.7]">Seu cliente agenda sozinho, inclusive fora do horário comercial.</p>
                  </div>
                </motion.div>
                <motion.div className="grid grid-cols-[50px_1fr] gap-5 py-[30px] border-b border-[#dddddd]" {...fadeUp(0.4)}>
                  <strong className="text-accent text-[11px]">04</strong>
                  <div>
                    <h3 className="font-title text-[18px] font-bold">Mais possibilidades</h3>
                    <p className="mt-[8px] text-[#707070] text-[13px] leading-[1.7]">Cresça de profissional autônomo para uma equipe completa sem perder o controle.</p>
                  </div>
                </motion.div>
              </div>

            </div>
          </div>
        </section>

        {/* =========================
             PRICING
        ========================== */}
        <section id="planos" className="bg-white py-[95px] md:py-[150px]">
          <div className="max-w-[1180px] mx-auto px-6">
            <motion.div className="max-w-[720px] mx-auto text-center" {...fadeUp()}>
              <span className="block mb-5 text-accent text-[11px] font-extrabold uppercase tracking-[1.6px]">Planos</span>
              <h2 className="font-title text-[43px] md:text-[clamp(40px,5vw,68px)] leading-none tracking-[-3px] md:tracking-[-4px] font-bold">
                Quanto vale recuperar<br /> horas do seu dia?
              </h2>
              <p className="max-w-[590px] mx-auto mt-[25px] text-[#707070] text-[16px] leading-[1.7]">
                Escolha o plano que combina com o momento do seu negócio.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-[15px] mt-[45px] md:mt-[70px] max-w-[500px] md:max-w-none mx-auto">
              
              {/* PLAN 1 */}
              <motion.article className="p-[30px] md:p-[38px] border border-[#dddddd] bg-white rounded-[28px] transition-all duration-300 hover:-translate-y-[6px] hover:shadow-[0_25px_70px_rgba(233,152,37,0.15)] hover:border-accent/40" {...fadeUp(0.1)}>
                <span className="font-title text-[17px] font-extrabold">Essencial</span>
                <p className="mt-2 text-[#999999] text-[12px]">Para quem está começando.</p>
                <div className="flex items-baseline mt-[35px]">
                  <small className="text-[14px] font-bold text-accent">R$</small>
                  <strong className="ml-1 text-[48px] md:text-[54px] tracking-[-3px] text-accent">27</strong>
                  <span className="ml-[5px] text-[#999999] text-[11px]">/mês</span>
                </div>
                <Link to="/cadastro" className="flex items-center justify-center w-full h-[48px] mt-[30px] border border-[#dddddd] rounded-[13px] text-[12px] font-extrabold transition-colors hover:bg-accent/5 hover:border-accent text-accent">Começar agora</Link>
                <div className="flex flex-col gap-[14px] mt-[35px] pt-[30px] border-t border-[#dddddd]">
                  <span className="text-[#707070] text-[12px]"><strong className="text-accent">✓</strong> Agendamento online</span>
                  <span className="text-[#707070] text-[12px]"><strong className="text-accent">✓</strong> Agenda inteligente</span>
                  <span className="text-[#707070] text-[12px]"><strong className="text-accent">✓</strong> Cadastro de serviços</span>
                  <span className="text-[#707070] text-[12px]"><strong className="text-accent">✓</strong> Gestão de clientes</span>
                </div>
              </motion.article>

              {/* PLAN 2 */}
              <motion.article className="relative p-[30px] md:p-[38px] border-2 border-accent bg-white rounded-[28px] shadow-[0_20px_60px_rgba(233,152,37,0.2)] transition-all duration-300 hover:-translate-y-[6px] hover:shadow-[0_25px_70px_rgba(233,152,37,0.3)]" {...fadeUp(0.2)}>
                <div className="absolute top-[-12px] left-[30px] p-[6px_11px] rounded-full bg-accent text-white text-[9px] font-extrabold">Mais escolhido</div>
                <span className="font-title text-[17px] font-extrabold">Profissional</span>
                <p className="mt-2 text-[#999999] text-[12px]">Para quem quer crescer.</p>
                <div className="flex items-baseline mt-[35px]">
                  <small className="text-[14px] font-bold text-accent">R$</small>
                  <strong className="ml-1 text-[48px] md:text-[54px] tracking-[-3px] text-accent">77</strong>
                  <span className="ml-[5px] text-[#999999] text-[11px]">/mês</span>
                </div>
                <Link to="/cadastro" className="flex items-center justify-center w-full h-[48px] mt-[30px] border border-accent bg-accent text-white rounded-[13px] text-[12px] font-extrabold transition-opacity hover:opacity-90 shadow-[0_10px_20px_rgba(233,152,37,0.3)]">Quero esse plano</Link>
                <div className="flex flex-col gap-[14px] mt-[35px] pt-[30px] border-t border-[#dddddd]">
                  <span className="text-[#707070] text-[12px]"><strong className="text-accent">✓</strong> Tudo do Essencial</span>
                  <span className="text-[#707070] text-[12px]"><strong className="text-accent">✓</strong> Equipe de profissionais</span>
                  <span className="text-[#707070] text-[12px]"><strong className="text-accent">✓</strong> Agenda individual</span>
                  <span className="text-[#707070] text-[12px]"><strong className="text-accent">✓</strong> Atendimento a domicílio</span>
                  <span className="text-[#707070] text-[12px]"><strong className="text-accent">✓</strong> Raio de atendimento</span>
                </div>
              </motion.article>

              {/* PLAN 3 */}
              <motion.article className="p-[30px] md:p-[38px] border border-[#dddddd] bg-white rounded-[28px] transition-all duration-300 hover:-translate-y-[6px] hover:shadow-[0_25px_70px_rgba(233,152,37,0.15)] hover:border-accent/40" {...fadeUp(0.3)}>
                <span className="font-title text-[17px] font-extrabold">Negócios</span>
                <p className="mt-2 text-[#999999] text-[12px]">Para operações maiores.</p>
                <div className="flex items-baseline mt-[35px]">
                  <small className="text-[14px] font-bold text-accent">R$</small>
                  <strong className="ml-1 text-[48px] md:text-[54px] tracking-[-3px] text-accent">197</strong>
                  <span className="ml-[5px] text-[#999999] text-[11px]">/mês</span>
                </div>
                <a href="mailto:contato@corteflow.com" className="flex items-center justify-center w-full h-[48px] mt-[30px] border border-[#dddddd] rounded-[13px] text-[12px] font-extrabold transition-colors hover:bg-accent/5 hover:border-accent text-accent">Falar com time</a>
                <div className="flex flex-col gap-[14px] mt-[35px] pt-[30px] border-t border-[#dddddd]">
                  <span className="text-[#707070] text-[12px]"><strong className="text-accent">✓</strong> Tudo do Profissional</span>
                  <span className="text-[#707070] text-[12px]"><strong className="text-accent">✓</strong> Gestão avançada</span>
                  <span className="text-[#707070] text-[12px]"><strong className="text-accent">✓</strong> Equipes maiores</span>
                  <span className="text-[#707070] text-[12px]"><strong className="text-accent">✓</strong> Mais controle da operação</span>
                </div>
              </motion.article>

            </div>

            <motion.p className="text-center mt-[30px] text-[#999999] text-[11px]" {...fadeUp(0.4)}>
              Sem complicação. Comece pequeno e evolua conforme seu negócio cresce.
            </motion.p>
          </div>
        </section>

        {/* =========================
             FINAL CTA
        ========================== */}
        <section className="relative py-[110px] md:py-[170px] overflow-hidden bg-[#080808] text-white text-center">
          <div className="absolute w-[700px] h-[700px] top-[-300px] left-1/2 -translate-x-1/2 rounded-full bg-accent/20 blur-[100px]"></div>
          
          <div className="max-w-[1180px] mx-auto px-6 relative z-10">
            <motion.div {...fadeUp()}>
              <span className="block mb-5 text-accent text-[11px] font-extrabold uppercase tracking-[1.6px]">Seu próximo cliente pode estar tentando agendar agora.</span>
              <h2 className="font-title text-[49px] md:text-[clamp(48px,7vw,90px)] leading-[0.95] tracking-[-4px] md:tracking-[-6px] font-bold">
                Você cuida do cliente.<br />
                <span className="text-white/40">O Corte Flow cuida da sua agenda.</span>
              </h2>
              <p className="mt-[25px] text-white/50">Transforme a maneira como você administra seu negócio.</p>
              
              <Link to="/cadastro" className="inline-flex items-center justify-center gap-[14px] min-h-[58px] px-[25px] mt-[35px] rounded-full text-[13px] font-bold transition-all bg-accent text-white hover:-translate-y-[3px] shadow-[0_10px_30px_rgba(233,152,37,0.3)]">
                Começar agora <span>→</span>
              </Link>
            </motion.div>
          </div>
        </section>

      </main>

      {/* =========================
           FOOTER
      ========================== */}
      <footer className="bg-[#080808] text-white border-t border-white/10 pt-[70px] pb-[25px]">
        <div className="max-w-[1180px] mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between gap-[50px]">
            <div>
              <div className="flex items-center gap-2.5 font-extrabold text-[17px] tracking-tight">
                <span className="grid place-items-center w-[30px] h-[30px] rounded-[9px] bg-accent text-white text-[15px]">C</span>
                <span className="font-title">Corte Flow</span>
              </div>
              <p className="max-w-[280px] mt-[18px] text-white/40 text-[12px] leading-[1.7]">
                Agendamento e gestão para quem vive de atendimento.
              </p>
            </div>

            <div className="flex gap-[50px] md:gap-[100px]">
              <div className="flex flex-col gap-[13px]">
                <strong className="mb-2 text-[11px] text-accent">Produto</strong>
                <a href="#recursos" className="text-white/40 text-[11px] hover:text-accent transition-colors">Recursos</a>
                <a href="#equipe" className="text-white/40 text-[11px] hover:text-accent transition-colors">Equipes</a>
                <a href="#domicilio" className="text-white/40 text-[11px] hover:text-accent transition-colors">Domicílio</a>
                <a href="#planos" className="text-white/40 text-[11px] hover:text-accent transition-colors">Planos</a>
              </div>
              <div className="flex flex-col gap-[13px]">
                <strong className="mb-2 text-[11px] text-accent">Empresa</strong>
                <a href="#" className="text-white/40 text-[11px] hover:text-accent transition-colors">Sobre</a>
                <a href="#" className="text-white/40 text-[11px] hover:text-accent transition-colors">Contato</a>
                <a href="#" className="text-white/40 text-[11px] hover:text-accent transition-colors">Privacidade</a>
              </div>
            </div>
          </div>

          <div className="mt-[70px] pt-[25px] border-t border-white/10 text-white/25 text-[10px]">
            © {new Date().getFullYear()} Corte Flow. Todos os direitos reservados.
          </div>
        </div>
      </footer>

      <CookieConsentBanner />
    </div>
  );
}
