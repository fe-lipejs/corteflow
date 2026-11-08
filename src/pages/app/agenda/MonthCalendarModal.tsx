import { useState, useMemo, useEffect, useRef } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  startOfDay,
} from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  X,
  Lock,
  Unlock,
  Check,
  Loader2,
  SlidersHorizontal,
  AlertTriangle,
  ListChecks,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '../../../contexts/ThemeContext';
import { type Booking } from '../../../hooks/useBookings';
import { supabase } from '../../../integrations/supabase/client';
import {
  type NormalizedBlock,
  useTenantBlocksInRange,
  isDayPartiallyOrFullyBlocked,
  useManageBlockedTimes,
} from '../../../hooks/useBlockedTimes';
import toast from 'react-hot-toast';

interface Props {
  tenantId: string;
  currentDay: Date;
  selectedProfessionalId?: string | null;
  proScopeId?: string;
  targetProIds: string[];
  businessHours: any[];
  knownBookings: Booking[];
  knownBlocks: NormalizedBlock[];
  isTogglingDayBlock?: boolean;
  onSelectDay: (day: Date) => void;
  onQuickToggleFullDay?: (day: Date, currentlyBlocked: boolean) => void | Promise<void>;
  onOpenBlockManager?: (day: Date) => void;
  onOpenBlockedOverview?: () => void;
  onClose: () => void;
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function MonthCalendarModal({
  tenantId,
  currentDay,
  selectedProfessionalId,
  proScopeId,
  targetProIds,
  businessHours,
  knownBookings,
  knownBlocks,
  isTogglingDayBlock = false,
  onSelectDay,
  onQuickToggleFullDay,
  onOpenBlockManager,
  onOpenBlockedOverview,
  onClose,
}: Props) {
  const { theme } = useTheme();
  const { saveMultiDaysToggle } = useManageBlockedTimes(tenantId);

  const [viewMonth, setViewMonth] = useState<Date>(() => startOfMonth(currentDay));
  const [inspectedDay, setInspectedDay] = useState<Date>(() => startOfDay(currentDay));

  // Modo dedicado "Bloquear Dias" (design de cards verticais interativos + botão Voltar e Salvar)
  const [isBlockDaysScreen, setIsBlockDaysScreen] = useState(false);

  // Mapa local de dias bloqueados (key: 'yyyy-MM-dd' -> boolean) na tela "Bloquear Dias"
  const [localDaysBlockedMap, setLocalDaysBlockedMap] = useState<Record<string, boolean>>({});
  const [conflictWarning, setConflictWarning] = useState<{
    conflictingBookings: Booking[];
    onProceed: () => Promise<void>;
  } | null>(null);

  // Suporte a toque e arraste pelos cards de dias
  const isDraggingDayRef = useRef(false);
  const dragDayIntentRef = useRef<boolean>(true);

  const gridStart = useMemo(
    () => startOfWeek(startOfMonth(viewMonth), { weekStartsOn: 0 }),
    [viewMonth]
  );
  const gridEnd = useMemo(
    () => endOfWeek(endOfMonth(viewMonth), { weekStartsOn: 0 }),
    [viewMonth]
  );

  // Dias apenas do mês atual para a tela "Bloquear Dias"
  const monthOnlyDays = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfMonth(viewMonth),
        end: endOfMonth(viewMonth),
      }),
    [viewMonth]
  );

  // Busca todos os agendamentos e bloqueios do mês visível
  const { data: monthBookings = [] } = useQuery({
    queryKey: [
      'bookings_month_overview',
      tenantId,
      format(gridStart, 'yyyy-MM-dd'),
      format(gridEnd, 'yyyy-MM-dd'),
      proScopeId ?? 'all',
    ],
    enabled: !!tenantId,
    queryFn: async () => {
      let q = supabase
        .from('bookings')
        .select('*')
        .eq('tenant_id', tenantId)
        .gte('scheduled_at', gridStart.toISOString())
        .lte('scheduled_at', gridEnd.toISOString())
        .not('status', 'in', '(canceled,no_show)');
      if (proScopeId) {
        q = q.eq('professional_id', proScopeId);
      }
      const { data } = await q;
      return (data ?? []) as unknown as Booking[];
    },
  });

  const { data: monthBlocks = [] } = useTenantBlocksInRange(
    tenantId || null,
    gridStart,
    gridEnd
  );

  const mergedBookings = useMemo(() => {
    const map = new Map<string, Booking>();
    for (const b of knownBookings) map.set(b.id, b);
    for (const b of monthBookings) map.set(b.id, b);
    return Array.from(map.values()).filter((b) => {
      if (b.status === 'canceled' || b.status === 'no_show') return false;
      if (selectedProfessionalId && b.professional_id !== selectedProfessionalId) return false;
      return true;
    });
  }, [knownBookings, monthBookings, selectedProfessionalId]);

  const mergedBlocks = useMemo(() => {
    const map = new Map<string, NormalizedBlock>();
    for (const b of knownBlocks) map.set(`${b.source}-${b.id}`, b);
    for (const b of monthBlocks) map.set(`${b.source}-${b.id}`, b);
    return Array.from(map.values());
  }, [knownBlocks, monthBlocks]);

  const daysInGrid = useMemo(
    () => eachDayOfInterval({ start: gridStart, end: gridEnd }),
    [gridStart, gridEnd]
  );

  const getScheduleForDay = (d: Date) => {
    const bh = businessHours.find((x: any) => x.weekday === d.getDay());
    return {
      isOpen: bh ? bh.is_open !== false : true,
      openTime: bh?.open_time ? String(bh.open_time).slice(0, 5) : '08:00',
      closeTime: bh?.close_time ? String(bh.close_time).slice(0, 5) : '20:00',
    };
  };

  // Estado vindo do banco para cada dia do mês visível
  const dbMonthBlockedMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const d of monthOnlyDays) {
      const key = format(d, 'yyyy-MM-dd');
      const sched = getScheduleForDay(d);
      const info = isDayPartiallyOrFullyBlocked(
        d,
        mergedBlocks,
        targetProIds,
        sched.openTime,
        sched.closeTime
      );
      map[key] = info.isFullyBlocked;
    }
    return map;
  }, [monthOnlyDays, mergedBlocks, targetProIds, businessHours]);

  // Sincroniza estado local quando muda o mês ou atualiza o banco
  useEffect(() => {
    setLocalDaysBlockedMap(dbMonthBlockedMap);
    setConflictWarning(null);
  }, [dbMonthBlockedMap]);

  useEffect(() => {
    const stopDrag = () => {
      isDraggingDayRef.current = false;
    };
    window.addEventListener('mouseup', stopDrag);
    window.addEventListener('touchend', stopDrag);
    return () => {
      window.removeEventListener('mouseup', stopDrag);
      window.removeEventListener('touchend', stopDrag);
    };
  }, []);

  const inspectedSchedule = useMemo(
    () => getScheduleForDay(inspectedDay),
    [inspectedDay, businessHours]
  );

  const inspectedBlockInfo = useMemo(
    () =>
      isDayPartiallyOrFullyBlocked(
        inspectedDay,
        mergedBlocks,
        targetProIds,
        inspectedSchedule.openTime,
        inspectedSchedule.closeTime
      ),
    [inspectedDay, mergedBlocks, targetProIds, inspectedSchedule]
  );

  const inspectedBookings = useMemo(
    () =>
      mergedBookings
        .filter((b) => isSameDay(new Date(b.scheduled_at), inspectedDay))
        .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()),
    [mergedBookings, inspectedDay]
  );

  // Calcula quantos dias foram alterados na tela "Bloquear Dias"
  const changedDaysSummary = useMemo(() => {
    const daysToBlock: Date[] = [];
    const daysToUnblock: Date[] = [];

    for (const d of monthOnlyDays) {
      const key = format(d, 'yyyy-MM-dd');
      const wasBlocked = !!dbMonthBlockedMap[key];
      const nowBlocked = !!localDaysBlockedMap[key];
      if (nowBlocked !== wasBlocked) {
        if (nowBlocked) daysToBlock.push(d);
        else daysToUnblock.push(d);
      }
    }

    return {
      daysToBlock,
      daysToUnblock,
      totalChanges: daysToBlock.length + daysToUnblock.length,
    };
  }, [monthOnlyDays, dbMonthBlockedMap, localDaysBlockedMap]);

  const handleDayCardStart = (dateKey: string) => {
    setConflictWarning(null);
    isDraggingDayRef.current = true;
    const currentVal = !!localDaysBlockedMap[dateKey];
    const nextVal = !currentVal;
    dragDayIntentRef.current = nextVal;
    setLocalDaysBlockedMap((prev) => ({
      ...prev,
      [dateKey]: nextVal,
    }));
  };

  const handleDayCardEnter = (dateKey: string) => {
    if (!isDraggingDayRef.current) return;
    const targetVal = dragDayIntentRef.current;
    setLocalDaysBlockedMap((prev) => {
      if (prev[dateKey] === targetVal) return prev;
      return {
        ...prev,
        [dateKey]: targetVal,
      };
    });
  };

  const handleTouchMoveDaysGrid = (e: React.TouchEvent) => {
    if (!isDraggingDayRef.current) return;
    const touch = e.touches[0];
    if (!touch) return;
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!el) return;
    const card = el.closest('[data-day-key]') as HTMLElement | null;
    if (!card) return;
    const key = card.getAttribute('data-day-key');
    if (key) handleDayCardEnter(key);
  };

  const executeSaveDaysChanges = async () => {
    const { daysToBlock, daysToUnblock, totalChanges } = changedDaysSummary;
    if (totalChanges === 0) {
      setIsBlockDaysScreen(false);
      return;
    }

    await saveMultiDaysToggle.mutateAsync({
      daysToBlock,
      daysToUnblock,
      targetProIds,
    });

    setConflictWarning(null);
    setIsBlockDaysScreen(false);
    toast.success('Disponibilidade dos dias salva!');
  };

  const handleSaveBlockDaysScreen = async () => {
    const { daysToBlock, totalChanges } = changedDaysSummary;
    if (totalChanges === 0) {
      setIsBlockDaysScreen(false);
      return;
    }

    if (daysToBlock.length > 0) {
      const conflicts = mergedBookings.filter((b) => {
        const bDate = new Date(b.scheduled_at);
        return daysToBlock.some((d) => isSameDay(d, bDate));
      });

      if (conflicts.length > 0) {
        setConflictWarning({
          conflictingBookings: conflicts,
          onProceed: executeSaveDaysChanges,
        });
        return;
      }
    }

    await executeSaveDaysChanges();
  };

  const isSaving = saveMultiDaysToggle.isPending;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg rounded-t-[28px] sm:rounded-[28px] border shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        style={{
          backgroundColor: isBlockDaysScreen ? theme.bg : theme.cardBg,
          borderColor: theme.border,
          color: theme.textPrimary,
        }}
      >
        {isBlockDaysScreen ? (
          /* ══════════════════════════════════════════════════════════════════════
             TELA DEDICADA: BLOQUEAR / LIBERAR DIAS (DESIGN DE CARDS DIFERENCIADO)
             ══════════════════════════════════════════════════════════════════════ */
          <>
            {/* Header da Tela Bloquear Dias com Botão de Retorno */}
            <div
              className="px-5 pt-5 pb-4 border-b flex flex-col gap-3 shrink-0"
              style={{ borderColor: theme.border, backgroundColor: theme.cardBg }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <button
                    type="button"
                    onClick={() => {
                      setIsBlockDaysScreen(false);
                      setLocalDaysBlockedMap(dbMonthBlockedMap);
                      setConflictWarning(null);
                    }}
                    className="w-9 h-9 rounded-full border flex items-center justify-center shrink-0 transition-all active:scale-95 cursor-pointer"
                    style={{
                      borderColor: theme.border,
                      backgroundColor: theme.bg,
                      color: theme.textPrimary,
                    }}
                    title="Voltar ao calendário"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>

                  <div className="min-w-0">
                    <h3 className="text-base sm:text-lg font-extrabold tracking-tight truncate">
                      Bloquear Dias
                    </h3>
                    <p className="text-xs font-medium truncate" style={{ color: theme.textSecondary }}>
                      Toque ou arraste sobre os dias para bloquear ou liberar
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-opacity hover:opacity-75 cursor-pointer"
                  style={{ color: theme.textSecondary }}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Barra de Navegação do Mês + Atalho Ver Bloqueios */}
              <div className="flex items-center justify-between gap-2 pt-0.5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setViewMonth((m) => subMonths(m, 1))}
                    className="w-8 h-8 rounded-xl border flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                    style={{ borderColor: theme.border, backgroundColor: theme.bg }}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm font-extrabold capitalize px-1">
                    {format(viewMonth, 'MMMM yyyy', { locale: ptBR })}
                  </span>
                  <button
                    type="button"
                    onClick={() => setViewMonth((m) => addMonths(m, 1))}
                    className="w-8 h-8 rounded-xl border flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                    style={{ borderColor: theme.border, backgroundColor: theme.bg }}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {onOpenBlockedOverview && (
                  <button
                    type="button"
                    onClick={onOpenBlockedOverview}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                    style={{
                      borderColor: theme.border,
                      backgroundColor: theme.bg,
                      color: theme.textPrimary,
                    }}
                  >
                    <ListChecks className="w-3.5 h-3.5" style={{ color: theme.accent }} />
                    <span>Ver bloqueios</span>
                  </button>
                )}
              </div>
            </div>

            {/* Aviso de Conflito */}
            {conflictWarning && (
              <div
                className="mx-5 mt-4 p-3.5 rounded-2xl border flex flex-col gap-2.5 animate-in fade-in"
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  borderColor: 'rgba(239, 68, 68, 0.35)',
                }}
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-[#EF4444] shrink-0 mt-0.5" />
                  <p className="text-xs leading-relaxed" style={{ color: theme.textPrimary }}>
                    Existem <strong>{conflictWarning.conflictingBookings.length} agendamento(s)</strong> nos dias selecionados. Eles <strong>não serão apagados</strong>, apenas novas reservas ficarão bloqueadas.
                  </p>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setConflictWarning(null)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer"
                    style={{
                      borderColor: theme.border,
                      backgroundColor: theme.cardBg,
                      color: theme.textSecondary,
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={conflictWarning.onProceed}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5"
                    style={{
                      background: theme.accentGradient || theme.accent,
                      color: theme.btnPrimaryText,
                    }}
                  >
                    {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Salvar mesmo assim</span>
                  </button>
                </div>
              </div>
            )}

            {/* Grade de Cards Verticais de Dias (Visual Estilo img2 — Diferenciado do Calendário) */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5">
              <div
                className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 sm:gap-3 select-none touch-none"
                onTouchMove={handleTouchMoveDaysGrid}
                onMouseLeave={() => {
                  isDraggingDayRef.current = false;
                }}
              >
                {monthOnlyDays.map((day) => {
                  const dateKey = format(day, 'yyyy-MM-dd');
                  const isBlocked = !!localDaysBlockedMap[dateKey];
                  const sched = getScheduleForDay(day);
                  const isClosed = !sched.isOpen;
                  const hasBookings = mergedBookings.some((b) =>
                    isSameDay(new Date(b.scheduled_at), day)
                  );

                  return (
                    <button
                      key={dateKey}
                      type="button"
                      data-day-key={dateKey}
                      onMouseDown={() => handleDayCardStart(dateKey)}
                      onMouseEnter={() => handleDayCardEnter(dateKey)}
                      onMouseUp={() => {
                        isDraggingDayRef.current = false;
                      }}
                      onTouchStart={(e) => {
                        e.preventDefault();
                        handleDayCardStart(dateKey);
                      }}
                      className={`py-3.5 px-2.5 rounded-2xl border flex flex-col items-center justify-center transition-all relative cursor-pointer select-none ${
                        isClosed && !isBlocked ? 'opacity-45' : ''
                      }`}
                      style={{
                        borderColor: isBlocked ? theme.accent : theme.border,
                        backgroundColor: isBlocked
                          ? `color-mix(in srgb, ${theme.accent} 14%, ${theme.cardBg})`
                          : theme.cardBg,
                        color: isBlocked ? theme.accent : theme.textPrimary,
                        boxShadow: isBlocked ? 'none' : '0 1px 4px rgba(0,0,0,0.04)',
                      }}
                    >
                      {hasBookings && (
                        <span
                          className="w-1.5 h-1.5 rounded-full absolute top-2.5 right-2.5"
                          style={{ backgroundColor: theme.accent }}
                          title="Possui agendamentos"
                        />
                      )}

                      <span
                        className="text-[10px] font-bold uppercase tracking-wider"
                        style={{ color: isBlocked ? theme.accent : theme.textSecondary }}
                      >
                        {isToday(day) ? 'Hoje' : WEEKDAYS[day.getDay()]}
                      </span>

                      <span className="text-xl font-black leading-none my-1 tabular-nums">
                        {format(day, 'dd')}
                      </span>

                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-bold mt-0.5"
                        style={{ color: isBlocked ? theme.accent : theme.textSecondary }}
                      >
                        {isBlocked ? (
                          <>
                            <Lock className="w-2.5 h-2.5" />
                            <span>Bloqueado</span>
                          </>
                        ) : isClosed ? (
                          <span>Fechado</span>
                        ) : (
                          <span>Livre</span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Rodapé da Tela Bloquear Dias: Botão Voltar + Botão Salvar */}
            <div
              className="px-5 py-3.5 border-t flex items-center justify-between gap-3 shrink-0"
              style={{ borderColor: theme.border, backgroundColor: theme.cardBg }}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  type="button"
                  onClick={() => {
                    setIsBlockDaysScreen(false);
                    setLocalDaysBlockedMap(dbMonthBlockedMap);
                    setConflictWarning(null);
                  }}
                  className="px-3.5 py-2.5 rounded-xl text-xs font-bold border transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer shrink-0"
                  style={{
                    borderColor: theme.border,
                    backgroundColor: theme.bg,
                    color: theme.textPrimary,
                  }}
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Voltar</span>
                </button>

                <span className="text-xs font-semibold truncate hidden xs:inline" style={{ color: theme.textSecondary }}>
                  {changedDaysSummary.totalChanges === 0
                    ? 'Toque nos dias para alterar'
                    : `${changedDaysSummary.totalChanges} dia(s) alterado(s)`}
                </span>
              </div>

              <button
                type="button"
                disabled={isSaving}
                onClick={handleSaveBlockDaysScreen}
                className="px-5 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer shrink-0"
                style={{
                  background: theme.accentGradient || theme.accent,
                  color: theme.btnPrimaryText,
                  boxShadow: theme.shadowAccent,
                }}
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4 stroke-[2.5]" />
                )}
                <span>Salvar</span>
              </button>
            </div>
          </>
        ) : (
          /* ══════════════════════════════════════════════════════════════════════
             VISÃO GERAL DO CALENDÁRIO MENSAL
             ══════════════════════════════════════════════════════════════════════ */
          <>
            {/* Header Clean do Mês */}
            <div className="px-5 pt-5 pb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setViewMonth((m) => subMonths(m, 1))}
                  className="w-9 h-9 rounded-full flex items-center justify-center border transition-all active:scale-95 cursor-pointer"
                  style={{
                    borderColor: theme.border,
                    backgroundColor: theme.bg,
                    color: theme.textPrimary,
                  }}
                  title="Mês anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <h3 className="text-lg font-extrabold capitalize tracking-tight px-1">
                  {format(viewMonth, 'MMMM yyyy', { locale: ptBR })}
                </h3>

                <button
                  type="button"
                  onClick={() => setViewMonth((m) => addMonths(m, 1))}
                  className="w-9 h-9 rounded-full flex items-center justify-center border transition-all active:scale-95 cursor-pointer"
                  style={{
                    borderColor: theme.border,
                    backgroundColor: theme.bg,
                    color: theme.textPrimary,
                  }}
                  title="Próximo mês"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                {onOpenBlockedOverview && (
                  <button
                    type="button"
                    onClick={onOpenBlockedOverview}
                    className="px-2.5 py-1.5 rounded-full text-[11px] font-bold border flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                    style={{
                      borderColor: theme.border,
                      backgroundColor: theme.bg,
                      color: theme.textPrimary,
                    }}
                    title="Visualizar dias e horários bloqueados"
                  >
                    <ListChecks className="w-3.5 h-3.5" style={{ color: theme.accent }} />
                    <span>Bloqueios</span>
                  </button>
                )}

                {!isToday(inspectedDay) && (
                  <button
                    type="button"
                    onClick={() => {
                      const now = startOfDay(new Date());
                      setViewMonth(startOfMonth(now));
                      setInspectedDay(now);
                    }}
                    className="px-3 py-1.5 rounded-full text-[11px] font-bold transition-all active:scale-95 cursor-pointer"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${theme.accent} 15%, transparent)`,
                      color: theme.accent,
                    }}
                  >
                    Hoje
                  </button>
                )}

                <button
                  type="button"
                  onClick={onClose}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-opacity hover:opacity-75 cursor-pointer"
                  style={{ color: theme.textSecondary }}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Segmented Control Estilo iOS: Alternar entre Calendário e Bloquear Vários Dias */}
            <div className="px-5 pb-3">
              <div
                className="grid grid-cols-2 p-1 rounded-2xl border"
                style={{ borderColor: theme.border, backgroundColor: theme.bg }}
              >
                <button
                  type="button"
                  className="py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  style={{
                    backgroundColor: theme.cardBg,
                    color: theme.textPrimary,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  }}
                >
                  <span>Calendário</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLocalDaysBlockedMap({ ...dbMonthBlockedMap });
                    setIsBlockDaysScreen(true);
                  }}
                  className="py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 opacity-75 hover:opacity-100"
                  style={{ color: theme.textSecondary }}
                >
                  <Lock className="w-3 h-3" style={{ color: theme.accent }} />
                  <span>Bloquear vários dias</span>
                </button>
              </div>
            </div>

            {/* Cabeçalho dos Dias da Semana */}
            <div className="grid grid-cols-7 px-4 pb-2 text-center">
              {WEEKDAYS.map((w) => (
                <span
                  key={w}
                  className="text-[10px] font-bold uppercase tracking-wider opacity-60"
                  style={{ color: theme.textSecondary }}
                >
                  {w}
                </span>
              ))}
            </div>

            {/* Grade Mensal de Cards de Dia */}
            <div className="grid grid-cols-7 gap-1.5 px-4 pb-4">
              {daysInGrid.map((day) => {
                const inCurrentMonth = isSameMonth(day, viewMonth);
                const isSelected = isSameDay(day, inspectedDay);
                const today = isToday(day);
                const sched = getScheduleForDay(day);
                const blockInfo = isDayPartiallyOrFullyBlocked(
                  day,
                  mergedBlocks,
                  targetProIds,
                  sched.openTime,
                  sched.closeTime
                );
                const dayBks = mergedBookings.filter((b) =>
                  isSameDay(new Date(b.scheduled_at), day)
                );
                const hasBookings = dayBks.length > 0;
                const isClosedDay = !sched.isOpen;

                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => setInspectedDay(day)}
                    onDoubleClick={() => {
                      onSelectDay(day);
                      onClose();
                    }}
                    className={`relative h-12 rounded-2xl flex flex-col items-center justify-center transition-all active:scale-95 cursor-pointer border ${
                      !inCurrentMonth ? 'opacity-30' : ''
                    }`}
                    style={{
                      backgroundColor: isSelected
                        ? theme.accent
                        : blockInfo.isFullyBlocked
                          ? `color-mix(in srgb, ${theme.accent} 10%, ${theme.bg})`
                          : today
                            ? `color-mix(in srgb, ${theme.accent} 12%, ${theme.cardBg})`
                            : theme.bg,
                      borderColor: isSelected
                        ? theme.accent
                        : blockInfo.isFullyBlocked
                          ? `color-mix(in srgb, ${theme.accent} 40%, transparent)`
                          : today
                            ? theme.accent
                            : theme.border,
                      color: isSelected ? theme.btnPrimaryText : theme.textPrimary,
                      boxShadow: isSelected ? `0 4px 14px ${theme.accent}40` : 'none',
                    }}
                  >
                    {blockInfo.isFullyBlocked && (
                      <Lock
                        className="w-2.5 h-2.5 absolute top-1 right-1"
                        style={{ color: isSelected ? theme.btnPrimaryText : theme.accent }}
                      />
                    )}

                    <span
                      className={`text-sm font-extrabold leading-none tabular-nums ${
                        isClosedDay && !isSelected ? 'opacity-40 line-through' : ''
                      }`}
                    >
                      {format(day, 'dd')}
                    </span>

                    <div className="flex items-center gap-1 mt-1 h-1.5">
                      {hasBookings && (
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{
                            backgroundColor: isSelected ? theme.btnPrimaryText : theme.accent,
                          }}
                        />
                      )}
                      {!blockInfo.isFullyBlocked && blockInfo.isPartiallyBlocked && (
                        <span
                          className="w-1.5 h-1.5 rounded-full opacity-60"
                          style={{
                            backgroundColor: isSelected ? theme.btnPrimaryText : theme.textSecondary,
                          }}
                        />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Legenda Minimalista */}
            <div
              className="px-5 py-2.5 border-t flex items-center justify-center gap-5 text-[11px] font-semibold"
              style={{ borderColor: theme.border, color: theme.textSecondary }}
            >
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: theme.accent }} />
                Com agendamento
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Lock className="w-3 h-3" style={{ color: theme.accent }} />
                Dia bloqueado
              </span>
            </div>

            {/* Rodapé da Visão Geral do Mês */}
            <div
              className="p-4 border-t space-y-3"
              style={{ borderColor: theme.border, backgroundColor: theme.bg }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-extrabold capitalize truncate" style={{ color: theme.textPrimary }}>
                    {format(inspectedDay, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                  </p>
                  <p className="text-[11px] font-medium truncate" style={{ color: theme.textSecondary }}>
                    {inspectedBlockInfo.isFullyBlocked
                      ? 'Dia inteiro bloqueado'
                      : !inspectedSchedule.isOpen
                        ? 'Fechado no horário padrão'
                        : inspectedBookings.length === 0
                          ? 'Dia livre · Nenhum agendamento'
                          : `${inspectedBookings.length} ${
                              inspectedBookings.length === 1 ? 'agendamento marcado' : 'agendamentos marcados'
                            }`}
                  </p>
                </div>

                {onQuickToggleFullDay && (
                  <button
                    type="button"
                    disabled={isTogglingDayBlock}
                    onClick={() => onQuickToggleFullDay(inspectedDay, inspectedBlockInfo.isFullyBlocked)}
                    className="px-3 py-2 rounded-xl text-xs font-bold border transition-all active:scale-95 flex items-center gap-1.5 shrink-0 cursor-pointer"
                    style={{
                      backgroundColor: inspectedBlockInfo.isFullyBlocked
                        ? `color-mix(in srgb, ${theme.accent} 16%, transparent)`
                        : theme.cardBg,
                      borderColor: inspectedBlockInfo.isFullyBlocked ? theme.accent : theme.border,
                      color: inspectedBlockInfo.isFullyBlocked ? theme.accent : theme.textPrimary,
                    }}
                  >
                    {isTogglingDayBlock ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : inspectedBlockInfo.isFullyBlocked ? (
                      <>
                        <Unlock className="w-3.5 h-3.5" />
                        <span>Liberar dia</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5" style={{ color: theme.accent }} />
                        <span>Bloquear dia</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {onOpenBlockManager && (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectDay(inspectedDay);
                      onClose();
                      onOpenBlockManager(inspectedDay);
                    }}
                    className="flex-1 py-2.5 px-3 rounded-xl text-xs font-bold border transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                    style={{
                      backgroundColor: theme.cardBg,
                      borderColor: theme.border,
                      color: theme.textPrimary,
                    }}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" style={{ color: theme.accent }} />
                    <span>Horários</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    onSelectDay(inspectedDay);
                    onClose();
                  }}
                  className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                  style={{
                    background: theme.accentGradient || theme.accent,
                    color: theme.btnPrimaryText,
                    boxShadow: theme.shadowAccent,
                  }}
                >
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Ver este dia</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
