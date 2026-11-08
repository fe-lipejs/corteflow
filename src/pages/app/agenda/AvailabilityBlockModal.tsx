import { useState, useMemo, useEffect, useRef } from 'react';
import {
  format,
  addDays,
  startOfDay,
  endOfDay,
  isSameDay,
  isToday,
  isBefore,
  addMinutes,
} from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import {
  X,
  Lock,
  Unlock,
  Calendar as CalendarIcon,
  Clock,
  Check,
  AlertTriangle,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Loader2,
  User,
  Sparkles,
} from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext';
import { type Booking } from '../../../hooks/useBookings';
import {
  type NormalizedBlock,
  type TimeRange,
  buildDayTimeSlots,
  isSlotBlockedForTarget,
  isDayFullyBlocked,
  useManageBlockedTimes,
} from '../../../hooks/useBlockedTimes';
import toast from 'react-hot-toast';

interface BusinessHour {
  weekday: number;
  is_open: boolean;
  open_time: string;
  close_time: string;
  lunch_start?: string | null;
  lunch_end?: string | null;
}

interface Props {
  tenantId: string;
  initialDate: Date;
  professionals: any[];
  selectedProfessionalId: string | null;
  canSeeAll: boolean;
  businessHours: BusinessHour[];
  blocks: NormalizedBlock[];
  bookings: Booking[];
  onClose: () => void;
  onDateChange?: (d: Date) => void;
}

type ModeTab = 'slots' | 'days';

interface UndoSnapshot {
  date: Date;
  targetProIds: string[];
  blockedSlotIndices: number[];
  description: string;
}

export default function AvailabilityBlockModal({
  tenantId,
  initialDate,
  professionals,
  selectedProfessionalId,
  canSeeAll,
  businessHours,
  blocks,
  bookings,
  onClose,
  onDateChange,
}: Props) {
  const { theme } = useTheme();
  const { saveDayBlocks, batchDaysBlock } = useManageBlockedTimes(tenantId);

  const [activeTab, setActiveTab] = useState<ModeTab>('slots');
  const [activeDate, setActiveDate] = useState<Date>(() => startOfDay(initialDate));
  const [targetProId, setTargetProId] = useState<string | 'all'>(() =>
    selectedProfessionalId ? selectedProfessionalId : canSeeAll ? 'all' : professionals[0]?.id ?? 'all'
  );

  // Profissionais alvo da operação
  const targetProIds = useMemo(() => {
    if (targetProId === 'all') {
      return professionals.map((p) => p.id);
    }
    return [targetProId];
  }, [targetProId, professionals]);

  // Expediente do dia selecionado
  const daySchedule = useMemo(() => {
    const weekday = activeDate.getDay();
    const bh = businessHours.find((b) => b.weekday === weekday);
    return {
      isOpen: bh ? bh.is_open !== false : true,
      openTime: bh?.open_time ? bh.open_time.slice(0, 5) : '08:00',
      closeTime: bh?.close_time ? bh.close_time.slice(0, 5) : '20:00',
      lunchStart: bh?.lunch_start ? bh.lunch_start.slice(0, 5) : null,
      lunchEnd: bh?.lunch_end ? bh.lunch_end.slice(0, 5) : null,
    };
  }, [activeDate, businessHours]);

  // Slots de 30 min do dia ativo
  const daySlots = useMemo(
    () => buildDayTimeSlots(activeDate, daySchedule.openTime, daySchedule.closeTime, 30),
    [activeDate, daySchedule.openTime, daySchedule.closeTime]
  );

  // Agendamentos ativos (não cancelados) do dia selecionado para os profissionais alvo
  const dayActiveBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (b.status === 'canceled' || b.status === 'no_show') return false;
      if (targetProId !== 'all' && b.professional_id !== targetProId) return false;
      return isSameDay(new Date(b.scheduled_at), activeDate);
    });
  }, [bookings, activeDate, targetProId]);

  // Mapa de qual agendamento ocupa cada slot
  const slotBookingsMap = useMemo(() => {
    const map = new Map<number, Booking[]>();
    daySlots.forEach((slot, idx) => {
      const overlapping = dayActiveBookings.filter((b) => {
        const bStart = new Date(b.scheduled_at);
        const dur = Number(b.duration_minutes) || Number(b.service?.duration_minutes) || 30;
        const bEnd = addMinutes(bStart, dur);
        return slot.start < bEnd && bStart < slot.end;
      });
      if (overlapping.length > 0) {
        map.set(idx, overlapping);
      }
    });
    return map;
  }, [daySlots, dayActiveBookings]);

  // Estado inicial de slots bloqueados vindo do banco
  const dbBlockedIndices = useMemo(() => {
    const set = new Set<number>();
    daySlots.forEach((slot, idx) => {
      if (isSlotBlockedForTarget(slot.start, slot.end, blocks, targetProIds)) {
        set.add(idx);
      }
    });
    return set;
  }, [daySlots, blocks, targetProIds]);

  // Estado interativo local dos slots bloqueados (para resposta visual imediata a 60fps durante arraste)
  const [localBlockedSet, setLocalBlockedSet] = useState<Set<number>>(() => new Set(dbBlockedIndices));
  const [isDirty, setIsDirty] = useState(false);

  // Sincroniza quando muda data, profissional ou dados do banco
  useEffect(() => {
    setLocalBlockedSet(new Set(dbBlockedIndices));
    setIsDirty(false);
    setConflictWarning(null);
  }, [dbBlockedIndices, activeDate, targetProId]);

  // Controle de Arraste (Touch & Mouse)
  const isDraggingRef = useRef(false);
  const dragIntentRef = useRef<'block' | 'unblock'>('block');
  const dragStartIndexRef = useRef<number | null>(null);
  const preDragSnapshotRef = useRef<Set<number>>(new Set());

  // Undo state
  const [undoSnapshot, setUndoSnapshot] = useState<UndoSnapshot | null>(null);

  // Aviso de conflito quando o período bloqueado tem agendamentos confirmados
  const [conflictWarning, setConflictWarning] = useState<{
    conflictingBookings: Booking[];
    onProceed: () => Promise<void>;
    actionLabel: string;
  } | null>(null);

  // Seleção de múltiplos dias (Tab "Bloquear Dias")
  const [multiDaysOffset, setMultiDaysOffset] = useState(0);
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);

  const stripDays = useMemo(
    () => Array.from({ length: 14 }, (_, i) => addDays(startOfDay(new Date()), i)),
    []
  );

  const calendarDays = useMemo(() => {
    const base = addDays(startOfDay(new Date()), multiDaysOffset * 28);
    return Array.from({ length: 28 }, (_, i) => addDays(base, i));
  }, [multiDaysOffset]);

  // Verifica se todos os slots do dia estão bloqueados localmente
  const isAllDayBlockedLocal = daySlots.length > 0 && localBlockedSet.size === daySlots.length;
  const isPartiallyBlockedLocal = localBlockedSet.size > 0 && localBlockedSet.size < daySlots.length;

  // Inicia interação em um slot (clique ou início de arraste)
  const handleSlotDragStart = (idx: number) => {
    isDraggingRef.current = true;
    dragStartIndexRef.current = idx;
    preDragSnapshotRef.current = new Set(localBlockedSet);

    const currentlyBlocked = localBlockedSet.has(idx);
    const intent: 'block' | 'unblock' = currentlyBlocked ? 'unblock' : 'block';
    dragIntentRef.current = intent;

    const next = new Set(localBlockedSet);
    if (intent === 'block') next.add(idx);
    else next.delete(idx);

    setLocalBlockedSet(next);
    setIsDirty(true);
    setConflictWarning(null);
  };

  // Atualiza seleção conforme o dedo ou mouse desliza sobre os slots
  const handleSlotDragEnter = (currentIdx: number) => {
    if (!isDraggingRef.current || dragStartIndexRef.current === null) return;

    const startIdx = Math.min(dragStartIndexRef.current, currentIdx);
    const endIdx = Math.max(dragStartIndexRef.current, currentIdx);
    const intent = dragIntentRef.current;

    const next = new Set(preDragSnapshotRef.current);
    for (let i = startIdx; i <= endIdx; i++) {
      if (intent === 'block') next.add(i);
      else next.delete(i);
    }

    setLocalBlockedSet(next);
    setIsDirty(true);
  };

  const handleSlotDragEnd = () => {
    isDraggingRef.current = false;
    dragStartIndexRef.current = null;
  };

  useEffect(() => {
    const onWindowUp = () => {
      isDraggingRef.current = false;
      dragStartIndexRef.current = null;
    };
    window.addEventListener('mouseup', onWindowUp);
    window.addEventListener('touchend', onWindowUp);
    return () => {
      window.removeEventListener('mouseup', onWindowUp);
      window.removeEventListener('touchend', onWindowUp);
    };
  }, []);

  // Suporte nativo ao arraste do dedo no celular via elementFromPoint
  const handleTouchMoveGrid = (e: React.TouchEvent) => {
    if (!isDraggingRef.current) return;
    const touch = e.touches[0];
    if (!touch) return;
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!el) return;
    const slotButton = el.closest('[data-slot-idx]') as HTMLElement | null;
    if (!slotButton) return;
    const idxStr = slotButton.getAttribute('data-slot-idx');
    if (idxStr !== null) {
      const idx = parseInt(idxStr, 10);
      if (!Number.isNaN(idx)) {
        handleSlotDragEnter(idx);
      }
    }
  };

  // Executa a persistência dos horários do dia ativo
  const executeSaveDaySlots = async (indicesToSave: Set<number>, isFullDayFlag?: boolean, labelForToast?: string) => {
    const prevIndices = Array.from(dbBlockedIndices);
    const ranges: TimeRange[] = Array.from(indicesToSave)
      .sort((a, b) => a - b)
      .map((i) => daySlots[i])
      .filter(Boolean);

    await saveDayBlocks.mutateAsync({
      date: activeDate,
      targetProIds,
      newBlockedRanges: ranges,
      isFullDay: isFullDayFlag ?? (daySlots.length > 0 && indicesToSave.size === daySlots.length),
    });

    setUndoSnapshot({
      date: activeDate,
      targetProIds: [...targetProIds],
      blockedSlotIndices: prevIndices,
      description: labelForToast || 'Alteração de disponibilidade',
    });

    setIsDirty(false);
    setConflictWarning(null);
    toast.success(labelForToast || 'Disponibilidade atualizada!');
  };

  // Verifica se há agendamentos nos slots que estão sendo bloqueados antes de salvar
  const handleRequestSaveSlots = async (customSet?: Set<number>, isFullDayFlag?: boolean, customLabel?: string) => {
    const targetSet = customSet ?? localBlockedSet;

    // Quais slots passaram a ser bloqueados (ou estão bloqueados) e possuem agendamento ativo?
    const conflictingMap = new Map<string, Booking>();
    targetSet.forEach((idx) => {
      const bks = slotBookingsMap.get(idx);
      if (bks) {
        bks.forEach((b) => conflictingMap.set(b.id, b));
      }
    });

    const conflictingList = Array.from(conflictingMap.values());

    // Mostrar aviso apenas se o usuário estiver bloqueando horários que têm agendamentos e ainda não estavam todos bloqueados
    const hasNewConflict = Array.from(targetSet).some(
      (idx) => !dbBlockedIndices.has(idx) && slotBookingsMap.has(idx)
    );

    if (conflictingList.length > 0 && hasNewConflict) {
      setConflictWarning({
        conflictingBookings: conflictingList,
        actionLabel: isFullDayFlag ? 'Bloquear dia mesmo assim' : 'Confirmar bloqueio',
        onProceed: async () => {
          await executeSaveDaySlots(targetSet, isFullDayFlag, customLabel);
        },
      });
      return;
    }

    await executeSaveDaySlots(targetSet, isFullDayFlag, customLabel);
  };

  // 1-Click: Bloquear / Liberar Dia Inteiro
  const handleToggleFullDayQuick = async () => {
    if (isAllDayBlockedLocal) {
      // Liberar o dia todo imediatamente
      const emptySet = new Set<number>();
      setLocalBlockedSet(emptySet);
      await executeSaveDaySlots(emptySet, false, `Dia ${format(activeDate, 'dd/MM')} liberado!`);
    } else {
      // Bloquear todos os horários do dia
      const allSet = new Set<number>(daySlots.map((_, i) => i));
      setLocalBlockedSet(allSet);
      await handleRequestSaveSlots(
        allSet,
        true,
        `Dia ${format(activeDate, 'dd/MM')} bloqueado!`
      );
    }
  };

  // Atalhos rápidos de período (Manhã, Tarde, Liberar tudo)
  const applyQuickPeriod = (startHour: number, endHour: number) => {
    const next = new Set(localBlockedSet);
    const matchingIndices: number[] = [];

    daySlots.forEach((s, idx) => {
      const h = s.start.getHours() + s.start.getMinutes() / 60;
      if (h >= startHour && h < endHour) {
        matchingIndices.push(idx);
      }
    });

    const allAlreadyBlocked = matchingIndices.every((idx) => next.has(idx));
    matchingIndices.forEach((idx) => {
      if (allAlreadyBlocked) next.delete(idx);
      else next.add(idx);
    });

    setLocalBlockedSet(next);
    setIsDirty(true);
    setConflictWarning(null);
  };

  // Desfazer última alteração
  const handleUndo = async () => {
    if (!undoSnapshot) return;
    const snap = undoSnapshot;
    const slotsForSnapDay = buildDayTimeSlots(snap.date, daySchedule.openTime, daySchedule.closeTime, 30);
    const restoredRanges = snap.blockedSlotIndices.map((i) => slotsForSnapDay[i]).filter(Boolean);

    await saveDayBlocks.mutateAsync({
      date: snap.date,
      targetProIds: snap.targetProIds,
      newBlockedRanges: restoredRanges,
      isFullDay: slotsForSnapDay.length > 0 && snap.blockedSlotIndices.length === slotsForSnapDay.length,
    });

    setUndoSnapshot(null);
    toast.success('Alteração desfeita!');
  };

  // Multi-day toggle
  const toggleSelectMultiDate = (d: Date) => {
    setConflictWarning(null);
    setSelectedDates((prev) => {
      const exists = prev.some((x) => isSameDay(x, d));
      if (exists) return prev.filter((x) => !isSameDay(x, d));
      return [...prev, d];
    });
  };

  const handleBatchMultiDays = async (block: boolean) => {
    if (selectedDates.length === 0) return;

    if (block) {
      // Verificar se há agendamentos em algum dos dias selecionados
      const conflicts = bookings.filter((b) => {
        if (b.status === 'canceled' || b.status === 'no_show') return false;
        if (targetProId !== 'all' && b.professional_id !== targetProId) return false;
        const bDate = new Date(b.scheduled_at);
        return selectedDates.some((d) => isSameDay(d, bDate));
      });

      if (conflicts.length > 0) {
        setConflictWarning({
          conflictingBookings: conflicts,
          actionLabel: `Bloquear ${selectedDates.length} dia(s)`,
          onProceed: async () => {
            await batchDaysBlock.mutateAsync({
              dates: selectedDates,
              targetProIds,
              block: true,
            });
            setSelectedDates([]);
            setConflictWarning(null);
            toast.success(`${selectedDates.length} dia(s) bloqueado(s)!`);
          },
        });
        return;
      }
    }

    await batchDaysBlock.mutateAsync({
      dates: selectedDates,
      targetProIds,
      block,
    });
    const count = selectedDates.length;
    setSelectedDates([]);
    setConflictWarning(null);
    toast.success(block ? `${count} dia(s) bloqueado(s)!` : `${count} dia(s) liberado(s)!`);
  };

  const isSaving = saveDayBlocks.isPending || batchDaysBlock.isPending;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-xl rounded-t-3xl sm:rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[92vh] transition-all"
        style={{
          backgroundColor: theme.cardBg,
          borderColor: theme.border,
          color: theme.textPrimary,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header Padrão Apple ── */}
        <div
          className="px-5 pt-5 pb-4 border-b flex flex-col gap-3.5 shrink-0"
          style={{ borderColor: theme.border }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: `color-mix(in srgb, ${theme.accent} 14%, transparent)`,
                  color: theme.accent,
                }}
              >
                <Lock className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-bold tracking-tight truncate">
                  Controle de Disponibilidade
                </h2>
                <p className="text-xs opacity-70 truncate" style={{ color: theme.textSecondary }}>
                  Toque ou arraste o dedo para bloquear e liberar horários
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {undoSnapshot && (
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all active:scale-95 cursor-pointer"
                  style={{
                    borderColor: `color-mix(in srgb, ${theme.accent} 35%, transparent)`,
                    backgroundColor: `color-mix(in srgb, ${theme.accent} 10%, transparent)`,
                    color: theme.accent,
                  }}
                  title="Desfazer última alteração"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Desfazer</span>
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-white/10 cursor-pointer"
                style={{ color: theme.textSecondary }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Seletor de Modo (Horários do Dia vs Vários Dias) + Filtro de Profissional */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div
              className="grid grid-cols-2 p-1 rounded-2xl border w-full sm:w-auto"
              style={{ backgroundColor: 'var(--theme-bg)', borderColor: theme.border }}
            >
              <button
                type="button"
                onClick={() => {
                  setActiveTab('slots');
                  setConflictWarning(null);
                }}
                className="flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
                style={{
                  backgroundColor: activeTab === 'slots' ? `${theme.accent}20` : 'transparent',
                  color: activeTab === 'slots' ? theme.accent : theme.textSecondary,
                }}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Horários do Dia</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('days');
                  setConflictWarning(null);
                }}
                className="flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
                style={{
                  backgroundColor: activeTab === 'days' ? `${theme.accent}20` : 'transparent',
                  color: activeTab === 'days' ? theme.accent : theme.textSecondary,
                }}
              >
                <CalendarIcon className="w-3.5 h-3.5" />
                <span>Bloquear Dias</span>
              </button>
            </div>

            {professionals.length > 1 && canSeeAll && (
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                <button
                  type="button"
                  onClick={() => setTargetProId('all')}
                  className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold border shrink-0 transition-all cursor-pointer"
                  style={{
                    backgroundColor: targetProId === 'all' ? `${theme.accent}18` : 'var(--theme-bg)',
                    borderColor: targetProId === 'all' ? theme.accent : theme.border,
                    color: targetProId === 'all' ? theme.accent : theme.textSecondary,
                  }}
                >
                  Todo o salão
                </button>
                {professionals.map((p) => {
                  const active = targetProId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setTargetProId(p.id)}
                      className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold border shrink-0 transition-all cursor-pointer"
                      style={{
                        backgroundColor: active ? `${theme.accent}18` : 'var(--theme-bg)',
                        borderColor: active ? theme.accent : theme.border,
                        color: active ? theme.accent : theme.textSecondary,
                      }}
                    >
                      {p.name.split(' ')[0]}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Aviso de Conflito com Agendamentos Existentes ── */}
        {conflictWarning && (
          <div
            className="mx-5 mt-4 p-4 rounded-2xl border flex flex-col gap-3 animate-in fade-in slide-in-from-top-2"
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              borderColor: 'rgba(239, 68, 68, 0.35)',
            }}
          >
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-[#EF4444] shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed">
                <p className="font-bold text-[#EF4444] text-sm">
                  Existem {conflictWarning.conflictingBookings.length} agendamento(s) neste período
                </p>
                <p className="mt-0.5 opacity-90" style={{ color: theme.textPrimary }}>
                  Os agendamentos já confirmados{' '}
                  <strong>não serão apagados nem alterados</strong>. Apenas os horários vagos ficarão
                  bloqueados para novas reservas.
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {conflictWarning.conflictingBookings.slice(0, 4).map((b) => (
                    <span
                      key={b.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold border"
                      style={{
                        backgroundColor: theme.cardBg,
                        borderColor: theme.border,
                        color: theme.textPrimary,
                      }}
                    >
                      {format(new Date(b.scheduled_at), 'HH:mm')} · {b.customer?.name ?? 'Cliente'}
                    </span>
                  ))}
                  {conflictWarning.conflictingBookings.length > 4 && (
                    <span className="text-[11px] opacity-75">
                      +{conflictWarning.conflictingBookings.length - 4} mais
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConflictWarning(null)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold border cursor-pointer"
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
                className="px-4 py-1.5 rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5"
                style={{
                  background: theme.accentGradient || theme.accent,
                  color: theme.btnPrimaryText,
                }}
              >
                {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{conflictWarning.actionLabel}</span>
              </button>
            </div>
          </div>
        )}

        {/* ── Corpo Principal ── */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-5 space-y-4">
          {activeTab === 'slots' ? (
            <>
              {/* Seletor Rápido de Dia (Carrossel Horizontal + Input Date) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider opacity-70" style={{ color: theme.textSecondary }}>
                    {format(activeDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                  </span>
                  <label
                    className="relative inline-flex items-center gap-1 text-xs font-bold cursor-pointer px-2.5 py-1 rounded-xl border"
                    style={{
                      borderColor: theme.border,
                      backgroundColor: 'var(--theme-bg)',
                      color: theme.accent,
                    }}
                  >
                    <CalendarIcon className="w-3.5 h-3.5" />
                    <span>Outra data</span>
                    <input
                      type="date"
                      value={format(activeDate, 'yyyy-MM-dd')}
                      onChange={(e) => {
                        if (!e.target.value) return;
                        const [yy, mm, dd] = e.target.value.split('-').map(Number);
                        const nextD = new Date(yy, mm - 1, dd);
                        setActiveDate(nextD);
                        onDateChange?.(nextD);
                      }}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                  </label>
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {stripDays.map((d) => {
                    const isSel = isSameDay(d, activeDate);
                    const fullBlocked = isDayFullyBlocked(
                      d,
                      blocks,
                      targetProIds,
                      daySchedule.openTime,
                      daySchedule.closeTime
                    );

                    return (
                      <button
                        key={d.toISOString()}
                        type="button"
                        onClick={() => {
                          setActiveDate(d);
                          onDateChange?.(d);
                        }}
                        className="shrink-0 flex flex-col items-center justify-center w-14 py-2 rounded-2xl border transition-all cursor-pointer relative"
                        style={{
                          backgroundColor: isSel
                            ? theme.accent
                            : fullBlocked
                              ? `color-mix(in srgb, ${theme.accent} 10%, transparent)`
                              : 'var(--theme-bg)',
                          borderColor: isSel
                            ? theme.accent
                            : fullBlocked
                              ? `color-mix(in srgb, ${theme.accent} 35%, transparent)`
                              : theme.border,
                          color: isSel ? theme.btnPrimaryText : theme.textPrimary,
                        }}
                      >
                        <span
                          className="text-[9px] font-bold uppercase tracking-wider opacity-75"
                          style={{ color: isSel ? theme.btnPrimaryText : theme.textSecondary }}
                        >
                          {isToday(d) ? 'Hoje' : format(d, 'EEE', { locale: ptBR }).slice(0, 3)}
                        </span>
                        <span className="text-sm font-extrabold tabular-nums leading-tight mt-0.5">
                          {format(d, 'dd')}
                        </span>
                        {fullBlocked && (
                          <Lock
                            className="w-2.5 h-2.5 mt-0.5"
                            style={{ color: isSel ? theme.btnPrimaryText : theme.accent }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Card de Bloqueio de Dia Inteiro em 1 Clique */}
              <div
                className="p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition-all"
                style={{
                  backgroundColor: isAllDayBlockedLocal
                    ? `color-mix(in srgb, ${theme.accent} 12%, transparent)`
                    : 'var(--theme-bg)',
                  borderColor: isAllDayBlockedLocal
                    ? `color-mix(in srgb, ${theme.accent} 40%, transparent)`
                    : theme.border,
                }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: isAllDayBlockedLocal
                        ? theme.accent
                        : `color-mix(in srgb, ${theme.accent} 14%, transparent)`,
                      color: isAllDayBlockedLocal ? theme.btnPrimaryText : theme.accent,
                    }}
                  >
                    {isAllDayBlockedLocal ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate">
                      {isAllDayBlockedLocal
                        ? 'Dia Inteiro Bloqueado'
                        : isPartiallyBlockedLocal
                          ? `${localBlockedSet.size} de ${daySlots.length} horários bloqueados`
                          : 'Dia Disponível para Agendamentos'}
                    </p>
                    <p className="text-[11px] opacity-70 truncate" style={{ color: theme.textSecondary }}>
                      {isAllDayBlockedLocal
                        ? 'Nenhum horário disponível na página pública neste dia'
                        : 'Bloqueie o dia todo com um toque ou selecione horários abaixo'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleToggleFullDayQuick}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 border"
                  style={{
                    background: isAllDayBlockedLocal
                      ? theme.cardBg
                      : theme.accentGradient || theme.accent,
                    borderColor: isAllDayBlockedLocal ? theme.accent : 'transparent',
                    color: isAllDayBlockedLocal ? theme.accent : theme.btnPrimaryText,
                  }}
                >
                  {isSaving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : isAllDayBlockedLocal ? (
                    <>
                      <Unlock className="w-3.5 h-3.5" />
                      <span>Liberar Dia</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5" />
                      <span>Bloquear Dia</span>
                    </>
                  )}
                </button>
              </div>

              {/* Atalhos Rápidos por Período */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-semibold opacity-65 mr-1" style={{ color: theme.textSecondary }}>
                    Seleção rápida:
                  </span>
                  {[
                    { label: 'Manhã', start: 0, end: 12 },
                    { label: 'Almoço (12h–14h)', start: 12, end: 14 },
                    { label: 'Tarde (14h–18h)', start: 14, end: 18 },
                    { label: 'Noite (18h+)', start: 18, end: 24 },
                  ].map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => applyQuickPeriod(p.start, p.end)}
                      className="px-2.5 py-1 rounded-xl text-[11px] font-semibold border transition-all hover:opacity-85 active:scale-95 cursor-pointer"
                      style={{
                        borderColor: theme.border,
                        backgroundColor: 'var(--theme-bg)',
                        color: theme.textPrimary,
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {localBlockedSet.size > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setLocalBlockedSet(new Set());
                      setIsDirty(true);
                      setConflictWarning(null);
                    }}
                    className="text-[11px] font-bold underline cursor-pointer"
                    style={{ color: theme.accent }}
                  >
                    Liberar todos
                  </button>
                )}
              </div>

              {/* Legenda Compacta dos Estados */}
              <div className="flex items-center gap-4 text-[11px] px-1" style={{ color: theme.textSecondary }}>
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full border"
                    style={{ borderColor: theme.border, backgroundColor: 'var(--theme-bg)' }}
                  />
                  Disponível
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: theme.accent }}
                  />
                  Bloqueado
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <User className="w-3 h-3 opacity-80" />
                  Com agendamento (protegido)
                </span>
              </div>

              {/* Grade Interativa Touch & Drag de Horários */}
              <div
                className="grid grid-cols-3 sm:grid-cols-4 gap-2 select-none touch-none py-1"
                onTouchMove={handleTouchMoveGrid}
                onMouseLeave={handleSlotDragEnd}
              >
                {daySlots.map((slot, idx) => {
                  const isBlocked = localBlockedSet.has(idx);
                  const slotBks = slotBookingsMap.get(idx);
                  const hasBooking = !!slotBks && slotBks.length > 0;
                  const firstBooking = slotBks?.[0];
                  const timeLabel = format(slot.start, 'HH:mm');

                  return (
                    <button
                      key={timeLabel}
                      type="button"
                      data-slot-idx={idx}
                      onMouseDown={() => handleSlotDragStart(idx)}
                      onMouseEnter={() => handleSlotDragEnter(idx)}
                      onMouseUp={handleSlotDragEnd}
                      onTouchStart={(e) => {
                        e.preventDefault();
                        handleSlotDragStart(idx);
                      }}
                      className="relative flex flex-col items-center justify-center py-2.5 px-2 rounded-2xl border transition-all cursor-pointer select-none"
                      style={{
                        backgroundColor: isBlocked
                          ? `color-mix(in srgb, ${theme.accent} 16%, transparent)`
                          : hasBooking
                            ? 'rgba(255, 255, 255, 0.03)'
                            : 'var(--theme-bg)',
                        borderColor: isBlocked
                          ? theme.accent
                          : hasBooking
                            ? `color-mix(in srgb, ${theme.textSecondary} 40%, transparent)`
                            : theme.border,
                        color: isBlocked ? theme.accent : theme.textPrimary,
                      }}
                    >
                      <div className="flex items-center gap-1.5">
                        {isBlocked ? (
                          <Lock className="w-3 h-3 shrink-0" style={{ color: theme.accent }} />
                        ) : hasBooking ? (
                          <User className="w-3 h-3 shrink-0 opacity-75" />
                        ) : null}
                        <span className="text-xs sm:text-sm font-bold tabular-nums tracking-tight">
                          {timeLabel}
                        </span>
                      </div>

                      <span
                        className="text-[10px] font-semibold truncate max-w-full mt-0.5"
                        style={{
                          color: isBlocked
                            ? theme.accent
                            : hasBooking
                              ? theme.textPrimary
                              : theme.textSecondary,
                          opacity: isBlocked ? 0.95 : 0.65,
                        }}
                      >
                        {hasBooking
                          ? `${firstBooking?.customer?.name?.split(' ')[0] ?? 'Ocupado'}${
                              isBlocked ? ' · Bloq.' : ''
                            }`
                          : isBlocked
                            ? 'Bloqueado'
                            : 'Livre'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            /* ── Tab 2: Bloqueio de Vários Dias de uma só vez ── */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold">Selecione um ou mais dias</p>
                  <p className="text-xs opacity-70" style={{ color: theme.textSecondary }}>
                    Toque nos dias para bloqueá-los ou liberá-los de uma só vez
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={multiDaysOffset <= 0}
                    onClick={() => setMultiDaysOffset((p) => Math.max(0, p - 1))}
                    className="w-8 h-8 rounded-xl border flex items-center justify-center disabled:opacity-30 cursor-pointer"
                    style={{ borderColor: theme.border, backgroundColor: 'var(--theme-bg)' }}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setMultiDaysOffset((p) => p + 1)}
                    className="w-8 h-8 rounded-xl border flex items-center justify-center cursor-pointer"
                    style={{ borderColor: theme.border, backgroundColor: 'var(--theme-bg)' }}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                {calendarDays.map((d) => {
                  const isSelected = selectedDates.some((x) => isSameDay(x, d));
                  const fullBlocked = isDayFullyBlocked(
                    d,
                    blocks,
                    targetProIds,
                    daySchedule.openTime,
                    daySchedule.closeTime
                  );
                  const hasDayBks = bookings.some(
                    (b) =>
                      b.status !== 'canceled' &&
                      b.status !== 'no_show' &&
                      (targetProId === 'all' || b.professional_id === targetProId) &&
                      isSameDay(new Date(b.scheduled_at), d)
                  );

                  return (
                    <button
                      key={d.toISOString()}
                      type="button"
                      onClick={() => toggleSelectMultiDate(d)}
                      className="flex flex-col items-center justify-center py-3 px-2 rounded-2xl border transition-all active:scale-95 cursor-pointer relative"
                      style={{
                        backgroundColor: isSelected
                          ? theme.accent
                          : fullBlocked
                            ? `color-mix(in srgb, ${theme.accent} 14%, transparent)`
                            : 'var(--theme-bg)',
                        borderColor: isSelected
                          ? theme.accent
                          : fullBlocked
                            ? theme.accent
                            : theme.border,
                        color: isSelected ? theme.btnPrimaryText : theme.textPrimary,
                      }}
                    >
                      <span
                        className="text-[9px] font-bold uppercase tracking-wider opacity-75"
                        style={{ color: isSelected ? theme.btnPrimaryText : theme.textSecondary }}
                      >
                        {isToday(d) ? 'Hoje' : format(d, 'EEE', { locale: ptBR }).slice(0, 3)}
                      </span>
                      <span className="text-base font-extrabold tabular-nums my-0.5">
                        {format(d, 'dd/MM')}
                      </span>
                      <div className="flex items-center gap-1 h-3.5">
                        {fullBlocked && (
                          <Lock
                            className="w-3 h-3"
                            style={{ color: isSelected ? theme.btnPrimaryText : theme.accent }}
                          />
                        )}
                        {hasDayBks && (
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{
                              backgroundColor: isSelected ? theme.btnPrimaryText : theme.accent,
                            }}
                            title="Possui agendamentos"
                          />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Barra Inferior de Ação Rápida ── */}
        <div
          className="px-5 py-4 border-t flex items-center justify-between gap-3 shrink-0"
          style={{ borderColor: theme.border, backgroundColor: theme.cardBg }}
        >
          {activeTab === 'slots' ? (
            <>
              <div className="text-xs min-w-0">
                <p className="font-bold truncate">
                  {localBlockedSet.size === 0
                    ? 'Todos os horários disponíveis'
                    : localBlockedSet.size === daySlots.length
                      ? 'Dia inteiro bloqueado'
                      : `${localBlockedSet.size} horário(s) bloqueado(s)`}
                </p>
                <p className="opacity-65 truncate" style={{ color: theme.textSecondary }}>
                  {isDirty ? 'Alterações prontas para aplicar' : 'Sincronizado com a página pública'}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {isDirty && (
                  <button
                    type="button"
                    onClick={() => {
                      setLocalBlockedSet(new Set(dbBlockedIndices));
                      setIsDirty(false);
                      setConflictWarning(null);
                    }}
                    className="px-3.5 py-2.5 rounded-xl text-xs font-bold border cursor-pointer"
                    style={{
                      borderColor: theme.border,
                      color: theme.textSecondary,
                    }}
                  >
                    Reverter
                  </button>
                )}

                <button
                  type="button"
                  disabled={isSaving || !isDirty}
                  onClick={() => handleRequestSaveSlots()}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
                  style={{
                    background: theme.accentGradient || theme.accent,
                    color: theme.btnPrimaryText,
                    boxShadow: isDirty ? theme.shadowAccent : 'none',
                  }}
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4 stroke-[2.5]" />
                  )}
                  <span>Salvar disponibilidade</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="text-xs min-w-0">
                <p className="font-bold truncate">
                  {selectedDates.length === 0
                    ? 'Nenhum dia selecionado'
                    : `${selectedDates.length} dia(s) selecionado(s)`}
                </p>
                {selectedDates.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedDates([])}
                    className="text-[11px] underline cursor-pointer"
                    style={{ color: theme.accent }}
                  >
                    Limpar seleção
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={isSaving || selectedDates.length === 0}
                  onClick={() => handleBatchMultiDays(false)}
                  className="px-3.5 py-2.5 rounded-xl text-xs font-bold border transition-all active:scale-95 disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
                  style={{
                    borderColor: theme.border,
                    backgroundColor: 'var(--theme-bg)',
                    color: theme.textPrimary,
                  }}
                >
                  <Unlock className="w-3.5 h-3.5" />
                  <span>Liberar ({selectedDates.length})</span>
                </button>

                <button
                  type="button"
                  disabled={isSaving || selectedDates.length === 0}
                  onClick={() => handleBatchMultiDays(true)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
                  style={{
                    background: theme.accentGradient || theme.accent,
                    color: theme.btnPrimaryText,
                  }}
                >
                  {isSaving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Lock className="w-3.5 h-3.5" />
                  )}
                  <span>Bloquear ({selectedDates.length})</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

