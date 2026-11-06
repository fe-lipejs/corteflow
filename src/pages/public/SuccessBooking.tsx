import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useTenantSlug } from '../../hooks/useTenantSlug';
import { getTenantPublicUrl, getTenantPortalUrl } from '../../lib/tenantUrl';
import { supabase } from '../../integrations/supabase/client';
import { motion } from 'framer-motion';
import { Check, Calendar, Clock, User, Scissors, MessageCircle, AlertCircle, ArrowRight } from 'lucide-react';
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
            const dateStr = scheduledDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
            const timeStr = scheduledDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

            setBooking({
              id: bookingData.id,
              order_number: bookingData.order_number,
              serviceName: (bookingData.services as any)?.name || 'Serviço',
              professionalName: (bookingData.professionals as any)?.name || 'Qualquer profissional disponível',
              date: dateStr,
              time: timeStr,
              customerName: (bookingData.customers as any)?.name || 'Cliente',
              customerPhone: (bookingData.customers as any)?.phone || '',
              amount_paid: bookingData.amount_paid,
              amount_total: bookingData.amount_total,
              payment_mode: bookingData.payment_mode
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
        booking.amount_total != null ? `*Valor:* R$ ${Number(booking.amount_total).toFixed(2).replace('.', ',')}` : '',
        settings?.address ? `*Local:* ${settings.address}` : '',
      ].filter(Boolean)
    : ['Olá! Concluí meu agendamento na plataforma.'];
  const text = lines.join('\n');
  const whatsappLink = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(text)}`;

  return (
    <div className="min-h-screen bg-[#090C0A] text-white font-sans flex flex-col items-center justify-center p-4 selection:bg-emerald-500 selection:text-black">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md flex flex-col items-center text-center"
      >
        {/* Circle Check Icon */}
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mb-5 shadow-xl"
          style={{ background: `${accentColor}20`, border: `2px solid ${accentColor}` }}
        >
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{ background: accentColor }}
          >
            <Check className="w-7 h-7 text-black stroke-[3]" />
          </div>
        </div>

        <div className="inline-block relative mb-3">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Quase lá!</h1>
          <svg
            viewBox="0 0 120 12"
            fill="none"
            className="w-24 sm:w-28 h-2.5 mx-auto mt-0.5"
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

        <p className="text-zinc-400 mb-6 text-xs sm:text-sm leading-relaxed">
          Seu agendamento está quase concluído.
          <br />
          Clique no botão abaixo para enviar pelo <strong className="font-extrabold text-white">WhatsApp</strong> e finalizar seu agendamento.
        </p>

        {/* Card Resumo */}
        <div className="w-full bg-[#13131A] border border-white/10 rounded-2xl p-5 space-y-3.5 mb-5 text-left shadow-2xl">
          {booking?.order_number && (
            <div className="flex justify-between items-center pb-3 border-b border-white/10">
              <span className="text-zinc-400 text-xs">Pedido</span>
              <span className="font-mono text-xs font-bold" style={{ color: accentColor }}>#{booking.order_number}</span>
            </div>
          )}

          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400 flex items-center gap-1.5">
              <Scissors className="w-3.5 h-3.5 text-zinc-500" /> Serviço
            </span>
            <span className="font-semibold text-white">{booking?.serviceName || 'Serviço'}</span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-zinc-500" /> Profissional
            </span>
            <span className="font-semibold text-white">{booking?.professionalName || 'Profissional'}</span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-zinc-500" /> Data
            </span>
            <span className="font-semibold text-white capitalize">{booking?.date || '—'}</span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-zinc-500" /> Horário
            </span>
            <span className="font-semibold text-white">{booking?.time || '—'}</span>
          </div>
        </div>

        <div
          className="w-full rounded-2xl border px-4 py-3.5 mb-3.5 flex items-center gap-3.5 text-left"
          style={{
            background: `${accentColor}14`,
            borderColor: `${accentColor}40`,
          }}
        >
          <div className="flex items-center gap-3 shrink-0 self-stretch">
            <AlertCircle className="w-6 h-6 shrink-0" style={{ color: accentColor }} />
            <div className="w-[1.5px] self-stretch rounded-full" style={{ background: `${accentColor}55` }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm font-extrabold leading-tight" style={{ color: accentColor }}>
              Ação obrigatória
            </p>
            <p className="text-xs leading-snug mt-0.5 text-zinc-300">
              Clique no botão abaixo para enviar sua reserva pelo <strong className="font-extrabold text-white">WhatsApp</strong> e concluir o agendamento.
            </p>
          </div>
        </div>

        {cleanNumber && (
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
            className="relative overflow-hidden w-full font-extrabold py-4 px-6 rounded-full mb-3 flex justify-center items-center gap-3.5 shadow-lg text-sm sm:text-base cursor-pointer"
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
        )}

        <button 
          onClick={() => navigate(getTenantPublicUrl(slug))}
          className="w-full bg-[#13131A] border border-white/10 text-zinc-200 hover:text-white hover:bg-white/5 font-bold py-3 rounded-xl transition-all text-xs cursor-pointer"
        >
          Voltar para a Página do Estabelecimento
        </button>

        <Link 
          to={`${getTenantPortalUrl(slug)}${booking?.order_number ? `?order=${booking.order_number}` : ''}`}
          className="mt-5 text-zinc-400 hover:text-white transition-colors text-xs font-medium underline underline-offset-4"
        >
          Acessar Meus Agendamentos
        </Link>
      </motion.div>
    </div>
  );
}
