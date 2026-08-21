import { useState } from 'react';
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
  
  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['customer_history', tenantId, customer.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id, scheduled_at, status, amount_total, payment_mode, notes,
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

  const money = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  
  const getStatusColor = (status: string) => {
    switch(status) {
      case 'confirmed': return theme.info;
      case 'completed': return theme.success;
      case 'canceled': return theme.error;
      case 'no_show': return theme.error;
      case 'pending': return theme.warning;
      default: return theme.textSecondary;
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div 
        className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl flex flex-col"
        style={{ background: theme.bg, borderColor: theme.border, borderWidth: 1 }}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between p-6 border-b backdrop-blur-md"
             style={{ borderColor: theme.border, background: `${theme.bg}ee` }}>
          <div>
            <h2 className="text-2xl font-bold" style={{ color: theme.textPrimary }}>
              Ficha do Cliente
            </h2>
            <p className="text-sm mt-1" style={{ color: theme.textSecondary }}>
              Detalhes e histórico de agendamentos
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-full transition-colors hover:bg-black/5"
          >
            <X className="w-5 h-5" style={{ color: theme.textSecondary }} />
          </button>
        </div>

        <div className="p-6 space-y-8">
          {/* Top Section: Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Main Info */}
            <div className="lg:col-span-2 p-5 rounded-xl border flex flex-col justify-center" style={{ borderColor: theme.border, background: theme.inputBg }}>
              <h3 className="text-xl font-bold mb-4" style={{ color: theme.textPrimary }}>{customer.name}</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <div className="p-1.5 rounded-lg" style={{ background: `${theme.accent}15`, color: theme.accent }}><Phone className="w-4 h-4" /></div>
                  <span style={{ color: theme.textSecondary }}>{customer.phone || 'Sem telefone cadastrado'}</span>
                </div>
                {customer.email && (
                  <div className="flex items-center gap-3 text-sm">
                    <div className="p-1.5 rounded-lg" style={{ background: `${theme.accent}15`, color: theme.accent }}><Mail className="w-4 h-4" /></div>
                    <span style={{ color: theme.textSecondary }}>{customer.email}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-sm">
                  <div className="p-1.5 rounded-lg" style={{ background: `${theme.accent}15`, color: theme.accent }}><Calendar className="w-4 h-4" /></div>
                  <span style={{ color: theme.textSecondary }}>
                    Cadastrado em {format(new Date(customer.created_at), "dd 'de' MMM, yyyy", { locale: ptBR })}
                  </span>
                </div>
              </div>
            </div>

            {/* Metrics */}
            <div className="p-5 rounded-xl border flex flex-col justify-between" style={{ borderColor: theme.border, background: theme.inputBg }}>
              <div className="flex items-center gap-2 mb-2" style={{ color: theme.textSecondary }}>
                <Award className="w-4 h-4" />
                <span className="text-sm font-semibold">Segmento</span>
              </div>
              <span 
                className="inline-flex items-center self-start px-3 py-1 rounded-full text-sm font-bold uppercase tracking-wider mt-2"
                style={{ 
                  background: customer.segment === 'vip' ? `${theme.accent}20` : customer.segment === 'fiel' ? `${theme.success}20` : `${theme.info}20`,
                  color: customer.segment === 'vip' ? theme.accent : customer.segment === 'fiel' ? theme.success : theme.info
                }}
              >
                {customer.segment || 'Novo'}
              </span>
            </div>

            <div className="p-5 rounded-xl border flex flex-col justify-between" style={{ borderColor: theme.border, background: theme.inputBg }}>
              <div className="flex items-center gap-2 mb-2" style={{ color: theme.textSecondary }}>
                <DollarSign className="w-4 h-4" />
                <span className="text-sm font-semibold">Total Gasto</span>
              </div>
              <p className="text-2xl font-bold" style={{ color: theme.textPrimary }}>
                {money(customer.total_spent || 0)}
              </p>
              <p className="text-xs mt-2" style={{ color: theme.textSecondary }}>
                Em {customer.visit_count || 0} visitas
              </p>
            </div>
            
          </div>

          {/* CRM extra info if any */}
          {(customer.favorite_professionals?.length > 0 || customer.past_services?.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border rounded-xl" style={{ borderColor: theme.border }}>
                <div className="flex items-center gap-2 mb-3" style={{ color: theme.textSecondary }}>
                  <Star className="w-4 h-4" />
                  <span className="font-semibold text-sm">Profissionais Favoritos</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {customer.favorite_professionals?.map((p: string, i: number) => (
                    <span key={i} className="px-2 py-1 rounded-md text-xs font-medium" style={{ background: theme.inputBg, color: theme.textPrimary }}>
                      {p}
                    </span>
                  ))}
                </div>
              </div>
              <div className="p-4 border rounded-xl" style={{ borderColor: theme.border }}>
                <div className="flex items-center gap-2 mb-3" style={{ color: theme.textSecondary }}>
                  <Scissors className="w-4 h-4" />
                  <span className="font-semibold text-sm">Serviços Mais Usados</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {customer.past_services?.map((s: string, i: number) => (
                    <span key={i} className="px-2 py-1 rounded-md text-xs font-medium" style={{ background: theme.inputBg, color: theme.textPrimary }}>
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Histórico */}
          <div>
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: theme.textPrimary }}>
              <Clock className="w-5 h-5" style={{ color: theme.accent }}/>
              Histórico de Agendamentos
            </h3>
            
            <div className="border rounded-xl overflow-hidden" style={{ borderColor: theme.border }}>
              {isLoading ? (
                <div className="p-8 text-center" style={{ color: theme.textSecondary }}>
                  Carregando histórico...
                </div>
              ) : bookings.length === 0 ? (
                <div className="p-8 text-center" style={{ color: theme.textSecondary }}>
                  Nenhum agendamento encontrado para este cliente.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b" style={{ borderColor: theme.border, background: theme.inputBg, color: theme.textSecondary }}>
                        <th className="py-3 px-4 font-semibold">Data e Hora</th>
                        <th className="py-3 px-4 font-semibold">Serviço</th>
                        <th className="py-3 px-4 font-semibold">Profissional</th>
                        <th className="py-3 px-4 font-semibold">Status</th>
                        <th className="py-3 px-4 font-semibold text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bookings.map((b: any) => (
                        <tr key={b.id} className="border-b last:border-b-0" style={{ borderColor: theme.border }}>
                          <td className="py-3 px-4" style={{ color: theme.textPrimary }}>
                            {format(new Date(b.scheduled_at), "dd/MM/yyyy 'às' HH:mm")}
                          </td>
                          <td className="py-3 px-4" style={{ color: theme.textPrimary }}>
                            {b.services?.name || '---'}
                          </td>
                          <td className="py-3 px-4" style={{ color: theme.textSecondary }}>
                            {b.professionals?.name || 'Qualquer'}
                          </td>
                          <td className="py-3 px-4">
                            <span 
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold"
                              style={{ 
                                background: `${getStatusColor(b.status)}20`,
                                color: getStatusColor(b.status)
                              }}
                            >
                              {getStatusLabel(b.status)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-medium" style={{ color: theme.textPrimary }}>
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

