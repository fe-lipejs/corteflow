import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../../integrations/supabase/client";
import { X, Clock, AlertCircle, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { useTheme } from "../../../contexts/ThemeContext";

interface Props {
  tenantId: string;
  onClose: () => void;
  onBookingClick: (booking: any) => void;
}

export default function PendingBookingsModal({ tenantId, onClose, onBookingClick }: Props) {
  const { theme } = useTheme();

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["forgotten-bookings", tenantId],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("bookings")
        .select(`
          *,
          customer:customers(name, phone),
          professional:professionals(name, agenda_color),
          service:services(name, duration_minutes)
        `)
        .eq("tenant_id", tenantId)
        .in("status", ["pending", "confirmed", "arrived", "in_progress"])
        .lt("scheduled_at", now)
        .order("scheduled_at", { ascending: false });
      if (error) throw error;
      return data || [];
    }
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md rounded-2xl shadow-2xl flex flex-col max-h-[85vh] animate-slide-up" style={{ background: theme.bg, border: `1px solid ${theme.border}` }}>
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: theme.border }}>
          <div>
            <h2 className="font-bold text-lg flex items-center gap-2" style={{ color: theme.textPrimary }}>
              <AlertCircle className="w-5 h-5 text-amber-500" />
              Agendamentos Esquecidos
            </h2>
            <p className="text-xs" style={{ color: theme.textMuted }}>Atendimentos do passado que ainda estão abertos</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg transition-colors hover:bg-white/5" style={{ color: theme.textSecondary }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading ? (
            <div className="flex justify-center p-8"><Clock className="w-6 h-6 animate-spin text-amber-500" /></div>
          ) : bookings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mb-3">
                <CheckCircle className="w-6 h-6 text-green-500" />
              </div>
              <p className="font-semibold text-sm" style={{ color: theme.textPrimary }}>Tudo em dia!</p>
              <p className="text-xs" style={{ color: theme.textMuted }}>Nenhum agendamento pendente no passado.</p>
            </div>
          ) : (
            bookings.map((b: any) => (
              <div 
                key={b.id}
                onClick={() => {
                  onBookingClick(b);
                  onClose();
                }}
                className="p-3 rounded-xl border cursor-pointer transition-all hover:scale-[1.02]"
                style={{ borderColor: theme.border, background: theme.cardBg }}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold px-2 py-0.5 rounded text-amber-500 bg-amber-500/10 border border-amber-500/20">
                    {format(new Date(b.scheduled_at), "dd/MM HH:mm")}
                  </span>
                  <span className="text-xs font-semibold" style={{ color: theme.textSecondary }}>
                    {b.professional?.name}
                  </span>
                </div>
                <p className="font-semibold text-sm truncate" style={{ color: theme.textPrimary }}>
                  {b.customer?.name || "Cliente sem nome"}
                </p>
                <p className="text-xs truncate" style={{ color: theme.textMuted }}>
                  {b.service?.name}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

