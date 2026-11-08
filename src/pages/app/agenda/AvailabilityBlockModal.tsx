import { useState, useMemo, useEffect, useRef } from 'react';
import {
  format,
  startOfDay,
  isSameDay,
  addMinutes,
} from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import {
  ArrowLeft,
  X,
  Lock,
  Unlock,
  Check,
  AlertTriangle,
  RotateCcw,
  Loader2,
  ListChecks,
} from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext';
import { type Booking } from '../../../hooks/useBookings';
import {
  type NormalizedBlock,
  type TimeRange,
  buildDayTimeSlots,
  isSlotBlockedForTarget,
  useManageBlockedTimes,
  useTenantBlocksInRange,
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
  onBack?: () => void;
  onOpenBlockedOverview?: () => void;
  onClose: () => void;
}

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
  onBack,
  onOpenBlockedOverview,
  onClose,
}: Props) {
  const { theme } = useTheme();
  const { saveDayBlocks } = useManageBlockedTimes(tenantId);

  const activeDate = useMemo(() => startOfDay(initialDate), [initialDate]);
  const [targetProId, setTargetProId] = useState<string | 'all'>(() =>
    selectedProfessionalId ? selectedProfessionalId : canSeeAll ? 'all' : professionals[0]?.id ?? 'all'
  );

  // Busca dedicada para o dia ativo (garante sincronia mesmo em datas distantes fora da janela da semana)
  const { data: daySpecificBlocks = [] } = useTenantBlocksInRange(
    tenantId || null,
    activeDate,
    activeDate
  );

  const mergedBlocks = useMemo(() => {
    const map = new Map<string, NormalizedBlock>();
    for (const b of blocks) map.set(`${b.source}-${b.id}`, b);
    for (const b of daySpecificBlocks) map.set(`${b.source}-${b.id}`, b);
    return Array.from(map.values());
  }, [blocks, daySpecificBlocks]);

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

  // Slots de 30 min do dia selecionado
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
      if (isSlotBlockedForTarget(slot.start, slot.end, mergedBlocks, targetProIds)) {
        set.add(idx);
      }
    });
    return set;
  }, [daySlots, mergedBlocks, targetProIds]);

  // Estado interativo local dos slots bloqueados
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

  // Verifica se todos os slots do dia estão bloqueados localmente
  const isAllDayBlockedLocal = daySlots.length > 0 && localBlockedSet.size === daySlots.length;

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
    toast.success(labelForToast || 'Disponibilidade salva!');
  };

  // Verifica se há agendamentos nos slots que estão sendo bloqueados antes de salvar
  const handleRequestSaveSlots = async (customSet?: Set<number>, isFullDayFlag?: boolean, customLabel?: string) => {
    const targetSet = customSet ?? localBlockedSet;

    const conflictingMap = new Map<string, Booking>();
    targetSet.forEach((idx) => {
      const bks = slotBookingsMap.get(idx);
      if (bks) {
        bks.forEach((b) => conflictingMap.set(b.id, b));
      }
    });

    const conflictingList = Array.from(conflictingMap.values());
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
      const emptySet = new Set<number>();
      setLocalBlockedSet(emptySet);
      await executeSaveDaySlots(emptySet, false, `Dia ${format(activeDate, 'dd/MM')} liberado!`);
    } else {
      const allSet = new Set<number>(daySlots.map((_, i) => i));
      setLocalBlockedSet(allSet);
      await handleRequestSaveSlots(
        allSet,
        true,
        `Dia ${format(activeDate, 'dd/MM')} bloqueado!`
      );
    }
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

  const isSaving = saveDayBlocks.isPending;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg rounded-t-[28px] sm:rounded-[28px] border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-all"
        style={{
          backgroundColor: theme.bg,
          borderColor: theme.border,
          color: theme.textPrimary,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header Clean com Botão de Retorno ── */}
        <div
          className="px-5 pt-5 pb-4 border-b flex flex-col gap-3 shrink-0"
          style={{ borderColor: theme.border, backgroundColor: theme.cardBg }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={onBack || onClose}
                className="w-9 h-9 rounded-full border flex items-center justify-center shrink-0 transition-all active:scale-95 cursor-pointer"
                style={{
                  borderColor: theme.border,
                  backgroundColor: theme.bg,
                  color: theme.textPrimary,
                }}
                title="Voltar"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>

              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-extrabold tracking-tight truncate">
                  Disponibilidade
                </h2>
                <p className="text-xs font-medium truncate" style={{ color: theme.textSecondary }}>
                  Toque ou deslize o dedo sobre os horários
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {undoSnapshot && (
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all active:scale-95 cursor-pointer"
                  style={{
                    borderColor: `color-mix(in srgb, ${theme.accent} 35%, transparent)`,
                    backgroundColor: `color-mix(in srgb, ${theme.accent} 10%, transparent)`,
                    color: theme.accent,
                  }}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Desfazer</span>
                </button>
              )}

              {onOpenBlockedOverview && (
                <button
                  type="button"
                  onClick={onOpenBlockedOverview}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all active:scale-95 cursor-pointer"
                  style={{
                    borderColor: theme.border,
                    backgroundColor: theme.bg,
                    color: theme.textPrimary,
                  }}
                  title="Ver todos os dias e horários bloqueados"
                >
                  <ListChecks className="w-3.5 h-3.5" style={{ color: theme.accent }} />
                  <span className="hidden xs:inline">Bloqueios</span>
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

          {professionals.length > 1 && canSeeAll && (
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
              <button
                type="button"
                onClick={() => setTargetProId('all')}
                className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold border shrink-0 transition-all cursor-pointer"
                style={{
                  backgroundColor: targetProId === 'all' ? `${theme.accent}16` : theme.bg,
                  borderColor: targetProId === 'all' ? theme.accent : theme.border,
                  color: targetProId === 'all' ? theme.accent : theme.textSecondary,
                }}
              >
                Todos
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
                      backgroundColor: active ? `${theme.accent}16` : theme.bg,
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

        {/* ── Aviso de Conflito com Agendamentos Existentes ── */}
        {conflictWarning && (
          <div
            className="mx-5 mt-4 p-4 rounded-2xl border flex flex-col gap-3 animate-in fade-in"
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              borderColor: 'rgba(239, 68, 68, 0.35)',
            }}
          >
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-[#EF4444] shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed">
                <p className="font-bold text-[#EF4444]">
                  {conflictWarning.conflictingBookings.length} agendamento(s) já marcado(s)
                </p>
                <p className="mt-0.5 opacity-90" style={{ color: theme.textPrimary }}>
                  Os agendamentos existentes <strong>não serão alterados</strong>. Apenas os horários livres serão bloqueados.
                </p>
              </div>
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
                <span>{conflictWarning.actionLabel}</span>
              </button>
            </div>
          </div>
        )}

        {/* ── Grade Clean de Horários do Dia Selecionado ── */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5">
          <div className="flex items-center justify-between gap-2 mb-4">
            <p
              className="text-[11px] font-bold uppercase tracking-widest"
              style={{ color: theme.textSecondary }}
            >
              Horários em {format(activeDate, "dd 'de' MMMM", { locale: ptBR })}
            </p>

            <button
              type="button"
              disabled={isSaving}
              onClick={handleToggleFullDayQuick}
              className="px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
              style={{
                backgroundColor: isAllDayBlockedLocal
                  ? `color-mix(in srgb, ${theme.accent} 14%, ${theme.cardBg})`
                  : theme.cardBg,
                borderColor: isAllDayBlockedLocal ? theme.accent : theme.border,
                color: isAllDayBlockedLocal ? theme.accent : theme.textPrimary,
              }}
            >
              {isSaving ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : isAllDayBlockedLocal ? (
                <>
                  <Unlock className="w-3 h-3" style={{ color: theme.accent }} />
                  <span>Liberar dia</span>
                </>
              ) : (
                <>
                  <Lock className="w-3 h-3" style={{ color: theme.accent }} />
                  <span>Bloquear dia</span>
                </>
              )}
            </button>
          </div>

          {/* Grade Clean de 3 Colunas (Toque ou Arraste) */}
          <div
            className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 sm:gap-3 select-none touch-none"
            onTouchMove={handleTouchMoveGrid}
            onMouseLeave={handleSlotDragEnd}
          >
            {daySlots.map((slot, idx) => {
              const isBlocked = localBlockedSet.has(idx);
              const slotBks = slotBookingsMap.get(idx);
              const hasBooking = !!slotBks && slotBks.length > 0;
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
                  className="py-3 px-2 rounded-xl text-xs sm:text-sm font-bold border transition-all duration-150 relative cursor-pointer select-none flex items-center justify-center gap-1.5"
                  style={{
                    borderColor: isBlocked ? theme.accent : theme.border,
                    backgroundColor: isBlocked
                      ? `color-mix(in srgb, ${theme.accent} 14%, ${theme.cardBg})`
                      : theme.cardBg,
                    color: isBlocked ? theme.accent : theme.textPrimary,
                    boxShadow: isBlocked
                      ? 'none'
                      : '0 1px 4px rgba(0,0,0,0.04)',
                  }}
                >
                  {isBlocked && (
                    <Lock className="w-3 h-3 shrink-0" style={{ color: theme.accent }} />
                  )}
                  <span className="tabular-nums">{timeLabel}</span>
                  {hasBooking && !isBlocked && (
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: theme.accent }}
                      title="Horário com agendamento"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Barra Inferior Clean com Retorno + Salvar/Concluir ── */}
        <div
          className="px-5 py-3.5 border-t flex items-center justify-between gap-3 shrink-0"
          style={{ borderColor: theme.border, backgroundColor: theme.cardBg }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={onBack || onClose}
              className="px-3.5 py-2 rounded-xl text-xs font-bold border transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer shrink-0"
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
              {localBlockedSet.size === 0
                ? 'Todos os horários livres'
                : `${localBlockedSet.size} bloqueado(s)`}
            </span>
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
                className="px-3 py-2 rounded-xl text-xs font-bold border cursor-pointer"
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
              disabled={isSaving}
              onClick={async () => {
                if (isDirty) {
                  await handleRequestSaveSlots();
                } else {
                  onClose();
                }
              }}
              className="px-5 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
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
              <span>{isDirty ? 'Salvar' : 'Concluir'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
