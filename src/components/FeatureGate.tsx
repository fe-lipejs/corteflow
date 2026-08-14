import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Check, ChevronRight, Crown, TrendingUp, DollarSign, Package, ArrowUpRight, ShieldCheck, BarChart3, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { usePlanFeatures } from '../hooks/usePlanFeatures';
import type { PlanFeatures } from '../hooks/usePlanFeatures';
import { useTheme } from '../contexts/ThemeContext';

interface FeatureGateProps {
  feature: keyof PlanFeatures;
  children: ReactNode;
  /** Custom upgrade message */
  message?: string;
  /** Show a compact inline lock instead of full screen */
  inline?: boolean;
}

/** Rich Teaser Mockups so the user sees realistic data and feels the urge to upgrade */
function TeaserBackdrop({ feature }: { feature: keyof PlanFeatures }) {
  const { theme } = useTheme();

  if (feature === 'financeiro') {
    return (
      <div className="space-y-5 p-2 sm:p-4 select-none opacity-50 filter blur-[1.5px] pointer-events-none">
        {/* KPI Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="p-4 rounded-2xl border" style={{ background: theme.cardBg, borderColor: theme.border }}>
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-bold uppercase tracking-wider" style={{ color: theme.textMuted }}>Faturamento (Mês)</span>
              <span className="text-emerald-500 font-bold flex items-center text-[11px]"><ArrowUpRight className="w-3.5 h-3.5" /> +24.8%</span>
            </div>
            <p className="text-2xl font-black" style={{ color: theme.textPrimary }}>R$ 18.450,00</p>
            <p className="text-[11px] mt-1" style={{ color: theme.textSecondary }}>Meta mensal: 82% atingida</p>
          </div>

          <div className="p-4 rounded-2xl border" style={{ background: theme.cardBg, borderColor: theme.border }}>
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-bold uppercase tracking-wider" style={{ color: theme.textMuted }}>Lucro Líquido</span>
              <span className="text-emerald-500 font-bold flex items-center text-[11px]"><ArrowUpRight className="w-3.5 h-3.5" /> +18.2%</span>
            </div>
            <p className="text-2xl font-black text-emerald-500">R$ 11.230,00</p>
            <p className="text-[11px] mt-1" style={{ color: theme.textSecondary }}>Margem de 60.8%</p>
          </div>

          <div className="p-4 rounded-2xl border" style={{ background: theme.cardBg, borderColor: theme.border }}>
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-bold uppercase tracking-wider" style={{ color: theme.textMuted }}>Ticket Médio</span>
              <span className="text-emerald-500 font-bold flex items-center text-[11px]"><ArrowUpRight className="w-3.5 h-3.5" /> +8.5%</span>
            </div>
            <p className="text-2xl font-black" style={{ color: theme.textPrimary }}>R$ 78,50</p>
            <p className="text-[11px] mt-1" style={{ color: theme.textSecondary }}>235 atendimentos</p>
          </div>

          <div className="p-4 rounded-2xl border" style={{ background: theme.cardBg, borderColor: theme.border }}>
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-bold uppercase tracking-wider" style={{ color: theme.textMuted }}>Previsão do Mês</span>
              <span className="text-amber-500 font-bold text-[11px]">Projetado</span>
            </div>
            <p className="text-2xl font-black" style={{ color: theme.accent }}>R$ 22.800,00</p>
            <p className="text-[11px] mt-1" style={{ color: theme.textSecondary }}>Com base nos agendamentos</p>
          </div>
        </div>

        {/* Realistic Chart & Table Mock */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 p-5 rounded-2xl border space-y-3" style={{ background: theme.cardBg, borderColor: theme.border }}>
            <div className="flex items-center justify-between">
              <h5 className="font-bold text-sm" style={{ color: theme.textPrimary }}>Evolução do Faturamento Semanal</h5>
              <span className="text-xs px-2.5 py-1 rounded-lg border font-semibold" style={{ borderColor: theme.border, color: theme.textMuted }}>Últimos 30 dias</span>
            </div>
            <div className="h-36 flex items-end justify-between gap-2 pt-6">
              {[45, 68, 52, 85, 92, 78, 95, 110, 88, 120, 105, 135].map((val, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                  <div
                    className="w-full rounded-t-lg transition-all"
                    style={{
                      height: `${(val / 140) * 100}%`,
                      background: idx >= 8 ? theme.accent : `${theme.accent}40`,
                    }}
                  />
                  <span className="text-[9px]" style={{ color: theme.textMuted }}>S{idx + 1}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-5 rounded-2xl border space-y-3" style={{ background: theme.cardBg, borderColor: theme.border }}>
            <h5 className="font-bold text-sm" style={{ color: theme.textPrimary }}>Últimos Recebimentos</h5>
            <div className="space-y-2.5">
              {[
                { name: 'Lucas Silveira', service: 'Corte Degradê & Barba', val: 'R$ 85,00', status: 'Recebido' },
                { name: 'Matheus Costa', service: 'Assinatura Mensal VIP', val: 'R$ 180,00', status: 'Recebido' },
                { name: 'Gabriel Rocha', service: 'Pomada Matte + Corte', val: 'R$ 95,00', status: 'Recebido' },
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
      <div className="space-y-4 p-2 sm:p-4 select-none opacity-50 filter blur-[1.5px] pointer-events-none">
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
            { name: 'Pomada Modeladora Efeito Matte 150g', cat: 'Pomadas • Fixação Alta', price: 'R$ 55,00', stock: '34 un', sales: '142 vendidas' },
            { name: 'Óleo Hidratante de Barba Premium 30ml', cat: 'Barba • Amadeirado', price: 'R$ 68,00', stock: '19 un', sales: '89 vendidas' },
            { name: 'Shampoo Fortalecedor Ice Mentol 250ml', cat: 'Cabelo • Refrescante', price: 'R$ 42,00', stock: '27 un', sales: '64 vendidas' },
            { name: 'Balm Condicionador para Barba 100g', cat: 'Barba • Hidratação', price: 'R$ 49,90', stock: '15 un', sales: '53 vendidas' },
          ].map((prod, idx) => (
            <div key={idx} className="p-4 rounded-2xl border flex items-center justify-between gap-3" style={{ background: theme.cardBg, borderColor: theme.border }}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center border font-bold text-lg shrink-0" style={{ background: theme.inputBg, borderColor: theme.border, color: theme.accent }}>
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
    <div className="grid grid-cols-3 gap-4 p-4 select-none opacity-45 filter blur-[1.5px] pointer-events-none">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-28 rounded-2xl border" style={{ background: theme.cardBg, borderColor: theme.border }} />
      ))}
    </div>
  );
}

function UpgradeScreen({ message, feature }: { message?: string; feature: keyof PlanFeatures }) {
  const { theme, fontStyle } = useTheme();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 14 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', damping: 26, stiffness: 300 }}
      className="relative w-full max-w-md mx-auto z-20"
    >
      {/* Glow Behind Card */}
      <div
        className="absolute -inset-1 rounded-3xl blur-2xl opacity-35 -z-10"
        style={{ background: theme.accent }}
      />

      {/* Floating Glassmorphic Upgrade Card */}
      <div
        className="relative rounded-3xl p-6 sm:p-7 border shadow-2xl backdrop-blur-2xl text-left overflow-hidden"
        style={{
          background: theme.id === 'elegant' ? 'rgba(255, 255, 255, 0.94)' : 'rgba(18, 18, 22, 0.92)',
          borderColor: `${theme.accent}40`,
          boxShadow: `0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px ${theme.accent}20 inset`,
        }}
      >
        {/* Top Floating Badge */}
        <div className="flex items-center justify-between mb-4">
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider border shadow-sm"
            style={{
              background: `${theme.accent}18`,
              borderColor: `${theme.accent}40`,
              color: theme.accent,
            }}
          >
            <Crown className="w-3.5 h-3.5" />
            <span>Recurso Growth</span>
          </div>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-md" style={{ background: `${theme.border}`, color: theme.textSecondary }}>
            Upgrade Imediato
          </span>
        </div>

        {/* Title */}
        <h3
          className="text-xl sm:text-2xl font-black mb-1.5 tracking-tight leading-tight"
          style={{
            color: theme.textPrimary,
            fontFamily: fontStyle === 'serif' ? "'Playfair Display', Georgia, serif" : 'inherit',
          }}
        >
          Desbloqueie todo o potencial
        </h3>

        <p className="text-xs sm:text-sm leading-relaxed mb-5 font-medium" style={{ color: theme.textSecondary }}>
          {message ?? 'Esta funcionalidade faz parte do plano Growth. Faça o upgrade agora para ter controle total.'}
        </p>

        {/* Value Bullets */}
        <div className="space-y-2.5 mb-6">
          {[
            'Catálogo completo de Produtos e Gestão de Estoque',
            'Fluxo Financeiro avançado, DRE e Relatórios',
            'Até 10 profissionais na equipe com comissões',
            'Taxas de processamento reduzidas e suporte VIP',
          ].map((benefit, i) => (
            <div
              key={i}
              className="flex items-center gap-2.5 p-2 rounded-xl border"
              style={{
                background: theme.id === 'elegant' ? '#F8FAFC' : 'rgba(255, 255, 255, 0.04)',
                borderColor: theme.border,
              }}
            >
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 shadow-sm"
                style={{ background: theme.accent, color: theme.btnPrimaryText }}
              >
                <Check className="w-3 h-3 stroke-[3]" />
              </div>
              <span className="text-xs font-semibold leading-tight" style={{ color: theme.textPrimary }}>
                {benefit}
              </span>
            </div>
          ))}
        </div>

        {/* CTA Button */}
        <Link
          to="/app/assinatura"
          className="group relative flex items-center justify-center gap-2 w-full py-3.5 px-5 font-extrabold text-xs uppercase tracking-wider rounded-xl overflow-hidden transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-xl text-center"
          style={{
            background: theme.btnPrimaryBg || theme.accent,
            color: theme.btnPrimaryText,
          }}
        >
          <Sparkles className="w-4 h-4" />
          <span>Fazer Upgrade para o Growth</span>
          <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </Link>

        <p className="text-[10px] text-center mt-3 font-semibold uppercase tracking-wider" style={{ color: theme.textMuted }}>
          Sem fidelidade • Cancele quando quiser
        </p>
      </div>
    </motion.div>
  );
}

function InlineLock({ message }: { message?: string }) {
  const { theme } = useTheme();
  return (
    <div className="flex items-center gap-2 text-sm p-3 rounded-xl border" style={{ background: theme.cardBg, borderColor: theme.cardBorder }}>
      <Crown className="w-4 h-4" style={{ color: theme.accent }} />
      <span style={{ color: theme.textSecondary }}>{message ?? 'Disponível no plano Growth.'}</span>
      <Link to="/app/assinatura" className="font-bold underline ml-auto text-xs" style={{ color: theme.accent }}>
        Fazer Upgrade
      </Link>
    </div>
  );
}

export default function FeatureGate({ feature, children, message, inline = false }: FeatureGateProps) {
  const { theme } = useTheme();
  const { features, isLoading } = usePlanFeatures();

  if (isLoading) return <>{children}</>;

  const hasAccess = features[feature];

  if (!hasAccess) {
    const isTrialExpired = features.subscription_status === 'trial_expired';
    const noSub = !features.has_subscription;

    let defaultMessage = 'Este recurso faz parte do plano Growth. Faça upgrade para desbloquear.';
    if (isTrialExpired || noSub) {
      defaultMessage = 'Seu período de teste terminou. Escolha um plano para continuar aproveitando todos os recursos.';
    }

    const displayMessage = message ?? defaultMessage;

    if (inline) {
      return <InlineLock message={displayMessage} />;
    }

    return (
      <div className="relative w-full min-h-[500px] rounded-3xl overflow-hidden border" style={{ borderColor: theme.border }}>
        {/* Realistic Teaser Backdrop so the client sees exactly what they will unlock */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          <TeaserBackdrop feature={feature} />
        </div>

        {/* Frosted Glass Gradient Brush Overlay & Centered Modal */}
        <div
          className="relative z-10 min-h-[500px] flex items-center justify-center p-4 sm:p-6"
          style={{
            background: theme.id === 'elegant'
              ? 'radial-gradient(ellipse at center, rgba(255, 255, 255, 0.72) 0%, rgba(241, 245, 249, 0.9) 100%)'
              : 'radial-gradient(ellipse at center, rgba(0, 0, 0, 0.65) 0%, rgba(10, 10, 12, 0.92) 100%)',
            backdropFilter: 'blur(3px)',
            WebkitBackdropFilter: 'blur(3px)',
          }}
        >
          <UpgradeScreen message={displayMessage} feature={feature} />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

