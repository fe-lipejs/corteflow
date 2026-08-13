import { motion } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { CheckCircle, ArrowRight, Scissors, Star, Calendar, Users, CreditCard, Clock, Globe, Phone, Mail, User } from 'lucide-react';

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-50px' },
  transition: { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }
});

const services = [
  { img: '/service-haircut.png', title: 'Cortes Modernos', desc: 'Fade, degradê, social e mais' },
  { img: '/service-salon.png', title: 'Salão de Beleza', desc: 'Cortes femininos, coloração e tratamentos' },
  { img: '/service-nails.png', title: 'Nail Design', desc: 'Manicure, pedicure e nail art' },
];

const testimonials = [
  { name: 'Rafael Pimentel', role: 'Barbearia Pimentel · SP', text: 'Aumentei meus agendamentos em 40% no primeiro mês. Meus clientes adoraram poder agendar pelo celular.', stars: 5 },
  { name: 'Camila Torres', role: 'Studio CT · RJ', text: 'Acabou a bagunça de anotações em caderno. Agora tudo fica organizado e eu recebo alerta de cada reserva.', stars: 5 },
  { name: 'João Bento', role: 'Esmalteria J · BH', text: 'Migrei de outra plataforma e fiquei surpreso com o quanto é mais fácil de usar. Vale cada centavo.', stars: 5 },
];

const stats = [
  { value: '2.500+', label: 'Profissionais' },
  { value: '150k+', label: 'Agendamentos' },
  { value: '4.9', label: 'Avaliação' },
  { value: '98%', label: 'Satisfação' },
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="bg-[#000000] text-[#FFFFFF] font-sans overflow-x-hidden">

      {/* ─── NAV ─── */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-[#000000]/80 border-b border-[#222222]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="Raffros Corteflow" className="h-12 md:h-16 w-auto" />
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#servicos" className="text-sm text-[#A1A1AA] hover:text-white transition-colors">Serviços</a>
            <a href="#como-funciona" className="text-sm text-[#A1A1AA] hover:text-white transition-colors">Como funciona</a>
            <a href="#depoimentos" className="text-sm text-[#A1A1AA] hover:text-white transition-colors">Depoimentos</a>
            <a href="#planos" className="text-sm text-[#A1A1AA] hover:text-white transition-colors">Planos</a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="flex items-center gap-2 text-sm font-medium text-[#A1A1AA] hover:text-white transition-colors">
              <span className="hidden sm:inline">Entrar</span>
              <User className="w-5 h-5 sm:hidden" />
            </Link>
            <Link
              to="/cadastro"
              className="text-sm font-semibold px-5 py-2.5 rounded-lg transition-all hover:shadow-[0_0_20px_rgba(201,150,59,0.3)]"
              style={{ background: 'linear-gradient(135deg, #C9963B, #E8B960)', color: '#000000' }}
            >
              Começar Grátis
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section className="relative min-h-screen flex items-center pt-20">
        {/* Background image with overlay */}
        <div className="absolute inset-0">
          <img src="/hero.png" alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#000000] via-[#000000]/90 to-[#000000]/40" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#000000] via-transparent to-transparent" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 py-20 grid lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] px-4 py-2 rounded-full mb-8 border border-[#C9963B]/30 text-[#C9963B] bg-[#C9963B]/10">
              ✦ Plataforma #1 em agendamento
            </span>
            <h1 className="text-5xl md:text-7xl font-bold leading-[1.05] mb-6 tracking-tight">
              Transforme seu{' '}
              <span className="bg-gradient-to-r from-[#C9963B] to-[#E8B960] bg-clip-text text-transparent">
                salão
              </span>{' '}
              em uma máquina de agendamentos.
            </h1>
            <p className="text-lg text-[#A1A1AA] mb-10 max-w-lg leading-relaxed">
              Agenda online, pagamentos, gestão de equipe e página profissional. Seus clientes agendam 24/7 — você só atende.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => navigate('/cadastro')}
                className="flex items-center justify-center gap-2 text-base font-bold px-8 py-4 rounded-xl transition-all hover:shadow-[0_0_30px_rgba(201,150,59,0.4)] hover:-translate-y-0.5"
                style={{ background: 'linear-gradient(135deg, #C9963B, #E8B960)', color: '#000000' }}
              >
                Começar Grátis (7 Dias) <ArrowRight className="w-5 h-5" />
              </button>
              <button
                className="flex items-center justify-center gap-2 text-base font-medium px-8 py-4 rounded-xl border border-[#333333] text-[#A1A1AA] hover:border-[#C9963B]/50 hover:text-white transition-all"
              >
                Ver demonstração
              </button>
            </div>

            {/* Social proof */}
            <div className="flex items-center gap-6 mt-12 pt-8 border-t border-[#222222]">
              <div className="flex -space-x-3">
                {[0, 1, 2, 3].map(i => (
                  <div key={i} className="w-10 h-10 rounded-full border-2 border-[#000000] flex items-center justify-center text-xs font-bold" style={{ background: `hsl(${35 + i * 8}, 60%, ${45 + i * 5}%)`, color: '#000000' }}>
                    {['R', 'C', 'J', 'M'][i]}
                  </div>
                ))}
              </div>
              <div>
                <div className="flex gap-0.5 mb-1">
                  {[...Array(5)].map((_, i) => <Star key={i} className="w-3.5 h-3.5 fill-[#C9963B] text-[#C9963B]" />)}
                </div>
                <p className="text-xs text-[#A1A1AA]">+2.500 profissionais confiam na Raffros Corteflow</p>
              </div>
            </div>
          </motion.div>

          {/* Right side — floating review card */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="hidden lg:flex justify-end"
          >
            <div className="bg-[#111111]/80 backdrop-blur-md border border-[#333333] rounded-2xl p-6 max-w-sm shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-[#C9963B] flex items-center justify-center text-[#000000] font-bold">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Happy Clients</p>
                  <p className="text-3xl font-bold text-[#C9963B]">95<span className="text-lg">%</span></p>
                </div>
              </div>
              <div className="border-t border-[#333333] pt-4">
                <p className="text-xs font-bold text-[#A1A1AA] mb-2 uppercase tracking-widest">Avaliação</p>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#333] flex items-center justify-center text-xs font-bold text-white">JD</div>
                  <div>
                    <p className="text-sm font-bold text-white">João Doe</p>
                    <div className="flex gap-0.5">
                      {[...Array(5)].map((_, i) => <Star key={i} className="w-3 h-3 fill-[#C9963B] text-[#C9963B]" />)}
                    </div>
                  </div>
                </div>
                <p className="text-sm text-[#A1A1AA] mt-3 leading-relaxed">
                  "Barbeiros com cuidado e atenção ao detalhe. Os melhores profissionais da cidade."
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── STATS BAR ─── */}
      <section className="border-y border-[#222222] bg-[#0A0A0A]">
        <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s, i) => (
            <motion.div key={i} {...fadeUp(i * 0.05)} className="text-center">
              <p className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-[#C9963B] to-[#E8B960] bg-clip-text text-transparent">{s.value}</p>
              <p className="text-sm text-[#A1A1AA] mt-2 font-medium">{s.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── SERVICES ─── */}
      <section id="servicos" className="py-24 bg-[#000000]">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div {...fadeUp()} className="text-center mb-16">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C9963B] mb-4">Para todos os tipos de negócio</p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
              Nossos <span className="text-[#C9963B]">serviços</span>
            </h2>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-6">
            {services.map((svc, i) => (
              <motion.div key={i} {...fadeUp(i * 0.08)} className="group relative rounded-2xl overflow-hidden cursor-pointer">
                <div className="aspect-[4/5] relative">
                  <img src={svc.img} alt={svc.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#000000] via-[#000000]/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-6">
                    <h3 className="text-2xl font-bold text-white mb-1">{svc.title}</h3>
                    <p className="text-sm text-[#A1A1AA]">{svc.desc}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section id="como-funciona" className="py-24 bg-[#0A0A0A]">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div {...fadeUp()} className="text-center mb-20">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C9963B] mb-4">Simples e rápido</p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
              Como <span className="text-[#C9963B]">funciona</span>
            </h2>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-12">
            {[
              { num: '01', icon: Mail, title: 'Crie sua conta', desc: 'Cadastre-se em 30 segundos com seu nome, telefone e e-mail. 7 dias grátis, sem cartão.' },
              { num: '02', icon: Scissors, title: 'Configure seu salão', desc: 'Adicione serviços, equipe, horários e personalize sua página pública com logo e tema.' },
              { num: '03', icon: Calendar, title: 'Receba agendamentos', desc: 'Compartilhe o link e comece a receber agendamentos com pagamento online integrado.' },
            ].map((step, i) => (
              <motion.div key={i} {...fadeUp(i * 0.1)} className="relative group">
                <div className="text-8xl font-black text-[#222222] absolute -top-4 -left-2 group-hover:text-[#C9963B]/10 transition-colors">{step.num}</div>
                <div className="relative pt-12">
                  <div className="w-14 h-14 rounded-2xl bg-[#C9963B]/10 border border-[#C9963B]/20 flex items-center justify-center mb-6 group-hover:bg-[#C9963B]/20 transition-colors">
                    <step.icon className="w-6 h-6 text-[#C9963B]" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">{step.title}</h3>
                  <p className="text-sm text-[#A1A1AA] leading-relaxed">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FEATURES GRID ─── */}
      <section className="py-24 bg-[#000000]">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div {...fadeUp()} className="text-center mb-16">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C9963B] mb-4">Por que escolher a Raffros Corteflow</p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
              Tudo que você precisa,<br />
              <span className="text-[#C9963B]">nada que não precisa.</span>
            </h2>
          </motion.div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: Calendar, title: 'Agenda Online 24/7', desc: 'Clientes agendam a qualquer hora pelo celular.' },
              { icon: CreditCard, title: 'Pagamentos Stripe', desc: 'Receba online com sinal antecipado e reduza faltas.' },
              { icon: Users, title: 'Gestão de Equipe', desc: 'Comissões, horários e acessos individuais.' },
              { icon: Clock, title: 'Bloqueio de Horário', desc: 'Férias, feriados e intervalos sob controle.' },
              { icon: Globe, title: 'Página Profissional', desc: 'Link personalizado com tema, logo e banner.' },
              { icon: Phone, title: 'WhatsApp Integrado', desc: 'Confirmação automática direto no WhatsApp.' },
              { icon: Star, title: 'Fidelização', desc: 'Segmentação VIP, fiéis e novos clientes.' },
              { icon: Scissors, title: 'Multi-negócio', desc: 'Barbearia, salão ou esmalteria. Tudo funciona.' },
            ].map((feat, i) => (
              <motion.div key={i} {...fadeUp(i * 0.04)} className="bg-[#0A0A0A] border border-[#222222] rounded-2xl p-6 hover:border-[#C9963B]/30 transition-all group">
                <div className="w-12 h-12 rounded-xl bg-[#C9963B]/10 flex items-center justify-center mb-4 group-hover:bg-[#C9963B]/20 transition-colors">
                  <feat.icon className="w-5 h-5 text-[#C9963B]" />
                </div>
                <h3 className="font-bold text-white mb-2">{feat.title}</h3>
                <p className="text-sm text-[#A1A1AA] leading-relaxed">{feat.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── TESTIMONIALS ─── */}
      <section id="depoimentos" className="py-24 bg-[#0A0A0A]">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div {...fadeUp()} className="text-center mb-16">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C9963B] mb-4">O que dizem</p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
              Quem usa, <span className="text-[#C9963B]">recomenda.</span>
            </h2>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <motion.div key={i} {...fadeUp(i * 0.08)} className="bg-[#000000] border border-[#222222] rounded-2xl p-8 relative">
                <div className="text-6xl font-serif text-[#C9963B]/20 absolute top-4 left-6">"</div>
                <div className="relative">
                  <div className="flex gap-1 mb-5">
                    {[...Array(t.stars)].map((_, si) => <Star key={si} className="w-4 h-4 fill-[#C9963B] text-[#C9963B]" />)}
                  </div>
                  <p className="text-sm text-[#A1A1AA] leading-relaxed mb-6">"{t.text}"</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#C9963B] to-[#8A6520] flex items-center justify-center text-sm font-bold text-[#000000]">
                      {t.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-sm text-white">{t.name}</p>
                      <p className="text-xs text-[#666]">{t.role}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PRICING ─── */}
      <section id="planos" className="py-24 bg-[#000000]">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div {...fadeUp()} className="text-center mb-16">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C9963B] mb-4">Planos</p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
              Simples e <span className="text-[#C9963B]">transparente.</span>
            </h2>
            <p className="mt-4 text-[#A1A1AA]">7 dias de trial gratuito. Sem cartão de crédito.</p>
          </motion.div>
          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {/* Starter */}
            <motion.div {...fadeUp(0)} className="bg-[#0A0A0A] border border-[#222222] rounded-2xl p-8 hover:border-[#C9963B]/30 transition-all">
              <p className="font-bold text-sm text-[#A1A1AA] mb-2">Starter</p>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-5xl font-bold text-white">R$ 27</span>
                <span className="text-sm text-[#666]">/mês</span>
              </div>
              <p className="text-xs text-[#666] mb-8">Para profissionais autônomos</p>
              <ul className="space-y-3 mb-8">
                {['1 Profissional', 'Agenda ilimitada', 'Link de agendamento público', 'Suporte por e-mail'].map(f => (
                  <li key={f} className="flex items-center gap-3 text-sm text-[#A1A1AA]">
                    <CheckCircle className="w-4 h-4 flex-shrink-0 text-[#C9963B]" /> {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => navigate('/cadastro')}
                className="w-full py-3.5 rounded-xl font-bold text-sm border border-[#333333] text-white hover:border-[#C9963B]/50 transition-all"
              >
                Iniciar Trial
              </button>
            </motion.div>

            {/* Growth */}
            <motion.div {...fadeUp(0.08)} className="relative bg-gradient-to-b from-[#111111] to-[#0A0A0A] border border-[#C9963B]/30 rounded-2xl p-8 shadow-[0_0_40px_rgba(201,150,59,0.08)]">
              <div className="absolute top-5 right-5 text-xs font-bold px-3 py-1 rounded-full bg-gradient-to-r from-[#C9963B] to-[#E8B960] text-[#000000]">
                Mais popular
              </div>
              <p className="font-bold text-sm text-[#C9963B] mb-2">Growth</p>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-5xl font-bold text-white">R$ 77</span>
                <span className="text-sm text-[#666]">/mês</span>
              </div>
              <p className="text-xs text-[#666] mb-8">Para salões em expansão</p>
              <ul className="space-y-3 mb-8">
                {['Até 10 Profissionais', 'Agenda ilimitada', 'Pagamentos Online (Stripe)', 'Gestão de Estoque e Produtos', 'Suporte prioritário'].map(f => (
                  <li key={f} className="flex items-center gap-3 text-sm text-[#A1A1AA]">
                    <CheckCircle className="w-4 h-4 flex-shrink-0 text-[#C9963B]" /> {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => navigate('/cadastro')}
                className="w-full py-3.5 rounded-xl font-bold text-sm transition-all hover:shadow-[0_0_20px_rgba(201,150,59,0.3)]"
                style={{ background: 'linear-gradient(135deg, #C9963B, #E8B960)', color: '#000000' }}
              >
                Iniciar Trial
              </button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section className="py-28 bg-[#0A0A0A] relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(201,150,59,0.08)_0%,_transparent_70%)]" />
        <div className="max-w-3xl mx-auto px-6 text-center relative z-10">
          <motion.div {...fadeUp()}>
            <Scissors className="w-10 h-10 mx-auto mb-8 text-[#C9963B]" />
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
              Pronto para elevar o nível do seu <span className="text-[#C9963B]">salão?</span>
            </h2>
            <p className="text-[#A1A1AA] mb-10 max-w-lg mx-auto leading-relaxed">
              Junte-se a milhares de profissionais que já automatizaram seus agendamentos e multiplicaram seu faturamento.
            </p>
            <button
              onClick={() => navigate('/cadastro')}
              className="inline-flex items-center gap-2 text-base font-bold px-10 py-4 rounded-xl transition-all hover:shadow-[0_0_30px_rgba(201,150,59,0.4)] hover:-translate-y-0.5"
              style={{ background: 'linear-gradient(135deg, #C9963B, #E8B960)', color: '#000000' }}
            >
              Criar conta grátis <ArrowRight className="w-5 h-5" />
            </button>
          </motion.div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="bg-[#050505] border-t border-[#222222]">
        <div className="max-w-7xl mx-auto px-6 py-16 grid grid-cols-2 md:grid-cols-4 gap-10">
          <div>
            <div className="flex items-center mb-6">
              <img src="/logo.svg" alt="Raffros Corteflow" className="h-16 md:h-20 w-auto" />
            </div>
            <p className="text-xs text-[#666] leading-relaxed">O padrão ouro em gestão de barbearias, salões e esmalterias.</p>
          </div>
          {[
            { title: 'Produto', items: ['Funcionalidades', 'Preços', 'Integrações'] },
            { title: 'Recursos', items: ['Blog', 'Ajuda', 'Tutoriais'] },
            { title: 'Legal', items: ['Termos de Uso', 'Privacidade', 'Cookies'] },
          ].map(col => (
            <div key={col.title}>
              <h4 className="text-white font-bold text-sm mb-5">{col.title}</h4>
              <ul className="space-y-3">
                {col.items.map(item => (
                  <li key={item}><a href="#" className="text-xs text-[#666] hover:text-[#C9963B] transition-colors">{item}</a></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="max-w-7xl mx-auto px-6 pb-8 pt-4 border-t border-[#222222] text-center text-xs text-[#444]">
          © {new Date().getFullYear()} Raffros Corteflow. Todos os direitos reservados.
        </div>
      </footer>
    </div>
  );
}
