import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useTenantSlug } from '../../hooks/useTenantSlug';
import { getTenantPublicUrl, getTenantPortalUrl } from '../../lib/tenantUrl';
import { supabase } from '../../integrations/supabase/client';
import { motion } from 'framer-motion';
import { Check, Calendar, Clock, User, Scissors, MessageCircle } from 'lucide-react';
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

          // Buscar agendamento real
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

          // Se não encontrou por order_number mas tem payment_intent ou session_id
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
            // Se o agendamento ainda estiver pendente e retornou do Stripe, confirma de forma segura via Edge Function
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
  const text = booking
    ? `📅 Novo Agendamento #${booking.order_number}\n👤 Cliente: ${booking.customerName}\n💈 Serviço: ${booking.serviceName}\n🧑‍💼 Profissional: ${booking.professionalName}\n🗓️ Data: ${booking.date} às ${booking.time}`
    : 'Olá! Concluí meu agendamento na plataforma.';
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
          className="w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-xl"
          style={{ background: `${accentColor}20`, border: `2px solid ${accentColor}` }}
        >
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{ background: accentColor }}
          >
            <Check className="w-7 h-7 text-black stroke-[3]" />
          </div>
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold mb-2 tracking-tight">Agendamento Confirmado!</h1>
        <p className="text-zinc-400 mb-8 text-xs sm:text-sm">
          {booking?.customerName ? `${booking.customerName}, seu horário está garantido.` : 'Seu horário foi agendado com sucesso.'}
        </p>

        {/* Card Resumo */}
        <div className="w-full bg-[#13131A] border border-white/10 rounded-2xl p-5 space-y-3.5 mb-6 text-left shadow-2xl">
          {booking?.order_number && (
            <div className="flex justify-between items-center pb-3 border-b border-white/10">
              <span className="text-zinc-400 text-xs">Pedido</span>
              <span className="font-mono text-xs font-bold text-emerald-400">#{booking.order_number}</span>
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

        <p className="text-zinc-400 text-xs mb-5">
          Avise o estabelecimento com 1 clique para agilizar seu atendimento:
        </p>

        {cleanNumber && (
          <a 
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold py-3.5 rounded-xl transition-all mb-3 flex justify-center items-center gap-2 shadow-lg shadow-emerald-500/20 text-xs cursor-pointer active:scale-95"
          >
            <MessageCircle className="w-4 h-4 fill-current" />
            Notificar Salão via WhatsApp
          </a>
        )}

        <button 
          onClick={() => navigate(getTenantPublicUrl(slug))}
          className="w-full bg-[#13131A] border border-white/10 text-zinc-200 hover:text-white hover:bg-white/5 font-bold py-3 rounded-xl transition-all text-xs cursor-pointer"
        >
          Voltar para a Página do Estabelecimento
        </button>

        <Link 
          to={`${getTenantPortalUrl(slug)}${booking?.order_number ? `?order=${booking.order_number}` : ''}`}
          className="mt-5 text-zinc-400 hover:text-emerald-400 transition-colors text-xs font-medium underline underline-offset-4"
        >
          Acessar Meus Agendamentos
        </Link>
      </motion.div>
    </div>
  );
}
