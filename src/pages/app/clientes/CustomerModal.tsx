import { useMemo } from 'react';
import { X, Calendar, DollarSign, Clock, Phone, Mail, Award, Scissors, Star } from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../integrations/supabase/client';

interface CustomerModalProps {
  customer: any;
  onClose: () => void;
  tenantId: string;
}

export function CustomerModal({ customer, onClose, tenantId }: CustomerModalProps) {
  const { theme } = useTheme();

  const isLight =
    theme.id === 'elegant' ||
    (theme.bg && (theme.bg.toLowerCase().startsWith('#f') || theme.bg.toLowerCase().startsWith('#fff')));
  
  const { data: rawBookings = [], isLoading } = useQuery({
    queryKey: ['customer_history', tenantId, customer.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id, scheduled_at, status, amount_total, amount_paid, payment_mode, payment_status, notes,
          services (name),
          professionals (name)
        `)
        .eq('tenant_id', tenantId)
        .eq('customer_id', customer.id)
        .order('scheduled_at', { ascending: false });
        
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId && !!customer.id
  });

  // Filtrar rascunhos online pendentes não pagos
  const bookings = useMemo(
    () =>
      rawBookings.filter(
        (b: any) =>
          !(
            b.status === 'pending' &&
            (b.payment_mode === 'deposit' || b.payment_mode === 'full') &&
            (!b.payment_status || b.payment_status === 'pending')
          )
      ),
    [rawBookings]
  );

  // Cálculo em tempo real para refletir agendamentos concluídos e pagamentos PIX/Cartão já realizados
  const liveMetrics = useMemo(() => {
    let spent = 0;
    let visits = 0;
    for (const b of bookings as any[]) {
      if (b.status === 'completed') {
        spent += Number(b.amount_total || 0);
        visits += 1;
      } else if (b.status === 'confirmed' && Number(b.amount_paid || 0) > 0) {
        spent += Number(b.amount_paid || 0);
        visits += 1;
      }
    }
    return {
      totalSpent: Math.max(Number(customer.total_spent || 0), spent),
      visitCount: Math.max(Number(customer.visit_count || 0), visits),
    };
  }, [bookings, customer.total_spent, customer.visit_count]);

  const money = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  
  const getStatusColor = (status: string) => {
    switch(status) {
      case 'confirmed': return isLight ? '#1D4ED8' : theme.info;
      case 'completed': return isLight ? '#15803D' : theme.success;
      case 'canceled': return isLight ? '#B91C1C' : theme.error;
      case 'no_show': return isLight ? '#C2410C' : theme.warning;
      case 'pending': return isLight ? '#B45309' : theme.warning;
      default: return isLight ? '#475569' : theme.textSecondary;
    }
  };

  const getStatusLabel = (status: string) => {
    switch(status) {
      case 'confirmed': return 'Confirmado';
      case 'completed': return 'Concluído';
      case 'canceled': return 'Cancelado';
      case 'no_show': return 'Não compareceu';
      case 'pending': return 'Pendente';
      default: return status;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div 
        className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl flex flex-col border"
        style={{
          background: isLight ? '#FFFFFF' : theme.bg,
          borderColor: isLight ? '#E2E8F0' : theme.border,
        }}
      >
        <div
          className="sticky top-0 z-10 flex items-center justify-between p-6 border-b backdrop-blur-md"
          style={{
            borderColor: isLight ? '#E2E8F0' : theme.border,
            background: isLight ? 'rgba(255, 255, 255, 0.95)' : `${theme.bg}ee`
          }}
        >
          <div>
            <h2 className="text-2xl font-bold font-serif" style={{ color: isLight ? '#0F172A' : theme.textPrimary }}>
              Ficha do Cliente
            </h2>
            <p className="text-sm mt-1 font-medium" style={{ color: isLight ? '#64748B' : theme.textSecondary }}>
              Detalhes e histórico de agendamentos
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-full transition-colors hover:bg-black/5 cursor-pointer"
          >
            <X className="w-5 h-5" style={{ color: isLight ? '#475569' : theme.textSecondary }} />
          </button>
        </div>

        <div className="p-6 space-y-8">
          {/* Top Section: Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Main Info */}
            <div
              className="lg:col-span-2 p-5 rounded-2xl border flex flex-col justify-center"
              style={{
                borderColor: isLight ? '#E2E8F0' : theme.border,
                background: isLight ? '#F8FAFC' : theme.inputBg,
              }}
            >
              <h3 className="text-xl font-bold mb-4 font-serif" style={{ color: isLight ? '#0F172A' : theme.textPrimary }}>{customer.name}</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <div className="p-1.5 rounded-lg" style={{ background: `${theme.accent}15`, color: theme.accent }}><Phone className="w-4 h-4" /></div>
                  <span className="font-medium" style={{ color: isLight ? '#334155' : theme.textSecondary }}>{customer.phone || 'Sem telefone cadastrado'}</span>
                </div>
                {customer.email && (
                  <div className="flex items-center gap-3 text-sm">
                    <div className="p-1.5 rounded-lg" style={{ background: `${theme.accent}15`, color: theme.accent }}><Mail className="w-4 h-4" /></div>
                    <span className="font-medium" style={{ color: isLight ? '#334155' : theme.textSecondary }}>{customer.email}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-sm">
                  <div className="p-1.5 rounded-lg" style={{ background: `${theme.accent}15`, color: theme.accent }}><Calendar className="w-4 h-4" /></div>
                  <span className="font-medium" style={{ color: isLight ? '#475569' : theme.textSecondary }}>
                    Cadastrado em {format(new Date(customer.created_at), "dd 'de' MMM, yyyy", { locale: ptBR })}
                  </span>
                </div>
              </div>
            </div>

            {/* Metrics */}
            <div
              className="p-5 rounded-2xl border flex flex-col justify-between"
              style={{
                borderColor: isLight ? '#E2E8F0' : theme.border,
                background: isLight ? '#F8FAFC' : theme.inputBg,
              }}
            >
              <div className="flex items-center gap-2 mb-2" style={{ color: isLight ? '#475569' : theme.textSecondary }}>
                <Award className="w-4 h-4" />
                <span className="text-sm font-semibold">Segmento</span>
              </div>
              <span 
                className="inline-flex items-center self-start px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mt-2 border shadow-sm"
                style={{ 
                  background: customer.segment === 'vip'
                    ? (isLight ? '#FEF3C7' : `${theme.accent}20`)
                    : customer.segment === 'fiel'
                      ? (isLight ? '#DCFCE7' : `${theme.success}20`)
                      : (isLight ? '#DBEAFE' : `${theme.info}20`),
                  color: customer.segment === 'vip'
                    ? (isLight ? '#92400E' : theme.accent)
                    : customer.segment === 'fiel'
                      ? (isLight ? '#166534' : theme.success)
                      : (isLight ? '#1E40AF' : theme.info),
                  borderColor: customer.segment === 'vip'
                    ? (isLight ? '#FDE68A' : 'rgba(245, 158, 11, 0.3)')
                    : customer.segment === 'fiel'
                      ? (isLight ? '#BBF7D0' : 'rgba(34, 197, 94, 0.3)')
                      : (isLight ? '#BFDBFE' : 'rgba(59, 130, 246, 0.3)'),
                }}
              >
                {customer.segment || 'Novo'}
              </span>
            </div>

            <div
              className="p-5 rounded-2xl border flex flex-col justify-between"
              style={{
                borderColor: isLight ? '#E2E8F0' : theme.border,
                background: isLight ? '#F8FAFC' : theme.inputBg,
              }}
            >
              <div className="flex items-center gap-2 mb-2" style={{ color: isLight ? '#475569' : theme.textSecondary }}>
                <DollarSign className="w-4 h-4" />
                <span className="text-sm font-semibold">Total Gasto</span>
              </div>
              <p className="text-2xl font-bold tracking-tight" style={{ color: isLight ? '#0F172A' : theme.textPrimary }}>
                {money(liveMetrics.totalSpent)}
              </p>
              <p className="text-xs mt-2 font-medium" style={{ color: isLight ? '#64748B' : theme.textSecondary }}>
                Em {liveMetrics.visitCount} {liveMetrics.visitCount === 1 ? 'atendimento' : 'atendimentos'}
              </p>
            </div>
            
          </div>

          {/* CRM extra info if any */}
          {(customer.favorite_professionals?.length > 0 || customer.past_services?.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div
                className="p-4 border rounded-2xl"
                style={{
                  borderColor: isLight ? '#E2E8F0' : theme.border,
                  background: isLight ? '#FFFFFF' : 'transparent',
                }}
              >
                <div className="flex items-center gap-2 mb-3" style={{ color: isLight ? '#475569' : theme.textSecondary }}>
                  <Star className="w-4 h-4" />
                  <span className="font-semibold text-sm">Profissionais Favoritos</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {customer.favorite_professionals?.map((p: string, i: number) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold border"
                      style={{
                        background: isLight ? '#F1F5F9' : theme.inputBg,
                        color: isLight ? '#0F172A' : theme.textPrimary,
                        borderColor: isLight ? '#CBD5E1' : theme.border,
                      }}
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>
              <div
                className="p-4 border rounded-2xl"
                style={{
                  borderColor: isLight ? '#E2E8F0' : theme.border,
                  background: isLight ? '#FFFFFF' : 'transparent',
                }}
              >
                <div className="flex items-center gap-2 mb-3" style={{ color: isLight ? '#475569' : theme.textSecondary }}>
                  <Scissors className="w-4 h-4" />
                  <span className="font-semibold text-sm">Serviços Mais Usados</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {customer.past_services?.map((s: string, i: number) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold border"
                      style={{
                        background: isLight ? '#F1F5F9' : theme.inputBg,
                        color: isLight ? '#0F172A' : theme.textPrimary,
                        borderColor: isLight ? '#CBD5E1' : theme.border,
                      }}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Histórico */}
          <div>
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: isLight ? '#0F172A' : theme.textPrimary }}>
              <Clock className="w-5 h-5" style={{ color: theme.accent }}/>
              Histórico de Agendamentos
            </h3>
            
            <div
              className="border rounded-2xl overflow-hidden"
              style={{
                borderColor: isLight ? '#E2E8F0' : theme.border,
                background: isLight ? '#FFFFFF' : theme.cardBg,
              }}
            >
              {isLoading ? (
                <div className="p-8 text-center" style={{ color: isLight ? '#64748B' : theme.textSecondary }}>
                  Carregando histórico...
                </div>
              ) : bookings.length === 0 ? (
                <div className="p-8 text-center" style={{ color: isLight ? '#64748B' : theme.textSecondary }}>
                  Nenhum agendamento encontrado para este cliente.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr
                        className="border-b"
                        style={{
                          borderColor: isLight ? '#E2E8F0' : theme.border,
                          background: isLight ? '#F8FAFC' : theme.inputBg,
                          color: isLight ? '#64748B' : theme.textSecondary
                        }}
                      >
                        <th className="py-3 px-4 font-semibold">Data e Hora</th>
                        <th className="py-3 px-4 font-semibold">Serviço</th>
                        <th className="py-3 px-4 font-semibold">Profissional</th>
                        <th className="py-3 px-4 font-semibold">Status</th>
                        <th className="py-3 px-4 font-semibold">Pagamento</th>
                        <th className="py-3 px-4 font-semibold text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bookings.map((b: any) => (
                        <tr
                          key={b.id}
                          className="border-b last:border-b-0 hover:bg-black/5 transition-colors"
                          style={{ borderColor: isLight ? '#F1F5F9' : theme.border }}
                        >
                          <td className="py-3.5 px-4 font-medium" style={{ color: isLight ? '#0F172A' : theme.textPrimary }}>
                            {format(new Date(b.scheduled_at), "dd/MM/yyyy 'às' HH:mm")}
                          </td>
                          <td className="py-3.5 px-4 font-semibold" style={{ color: isLight ? '#0F172A' : theme.textPrimary }}>
                            {b.services?.name || '---'}
                          </td>
                          <td className="py-3.5 px-4 font-medium" style={{ color: isLight ? '#475569' : theme.textSecondary }}>
                            {b.professionals?.name || 'Qualquer'}
                          </td>
                          <td className="py-3.5 px-4">
                            <span 
                              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border shadow-sm"
                              style={{ 
                                background: `${getStatusColor(b.status)}15`,
                                color: getStatusColor(b.status),
                                borderColor: `${getStatusColor(b.status)}30`
                              }}
                            >
                              {getStatusLabel(b.status)}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-xs font-semibold" style={{ color: isLight ? '#475569' : theme.textSecondary }}>
                            {b.payment_mode === 'deposit' && Number(b.amount_paid || 0) > 0
                              ? `Sinal Pago (${money(b.amount_paid)})`
                              : b.payment_mode === 'full' && Number(b.amount_paid || 0) > 0
                                ? '100% Online'
                                : 'No Local'}
                          </td>
                          <td className="py-3.5 px-4 text-right font-bold" style={{ color: isLight ? '#0F172A' : theme.textPrimary }}>
                            {money(b.amount_total || 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
