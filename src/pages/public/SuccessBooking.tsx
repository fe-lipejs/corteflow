import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useTenantSlug } from '../../hooks/useTenantSlug';
import { getTenantPublicUrl, getTenantPortalUrl } from '../../lib/tenantUrl';
import { supabase } from '../../integrations/supabase/client';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

export default function SuccessBooking() {
  const slugFromHook = useTenantSlug();
  const { slug: paramSlug } = useParams<{ slug?: string }>();
  const slug = slugFromHook ?? paramSlug ?? '';
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const session_id = searchParams.get('session_id');

  const [booking, setBooking] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        if (!slug) return;
        
        const { data: tData } = await supabase.from('tenants').select('*').eq('slug', slug).single();
        if (tData) {
          const tenantRaw = tData as any;
          const { data: sData } = await supabase.from('tenant_settings').select('*').eq('tenant_id', tenantRaw.id).single();
          setSettings(sData);
        }

        // Simulate booking details for preview (since actual webhooks are pending)
        setBooking({
          serviceName: 'Listras (adicional)',
          professionalName: 'Isadora',
          date: 'quarta-feira, 29 de julho',
          time: '10:15',
          order_number: '74829',
          customerName: 'Felipe'
        });

      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [slug, session_id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1A1714] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#C9963B] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // wa.me logic
  const whatsappNumber = settings?.whatsapp_number || settings?.phone || '';
  const cleanNumber = whatsappNumber.replace(/\D/g, '');
  const text = `📅 Novo Agendamento #${booking?.order_number}\n👤 Cliente: ${booking?.customerName}\n💈 Serviço: ${booking?.serviceName}\n🗓️ Data: ${booking?.date} às ${booking?.time}`;
  const whatsappLink = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(text)}`;

  return (
    <div className="min-h-screen bg-[#1A1714] text-white font-sans flex flex-col items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md flex flex-col items-center text-center"
      >
        {/* Circle Check Icon */}
        <div className="w-20 h-20 rounded-full bg-[#C9963B] flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(201,150,59,0.3)]">
          <div className="w-16 h-16 rounded-full border-4 border-[#1A1714] flex items-center justify-center">
            <Check className="w-8 h-8 text-[#1A1714]" strokeWidth={4} />
          </div>
        </div>

        <h1 className="text-3xl font-bold font-serif mb-2">Agendamento confirmado</h1>
        <p className="text-[#A09888] mb-10 text-sm">
          {booking?.customerName}, te esperamos em {booking?.date} às {booking?.time}.
        </p>

        {/* Card Resumo */}
        <div className="w-full bg-[#252118] border border-[#3A3530] rounded-3xl p-6 space-y-4 mb-8 text-left shadow-2xl">
          <div className="flex justify-between items-center">
            <span className="text-[#A09888] text-sm">Serviço</span>
            <span className="font-semibold">{booking?.serviceName}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#A09888] text-sm">Profissional</span>
            <span className="font-semibold">{booking?.professionalName}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#A09888] text-sm">Data</span>
            <span className="font-semibold">{booking?.date}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#A09888] text-sm">Horário</span>
            <span className="font-semibold">{booking?.time}</span>
          </div>
        </div>

        <p className="text-[#A09888] text-sm mb-6">
          Toque no botão abaixo para enviar os detalhes ao estabelecimento.
        </p>

        {cleanNumber && (
          <a 
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full bg-[#22c55e] hover:bg-[#16a34a] text-white font-bold py-4 rounded-xl transition-colors mb-4 flex justify-center items-center gap-2 shadow-lg"
          >
            Enviar para o WhatsApp
          </a>
        )}

        <button 
          onClick={() => navigate(getTenantPublicUrl(slug))}
          className="w-full bg-transparent border border-[#3A3530] text-white hover:bg-[#252118] font-bold py-4 rounded-xl transition-colors"
        >
          Voltar para o Salão
        </button>

        <Link to={getTenantPortalUrl(slug)} className="mt-6 text-[#A09888] hover:text-white transition-colors text-sm font-medium underline">
          Acessar Meu Histórico
        </Link>
      </motion.div>
    </div>
  );
}

