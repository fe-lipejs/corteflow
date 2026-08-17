import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Check, ChevronRight, Lock, Package, ArrowUpRight, TrendingUp, DollarSign } from 'lucide-react';
import { motion } from 'framer-motion';
import { usePermissionEngine } from '../hooks/usePermissionEngine';
import { useTheme } from '../contexts/ThemeContext';

interface FeatureGateProps {
  feature?: string;
  permission?: string;
  children: ReactNode;
  /** Custom upgrade message */
  message?: string;
  /** Show a compact inline lock instead of full screen */
  inline?: boolean;
}

/** Rich, Privacy-Protected Teaser Mockup so the user sees the structure and charts, but the data is enticely blurred/censored */
function TeaserBackdrop({ feature }: { feature: string }) {
  const { theme } = useTheme();

  if (feature === 'financeiro') {
    return (
      <div className="space-y-4 p-4 sm:p-6 select-none pointer-events-none filter blur-[3.5px] opacity-70">
        {/* KPI Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="p-4 rounded-2xl border shadow-sm" style={{ background: theme.cardBg, borderColor: theme.border }}>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-extrabold uppercase tracking-wider text-[10px]" style={{ color: theme.textMuted }}>Faturamento (Mês)</span>
              <span className="text-emerald-500 font-bold flex items-center text-[11px]"><ArrowUpRight className="w-3.5 h-3.5" /> +24%</span>
            </div>
            <p className="text-2xl font-black" style={{ color: theme.textPrimary }}>R$ 18.450,00</p>
            <p className="text-[11px] mt-1 font-medium" style={{ color: theme.textSecondary }}>235 agendamentos realizados</p>
          </div>

          <div className="p-4 rounded-2xl border shadow-sm" style={{ background: theme.cardBg, borderColor: theme.border }}>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-extrabold uppercase tracking-wider text-[10px]" style={{ color: theme.textMuted }}>Lucro Líquido</span>
              <span className="text-emerald-500 font-bold flex items-center text-[11px]"><ArrowUpRight className="w-3.5 h-3.5" /> +18%</span>
            </div>
            <p className="text-2xl font-black text-emerald-500">R$ 11.230,00</p>
            <p className="text-[11px] mt-1 font-medium" style={{ color: theme.textSecondary }}>Após custos e despesas</p>
          </div>

          <div className="p-4 rounded-2xl border shadow-sm" style={{ background: theme.cardBg, borderColor: theme.border }}>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-extrabold uppercase tracking-wider text-[10px]" style={{ color: theme.textMuted }}>Ticket Médio</span>
              <span className="text-emerald-500 font-bold flex items-center text-[11px]"><ArrowUpRight className="w-3.5 h-3.5" /> +9%</span>
            </div>
            <p className="text-2xl font-black" style={{ color: theme.textPrimary }}>R$ 78,50</p>
            <p className="text-[11px] mt-1 font-medium" style={{ color: theme.textSecondary }}>Média por cliente atendido</p>
          </div>

          <div className="p-4 rounded-2xl border shadow-sm" style={{ background: theme.cardBg, borderColor: theme.border }}>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-extrabold uppercase tracking-wider text-[10px]" style={{ color: theme.textMuted }}>Previsão Próx. 30d</span>
              <span className="text-amber-500 font-bold text-[11px]">Projetado</span>
            </div>
            <p className="text-2xl font-black" style={{ color: theme.accent }}>R$ 22.800,00</p>
            <p className="text-[11px] mt-1 font-medium" style={{ color: theme.textSecondary }}>Baseado na taxa de ocupação</p>
          </div>
        </div>

        {/* Realistic Chart & Transactions Mock */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 p-5 rounded-2xl border space-y-3 shadow-sm" style={{ background: theme.cardBg, borderColor: theme.border }}>
            <div className="flex items-center justify-between">
              <h5 className="font-bold text-sm" style={{ color: theme.textPrimary }}>Fluxo de Faturamento Semanal</h5>
              <span className="text-xs px-2.5 py-1 rounded-lg border font-semibold" style={{ borderColor: theme.border, color: theme.textMuted }}>Últimos 30 dias</span>
            </div>
            <div className="h-36 flex items-end justify-between gap-2.5 pt-4">
              {[45, 68, 52, 85, 92, 78, 95, 110, 88, 120, 105, 135].map((val, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                  <div
                    className="w-full rounded-t-lg transition-all"
                    style={{
                      height: `${(val / 140) * 100}%`,
                      background: idx >= 8 ? theme.accent : `${theme.accent}45`,
                    }}
                  />
                  <span className="text-[9px] font-mono" style={{ color: theme.textMuted }}>S{idx + 1}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-5 rounded-2xl border space-y-3 shadow-sm" style={{ background: theme.cardBg, borderColor: theme.border }}>
            <h5 className="font-bold text-sm" style={{ color: theme.textPrimary }}>Últimos Recebimentos</h5>
            <div className="space-y-2">
              {[
                { name: 'Lucas Silveira', service: 'Corte Degradê & Barba', val: 'R$ 85,00', status: 'Recebido' },
                { name: 'Matheus Costa', service: 'Assinatura Mensal VIP', val: 'R$ 180,00', status: 'Recebido' },
                { name: 'Gabriel Rocha', service: 'Pomada Matte + Barba', val: 'R$ 95,00', status: 'Recebido' },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl border text-xs" style={{ background: theme.inputBg, borderColor: theme.border }}>
                  <div>
                    <p className="font-bold" style={{ color: theme.textPrimary }}>{item.name}</p>
                    <p className="text-[10px]" style={{ color: theme.textMuted }}>{item.service}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold" style={{ color: theme.accent }}>{item.val}</p>
                    <span className="text-[9px] text-emerald-500 font-bold">{item.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (feature === 'produtos') {
    return (
      <div className="space-y-4 p-4 sm:p-6 select-none pointer-events-none filter blur-[3.5px] opacity-70">
        {/* Search & Categories */}
        <div className="flex gap-2">
          <div className="flex-1 p-3 rounded-xl border text-xs font-medium" style={{ background: theme.inputBg, borderColor: theme.border, color: theme.textMuted }}>
            Buscar produto, categoria ou marca...
          </div>
          <div className="flex gap-1.5">
            {['Todos', 'Pomadas', 'Óleos & Barba', 'Shampoos'].map((cat, idx) => (
              <span key={idx} className="px-3 py-2 rounded-xl text-xs font-bold border" style={{ background: idx === 0 ? theme.accent : theme.cardBg, color: idx === 0 ? theme.btnPrimaryText : theme.textSecondary, borderColor: theme.border }}>
                {cat}
              </span>
            ))}
          </div>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {[
            { name: 'Pomada Modeladora Efeito Matte 150g', cat: 'Pomadas • Fixação Forte', price: 'R$ 55,00', stock: '34 un', sales: '142 vendidas' },
            { name: 'Óleo Hidratante de Barba Amadeirado 30ml', cat: 'Barba • Hidratação', price: 'R$ 68,00', stock: '19 un', sales: '89 vendidas' },
            { name: 'Shampoo Fortalecedor Ice Mentol 250ml', cat: 'Cabelo • Refrescante', price: 'R$ 42,00', stock: '27 un', sales: '64 vendidas' },
            { name: 'Balm Multifuncional para Barba 100g', cat: 'Barba • Maciez', price: 'R$ 49,90', stock: '15 un', sales: '53 vendidas' },
          ].map((prod, idx) => (
            <div key={idx} className="p-4 rounded-2xl border flex items-center justify-between gap-3 shadow-sm" style={{ background: theme.cardBg, borderColor: theme.border }}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center border font-bold text-lg shrink-0 shadow-inner" style={{ background: theme.inputBg, borderColor: theme.border, color: theme.accent }}>
                  <Package className="w-6 h-6" />
                </div>
                <div>
                  <h6 className="font-bold text-xs leading-tight" style={{ color: theme.textPrimary }}>{prod.name}</h6>
                  <p className="text-[10px] mt-0.5" style={{ color: theme.textMuted }}>{prod.cat}</p>
                  <p className="text-[10px] font-bold mt-1" style={{ color: theme.textSecondary }}>Estoque: <span className="text-emerald-500">{prod.stock}</span> • {prod.sales}</p>
                </div>
              </div>
              <p className="text-sm font-black shrink-0" style={{ color: theme.accent }}>{prod.price}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-4 p-4 select-none pointer-events-none filter blur-[3.5px] opacity-70">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-28 rounded-2xl border" style={{ background: theme.cardBg, borderColor: theme.border }} />
      ))}
    </div>
  );
}

function UpgradeScreen() {
  const { theme, fontStyle } = useTheme();

  // Generic fallback if no specific commercial info is provided.
  const featureDetails = {
    badge: 'Recurso Premium',
    title: 'Desbloqueie o potencial máximo do seu negócio',
    desc: 'Este recurso não está disponível no seu plano atual. Faça um upgrade para ter acesso a mais funcionalidades.',
    roiPill: '💡 Transforme a operação do seu salão com novos recursos.',
    benefits: [
      { title: 'Gestão Inteligente', desc: 'Funcionalidades desenhadas para escalar seu faturamento.' },
      { title: 'Controle Total', desc: 'Tenha domínio sobre todos os aspectos do seu negócio.' },
      { title: 'Experiência Premium', desc: 'Ofereça o melhor para seus clientes e sua equipe.' },
    ],
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className="relative w-full max-w-lg mx-auto z-20"
    >
      {/* Subtle Glow Aura (Modo escuro discreto) */}
      {theme.id !== 'elegant' && (
        <div
          className="absolute -inset-2 rounded-3xl blur-2xl opacity-20 -z-10"
          style={{ background: theme.accent }}
        />
      )}

      {/* High-Converting Sales Card */}
      <div
        className="relative rounded-3xl p-6 sm:p-8 border text-left overflow-hidden shadow-2xl"
        style={{
          background: theme.id === 'elegant'
            ? '#FFFFFF'
            : 'rgba(18, 18, 24, 0.96)',
          borderColor: theme.id === 'elegant'
            ? '#E2E8F0'
            : 'rgba(255, 255, 255, 0.12)',
          boxShadow: theme.id === 'elegant'
            ? '0 30px 60px -15px rgba(15, 23, 42, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.04)'
            : '0 30px 60px -15px rgba(0, 0, 0, 0.65), inset 0 1px 1px 0 rgba(255, 255, 255, 0.15)',
        }}
      >
        {/* Top Floating Badge & Plan Tag */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider border shadow-sm"
            style={{
              background: `${theme.accent}15`,
              borderColor: `${theme.accent}35`,
              color: theme.accent,
            }}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>{featureDetails.badge}</span>
          </div>

          <span
            className="text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full border shadow-sm"
            style={{
              background: theme.id === 'elegant' ? '#F8FAFC' : 'rgba(255, 255, 255, 0.06)',
              borderColor: theme.border,
              color: theme.textSecondary,
            }}
          >
            Plano Superior
          </span>
        </div>

        {/* Commercial Headline */}
        <h3
          className="text-xl sm:text-2xl font-black mb-2 tracking-tight leading-snug"
          style={{
            color: theme.textPrimary,
            fontFamily: fontStyle === 'serif' ? "'Playfair Display', Georgia, serif" : 'inherit',
          }}
        >
          {featureDetails.title}
        </h3>

        <p className="text-xs sm:text-sm leading-relaxed mb-4 font-medium" style={{ color: theme.textSecondary }}>
          {featureDetails.desc}
        </p>

        {/* ROI / Value Tip Box */}
        <div
          className="p-3 rounded-2xl border text-xs font-semibold mb-5 flex items-center gap-2"
          style={{
            background: `${theme.accent}0C`,
            borderColor: `${theme.accent}25`,
            color: theme.textPrimary,
          }}
        >
          <span>{featureDetails.roiPill}</span>
        </div>

        {/* Feature Benefits List */}
        <div className="space-y-2.5 mb-6">
          {featureDetails.benefits.map((benefit, i) => (
            <div
              key={i}
              className="flex items-start gap-3 p-2.5 rounded-2xl border transition-all"
              style={{
                background: theme.id === 'elegant' ? '#F8FAFC' : 'rgba(255, 255, 255, 0.03)',
                borderColor: theme.border,
              }}
            >
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 shadow-sm"
                style={{ background: theme.accent, color: theme.btnPrimaryText }}
              >
                <Check className="w-3 h-3 stroke-[3]" />
              </div>
              <div>
                <h6 className="text-xs font-bold leading-tight" style={{ color: theme.textPrimary }}>
                  {benefit.title}
                </h6>
                <p className="text-[11px] mt-0.5 leading-snug" style={{ color: theme.textMuted }}>
                  {benefit.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Pricing Anchor & Magnetic CTA */}
        <div className="pt-2 border-t" style={{ borderColor: theme.border }}>
          <div className="flex items-baseline justify-between mb-3 px-1">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: theme.textMuted }}>
                Desbloqueie mais recursos
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-sm font-bold" style={{ color: theme.textPrimary }}>
                  Consulte opções e preços
                </span>
              </div>
            </div>
          </div>

          {/* Magnetic High-Impact CTA Button */}
          <motion.div
            animate={{ scale: [1, 1.018, 1] }}
            transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
          >
            <Link
              to="/app/assinatura"
              className="group relative flex items-center justify-center gap-2 w-full py-4 px-6 font-black text-xs uppercase tracking-wider rounded-2xl overflow-hidden shadow-2xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer text-center"
              style={{
                background: theme.btnPrimaryBg || theme.accent,
                color: theme.btnPrimaryText,
              }}
            >
              {/* Light Sweep Beam */}
              <motion.div
                className="absolute top-0 bottom-0 w-28 -skew-x-12 bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none"
                animate={{ left: ['-100%', '200%'] }}
                transition={{ repeat: Infinity, duration: 2.6, ease: 'easeInOut', repeatDelay: 0.8 }}
              />

              <motion.div
                animate={{ rotate: [0, -14, 14, 0] }}
                transition={{ repeat: Infinity, duration: 2.2, repeatDelay: 0.8 }}
              >
                <Sparkles className="w-4 h-4" />
              </motion.div>
              <span>Ver opções de upgrade</span>
              <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </motion.div>

          <p className="text-[11px] text-center mt-3 font-bold" style={{ color: theme.textMuted }}>
            🔒 Sem cobrança hoje • Cancele quando quiser com 1 clique
          </p>
        </div>
      </div>
    </motion.div>
  );
}

function InlineLock({ message }: { message?: string }) {
  const { theme } = useTheme();
  return (
    <div className="flex items-center gap-2 text-sm p-3 rounded-xl border shadow-sm backdrop-blur-md" style={{ background: theme.cardBg, borderColor: theme.cardBorder }}>
      <Lock className="w-4 h-4" style={{ color: theme.accent }} />
      <span style={{ color: theme.textSecondary }}>{message ?? 'Disponível em um plano superior.'}</span>
      <Link to="/app/assinatura" className="font-bold underline ml-auto text-xs" style={{ color: theme.accent }}>
        Fazer Upgrade
      </Link>
    </div>
  );
}

export default function FeatureGate({ feature, permission, children, message, inline = false }: FeatureGateProps) {
  const { theme } = useTheme();
  const engine = usePermissionEngine();

  if (engine.isLoading) return <>{children}</>;

  const hasAccess = permission ? engine.hasPermission(permission) : (feature ? engine.hasFeature(feature) : false);

  if (!hasAccess) {
    const subStatus = engine.subscription?.status;
    const isTrialExpired = subStatus === 'trial' && engine.subscription?.trial_ends_at && new Date(engine.subscription.trial_ends_at) < new Date();
    const noSub = !engine.subscription && !engine.defaultPlan;

    let defaultMessage = 'Este recurso faz parte de um plano superior. Faça upgrade para desbloquear.';
    if (isTrialExpired || noSub) {
      defaultMessage = 'Seu período de teste terminou. Escolha um plano para continuar aproveitando todos os recursos.';
    }

    const displayMessage = message ?? defaultMessage;

    if (inline) {
      return <InlineLock message={displayMessage} />;
    }

    return (
      <div className="relative w-full min-h-[580px] rounded-3xl overflow-hidden border shadow-inner" style={{ borderColor: theme.border }}>
        {/* Privacy-Protected Teaser Backdrop */}
        {feature && (
          <div className="absolute inset-0 z-0 overflow-hidden">
            <TeaserBackdrop feature={feature} />
          </div>
        )}

        {/* Clean Glass Pane with Centered High-Converting Sales Card */}
        <div
          className="relative z-10 min-h-[580px] flex items-center justify-center p-4 sm:p-6"
          style={{
            background: theme.id === 'elegant'
              ? 'rgba(15, 23, 42, 0.05)'
              : 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(2px)',
            WebkitBackdropFilter: 'blur(2px)',
          }}
        >
          <UpgradeScreen />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

