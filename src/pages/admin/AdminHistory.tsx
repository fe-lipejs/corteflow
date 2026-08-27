import React, { useState, useEffect } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { useTranslation } from 'react-i18next';
import { Loader2, Calendar, Mail, AlertCircle, TrendingUp, UserX, Clock, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const Card = ({ children, className }: any) => <div className={`bg-[#0f0f0f] border border-[#222] rounded-xl ${className || ''}`}>{children}</div>;
const CardHeader = ({ children, className }: any) => <div className={`p-6 pb-2 ${className || ''}`}>{children}</div>;
const CardTitle = ({ children, className }: any) => <h3 className={`font-semibold text-lg ${className || ''}`}>{children}</h3>;
const CardContent = ({ children, className }: any) => <div className={`p-6 pt-0 ${className || ''}`}>{children}</div>;

const Dialog = ({ open, onOpenChange, children }: any) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => onOpenChange(false)}>
      <div className="bg-[#111] border border-[#222] rounded-xl p-6 max-w-2xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
};
const DialogContent = ({ children, className }: any) => <div className={`flex flex-col h-full ${className || ''}`}>{children}</div>;
const DialogHeader = ({ children, className }: any) => <div className={`mb-4 ${className || ''}`}>{children}</div>;
const DialogTitle = ({ children, className }: any) => <h2 className={`text-xl font-bold ${className || ''}`}>{children}</h2>;
const DialogDescription = ({ children, className }: any) => <p className={`text-sm text-gray-400 ${className || ''}`}>{children}</p>;

const ScrollArea = ({ children, className }: any) => <div className={`overflow-y-auto ${className || ''}`}>{children}</div>;

interface HistoryData {
  id: string;
  original_tenant_id: string;
  normalized_email: string;
  first_signup_at: string;
  last_known_status: string;
  total_subscriptions: number;
  total_cancellations: number;
  total_account_deletions: number;
  total_trials_used: number;
  last_activity_at: string;
}

interface EventData {
  id: string;
  event_type: string;
  type: string;
  created_at: string;
  details: any;
  payload: any;
}

export function AdminHistory() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [histories, setHistories] = useState<HistoryData[]>([]);
  const [selectedHistory, setSelectedHistory] = useState<HistoryData | null>(null);
  const [events, setEvents] = useState<EventData[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  useEffect(() => {
    fetchHistories();
  }, []);

  const fetchHistories = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('commercial_history')
      .select('*')
      .order('last_activity_at', { ascending: false });
    
    if (data) setHistories(data);
    setLoading(false);
  };

  const fetchEvents = async (historyId: string) => {
    setLoadingEvents(true);
    const { data, error } = await supabase
      .from('billing_events')
      .select('*')
      .eq('history_id', historyId)
      .order('created_at', { ascending: false });
    
    if (data) setEvents(data);
    setLoadingEvents(false);
  };

  const openTimeline = (history: HistoryData) => {
    setSelectedHistory(history);
    fetchEvents(history.id);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">CRM & Histórico de Clientes</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total de Contatos</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{histories.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Contas Excluídas (LGPD)</CardTitle>
            <UserX className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{histories.reduce((acc, h) => acc + h.total_account_deletions, 0)}</div>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin" /></div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Auditoria de Faturamento e Uso</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                  <tr>
                    <th className="px-4 py-3">E-mail Único</th>
                    <th className="px-4 py-3">1º Cadastro</th>
                    <th className="px-4 py-3">Último Status</th>
                    <th className="px-4 py-3 text-center">Assinaturas</th>
                    <th className="px-4 py-3 text-center">Trials Usados</th>
                    <th className="px-4 py-3 text-center">Deleções</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {histories.map((h) => (
                    <tr key={h.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{h.normalized_email}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {format(new Date(h.first_signup_at), "dd/MM/yyyy", { locale: ptBR })}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          h.last_known_status === 'active' ? 'bg-green-500/10 text-green-500' :
                          h.last_known_status === 'deleted_account' ? 'bg-red-500/10 text-red-500' :
                          'bg-yellow-500/10 text-yellow-500'
                        }`}>
                          {h.last_known_status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">{h.total_subscriptions}</td>
                      <td className="px-4 py-3 text-center">{h.total_trials_used}</td>
                      <td className="px-4 py-3 text-center text-red-500">{h.total_account_deletions}</td>
                      <td className="px-4 py-3 text-right">
                        <button 
                          onClick={() => openTimeline(h)}
                          className="px-3 py-1 bg-primary text-primary-foreground text-xs rounded-md hover:bg-primary/90"
                        >
                          Timeline
                        </button>
                      </td>
                    </tr>
                  ))}
                  {histories.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-muted-foreground">
                        Nenhum histórico comercial encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!selectedHistory} onOpenChange={(open: boolean) => !open && setSelectedHistory(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Timeline de Eventos Comerciais</DialogTitle>
            <DialogDescription>
              {selectedHistory?.normalized_email}
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="flex-1 -mx-6 px-6">
            {loadingEvents ? (
              <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : events.length === 0 ? (
              <div className="text-center text-muted-foreground p-8">Nenhum evento registrado.</div>
            ) : (
              <div className="space-y-6 py-4 border-l-2 border-muted ml-4 pl-4">
                {events.map((event, index) => (
                  <div key={event.id} className="relative">
                    <div className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-primary ring-4 ring-background" />
                    <div className="bg-muted/30 p-4 rounded-lg border">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-sm capitalize">
                          {(event.event_type || event.type || 'evento').replace(/_/g, ' ')}
                        </h3>
                        <time className="text-xs text-muted-foreground font-mono">
                          {format(new Date(event.created_at), "dd/MM/yyyy HH:mm:ss")}
                        </time>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-2">
                        {event.details && Object.keys(event.details).length > 0 && (
                          <div className="bg-card p-2 rounded border border-border/50">
                            <strong>Detalhes Internos:</strong>
                            <pre className="mt-1 whitespace-pre-wrap font-mono text-[10px]">{JSON.stringify(event.details, null, 2)}</pre>
                          </div>
                        )}
                        {event.payload && Object.keys(event.payload).length > 0 && (
                          <div className="bg-card p-2 rounded border border-border/50">
                            <strong>Stripe Payload:</strong>
                            <pre className="mt-1 whitespace-pre-wrap font-mono text-[10px] overflow-x-auto max-h-32">{JSON.stringify(event.payload, null, 2)}</pre>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
