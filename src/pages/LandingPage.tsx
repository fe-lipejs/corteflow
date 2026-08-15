import { motion } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { CheckCircle, ArrowRight, Scissors, Star, Calendar, Users, CreditCard, Clock, Globe, Phone, Mail, User, Sparkles } from 'lucide-react';
import CookieConsentBanner from '../components/cookies/CookieConsentBanner';

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-50px' },
  transition: { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }
});

const services = [
  { img: '/service-haircut.png', title: 'Barbearias & Cortes', desc: 'Fade, degradê, barba na toalha e estilo social' },
  { img: '/service-salon.png', title: 'Salões de Beleza', desc: 'Cortes femininos, coloração, mechas e tratamentos' },
  { img: '/service-nails.png', title: 'Esmalterias & Studios', desc: 'Manicure, pedicure, alongamento e nail art' },
];

const testimonials = [
  { name: 'Rafael Pimentel', role: 'Barbearia Pimentel · SP', text: 'Aumentei meus agendamentos em 40% no primeiro mês. Meus clientes adoraram poder agendar direto pelo celular sem precisar esperar no WhatsApp.', stars: 5 },
  { name: 'Camila Torres', role: 'Studio CT · RJ', text: 'Acabou a bagunça de cadernos e horários duplicados. Agora tudo fica organizado, sincronizado e eu recebo notificação a cada reserva.', stars: 5 },
  { name: 'João Bento', role: 'Esmalteria VIP · BH', text: 'Migrei de outro sistema antigo e fiquei impressionado com o design limpo e moderno. Os clientes elogiam todos os dias.', stars: 5 },
];

const stats = [
  { value: '2.500+', label: 'Profissionais Ativos' },
  { value: '150k+', label: 'Agendamentos Realizados' },
  { value: '4.9/5', label: 'Nota Média de Avaliação' },
  { value: '99.4%', label: 'Satisfação dos Salões' },
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="bg-[#F8FAFC] text-[#0F172A] font-sans overflow-x-hidden min-h-screen selection:bg-[#DE870D]/20 selection:text-[#DE870D]">

      {/* ─── NAV ─── */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-white/80 border-b border-[#E2E8F0]/80 transition-all">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/">
              <img src="/logo.svg" alt="Raffros Corteflow" className="h-10 md:h-14 w-auto" />
            </Link>
          </div>
          <div className="hidden md:flex items-center gap-8 font-medium">
            <a href="#servicos" className="text-sm text-[#475569] hover:text-[#DE870D] transition-colors">Segmentos</a>
            <a href="#como-funciona" className="text-sm text-[#475569] hover:text-[#DE870D] transition-colors">Como Funciona</a>
            <a href="#depoimentos" className="text-sm text-[#475569] hover:text-[#DE870D] transition-colors">Depoimentos</a>
            <a href="#planos" className="text-sm text-[#475569] hover:text-[#DE870D] transition-colors">Planos & Preços</a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="flex items-center gap-2 text-sm font-bold text-[#334155] hover:text-[#DE870D] transition-colors px-3 py-2">
              <span className="hidden sm:inline">Entrar</span>
              <User className="w-5 h-5 sm:hidden" />
            </Link>
            <Link
              to="/cadastro"
              className="text-sm font-bold px-5 py-2.5 rounded-xl text-white transition-all shadow-md shadow-[#DE870D]/25 hover:shadow-lg hover:shadow-[#DE870D]/35 hover:brightness-105 active:scale-[0.98] cursor-pointer"
              style={{ background: 'linear-gradient(135deg, #DE870D, #F5A623)' }}
            >
              Começar Grátis
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section className="relative min-h-[90vh] flex items-center pt-28 pb-16 overflow-hidden">
        {/* Ambient Light Gradient Glows */}
        <div className="absolute top-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-[#DE870D]/10 blur-[140px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40vw] h-[40vw] bg-[#F5A623]/8 blur-[120px] rounded-full pointer-events-none" />

        <div className="relative z-10 max-w-7xl mx-auto px-6 grid lg:grid-cols-12 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="lg:col-span-7 space-y-6"
          >
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] px-4 py-2 rounded-full border border-[#DE870D]/30 text-[#DE870D] bg-[#DE870D]/10">
              <Sparkles className="w-3.5 h-3.5 text-[#DE870D]" /> Plataforma #1 em Gestão & Agendamento
            </div>
            
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black leading-[1.08] tracking-tight text-[#0F172A]">
              Transforme seu{' '}
              <span className="bg-gradient-to-r from-[#DE870D] to-[#F5A623] bg-clip-text text-transparent">
                estabelecimento
              </span>{' '}
              em uma máquina de agendamentos.
            </h1>
            
            <p className="text-base sm:text-lg text-[#475569] max-w-xl leading-relaxed font-normal">
              Agenda online inteligente, cobranças Pix e Cartão no Stripe Connect, gestão de profissionais e sua página pública profissional. Seus clientes agendam 24 horas por dia.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 pt-2">
              <button
                onClick={() => navigate('/cadastro')}
                className="flex items-center justify-center gap-2 text-base font-bold px-8 py-4 rounded-xl text-white transition-all shadow-lg shadow-[#DE870D]/25 hover:shadow-xl hover:shadow-[#DE870D]/35 hover:brightness-105 active:scale-[0.98] cursor-pointer"
                style={{ background: 'linear-gradient(135deg, #DE870D, #F5A623)' }}
              >
                Experimentar 7 Dias Grátis <ArrowRight className="w-5 h-5" />
              </button>
              <a
                href="#como-funciona"
                className="flex items-center justify-center gap-2 text-base font-semibold px-8 py-4 rounded-xl border border-[#CBD5E1] bg-white text-[#334155] hover:border-[#DE870D] hover:text-[#DE870D] transition-all shadow-sm"
              >
                Como Funciona
              </a>
            </div>

            {/* Social proof */}
            <div className="flex items-center gap-6 pt-6 border-t border-[#E2E8F0]">
              <div className="flex -space-x-3">
                {[0, 1, 2, 3].map(i => (
                  <div key={i} className="w-10 h-10 rounded-full border-2 border-white flex items-center justify-center text-xs font-bold text-white shadow-sm" style={{ background: ['#DE870D', '#0F172A', '#F5A623', '#334155'][i] }}>
                    {['R', 'C', 'J', 'M'][i]}
                  </div>
                ))}
              </div>
              <div>
                <div className="flex gap-0.5 mb-1">
                  {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 fill-[#DE870D] text-[#DE870D]" />)}
                </div>
                <p className="text-xs font-semibold text-[#64748B]">+2.500 profissionais confiam na Raffros Corteflow</p>
              </div>
            </div>
          </motion.div>

          {/* Right side — hero preview card */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="lg:col-span-5 relative"
          >
            <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 shadow-2xl space-y-6 relative overflow-hidden">
              <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#DE870D]/15 text-[#DE870D] flex items-center justify-center font-bold">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-[#0F172A]">Agenda em Tempo Real</h4>
                    <p className="text-xs text-[#64748B]">Hoje · Sincronização Automática</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-green-100 text-green-700 font-bold text-xs rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-600 animate-pulse" /> Online
                </span>
              </div>

              <div className="space-y-3">
                {[
                  { time: '09:00', client: 'Lucas Medeiros', service: 'Corte + Barba', status: 'Confirmado', price: 'R$ 65,00' },
                  { time: '10:00', client: 'Mariana Lima', service: 'Coloração & Escova', status: 'Sinal Pago', price: 'R$ 140,00' },
                  { time: '11:15', client: 'Gabriel Castro', service: 'Degradê Navalhado', status: 'Confirmado', price: 'R$ 45,00' },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] hover:border-[#DE870D]/40 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="font-mono text-xs font-bold text-[#DE870D] bg-white px-2 py-1 rounded-lg border border-[#E2E8F0]">
                        {item.time}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#0F172A]">{item.client}</p>
                        <p className="text-[11px] text-[#64748B]">{item.service}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-[#0F172A]">{item.price}</p>
                      <span className="text-[10px] font-semibold text-green-600">{item.status}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 rounded-2xl bg-gradient-to-br from-[#DE870D]/10 to-[#F5A623]/5 border border-[#DE870D]/20 flex items-center justify-between">
                <div>
                  <p className="text-xs text-[#64748B] font-medium">Recebimentos no Stripe</p>
                  <p className="text-xl font-black text-[#0F172A]">R$ 1.840,00 <span className="text-xs font-bold text-green-600">+28%</span></p>
                </div>
                <div className="w-9 h-9 rounded-xl bg-[#DE870D] text-white flex items-center justify-center shadow-md">
                  <CreditCard className="w-5 h-5" />
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── STATS BAR ─── */}
      <section className="border-y border-[#E2E8F0] bg-white py-12">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s, i) => (
            <motion.div key={i} {...fadeUp(i * 0.05)} className="text-center">
              <p className="text-3xl sm:text-4xl md:text-5xl font-black bg-gradient-to-r from-[#DE870D] to-[#F5A623] bg-clip-text text-transparent">
                {s.value}
              </p>
              <p className="text-xs sm:text-sm text-[#64748B] mt-2 font-semibold">{s.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── SERVICES / SEGMENTS ─── */}
      <section id="servicos" className="py-24 bg-[#F8FAFC]">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div {...fadeUp()} className="text-center mb-16 space-y-3">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#DE870D]">Feito sob medida para você</p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-[#0F172A]">
              Ideal para qualquer <span className="text-[#DE870D]">negócio de beleza</span>
            </h2>
            <p className="text-[#64748B] text-sm max-w-lg mx-auto">
              Seja uma barbearia clássica, salão de beleza completo ou studio de unhas, o Corteflow adapta todo o catálogo e a experiência.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {services.map((svc, i) => (
              <motion.div key={i} {...fadeUp(i * 0.08)} className="group bg-white rounded-3xl overflow-hidden border border-[#E2E8F0] shadow-sm hover:shadow-xl transition-all hover:-translate-y-1">
                <div className="aspect-[4/3] relative overflow-hidden">
                  <img src={svc.img} alt={svc.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4 text-white">
                    <h3 className="text-xl font-bold">{svc.title}</h3>
                  </div>
                </div>
                <div className="p-6">
                  <p className="text-sm text-[#64748B] leading-relaxed">{svc.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section id="como-funciona" className="py-24 bg-white border-y border-[#E2E8F0]">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div {...fadeUp()} className="text-center mb-20 space-y-3">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#DE870D]">Simples, Rápido e Sem Complicações</p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-[#0F172A]">
              Como funciona o <span className="text-[#DE870D]">Corteflow</span>
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-10">
            {[
              { num: '01', icon: Mail, title: '1. Crie sua conta', desc: 'Cadastro em 30 segundos. Teste gratuitamente por 7 dias com todos os recursos liberados.' },
              { num: '02', icon: Scissors, title: '2. Personalize seu Salão', desc: 'Cadastre seus serviços, equipe, horários e configure sua página pública personalizada.' },
              { num: '03', icon: Calendar, title: '3. Receba Agendamentos', desc: 'Envie seu link no Instagram e WhatsApp. Receba pagamentos e confirmações no piloto automático.' },
            ].map((step, i) => (
              <motion.div key={i} {...fadeUp(i * 0.1)} className="relative p-8 rounded-3xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-4 hover:border-[#DE870D]/40 transition-all">
                <div className="w-14 h-14 rounded-2xl bg-[#DE870D]/10 border border-[#DE870D]/25 flex items-center justify-center text-[#DE870D]">
                  <step.icon className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold text-[#0F172A]">{step.title}</h3>
                <p className="text-sm text-[#64748B] leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FEATURES GRID ─── */}
      <section className="py-24 bg-[#F8FAFC]">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div {...fadeUp()} className="text-center mb-16 space-y-3">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#DE870D]">Recursos Premium</p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-[#0F172A]">
              Tudo o que você precisa para crescer
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Calendar, title: 'Agenda Online 24/7', desc: 'Seus clientes escolhem o serviço e o horário pelo celular sem esperar atendimento.' },
              { icon: CreditCard, title: 'Pagamentos no Stripe', desc: 'Receba antecipadamente via Pix ou Cartão e elimine faltas de última hora.' },
              { icon: Users, title: 'Gestão de Profissionais', desc: 'Agendas individuais, horários personalizados e comissões organizadas.' },
              { icon: Clock, title: 'Bloqueios e Feriados', desc: 'Trave folgas e horários de almoço com apenas 1 clique.' },
              { icon: Globe, title: 'Página Pública do Salão', desc: 'Seu link exclusivo para divulgar na bio do Instagram e no WhatsApp.' },
              { icon: Phone, title: 'Notificações no WhatsApp', desc: 'Lembretes e confirmações automáticas para você e para o cliente.' },
              { icon: Star, title: 'Segmentação de Clientes', desc: 'Identifique clientes VIPs, fiéis e recupere quem sumiu.' },
              { icon: Scissors, title: 'Tema e Identidade Visual', desc: 'Personalize cores, logotipo e banner para combinar com a sua marca.' },
            ].map((feat, i) => (
              <motion.div key={i} {...fadeUp(i * 0.04)} className="bg-white border border-[#E2E8F0] rounded-3xl p-6 hover:border-[#DE870D]/40 shadow-sm hover:shadow-md transition-all">
                <div className="w-12 h-12 rounded-2xl bg-[#DE870D]/10 text-[#DE870D] flex items-center justify-center mb-4">
                  <feat.icon className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-[#0F172A] mb-2 text-base">{feat.title}</h3>
                <p className="text-xs text-[#64748B] leading-relaxed">{feat.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── TESTIMONIALS ─── */}
      <section id="depoimentos" className="py-24 bg-white border-y border-[#E2E8F0]">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div {...fadeUp()} className="text-center mb-16 space-y-3">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#DE870D]">Resultados Reais</p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-[#0F172A]">
              Quem usa, recomenda
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((t, i) => (
              <motion.div key={i} {...fadeUp(i * 0.08)} className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-3xl p-8 relative flex flex-col justify-between">
                <div>
                  <div className="flex gap-1 mb-4">
                    {[...Array(t.stars)].map((_, si) => <Star key={si} className="w-4 h-4 fill-[#DE870D] text-[#DE870D]" />)}
                  </div>
                  <p className="text-sm text-[#334155] leading-relaxed mb-6 font-medium italic">"{t.text}"</p>
                </div>
                <div className="flex items-center gap-3 pt-4 border-t border-[#E2E8F0]">
                  <div className="w-10 h-10 rounded-full bg-[#DE870D] text-white flex items-center justify-center text-sm font-bold shadow-md">
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-sm text-[#0F172A]">{t.name}</p>
                    <p className="text-xs text-[#64748B]">{t.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PRICING ─── */}
      <section id="planos" className="py-24 bg-[#F8FAFC]">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div {...fadeUp()} className="text-center mb-16 space-y-3">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#DE870D]">Planos Simples e Transparentes</p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-[#0F172A]">
              Escolha o plano ideal para seu momento
            </h2>
            <p className="text-[#64748B] text-sm">7 dias de teste gratuito. Sem taxa de adesão ou fidelidade.</p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {/* Starter */}
            <motion.div {...fadeUp(0)} className="bg-white border border-[#E2E8F0] rounded-3xl p-8 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
              <div>
                <p className="font-bold text-sm text-[#64748B] mb-2">Starter</p>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-5xl font-black text-[#0F172A]">R$ 27</span>
                  <span className="text-sm font-semibold text-[#64748B]">/mês</span>
                </div>
                <p className="text-xs text-[#64748B] mb-8">Para profissionais autônomos e barbearias individuais</p>
                <ul className="space-y-3 mb-8">
                  {['1 Profissional Ativo', 'Agendamentos Ilimitados', 'Página Pública Personalizada', 'Controle Financeiro Básico', 'Suporte por E-mail'].map(f => (
                    <li key={f} className="flex items-center gap-3 text-sm text-[#334155] font-medium">
                      <CheckCircle className="w-4 h-4 flex-shrink-0 text-[#DE870D]" /> {f}
                    </li>
                  ))}
                </ul>
              </div>
              <button
                onClick={() => navigate('/cadastro')}
                className="w-full py-3.5 rounded-xl font-bold text-sm border-2 border-[#CBD5E1] text-[#0F172A] hover:border-[#DE870D] hover:text-[#DE870D] transition-all cursor-pointer"
              >
                Iniciar 7 Dias Grátis
              </button>
            </motion.div>

            {/* Growth */}
            <motion.div {...fadeUp(0.08)} className="relative bg-white border-2 border-[#DE870D] rounded-3xl p-8 shadow-xl shadow-[#DE870D]/10 flex flex-col justify-between">
              <div className="absolute top-5 right-5 text-xs font-bold px-3 py-1 rounded-full bg-[#DE870D] text-white shadow-md">
                Mais Escolhido
              </div>
              <div>
                <p className="font-bold text-sm text-[#DE870D] mb-2">Growth</p>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-5xl font-black text-[#0F172A]">R$ 77</span>
                  <span className="text-sm font-semibold text-[#64748B]">/mês</span>
                </div>
                <p className="text-xs text-[#64748B] mb-8">Para salões e barbearias em expansão com equipe</p>
                <ul className="space-y-3 mb-8">
                  {['Até 10 Profissionais', 'Agendamentos Ilimitados', 'Pagamentos Online (Stripe Connect)', 'Venda de Produtos & Estoque', 'Relatórios Financeiros Avançados', 'Suporte Prioritário WhatsApp'].map(f => (
                    <li key={f} className="flex items-center gap-3 text-sm text-[#0F172A] font-semibold">
                      <CheckCircle className="w-4 h-4 flex-shrink-0 text-[#DE870D]" /> {f}
                    </li>
                  ))}
                </ul>
              </div>
              <button
                onClick={() => navigate('/cadastro')}
                className="w-full py-3.5 rounded-xl font-bold text-sm text-white transition-all shadow-md shadow-[#DE870D]/25 hover:shadow-lg hover:shadow-[#DE870D]/35 hover:brightness-105 active:scale-[0.98] cursor-pointer"
                style={{ background: 'linear-gradient(135deg, #DE870D, #F5A623)' }}
              >
                Iniciar 7 Dias Grátis
              </button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section className="py-24 bg-[#0F172A] text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#DE870D]/15 blur-3xl rounded-full pointer-events-none" />
        <div className="max-w-3xl mx-auto px-6 text-center relative z-10 space-y-6">
          <motion.div {...fadeUp()}>
            <Scissors className="w-10 h-10 mx-auto mb-6 text-[#DE870D]" />
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight mb-4">
              Pronto para elevar o nível do seu <span className="text-[#DE870D]">salão?</span>
            </h2>
            <p className="text-slate-300 mb-8 max-w-lg mx-auto leading-relaxed text-sm sm:text-base">
              Junte-se a milhares de profissionais que modernizaram seus agendamentos e faturam mais todo mês.
            </p>
            <button
              onClick={() => navigate('/cadastro')}
              className="inline-flex items-center gap-2 text-base font-bold px-10 py-4 rounded-xl text-white transition-all shadow-xl shadow-[#DE870D]/30 hover:brightness-105 active:scale-[0.98] cursor-pointer"
              style={{ background: 'linear-gradient(135deg, #DE870D, #F5A623)' }}
            >
              Criar Conta Grátis <ArrowRight className="w-5 h-5" />
            </button>
          </motion.div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="bg-white border-t border-[#E2E8F0]">
        <div className="max-w-7xl mx-auto px-6 py-16 grid grid-cols-2 md:grid-cols-4 gap-10">
          <div>
            <div className="flex items-center mb-4">
              <img src="/logo.svg" alt="Raffros Corteflow" className="h-10 md:h-12 w-auto" />
            </div>
            <p className="text-xs text-[#64748B] leading-relaxed font-medium">O padrão ouro em gestão e agendamento para barbearias, salões de beleza e esmalterias.</p>
          </div>
          {[
            { title: 'Produto', items: ['Funcionalidades', 'Planos', 'Stripe Connect'] },
            { title: 'Recursos', items: ['Como Funciona', 'Ajuda', 'Suporte'] },
            { title: 'Legal', items: ['Termos de Uso', 'Privacidade', 'Cookies'] },
          ].map(col => (
            <div key={col.title}>
              <h4 className="text-[#0F172A] font-bold text-sm mb-4">{col.title}</h4>
              <ul className="space-y-2.5">
                {col.items.map(item => (
                  <li key={item}>
                    {item === 'Cookies' ? (
                      <button
                        onClick={() => {
                          localStorage.removeItem('navalha_cookie_preferences_v1');
                          window.location.reload();
                        }}
                        className="text-xs text-[#64748B] hover:text-[#DE870D] font-medium transition-colors text-left"
                      >
                        Preferências de Cookies
                      </button>
                    ) : (
                      <a href="#" className="text-xs text-[#64748B] hover:text-[#DE870D] font-medium transition-colors">{item}</a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="max-w-7xl mx-auto px-6 pb-8 pt-4 border-t border-[#E2E8F0] text-center text-xs text-[#94A3B8] font-medium">
          © {new Date().getFullYear()} Raffros Corteflow. Todos os direitos reservados.
        </div>
      </footer>

      {/* Cookie Consent Banner */}
      <CookieConsentBanner />
    </div>
  );
}
