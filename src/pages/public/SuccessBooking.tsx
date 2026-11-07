import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useTenantSlug } from '../../hooks/useTenantSlug';
import { getTenantPublicUrl, getTenantPortalUrl } from '../../lib/tenantUrl';
import { supabase } from '../../integrations/supabase/client';
import { motion } from 'framer-motion';
import { CheckCircle2, MessageCircle, ArrowRight, AlertCircle } from 'lucide-react';
import { useTenantPortalTheme } from '../../hooks/useTenantPortalTheme';
import { PortalLoadingScreen } from '../../components/public/PortalLoadingScreen';

export default function SuccessBooking() {
  const slugFromHook = useTenantSlug();
  const { slug: paramSlug } = useParams<{ slug?: string }>();
  const slug = slugFromHook ?? paramSlug ?? '';
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const orderNumber = searchParams.get('order') || searchParams.get('order_number');
  const sessionId = searchParams.get('session_id');
  const paymentIntentId = searchParams.get('payment_intent');

  const [booking, setBooking] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        if (!slug) return;

        const { data: tData } = await supabase
          .from('tenants')
          .select('*')
          .eq('slug', slug)
          .maybeSingle();

        if (tData) {
          const tenantRaw = tData as any;
          const { data: sData } = await supabase
            .from('tenant_settings')
            .select('*')
            .eq('tenant_id', tenantRaw.id)
            .maybeSingle();
          setSettings(sData);

          let bookingData: any = null;

          if (orderNumber) {
            const { data: bData } = await supabase
              .from('bookings')
              .select('*, services(name, price), professionals(name), customers(name, phone, email)')
              .eq('tenant_id', tenantRaw.id)
              .eq('order_number', orderNumber)
              .maybeSingle();
            bookingData = bData;
          }

          if (!bookingData && (paymentIntentId || sessionId)) {
            const targetPi = paymentIntentId || sessionId;
            const { data: pData } = await supabase
              .from('payments')
              .select('booking_id')
              .eq('stripe_payment_intent_id', targetPi)
              .maybeSingle();

            if (pData?.booking_id) {
              const { data: bData } = await supabase
                .from('bookings')
                .select('*, services(name, price), professionals(name), customers(name, phone, email)')
                .eq('id', pData.booking_id)
                .maybeSingle();
              bookingData = bData;
            }
          }

          if (bookingData) {
            if (bookingData.status === 'pending' && (paymentIntentId || sessionId)) {
              try {
                await supabase.functions.invoke('create-payment-intent', {
                  body: {
                    action: 'confirm_booking',
                    bookingId: bookingData.id,
                    paymentIntentId: paymentIntentId || undefined,
                    sessionId: sessionId || undefined,
                  },
                });
              } catch (confirmErr) {
                console.warn('Erro ao confirmar booking via Edge Function:', confirmErr);
              }
            }

            const scheduledDate = new Date(bookingData.scheduled_at);
            const dateStr = scheduledDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
            const fullDateStr = scheduledDate.toLocaleDateString('pt-BR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            });
            const timeStr = scheduledDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

            setBooking({
              id: bookingData.id,
              order_number: bookingData.order_number,
              serviceName: (bookingData.services as any)?.name || 'Serviço',
              professionalName: (bookingData.professionals as any)?.name || 'Qualquer profissional',
              date: fullDateStr,
              shortDate: dateStr,
              time: timeStr,
              customerName: (bookingData.customers as any)?.name || 'Cliente',
              customerPhone: (bookingData.customers as any)?.phone || '',
              amount_paid: bookingData.amount_paid,
              amount_total: bookingData.amount_total,
              payment_mode: bookingData.payment_mode,
            });
          }
        }
      } catch (e) {
        console.error('Erro ao carregar dados do agendamento:', e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [slug, orderNumber, sessionId, paymentIntentId]);

  const portalTheme = useTenantPortalTheme(slug, settings, null);
  const accentColor = portalTheme.accent;
  const btnBg = portalTheme.theme.btnPrimaryBg || accentColor;
  const btnText = portalTheme.theme.btnPrimaryText;
  const pageBg = portalTheme.bg || '#090C0A';
  const cardBg = portalTheme.cardBg || '#13131A';
  const cardBorder = portalTheme.cardBorder || 'rgba(255,255,255,0.1)';
  const textPrimary = portalTheme.textPrimary || '#FFFFFF';
  const textSecondary = portalTheme.theme.textSecondary || portalTheme.textMuted || '#A1A1AA';
  const textMuted = portalTheme.textMuted || '#71717A';

  if (loading) {
    return (
      <PortalLoadingScreen
        portalTheme={portalTheme}
        message="Localizando confirmação de agendamento…"
        badgeText="Agendamento Confirmado"
      />
    );
  }

  // wa.me logic
  const whatsappNumber = settings?.whatsapp_number || settings?.phone || '';
  const cleanNumber = whatsappNumber.replace(/\D/g, '');
  const lines = booking
    ? [
      `*NOVA RESERVA — ${settings?.fantasy_name || 'Salão'}*`,
      `*Código:* #${booking.order_number}`,
      `*Cliente:* ${booking.customerName}`,
      `*Serviço:* ${booking.serviceName}`,
      `*Profissional:* ${booking.professionalName}`,
      `*Data/Hora:* ${booking.date} às ${booking.time}`,
      booking.amount_total != null
        ? `*Valor:* R$ ${Number(booking.amount_total).toFixed(2).replace('.', ',')}`
        : '',
      settings?.address ? `*Local:* ${settings.address}` : '',
    ].filter(Boolean)
    : ['Olá! Concluí meu agendamento na plataforma.'];
  const text = lines.join('\n');
  const whatsappLink = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(text)}`;

  const formattedTotal =
    booking?.amount_total != null
      ? `R$ ${Number(booking.amount_total).toFixed(2).replace('.', ',')}`
      : '';

  return (
    <div
      className="min-h-[100dvh] font-sans flex flex-col items-center justify-center px-5 py-6"
      style={{ background: pageBg, color: textPrimary }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-md flex flex-col items-center justify-center text-center"
      >
        {/* Compact Check Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', damping: 14, stiffness: 220, delay: 0.05 }}
          className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3.5 shadow-lg"
          style={{
            background: `${accentColor}18`,
            border: `1.5px solid ${accentColor}60`,
            color: accentColor,
          }}
        >
          <CheckCircle2 className="w-7 h-7" />
        </motion.div>

        {/* Title */}
        <div className="inline-block relative mb-3">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight" style={{ color: textPrimary }}>
            Quase lá!
          </h1>
          <svg
            viewBox="0 0 120 12"
            fill="none"
            className="w-20 sm:w-24 h-2 mx-auto mt-0.5"
            aria-hidden="true"
          >
            <path
              d="M4 8.5C34 2.5 86 2.5 116 7.5"
              stroke={accentColor}
              strokeWidth="4"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <p
          className="text-xs sm:text-sm font-medium leading-relaxed max-w-sm mx-auto mb-4"
          style={{ color: textSecondary }}
        >
          Seu agendamento está quase concluído.
          <br />
          Clique no botão abaixo para enviar pelo{' '}
          <strong className="font-extrabold" style={{ color: textPrimary }}>
            WhatsApp
          </strong>{' '}
          e finalizar seu agendamento.
        </p>

        {/* Clean Minimalist Summary Card */}
        {booking && (
          <div
            className="w-full rounded-2xl border px-4 py-3.5 mb-3.5 text-left shadow-sm"
            style={{
              background: cardBg,
              borderColor: cardBorder,
            }}
          >
            <div
              className="flex items-center justify-between gap-2 pb-2.5 border-b"
              style={{ borderColor: cardBorder }}
            >
              <span className="font-bold text-sm truncate" style={{ color: textPrimary }}>
                {booking.serviceName}
              </span>
              {booking.order_number && (
                <span
                  className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md shrink-0"
                  style={{ background: `${accentColor}15`, color: accentColor }}
                >
                  #{booking.order_number}
                </span>
              )}
            </div>

            <div className="pt-2.5 flex items-center justify-between gap-2 text-xs">
              <span className="font-medium truncate" style={{ color: textSecondary }}>
                {booking.shortDate} às <strong style={{ color: textPrimary }}>{booking.time}</strong>
                {booking.professionalName ? ` • ${booking.professionalName}` : ''}
              </span>
              {formattedTotal && (
                <span className="font-bold shrink-0" style={{ color: textPrimary }}>
                  {formattedTotal}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Mensagem Clean de Obrigatoriedade */}
        <div
          className="w-full flex items-center justify-center gap-2 py-2 px-3.5 rounded-xl mt-1 mb-4 border text-xs font-semibold text-center leading-snug"
          style={{
            background: `${accentColor}0d`,
            borderColor: `${accentColor}25`,
            color: accentColor,
          }}
        >
          <AlertCircle className="w-3.5 h-3.5 shrink-0" style={{ color: accentColor }} />
          <span>
            <strong className="font-extrabold" style={{ color: accentColor }}>
              Obrigatório:
            </strong>{' '}
            <span style={{ opacity: 0.95 }}>
              sem o envio no WhatsApp, seu agendamento é inválido.
            </span>
          </span>
        </div>

        {/* Hero Animated WhatsApp Button */}
        {cleanNumber && (
          <>
            <motion.a
              animate={{
                scale: [1, 1.028, 1],
                boxShadow: [
                  `0 8px 22px -4px ${accentColor}50, 0 0 0 0px ${accentColor}40`,
                  `0 14px 30px -4px ${accentColor}75, 0 0 0 7px ${accentColor}00`,
                  `0 8px 22px -4px ${accentColor}50, 0 0 0 0px ${accentColor}00`,
                ],
              }}
              transition={{
                duration: 2.2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="relative overflow-hidden w-full font-extrabold py-4 px-6 rounded-full flex justify-center items-center gap-3.5 shadow-lg text-sm sm:text-base cursor-pointer"
              style={{
                background: btnBg,
                color: btnText,
              }}
            >
              <motion.span
                aria-hidden="true"
                animate={{ x: ['-140%', '240%'] }}
                transition={{
                  duration: 2.6,
                  repeat: Infinity,
                  repeatDelay: 1.1,
                  ease: 'easeInOut',
                }}
                className="pointer-events-none absolute inset-y-0 w-1/3 -skew-x-12"
                style={{
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.28), transparent)',
                }}
              />
              <MessageCircle className="w-5 h-5" />
              <span className="h-5 w-[1.5px] rounded-full opacity-35" style={{ background: btnText }} />
              <span>Concluir Agendamento</span>
              <motion.span
                animate={{ x: [0, 4, 0] }}
                transition={{
                  duration: 1.4,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
                className="inline-flex items-center"
              >
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </motion.span>
            </motion.a>

            <p className="text-[11px] mt-2.5 font-medium" style={{ color: textMuted }}>
              Ao abrir o WhatsApp, toque em <strong style={{ color: textSecondary }}>Enviar</strong>.
            </p>
          </>
        )}

        {/* Discreet Secondary Links */}
        <div className="mt-6 flex items-center justify-center gap-4 text-xs font-medium">
          <Link
            to={`${getTenantPortalUrl(slug)}${booking?.order_number ? `?order=${booking.order_number}` : ''}`}
            className="hover:underline transition-opacity opacity-80 hover:opacity-100"
            style={{ color: textSecondary }}
          >
            Meus agendamentos
          </Link>
          <span className="opacity-30" style={{ color: textMuted }}>
            •
          </span>
          <button
            type="button"
            onClick={() => navigate(getTenantPublicUrl(slug))}
            className="hover:underline transition-opacity opacity-80 hover:opacity-100 cursor-pointer"
            style={{ color: textSecondary }}
          >
            Voltar ao início
          </button>
        </div>
      </motion.div>
    </div>
  );
}
