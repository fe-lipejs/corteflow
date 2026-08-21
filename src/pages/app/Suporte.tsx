import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../contexts/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, MessageCircle, Clock, CheckCircle2, XCircle,
  Send, ChevronLeft, AlertCircle, Tag, Loader2
} from 'lucide-react';

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
}

interface Message {
  id: string;
  ticket_id: string;
  sender_id: string | null;
  sender_role: 'owner' | 'super_admin';
  content: string;
  created_at: string;
  profiles?: { full_name: string } | null;
}

const STATUS_CONFIG: Record<TicketStatus, { label: string; color: string; icon: React.ElementType }> = {
  open: { label: 'Aberto', color: '#3B82F6', icon: AlertCircle },
  in_progress: { label: 'Em andamento', color: '#F59E0B', icon: Clock },
  waiting_user: { label: 'Aguardando Sua Resposta', color: '#8B5CF6', icon: Clock },
  waiting_support: { label: 'Aguardando Suporte', color: '#EF4444', icon: AlertCircle },
  resolved: { label: 'Resolvido', color: '#10B981', icon: CheckCircle2 },
  closed: { label: 'Fechado', color: '#6B7280', icon: XCircle },
};

const CATEGORY_LABELS: Record<TicketCategory, string> = {
  billing: '💳 Cobrança / Assinatura',
  technical: '🔧 Problema técnico',
  feature: '💡 Sugestão / Recurso',
  other: '💬 Outro assunto',
};

const PRIORITY_CONFIG: Record<TicketPriority, { label: string; color: string }> = {
  low: { label: 'Baixa', color: '#6B7280' },
  medium: { label: 'Média', color: '#F59E0B' },
  high: { label: 'Alta', color: '#EF4444' },
};

export default function Suporte() {
  const { tenant, profile } = useAuth();
  const { theme } = useTheme();

  const [view, setView] = useState<'list' | 'ticket' | 'new'>('list');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [messageText, setMessageText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // New ticket form
  const [newSubject, setNewSubject] = useState('');
  const [newCategory, setNewCategory] = useState<TicketCategory>('other');
  const [newPriority, setNewPriority] = useState<TicketPriority>('medium');
  const [newMessage, setNewMessage] = useState('');
  const [creating, setCreating] = useState(false);

  // ── Fetch tickets ──────────────────────────────────────────────────────────
  const fetchTickets = async () => {
    if (!tenant) return;
    const { data } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('updated_at', { ascending: false });
    setTickets((data as Ticket[]) ?? []);
    setLoadingTickets(false);
  };

  useEffect(() => { fetchTickets(); }, [tenant]);

  // ── Fetch messages for selected ticket ────────────────────────────────────
  const fetchMessages = async (ticketId: string) => {
    setLoadingMessages(true);
    const { data } = await supabase
      .from('support_messages')
      .select('*, profiles(full_name)')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });
    setMessages((data as Message[]) ?? []);
    setLoadingMessages(false);

    // Mark messages as read by owner
    await supabase
      .from('support_messages')
      .update({ read_by_owner: true })
      .eq('ticket_id', ticketId)
      .eq('sender_role', 'super_admin');
  };

  // ── Realtime subscription ─────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedTicket) return;
    const channel = supabase
      .channel(`ticket-${selectedTicket.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'support_messages',
        filter: `ticket_id=eq.${selectedTicket.id}`,
      }, () => {
        fetchMessages(selectedTicket.id);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedTicket?.id]);

  // ── Scroll to bottom ──────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Open ticket ───────────────────────────────────────────────────────────
  const openTicket = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    fetchMessages(ticket.id);
    setView('ticket');
  };

  // ── Send message ──────────────────────────────────────────────────────────
  const sendMessage = async () => {
    if (!messageText.trim() || !selectedTicket || !profile) return;
    setSending(true);
    await supabase.from('support_messages').insert({
      ticket_id: selectedTicket.id,
      sender_id: profile.id,
      sender_role: 'owner',
      content: messageText.trim(),
      read_by_admin: false,
      read_by_owner: true,
    } as any);
    if (selectedTicket.status !== 'closed' && selectedTicket.status !== 'resolved') {
      await updateStatus(selectedTicket.id, 'waiting_support');
    }

    setMessageText('');
    setSending(false);
    fetchMessages(selectedTicket.id);
  };

  const updateStatus = async (ticketId: string, status: TicketStatus) => {
    await supabase.from('support_tickets').update({ status }).eq('id', ticketId);
    setSelectedTicket(prev => prev ? { ...prev, status } : null);
    setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status } : t));
  };

  // ── Create new ticket ─────────────────────────────────────────────────────
  const createTicket = async () => {
    if (!newSubject.trim() || !newMessage.trim() || !tenant || !profile) return;
    setCreating(true);

    const { data: ticket } = await supabase.from('support_tickets').insert({
      tenant_id: tenant.id,
      subject: newSubject.trim(),
      category: newCategory,
      priority: newPriority,
      status: 'open',
    } as any).select().single();

    if (ticket) {
      await supabase.from('support_messages').insert({
        ticket_id: ticket.id,
        sender_id: profile.id,
        sender_role: 'owner',
        content: newMessage.trim(),
        read_by_admin: false,
        read_by_owner: true,
      } as any);
    }

    setCreating(false);
    setNewSubject('');
    setNewMessage('');
    setNewCategory('other');
    setNewPriority('medium');
    await fetchTickets();
    setView('list');
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
  });

  // ── Views ─────────────────────────────────────────────────────────────────
  if (view === 'new') {
    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <button onClick={() => setView('list')} className="p-2 rounded-xl transition-colors hover:opacity-70" style={{ color: theme.textSecondary }}>
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-serif text-2xl font-bold" style={{ color: theme.textPrimary }}>Abrir Chamado</h1>
            <p className="text-sm" style={{ color: theme.textSecondary }}>Nossa equipe responde em até 24h úteis</p>
          </div>
        </div>

        <div className="p-6 rounded-2xl border space-y-5" style={{ borderColor: theme.border, background: theme.cardBg }}>
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: theme.textSecondary }}>Assunto *</label>
            <input
              value={newSubject}
              onChange={e => setNewSubject(e.target.value)}
              placeholder="Ex: Não consigo emitir nota fiscal..."
              className="w-full px-4 py-3 rounded-xl border text-sm outline-none transition-colors"
              style={{ background: theme.inputBg, borderColor: theme.border, color: theme.textPrimary }}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: theme.textSecondary }}>Categoria</label>
              <select
                value={newCategory}
                onChange={e => setNewCategory(e.target.value as TicketCategory)}
                className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
                style={{ background: theme.inputBg, borderColor: theme.border, color: theme.textPrimary }}
              >
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: theme.textSecondary }}>Prioridade</label>
              <select
                value={newPriority}
                onChange={e => setNewPriority(e.target.value as TicketPriority)}
                className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
                style={{ background: theme.inputBg, borderColor: theme.border, color: theme.textPrimary }}
              >
                {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: theme.textSecondary }}>Descreva o problema *</label>
            <textarea
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              rows={5}
              placeholder="Descreva com detalhes o que aconteceu, o que você esperava e o que está vendo..."
              className="w-full px-4 py-3 rounded-xl border text-sm outline-none resize-none transition-colors"
              style={{ background: theme.inputBg, borderColor: theme.border, color: theme.textPrimary }}
            />
          </div>

          <button
            onClick={createTicket}
            disabled={creating || !newSubject.trim() || !newMessage.trim()}
            className="w-full py-3 rounded-xl font-bold text-sm transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: theme.accentGradient, color: theme.btnPrimaryText, boxShadow: theme.shadowAccent }}
          >
            {creating ? (
              <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Enviando...</span>
            ) : 'Enviar Chamado'}
          </button>
        </div>
      </div>
    );
  }

  if (view === 'ticket' && selectedTicket) {
    const statusCfg = STATUS_CONFIG[selectedTicket.status];
    const StatusIcon = statusCfg.icon;

    return (
      <div className="max-w-3xl mx-auto flex flex-col h-full animate-fade-in" style={{ minHeight: 'calc(100vh - 8rem)' }}>
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <button onClick={() => { setView('list'); setSelectedTicket(null); }} className="p-2 rounded-xl mt-1 hover:opacity-70 transition-colors" style={{ color: theme.textSecondary }}>
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-serif text-xl font-bold truncate" style={{ color: theme.textPrimary }}>{selectedTicket.subject}</h1>
            <div className="flex items-center flex-wrap gap-2 mt-1">
              <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: `${statusCfg.color}20`, color: statusCfg.color }}>
                <StatusIcon className="w-3 h-3" />{statusCfg.label}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full border" style={{ borderColor: theme.border, color: theme.textSecondary }}>
                <Tag className="w-3 h-3 inline mr-1" />{CATEGORY_LABELS[selectedTicket.category]}
              </span>
              <span className="text-xs" style={{ color: theme.textMuted }}>Aberto em {formatDate(selectedTicket.created_at)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selectedTicket.status !== 'closed' && selectedTicket.status !== 'resolved' && (
              <button
                onClick={() => updateStatus(selectedTicket.id, 'resolved')}
                className="text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1"
                style={{ borderColor: theme.success, color: theme.success, background: `${theme.success}10` }}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Marcar como Resolvido
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 p-4 rounded-2xl border mb-4" style={{ borderColor: theme.border, background: theme.inputBg, minHeight: '400px', maxHeight: '60vh' }}>
          {loadingMessages ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: theme.accent }} />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8 text-sm" style={{ color: theme.textMuted }}>Nenhuma mensagem ainda.</div>
          ) : (
            messages.map(msg => {
              const isOwner = msg.sender_role === 'owner';
              return (
                <div key={msg.id} className={`flex ${isOwner ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 space-y-1 ${isOwner ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}
                    style={{
                      background: isOwner ? theme.accent : theme.cardBg,
                      color: isOwner ? theme.btnPrimaryText : theme.textPrimary,
                      border: isOwner ? 'none' : `1px solid ${theme.border}`,
                    }}>
                    <p className="text-xs font-semibold opacity-70">{isOwner ? 'Você' : '🛡️ Suporte Corteflow'}</p>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    <p className="text-[10px] opacity-50 text-right">{formatDate(msg.created_at)}</p>
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
              placeholder="Digite sua mensagem... (Enter para enviar)"
              rows={2}
              className="flex-1 px-4 py-3 rounded-xl border text-sm outline-none resize-none transition-colors"
              style={{ background: theme.inputBg, borderColor: theme.border, color: theme.textPrimary }}
            />
            <button
              onClick={sendMessage}
              disabled={sending || !messageText.trim()}
              className="px-4 py-3 rounded-xl font-bold transition-all hover:-translate-y-0.5 disabled:opacity-50"
              style={{ background: theme.accentGradient, color: theme.btnPrimaryText, boxShadow: theme.shadowAccent }}
            >
              {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
        ) : (
          <div className="text-center p-4 rounded-xl border text-sm" style={{ borderColor: theme.border, color: theme.textMuted }}>
            Este chamado está fechado. Abra um novo chamado se precisar de ajuda.
          </div>
        )}
      </div>
    );
  }

  // ── List view ─────────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: theme.textSecondary }}>Central de Ajuda</p>
          <h1 className="font-serif text-3xl font-bold" style={{ color: theme.textPrimary }}>Suporte</h1>
        </div>
        <button
          onClick={() => setView('new')}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all hover:-translate-y-0.5"
          style={{ background: theme.accentGradient, color: theme.btnPrimaryText, boxShadow: theme.shadowAccent }}
        >
          <Plus className="w-4 h-4" /> Abrir Chamado
        </button>
      </div>

      {/* Info card */}
      <div className="p-4 rounded-2xl border flex items-start gap-3" style={{ borderColor: theme.border, background: theme.cardBg }}>
        <MessageCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: theme.accent }} />
        <p className="text-sm" style={{ color: theme.textSecondary }}>
          Nossa equipe responde em até <strong>24h úteis</strong>. Abra um chamado descrevendo seu problema e acompanhe a conversa aqui.
        </p>
      </div>

      {/* Ticket list */}
      {loadingTickets ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: theme.accent }} />
        </div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-16 border rounded-2xl" style={{ borderColor: theme.border, background: theme.cardBg }}>
          <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-30" style={{ color: theme.textSecondary }} />
          <h3 className="font-bold mb-1" style={{ color: theme.textPrimary }}>Nenhum chamado aberto</h3>
          <p className="text-sm" style={{ color: theme.textSecondary }}>Clique em "Abrir Chamado" se precisar de ajuda.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map(ticket => {
            const statusCfg = STATUS_CONFIG[ticket.status];
            const StatusIcon = statusCfg.icon;
            const priorityCfg = PRIORITY_CONFIG[ticket.priority];

            return (
              <motion.div
                key={ticket.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => openTicket(ticket)}
                className="p-5 rounded-2xl border cursor-pointer transition-all hover:-translate-y-0.5"
                style={{ borderColor: theme.border, background: theme.cardBg, boxShadow: 'none' }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = theme.shadowAccent)}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-bold truncate" style={{ color: theme.textPrimary }}>{ticket.subject}</h3>
                    <p className="text-xs mt-0.5" style={{ color: theme.textMuted }}>{CATEGORY_LABELS[ticket.category]}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: priorityCfg.color, background: `${priorityCfg.color}15` }}>
                      {priorityCfg.label}
                    </span>
                    <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: `${statusCfg.color}20`, color: statusCfg.color }}>
                      <StatusIcon className="w-3 h-3" />{statusCfg.label}
                    </span>
                  </div>
                </div>
                <p className="text-xs mt-2" style={{ color: theme.textMuted }}>
                  Última atualização: {formatDate(ticket.updated_at)}
                </p>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

