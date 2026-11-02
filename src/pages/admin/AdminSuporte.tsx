import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { useAuth } from '../../hooks/useAuth';
import { motion } from 'framer-motion';
import {
  MessageCircle, Send, ChevronLeft, Clock, CheckCircle2, XCircle,
  AlertCircle, Loader2, Building2, Search
} from 'lucide-react';
import AdminPageHeader from './components/AdminPageHeader';

type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed' | 'waiting_user' | 'waiting_support';
type TicketCategory = 'billing' | 'technical' | 'feature' | 'other';
type TicketPriority = 'low' | 'medium' | 'high';

interface Ticket {
  id: string;
  subject: string;
  category: TicketCategory;
  status: TicketStatus;
  priority: TicketPriority;
  created_at: string;
  updated_at: string;
  tenant_id: string;
  tenants?: { name: string; slug: string } | null;
  unread_count?: number;
}

interface Message {
  id: string;
  ticket_id: string;
  sender_id: string | null;
  sender_role: 'owner' | 'super_admin';
  content: string;
  created_at: string;
  read_by_admin: boolean;
  profiles?: { full_name: string } | null;
}

const STATUS_CONFIG: Record<TicketStatus, { label: string; color: string; icon: React.ElementType }> = {
  open: { label: 'Aberto', color: '#10B981', icon: AlertCircle },
  in_progress: { label: 'Em andamento', color: '#F59E0B', icon: Clock },
  waiting_user: { label: 'Aguardando Cliente', color: '#34D399', icon: Clock },
  waiting_support: { label: 'Aguardando Suporte', color: '#EF4444', icon: AlertCircle },
  resolved: { label: 'Resolvido', color: '#10B981', icon: CheckCircle2 },
  closed: { label: 'Fechado', color: '#71717A', icon: XCircle },
};

const CATEGORY_LABELS: Record<TicketCategory, string> = {
  billing: '💳 Cobrança',
  technical: '🔧 Técnico',
  feature: '💡 Sugestão',
  other: '💬 Outro',
};

const PRIORITY_CONFIG: Record<TicketPriority, { label: string; color: string }> = {
  low: { label: 'Baixa', color: '#71717A' },
  medium: { label: 'Média', color: '#F59E0B' },
  high: { label: 'Alta', color: '#EF4444' },
};

export default function AdminSuporte() {
  const { profile } = useAuth();

  const [view, setView] = useState<'list' | 'ticket'>('list');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | TicketStatus>('all');
  const [search, setSearch] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Fetch tickets ──────────────────────────────────────────────────────────
  const fetchTickets = async () => {
    const { data } = await supabase
      .from('support_tickets')
      .select('*, tenants(name, slug)')
      .order('updated_at', { ascending: false });
    setTickets((data as Ticket[]) ?? []);
    setLoadingTickets(false);
  };

  useEffect(() => { fetchTickets(); }, []);

  // ── Fetch messages ────────────────────────────────────────────────────────
  const fetchMessages = async (ticketId: string) => {
    setLoadingMessages(true);
    const { data } = await supabase
      .from('support_messages')
      .select('*, profiles(full_name)')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });
    setMessages((data as Message[]) ?? []);
    setLoadingMessages(false);

    await supabase
      .from('support_messages')
      .update({ read_by_admin: true } as any)
      .eq('ticket_id', ticketId)
      .eq('read_by_admin', false);
  };

  const openTicket = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setView('ticket');
    fetchMessages(ticket.id);
  };

  const updateStatus = async (ticketId: string, newStatus: TicketStatus) => {
    await supabase.from('support_tickets').update({ status: newStatus } as any).eq('id', ticketId);
    if (selectedTicket) setSelectedTicket({ ...selectedTicket, status: newStatus });
    fetchTickets();
  };

  const deleteTicket = async (ticketId: string) => {
    if (!window.confirm('Tem certeza que deseja apagar permanentemente este chamado e todas as mensagens?')) return;
    await supabase.from('support_messages').delete().eq('ticket_id', ticketId);
    await supabase.from('support_tickets').delete().eq('id', ticketId);
    setView('list');
    setSelectedTicket(null);
    fetchTickets();
  };

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Send message ──────────────────────────────────────────────────────────
  const sendMessage = async () => {
    if (!messageText.trim() || !selectedTicket || !profile) return;
    setSending(true);

    await supabase.from('support_messages').insert({
      ticket_id: selectedTicket.id,
      sender_id: profile.id,
      sender_role: 'super_admin',
      content: messageText.trim(),
      read_by_admin: true,
      read_by_owner: false,
    } as any);

    if (selectedTicket.status !== 'closed' && selectedTicket.status !== 'resolved') {
      await updateStatus(selectedTicket.id, 'waiting_user');
    }

    setMessageText('');
    setSending(false);
    fetchMessages(selectedTicket.id);
    fetchTickets();
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
  });

  // ── Filter ────────────────────────────────────────────────────────────────
  const filtered = tickets.filter(t => {
    const matchStatus = statusFilter === 'all' || t.status === statusFilter;
    const matchSearch = search === '' ||
      t.subject.toLowerCase().includes(search.toLowerCase()) ||
      (t.tenants?.name ?? '').toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const unreadTotal = tickets.filter(t => t.status === 'open').length;

  // ── Ticket view ───────────────────────────────────────────────────────────
  if (view === 'ticket' && selectedTicket) {
    const statusCfg = STATUS_CONFIG[selectedTicket.status];
    const StatusIcon = statusCfg.icon;

    return (
      <div className="space-y-4 h-full flex flex-col max-h-[calc(100vh-8rem)] text-zinc-100">
        {/* Header */}
        <div className="flex items-start gap-3 bg-[#0B0B0E] p-4 rounded-2xl border border-white/10 shadow-xl">
          <button onClick={() => { setView('list'); fetchTickets(); }} className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-semibold text-zinc-300">{selectedTicket.tenants?.name}</span>
            </div>
            <h1 className="text-xl font-bold text-white truncate">{selectedTicket.subject}</h1>
            <div className="flex items-center flex-wrap gap-2 mt-1">
              <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-white/10" style={{ background: `${statusCfg.color}15`, color: statusCfg.color }}>
                <StatusIcon className="w-3 h-3" />{statusCfg.label}
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-lg border border-white/10 text-zinc-300 bg-white/[0.03]">
                {CATEGORY_LABELS[selectedTicket.category]}
              </span>
              <span className="text-xs text-zinc-500">Aberto em {formatDate(selectedTicket.created_at)}</span>
            </div>
          </div>

          {/* Status controls */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {selectedTicket.status !== 'closed' && (
              <button
                onClick={() => updateStatus(selectedTicket.id, 'closed')}
                className="text-xs px-3.5 py-2 rounded-xl border border-emerald-500/30 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 font-bold transition-all shadow-sm cursor-pointer"
              >
                ✓ Concluir Chamado
              </button>
            )}
            <button
              onClick={() => deleteTicket(selectedTicket.id)}
              className="text-xs px-3.5 py-2 rounded-xl border border-rose-500/30 text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 font-bold transition-all shadow-sm cursor-pointer"
            >
              Apagar
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 p-5 rounded-2xl border border-white/10 bg-[#0E0E14] shadow-xl" style={{ minHeight: '400px', maxHeight: '55vh' }}>
          {loadingMessages ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8 text-sm text-zinc-500">Nenhuma mensagem ainda.</div>
          ) : (
            messages.map(msg => {
              const isAdmin = msg.sender_role === 'super_admin';
              return (
                <div key={msg.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 space-y-1 shadow-md ${
                    isAdmin 
                      ? 'bg-emerald-500 text-black font-medium rounded-tr-xs shadow-emerald-500/10' 
                      : 'bg-[#13131A] border border-white/10 text-white rounded-tl-xs'
                  }`}>
                    <p className={`text-xs font-bold ${isAdmin ? 'text-black/70' : 'text-zinc-400'}`}>
                      {isAdmin ? '🛡️ Você (Suporte)' : msg.profiles?.full_name ?? 'Cliente'}
                    </p>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    <p className={`text-[10px] text-right ${isAdmin ? 'text-black/60' : 'text-zinc-500'}`}>
                      {formatDate(msg.created_at)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        {selectedTicket.status !== 'closed' ? (
          <div className="flex gap-2">
            <textarea
              value={messageText}
              onChange={e => setMessageText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Digite sua resposta... (Enter para enviar)"
              rows={2}
              className="flex-1 px-4 py-3 rounded-xl border border-white/10 bg-[#13131A] text-white text-sm outline-none resize-none focus:border-emerald-500 shadow-sm transition-colors placeholder-zinc-500"
            />
            <button
              onClick={sendMessage}
              disabled={sending || !messageText.trim()}
              className="px-5 py-3 rounded-xl font-bold bg-emerald-500 hover:bg-emerald-400 text-black transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-40 flex items-center justify-center cursor-pointer active:scale-95"
            >
              {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
        ) : (
          <div className="text-center p-4 rounded-xl border border-white/10 bg-[#0B0B0E] text-sm text-zinc-500 font-medium">
            Chamado fechado.
          </div>
        )}
      </div>
    );
  }

  // ── List view ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 text-zinc-100">
      <AdminPageHeader
        title={`Suporte ${unreadTotal > 0 ? `(${unreadTotal} abertos)` : ''}`}
        subtitle="Gerencie os chamados dos salões cadastrados"
        icon={<MessageCircle className="w-5 h-5" />}
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por assunto ou salão..."
            className="w-full pl-9 pr-4 py-2 bg-[#13131A] border border-white/10 rounded-xl text-sm text-white placeholder-zinc-500 outline-none focus:border-emerald-500 shadow-sm transition-colors"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0">
          {(['all', 'open', 'in_progress', 'resolved', 'closed'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                statusFilter === s 
                  ? 'bg-emerald-500 text-black font-bold shadow-lg shadow-emerald-500/20' 
                  : 'bg-white/5 border border-white/10 text-zinc-300 hover:bg-white/10'
              }`}
            >
              {s === 'all' ? 'Todos' : STATUS_CONFIG[s].label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(['open', 'in_progress', 'resolved', 'closed'] as TicketStatus[]).map(s => {
          const count = tickets.filter(t => t.status === s).length;
          const cfg = STATUS_CONFIG[s];
          const Icon = cfg.icon;
          return (
            <div key={s} className="bg-[#0B0B0E] border border-white/10 rounded-2xl p-4 flex items-center gap-3 shadow-xl">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${cfg.color}20` }}>
                <Icon className="w-4 h-4" style={{ color: cfg.color }} />
              </div>
              <div>
                <p className="text-xl font-black text-white">{count}</p>
                <p className="text-xs text-zinc-400 font-medium">{cfg.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Ticket list */}
      {loadingTickets ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-white/10 rounded-2xl bg-[#0B0B0E] shadow-xl">
          <MessageCircle className="w-10 h-10 mx-auto mb-3 text-zinc-600" />
          <p className="text-sm text-zinc-400">Nenhum chamado encontrado.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((ticket, i) => {
            const statusCfg = STATUS_CONFIG[ticket.status];
            const StatusIcon = statusCfg.icon;
            const priorityCfg = PRIORITY_CONFIG[ticket.priority];

            return (
              <motion.div
                key={ticket.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => openTicket(ticket)}
                className="bg-[#0B0B0E] border border-white/10 rounded-2xl p-4 cursor-pointer transition-all hover:border-emerald-500/30 hover:shadow-xl shadow-lg"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Building2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      <span className="text-xs text-zinc-400 font-medium truncate">{ticket.tenants?.name ?? 'Salão desconhecido'}</span>
                    </div>
                    <h3 className="font-semibold text-white truncate">{ticket.subject}</h3>
                    <p className="text-xs text-zinc-400 mt-0.5">{CATEGORY_LABELS[ticket.category]}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full border border-white/10" style={{ color: priorityCfg.color, background: `${priorityCfg.color}15` }}>
                      {priorityCfg.label}
                    </span>
                    <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-white/10" style={{ background: `${statusCfg.color}15`, color: statusCfg.color }}>
                      <StatusIcon className="w-3 h-3" />{statusCfg.label}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-zinc-500 mt-2 font-medium">Atualizado: {formatDate(ticket.updated_at)}</p>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
