import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar,
  CalendarClock,
  Clock,
  Plus,
  Pencil,
  Trash2,
  Check,
  AlertCircle,
  Loader2,
  X,
  Info,
  Coffee,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../integrations/supabase/client';
import { useTheme } from '../../contexts/ThemeContext';
import { PUBLIC_STORE_QUERY_KEY } from '../../hooks/usePublicStore';
import toast from 'react-hot-toast';
import {
  type SpecialBusinessHourPeriod,
  type SpecialDayConfig,
  type SpecialPeriodStatus,
  getSpecialPeriodStatus,
} from '../../lib/availability';

export { getSpecialPeriodStatus, type SpecialPeriodStatus };

interface SpecialBusinessHoursSectionProps {
  tenantId: string | null | undefined;
}

const ORDERED_WEEKDAYS: { weekday: number; short: string; full: string }[] = [
  { weekday: 1, short: 'Seg', full: 'Segunda-feira' },
  { weekday: 2, short: 'Ter', full: 'Terça-feira' },
  { weekday: 3, short: 'Qua', full: 'Quarta-feira' },
  { weekday: 4, short: 'Qui', full: 'Quinta-feira' },
  { weekday: 5, short: 'Sex', full: 'Sexta-feira' },
  { weekday: 6, short: 'Sáb', full: 'Sábado' },
  { weekday: 0, short: 'Dom', full: 'Domingo' },
];

const NAME_SUGGESTIONS = [
  'Temporada de dezembro',
  'Horário especial de Natal',
  'Semana do Dia das Mães',
  'Atendimento de fim de ano',
];

function formatDateBR(dateStr: string): string {
  if (!dateStr) return '';
  const clean = dateStr.slice(0, 10);
  const parts = clean.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function formatHourShort(timeStr: string | null | undefined): string {
  if (!timeStr) return '';
  const clean = timeStr.slice(0, 5);
  const [h, m] = clean.split(':');
  if (m === '00') return `${h}h`;
  return `${h}h${m}`;
}

function createDefaultDaysConfig(
  openTime = '05:00',
  closeTime = '23:00',
  lunchStart: string | null = null,
  lunchEnd: string | null = null
): SpecialDayConfig[] {
  return ORDERED_WEEKDAYS.map((d) => ({
    weekday: d.weekday,
    is_open: true,
    open_time: openTime,
    close_time: closeTime,
    lunch_start: lunchStart,
    lunch_end: lunchEnd,
  }));
}

export const SpecialBusinessHoursSection: React.FC<SpecialBusinessHoursSectionProps> = ({
  tenantId,
}) => {
  const { theme } = useTheme();
  const queryClient = useQueryClient();

  const textPrimary = theme.textPrimary || (theme as any).text || '#111827';
  const textSecondary = theme.textSecondary || (theme as any).subtext || '#6B7280';
  const borderColor = theme.border || (theme as any).cardBorder || 'rgba(0,0,0,0.08)';
  const cardBg = theme.cardBg || '#FFFFFF';
  const inputBg = theme.inputBg || 'rgba(0,0,0,0.02)';

  const [periods, setPeriods] = useState<SpecialBusinessHourPeriod[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Form modal / panel state
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Etapa 1: Identificação
  const [periodName, setPeriodName] = useState<string>('');
  // Etapa 2: Período de validade
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  // Etapa 3 & 4: Dias e horários
  const [sameHoursForAll, setSameHoursForAll] = useState<boolean>(true);
  const [sharedOpenTime, setSharedOpenTime] = useState<string>('08:00');
  const [sharedCloseTime, setSharedCloseTime] = useState<string>('20:00');
  const [sharedHasLunch, setSharedHasLunch] = useState<boolean>(false);
  const [sharedLunchStart, setSharedLunchStart] = useState<string>('12:00');
  const [sharedLunchEnd, setSharedLunchEnd] = useState<string>('13:00');
  const [daysConfig, setDaysConfig] = useState<SpecialDayConfig[]>(() =>
    createDefaultDaysConfig('08:00', '20:00', null, null)
  );

  const fetchPeriods = useCallback(async () => {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('special_business_hours' as any)
        .select('*')
        .eq('tenant_id', tenantId)
        .order('start_date', { ascending: true });

      if (error) throw error;
      const parsed: SpecialBusinessHourPeriod[] = (data || []).map((row: any) => ({
        ...row,
        days_config: Array.isArray(row.days_config)
          ? row.days_config
          : typeof row.days_config === 'string'
            ? JSON.parse(row.days_config)
            : [],
      }));
      setPeriods(parsed);
    } catch (err: any) {
      console.error('Erro ao carregar horários especiais:', err);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchPeriods();
  }, [fetchPeriods]);

  const openNewForm = () => {
    setEditingId(null);
    setFormError(null);
    setPeriodName('');
    setStartDate('');
    setEndDate('');
    setSameHoursForAll(true);
    setSharedOpenTime('08:00');
    setSharedCloseTime('20:00');
    setSharedHasLunch(false);
    setSharedLunchStart('12:00');
    setSharedLunchEnd('13:00');
    setDaysConfig(createDefaultDaysConfig('08:00', '20:00', null, null));
    setIsFormOpen(true);
  };

  const openEditForm = (period: SpecialBusinessHourPeriod) => {
    setEditingId(period.id || null);
    setFormError(null);
    setPeriodName(period.name || '');
    setStartDate((period.start_date || '').slice(0, 10));
    setEndDate((period.end_date || '').slice(0, 10));
    const isSame = period.same_hours_for_all !== false;
    setSameHoursForAll(isSame);

    const existingDays: SpecialDayConfig[] = ORDERED_WEEKDAYS.map((wd) => {
      const found = (period.days_config || []).find(
        (d) => Number(d.weekday) === wd.weekday
      );
      if (found) {
        return {
          weekday: wd.weekday,
          is_open: Boolean(found.is_open),
          open_time: String(found.open_time || '08:00').slice(0, 5),
          close_time: String(found.close_time || '20:00').slice(0, 5),
          lunch_start: found.lunch_start ? String(found.lunch_start).slice(0, 5) : null,
          lunch_end: found.lunch_end ? String(found.lunch_end).slice(0, 5) : null,
        };
      }
      return {
        weekday: wd.weekday,
        is_open: false,
        open_time: '08:00',
        close_time: '20:00',
        lunch_start: null,
        lunch_end: null,
      };
    });

    const firstOpen = existingDays.find((d) => d.is_open) || existingDays[0];
    setSharedOpenTime(firstOpen.open_time || '08:00');
    setSharedCloseTime(firstOpen.close_time || '20:00');
    const hasLunch = Boolean(firstOpen.lunch_start && firstOpen.lunch_end);
    setSharedHasLunch(hasLunch);
    setSharedLunchStart(firstOpen.lunch_start || '12:00');
    setSharedLunchEnd(firstOpen.lunch_end || '13:00');
    setDaysConfig(existingDays);
    setIsFormOpen(true);
  };

  const toggleWeekday = (weekday: number) => {
    setDaysConfig((prev) =>
      prev.map((d) => (d.weekday === weekday ? { ...d, is_open: !d.is_open } : d))
    );
  };

  const selectAllWeekdays = (open: boolean) => {
    setDaysConfig((prev) => prev.map((d) => ({ ...d, is_open: open })));
  };

  const updateDayField = (
    weekday: number,
    field: keyof SpecialDayConfig,
    value: string | boolean | null
  ) => {
    setDaysConfig((prev) =>
      prev.map((d) => (d.weekday === weekday ? { ...d, [field]: value } : d))
    );
  };

  const effectiveDaysConfig = useMemo((): SpecialDayConfig[] => {
    const normalizeClose = (t: string) => (t === '00:00' ? '23:59' : t);
    if (!sameHoursForAll) {
      return daysConfig.map((d) => ({
        ...d,
        close_time: normalizeClose(d.close_time),
      }));
    }
    return daysConfig.map((d) => ({
      ...d,
      open_time: sharedOpenTime,
      close_time: normalizeClose(sharedCloseTime),
      lunch_start: sharedHasLunch ? sharedLunchStart : null,
      lunch_end: sharedHasLunch ? sharedLunchEnd : null,
    }));
  }, [
    sameHoursForAll,
    daysConfig,
    sharedOpenTime,
    sharedCloseTime,
    sharedHasLunch,
    sharedLunchStart,
    sharedLunchEnd,
  ]);

  const selectedOpenDays = useMemo(
    () =>
      ORDERED_WEEKDAYS.filter((wd) =>
        effectiveDaysConfig.some((d) => d.weekday === wd.weekday && d.is_open)
      ),
    [effectiveDaysConfig]
  );

  const summaryText = useMemo(() => {
    const startFormatted = startDate ? formatDateBR(startDate) : '__/__/____';
    const endFormatted = endDate ? formatDateBR(endDate) : '__/__/____';

    if (selectedOpenDays.length === 0) {
      return `Nenhum dia de funcionamento selecionado entre ${startFormatted} e ${endFormatted}.`;
    }

    if (sameHoursForAll) {
      const openLabel = formatHourShort(sharedOpenTime);
      const closeLabel = formatHourShort(sharedCloseTime);
      const lunchClause =
        sharedHasLunch && sharedLunchStart && sharedLunchEnd
          ? ` (com intervalo das ${formatHourShort(sharedLunchStart)} às ${formatHourShort(sharedLunchEnd)})`
          : '';
      return `Seu salão funcionará em horário especial de ${startFormatted} até ${endFormatted}, das ${openLabel} às ${closeLabel}${lunchClause}.`;
    }

    const firstDay = effectiveDaysConfig.find((d) => d.is_open);
    const openLabel = formatHourShort(firstDay?.open_time || '08:00');
    const closeLabel = formatHourShort(firstDay?.close_time || '20:00');
    return `Seu salão funcionará em horário especial de ${startFormatted} até ${endFormatted}, nos dias selecionados (${selectedOpenDays.map((d) => d.short).join(', ')}), a partir das ${openLabel} até ${closeLabel}.`;
  }, [
    startDate,
    endDate,
    selectedOpenDays,
    sameHoursForAll,
    sharedOpenTime,
    sharedCloseTime,
    sharedHasLunch,
    sharedLunchStart,
    sharedLunchEnd,
    effectiveDaysConfig,
  ]);

  const handleSavePeriod = async () => {
    setFormError(null);

    if (!tenantId) {
      setFormError('Estabelecimento não identificado.');
      return;
    }

    if (!startDate || !endDate) {
      setFormError('Selecione a data de início e a data de término do período especial.');
      return;
    }

    if (endDate < startDate) {
      setFormError('A data de término não pode ser anterior à data de início.');
      return;
    }

    const openDays = effectiveDaysConfig.filter((d) => d.is_open);
    if (openDays.length === 0) {
      setFormError('Selecione pelo menos um dia da semana em que o horário especial será aplicado.');
      return;
    }

    for (const day of openDays) {
      const dayLabel =
        ORDERED_WEEKDAYS.find((w) => w.weekday === day.weekday)?.full || 'Dia selecionado';
      if (!day.open_time || !day.close_time) {
        setFormError(`Preencha o horário de abertura e fechamento para ${dayLabel}.`);
        return;
      }
      if (day.open_time >= day.close_time) {
        setFormError(
          `Em ${dayLabel}, o horário de fechamento (${day.close_time}) deve ser maior que o de abertura (${day.open_time}).`
        );
        return;
      }
      if (day.lunch_start || day.lunch_end) {
        if (!day.lunch_start || !day.lunch_end) {
          setFormError(`Em ${dayLabel}, preencha tanto o início quanto o fim do intervalo.`);
          return;
        }
        if (day.lunch_start >= day.lunch_end) {
          setFormError(`Em ${dayLabel}, o fim do intervalo deve ser maior que o início.`);
          return;
        }
        if (day.lunch_start <= day.open_time || day.lunch_end >= day.close_time) {
          setFormError(
            `Em ${dayLabel}, o intervalo de almoço deve estar dentro do horário de funcionamento (${day.open_time} às ${day.close_time}).`
          );
          return;
        }
      }
    }

    // Overlap check against existing periods of the same salon
    const conflicting = periods.find((p) => {
      if (editingId && p.id === editingId) return false;
      const pStart = (p.start_date || '').slice(0, 10);
      const pEnd = (p.end_date || '').slice(0, 10);
      return startDate <= pEnd && endDate >= pStart;
    });

    if (conflicting) {
      const conflictTitle = conflicting.name || 'Horário especial';
      setFormError(
        `As datas selecionadas conflitam com "${conflictTitle}" (${formatDateBR(
          conflicting.start_date
        )} até ${formatDateBR(
          conflicting.end_date
        )}). Escolha outras datas ou edite o período já cadastrado.`
      );
      return;
    }

    setSaving(true);
    try {
      const payload = {
        tenant_id: tenantId,
        name: periodName.trim() || null,
        start_date: startDate,
        end_date: endDate,
        same_hours_for_all: sameHoursForAll,
        days_config: effectiveDaysConfig,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { error } = await supabase
          .from('special_business_hours' as any)
          .update(payload)
          .eq('id', editingId)
          .eq('tenant_id', tenantId);
        if (error) throw error;
        toast.success('Horário especial atualizado com sucesso!');
      } else {
        const { error } = await supabase
          .from('special_business_hours' as any)
          .insert(payload);
        if (error) throw error;
        toast.success('Horário especial aplicado com sucesso!');
      }

      setIsFormOpen(false);
      setEditingId(null);
      await fetchPeriods();
      queryClient.invalidateQueries({ queryKey: [PUBLIC_STORE_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ['publicStore'] });
      queryClient.invalidateQueries({ queryKey: ['tenant_availability_meta'] });
    } catch (err: any) {
      console.error('Erro ao salvar horário especial:', err);
      setFormError(err?.message || 'Não foi possível salvar o horário especial.');
      toast.error('Erro ao salvar horário especial.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePeriod = async (id: string) => {
    if (!tenantId || !id) return;
    setDeletingId(id);
    try {
      const { error } = await supabase
        .from('special_business_hours' as any)
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenantId);
      if (error) throw error;
      toast.success('Horário especial removido.');
      setConfirmDeleteId(null);
      await fetchPeriods();
      queryClient.invalidateQueries({ queryKey: [PUBLIC_STORE_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ['publicStore'] });
      queryClient.invalidateQueries({ queryKey: ['tenant_availability_meta'] });
    } catch (err: any) {
      console.error('Erro ao excluir horário especial:', err);
      toast.error('Não foi possível excluir o horário especial.');
    } finally {
      setDeletingId(null);
    }
  };

  const describePeriodDays = (period: SpecialBusinessHourPeriod): string => {
    const openSet = new Set(
      (period.days_config || [])
        .filter((d) => d.is_open)
        .map((d) => Number(d.weekday))
    );
    if (openSet.size === 7) return 'Todos os dias';
    if (openSet.size === 0) return 'Fechado em todos os dias';
    if (openSet.size === 6 && !openSet.has(0)) {
      return 'Segunda a sábado';
    }
    if (openSet.size === 5 && !openSet.has(0) && !openSet.has(6)) {
      return 'Segunda a sexta';
    }
    return ORDERED_WEEKDAYS.filter((w) => openSet.has(w.weekday))
      .map((w) => w.short)
      .join(', ');
  };

  const getPeriodHoursSummary = (
    period: SpecialBusinessHourPeriod
  ): { mainHours: string; lunchHours: string | null } => {
    const openDays = (period.days_config || []).filter((d) => d.is_open);
    if (openDays.length === 0) return { mainHours: 'Sem expediente', lunchHours: null };
    const first = openDays[0];
    const allSame = openDays.every(
      (d) =>
        String(d.open_time).slice(0, 5) === String(first.open_time).slice(0, 5) &&
        String(d.close_time).slice(0, 5) === String(first.close_time).slice(0, 5)
    );
    if (allSame) {
      const mainHours = `${String(first.open_time).slice(0, 5)} às ${String(first.close_time).slice(0, 5)}`;
      const lunchHours =
        first.lunch_start && first.lunch_end
          ? `${String(first.lunch_start).slice(0, 5)} às ${String(first.lunch_end).slice(0, 5)}`
          : null;
      return { mainHours, lunchHours };
    }
    return { mainHours: 'Horários personalizados por dia', lunchHours: null };
  };

  return (
    <div
      className="mt-6 pt-6 border-t space-y-5 transition-all"
      style={{ borderColor }}
    >
      {/* Cabeçalho da Seção (Sem encaixotamento duplo no mobile) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `${theme.accent}15`, color: theme.accent }}
            >
              <CalendarClock className="w-4 h-4" />
            </div>
            <h3
              className="text-base sm:text-lg font-bold tracking-tight uppercase"
              style={{ color: textPrimary }}
            >
              HORÁRIOS ESPECIAIS
            </h3>
          </div>
          <p className="text-xs sm:text-sm leading-relaxed" style={{ color: textSecondary }}>
            Configure horários diferentes para feriados, datas comemorativas, temporadas e períodos de maior movimento.
          </p>
        </div>

        {!isFormOpen && (
          <button
            type="button"
            onClick={openNewForm}
            className="min-h-[48px] px-5 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] shrink-0 cursor-pointer"
            style={{
              background: theme.accent,
              color: '#FFFFFF',
              boxShadow: 'none',
            }}
          >
            <Plus className="w-5 h-5 stroke-[2.5]" />
            <span>Adicionar horário especial</span>
          </button>
        )}
      </div>

      {/* Formulário Guiado em 5 Etapas (Largura total aproveitada no mobile) */}
      {isFormOpen && (
        <div
          className="rounded-2xl border p-4 sm:p-6 space-y-6 transition-all"
          style={{
            background: cardBg,
            borderColor: `${theme.accent}45`,
          }}
        >
          <div
            className="flex items-center justify-between border-b pb-4"
            style={{ borderColor }}
          >
            <div>
              <span
                className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full"
                style={{ background: `${theme.accent}18`, color: theme.accent }}
              >
                {editingId ? 'Editando horário especial' : 'Novo horário especial'}
              </span>
              <h4 className="text-base sm:text-lg font-bold mt-2" style={{ color: textPrimary }}>
                Configuração passo a passo
              </h4>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsFormOpen(false);
                setEditingId(null);
                setFormError(null);
              }}
              className="w-10 h-10 rounded-xl flex items-center justify-center border transition-colors cursor-pointer"
              style={{ borderColor, color: textSecondary }}
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Etapa 1 — Identificação */}
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <span
                className="w-7 h-7 rounded-full text-xs font-extrabold flex items-center justify-center shrink-0"
                style={{ background: theme.accent, color: '#FFFFFF' }}
              >
                1
              </span>
              <label className="text-sm sm:text-base font-bold" style={{ color: textPrimary }}>
                Nome do período{' '}
                <span className="font-normal text-xs" style={{ color: textSecondary }}>
                  (opcional)
                </span>
              </label>
            </div>
            <input
              type="text"
              value={periodName}
              onChange={(e) => setPeriodName(e.target.value)}
              placeholder="Ex: Temporada de dezembro, Horário especial de Natal..."
              className="w-full min-h-[48px] px-4 py-3 rounded-xl border text-sm sm:text-base font-medium outline-none transition-all"
              style={{
                background: inputBg,
                borderColor,
                color: textPrimary,
              }}
            />
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-xs font-medium" style={{ color: textSecondary }}>
                Exemplos:
              </span>
              {NAME_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setPeriodName(suggestion)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all active:scale-95 cursor-pointer"
                  style={{
                    background:
                      periodName === suggestion ? `${theme.accent}18` : inputBg,
                    borderColor:
                      periodName === suggestion ? theme.accent : borderColor,
                    color: periodName === suggestion ? theme.accent : textPrimary,
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>

          {/* Etapa 2 — Período de validade */}
          <div className="space-y-3 pt-4 border-t" style={{ borderColor }}>
            <div className="flex items-center gap-2.5">
              <span
                className="w-7 h-7 rounded-full text-xs font-extrabold flex items-center justify-center shrink-0"
                style={{ background: theme.accent, color: '#FFFFFF' }}
              >
                2
              </span>
              <span className="text-sm sm:text-base font-bold" style={{ color: textPrimary }}>
                Período de validade
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs sm:text-sm font-semibold block" style={{ color: textPrimary }}>
                  Data de início
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    if (!endDate || endDate < e.target.value) {
                      setEndDate(e.target.value);
                    }
                  }}
                  className="w-full min-h-[48px] px-4 py-3 rounded-xl border text-sm sm:text-base font-semibold outline-none"
                  style={{
                    background: inputBg,
                    borderColor,
                    color: textPrimary,
                  }}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs sm:text-sm font-semibold block" style={{ color: textPrimary }}>
                  Data de término
                </label>
                <input
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full min-h-[48px] px-4 py-3 rounded-xl border text-sm sm:text-base font-semibold outline-none"
                  style={{
                    background: inputBg,
                    borderColor,
                    color: textPrimary,
                  }}
                />
              </div>
            </div>

            <div
              className="flex items-center gap-2.5 p-3.5 rounded-xl border text-xs sm:text-sm"
              style={{
                background: `${theme.accent}0D`,
                borderColor: `${theme.accent}30`,
                color: textPrimary,
              }}
            >
              <Info className="w-4 h-4 shrink-0" style={{ color: theme.accent }} />
              <span>Este horário será aplicado somente entre as datas selecionadas.</span>
            </div>
          </div>

          {/* Etapa 3 — Dias de funcionamento */}
          <div className="space-y-3 pt-4 border-t" style={{ borderColor }}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span
                  className="w-7 h-7 rounded-full text-xs font-extrabold flex items-center justify-center shrink-0"
                  style={{ background: theme.accent, color: '#FFFFFF' }}
                >
                  3
                </span>
                <span className="text-sm sm:text-base font-bold" style={{ color: textPrimary }}>
                  Dias de funcionamento
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => selectAllWeekdays(true)}
                  className="text-xs font-bold px-3 py-1.5 rounded-xl border transition-all cursor-pointer"
                  style={{
                    background: inputBg,
                    borderColor,
                    color: theme.accent,
                  }}
                >
                  Selecionar todos
                </button>
                <button
                  type="button"
                  onClick={() => selectAllWeekdays(false)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all cursor-pointer"
                  style={{
                    background: inputBg,
                    borderColor,
                    color: textSecondary,
                  }}
                >
                  Limpar
                </button>
              </div>
            </div>

            <p className="text-xs sm:text-sm" style={{ color: textSecondary }}>
              Toque nos dias da semana em que o horário especial será aplicado:
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
              {ORDERED_WEEKDAYS.map((wd) => {
                const dayState = daysConfig.find((d) => d.weekday === wd.weekday);
                const isSelected = Boolean(dayState?.is_open);
                return (
                  <button
                    key={wd.weekday}
                    type="button"
                    onClick={() => toggleWeekday(wd.weekday)}
                    className="min-h-[54px] p-2.5 rounded-xl border font-bold text-sm flex flex-col items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer"
                    style={{
                      background: isSelected ? theme.accent : inputBg,
                      borderColor: isSelected ? theme.accent : borderColor,
                      color: isSelected ? '#FFFFFF' : textPrimary,
                      boxShadow: 'none',
                    }}
                  >
                    <span className="text-sm font-extrabold">{wd.short}</span>
                    <span
                      className="text-[10px] font-semibold opacity-90"
                      style={{ color: isSelected ? '#FFFFFF' : textSecondary }}
                    >
                      {isSelected ? 'Aberto' : 'Fechado'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Etapa 4 — Horários (Sem card extra aninhado para não apertar lateralmente no celular) */}
          <div className="space-y-4 pt-4 border-t" style={{ borderColor }}>
            <div className="flex items-center gap-2.5">
              <span
                className="w-7 h-7 rounded-full text-xs font-extrabold flex items-center justify-center shrink-0"
                style={{ background: theme.accent, color: '#FFFFFF' }}
              >
                4
              </span>
              <span className="text-sm sm:text-base font-bold" style={{ color: textPrimary }}>
                Horários
              </span>
            </div>

            {/* Opção de replicação */}
            <button
              type="button"
              onClick={() => setSameHoursForAll((prev) => !prev)}
              className="w-full min-h-[52px] p-3.5 sm:p-4 rounded-xl border flex items-center justify-between gap-3 text-left transition-all cursor-pointer"
              style={{
                background: sameHoursForAll ? `${theme.accent}12` : inputBg,
                borderColor: sameHoursForAll ? theme.accent : borderColor,
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center border shrink-0"
                  style={{
                    background: sameHoursForAll ? theme.accent : 'transparent',
                    borderColor: sameHoursForAll ? theme.accent : textSecondary,
                    color: '#FFFFFF',
                  }}
                >
                  {sameHoursForAll && <Check className="w-4 h-4 stroke-[3]" />}
                </div>
                <div>
                  <p className="text-sm font-bold" style={{ color: textPrimary }}>
                    Usar o mesmo horário em todos os dias selecionados
                  </p>
                  <p className="text-xs" style={{ color: textSecondary }}>
                    Preenche automaticamente todos os dias marcados com o mesmo horário.
                  </p>
                </div>
              </div>
            </button>

            {sameHoursForAll ? (
              <div className="space-y-4 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs sm:text-sm font-bold block" style={{ color: textPrimary }}>
                      Horário de abertura
                    </label>
                    <input
                      type="time"
                      value={sharedOpenTime}
                      onChange={(e) => setSharedOpenTime(e.target.value)}
                      className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border text-base font-bold outline-none"
                      style={{
                        background: inputBg,
                        borderColor,
                        color: textPrimary,
                      }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs sm:text-sm font-bold block" style={{ color: textPrimary }}>
                      Horário de fechamento
                    </label>
                    <input
                      type="time"
                      value={sharedCloseTime}
                      onChange={(e) => setSharedCloseTime(e.target.value)}
                      className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border text-base font-bold outline-none"
                      style={{
                        background: inputBg,
                        borderColor,
                        color: textPrimary,
                      }}
                    />
                  </div>
                </div>

                {/* Intervalo de almoço opcional */}
                <div className="pt-2 space-y-3">
                  <button
                    type="button"
                    onClick={() => setSharedHasLunch((prev) => !prev)}
                    className="flex items-center gap-2.5 text-xs sm:text-sm font-bold py-1.5 cursor-pointer"
                    style={{ color: sharedHasLunch ? theme.accent : textSecondary }}
                  >
                    <div
                      className="w-5 h-5 rounded-md border flex items-center justify-center shrink-0"
                      style={{
                        background: sharedHasLunch ? theme.accent : 'transparent',
                        borderColor: sharedHasLunch ? theme.accent : textSecondary,
                        color: '#FFFFFF',
                      }}
                    >
                      {sharedHasLunch && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                    <Coffee className="w-4 h-4 shrink-0" />
                    <span>Definir intervalo de almoço (opcional)</span>
                  </button>

                  {sharedHasLunch && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold block" style={{ color: textSecondary }}>
                          Início do intervalo
                        </label>
                        <input
                          type="time"
                          value={sharedLunchStart}
                          onChange={(e) => setSharedLunchStart(e.target.value)}
                          className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border text-base font-bold outline-none"
                          style={{
                            background: inputBg,
                            borderColor,
                            color: textPrimary,
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold block" style={{ color: textSecondary }}>
                          Fim do intervalo
                        </label>
                        <input
                          type="time"
                          value={sharedLunchEnd}
                          onChange={(e) => setSharedLunchEnd(e.target.value)}
                          className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border text-base font-bold outline-none"
                          style={{
                            background: inputBg,
                            borderColor,
                            color: textPrimary,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {ORDERED_WEEKDAYS.map((wd) => {
                  const dayState = daysConfig.find((d) => d.weekday === wd.weekday);
                  if (!dayState || !dayState.is_open) return null;
                  const hasDayLunch = Boolean(dayState.lunch_start || dayState.lunch_end);
                  return (
                    <div
                      key={wd.weekday}
                      className="p-3.5 sm:p-4 rounded-xl border space-y-3"
                      style={{ background: inputBg, borderColor }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold" style={{ color: textPrimary }}>
                          {wd.full}
                        </span>
                        <span
                          className="text-[11px] font-bold px-2.5 py-0.5 rounded-full"
                          style={{ background: `${theme.accent}15`, color: theme.accent }}
                        >
                          Aberto
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold block" style={{ color: textSecondary }}>
                            Horário de abertura
                          </label>
                          <input
                            type="time"
                            value={dayState.open_time}
                            onChange={(e) =>
                              updateDayField(wd.weekday, 'open_time', e.target.value)
                            }
                            className="w-full min-h-[44px] px-3 py-2 rounded-xl border text-sm font-bold outline-none"
                            style={{
                              background: cardBg,
                              borderColor,
                              color: textPrimary,
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold block" style={{ color: textSecondary }}>
                            Horário de fechamento
                          </label>
                          <input
                            type="time"
                            value={dayState.close_time}
                            onChange={(e) =>
                              updateDayField(wd.weekday, 'close_time', e.target.value)
                            }
                            className="w-full min-h-[44px] px-3 py-2 rounded-xl border text-sm font-bold outline-none"
                            style={{
                              background: cardBg,
                              borderColor,
                              color: textPrimary,
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold block" style={{ color: textSecondary }}>
                            Início do intervalo
                          </label>
                          <input
                            type="time"
                            value={dayState.lunch_start || ''}
                            onChange={(e) =>
                              updateDayField(
                                wd.weekday,
                                'lunch_start',
                                e.target.value || null
                              )
                            }
                            className="w-full min-h-[44px] px-3 py-2 rounded-xl border text-sm font-semibold outline-none"
                            style={{
                              background: cardBg,
                              borderColor,
                              color: textPrimary,
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] font-semibold block" style={{ color: textSecondary }}>
                              Fim do intervalo
                            </label>
                            {hasDayLunch && (
                              <button
                                type="button"
                                onClick={() => {
                                  updateDayField(wd.weekday, 'lunch_start', null);
                                  updateDayField(wd.weekday, 'lunch_end', null);
                                }}
                                className="text-[10px] font-bold underline cursor-pointer"
                                style={{ color: theme.accent }}
                              >
                                Limpar
                              </button>
                            )}
                          </div>
                          <input
                            type="time"
                            value={dayState.lunch_end || ''}
                            onChange={(e) =>
                              updateDayField(
                                wd.weekday,
                                'lunch_end',
                                e.target.value || null
                              )
                            }
                            className="w-full min-h-[44px] px-3 py-2 rounded-xl border text-sm font-semibold outline-none"
                            style={{
                              background: cardBg,
                              borderColor,
                              color: textPrimary,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Etapa 5 — Aplicar */}
          <div className="space-y-4 pt-4 border-t" style={{ borderColor }}>
            <div className="flex items-center gap-2.5">
              <span
                className="w-7 h-7 rounded-full text-xs font-extrabold flex items-center justify-center shrink-0"
                style={{ background: theme.accent, color: '#FFFFFF' }}
              >
                5
              </span>
              <span className="text-sm sm:text-base font-bold" style={{ color: textPrimary }}>
                Resumo antes de aplicar
              </span>
            </div>

            <div
              className="p-4 rounded-xl border space-y-1.5"
              style={{
                background: inputBg,
                borderColor: `${theme.accent}45`,
              }}
            >
              <p className="text-xs sm:text-sm font-semibold leading-relaxed" style={{ color: textPrimary }}>
                {summaryText}
              </p>
              {selectedOpenDays.length > 0 && (
                <p className="text-xs" style={{ color: textSecondary }}>
                  Dias de funcionamento:{' '}
                  <strong style={{ color: textPrimary }}>
                    {selectedOpenDays.length === 7
                      ? 'Todos os dias (Segunda a Domingo)'
                      : selectedOpenDays.map((d) => d.full).join(', ')}
                  </strong>
                </p>
              )}
            </div>

            {formError && (
              <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 flex items-start gap-3 text-red-500 text-xs sm:text-sm font-semibold">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsFormOpen(false);
                  setEditingId(null);
                  setFormError(null);
                }}
                className="min-h-[48px] px-5 py-3 rounded-xl border font-bold text-sm transition-all cursor-pointer"
                style={{
                  background: inputBg,
                  borderColor,
                  color: textSecondary,
                }}
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={handleSavePeriod}
                className="min-h-[50px] px-7 py-3.5 rounded-xl font-bold text-sm sm:text-base flex items-center justify-center gap-2.5 transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                style={{
                  background: theme.accent,
                  color: '#FFFFFF',
                  boxShadow: 'none',
                }}
              >
                {saving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Aplicando...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5 stroke-[2.5]" />
                    <span>Aplicar horário especial</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Listagem dos Horários Especiais (Cards alinhados, sem quebras tortas) */}
      {loading ? (
        <div className="py-8 flex items-center justify-center gap-2.5 text-sm" style={{ color: textSecondary }}>
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: theme.accent }} />
          <span>Carregando horários especiais...</span>
        </div>
      ) : periods.length === 0 ? (
        <div
          className="p-6 sm:p-8 rounded-2xl border text-center space-y-2"
          style={{ background: inputBg, borderColor }}
        >
          <CalendarClock className="w-8 h-8 mx-auto opacity-60" style={{ color: theme.accent }} />
          <p
            className="text-sm sm:text-base font-medium max-w-lg mx-auto leading-relaxed"
            style={{ color: textSecondary }}
          >
            Nenhum horário especial cadastrado. Quando precisar ampliar ou alterar seus horários, você poderá configurar aqui.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {periods.map((period) => {
            const status = getSpecialPeriodStatus(period.start_date, period.end_date);
            const hoursInfo = getPeriodHoursSummary(period);
            const statusStyles =
              status.key === 'active'
                ? {
                  bg: 'rgba(16, 185, 129, 0.12)',
                  border: 'rgba(16, 185, 129, 0.35)',
                  text: '#10B981',
                  dot: '#10B981',
                }
                : status.key === 'scheduled'
                  ? {
                    bg: `${theme.accent}12`,
                    border: `${theme.accent}30`,
                    text: theme.accent,
                    dot: theme.accent,
                  }
                  : {
                    bg: 'rgba(148, 163, 184, 0.14)',
                    border: 'rgba(148, 163, 184, 0.3)',
                    text: textSecondary,
                    dot: textSecondary,
                  };

            return (
              <div
                key={period.id}
                className="p-4 sm:p-5 rounded-2xl border transition-all space-y-4"
                style={{
                  background: cardBg,
                  borderColor:
                    status.key === 'active' ? 'rgba(16, 185, 129, 0.4)' : borderColor,
                }}
              >
                {/* Topo do Card: Título, Período em 1 linha e Badge de Status */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center flex-wrap gap-2">
                      <h4
                        className="text-base font-bold tracking-tight"
                        style={{ color: textPrimary }}
                      >
                        {period.name || 'Horário especial'}
                      </h4>
                      <span
                        className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full border shrink-0"
                        style={{
                          background: statusStyles.bg,
                          borderColor: statusStyles.border,
                          color: statusStyles.text,
                        }}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ background: statusStyles.dot }}
                        />
                        {status.label}
                      </span>
                    </div>
                    <p
                      className="text-xs sm:text-sm font-semibold mt-1 tabular-nums"
                      style={{ color: textSecondary }}
                    >
                      {formatDateBR(period.start_date)} até {formatDateBR(period.end_date)}
                    </p>
                  </div>

                  {/* Ações alinhadas e proporcionais */}
                  {confirmDeleteId !== period.id && (
                    <div className="grid grid-cols-2 sm:flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0" style={{ borderColor }}>
                      <button
                        type="button"
                        onClick={() => openEditForm(period)}
                        className="min-h-[40px] px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                        style={{
                          background: inputBg,
                          borderColor,
                          color: textPrimary,
                        }}
                      >
                        <Pencil className="w-3.5 h-3.5" style={{ color: theme.accent }} />
                        <span>Editar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(period.id || null)}
                        className="min-h-[40px] px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                        style={{
                          background: inputBg,
                          borderColor,
                          color: '#EF4444',
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Excluir</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Bloco de Informações em Pílulas/Linhas Alinhadas (Nunca quebra no meio de parênteses) */}
                <div
                  className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3 rounded-xl border"
                  style={{ background: inputBg, borderColor }}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Clock className="w-4 h-4 shrink-0" style={{ color: theme.accent }} />
                    <div className="min-w-0">
                      <span className="block text-[10px] font-bold uppercase tracking-wider" style={{ color: textSecondary }}>
                        Expediente
                      </span>
                      <span className="text-xs sm:text-sm font-bold tabular-nums" style={{ color: textPrimary }}>
                        {hoursInfo.mainHours}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 min-w-0">
                    <Coffee className="w-4 h-4 shrink-0" style={{ color: theme.accent }} />
                    <div className="min-w-0">
                      <span className="block text-[10px] font-bold uppercase tracking-wider" style={{ color: textSecondary }}>
                        Intervalo
                      </span>
                      <span className="text-xs sm:text-sm font-semibold tabular-nums" style={{ color: textPrimary }}>
                        {hoursInfo.lunchHours || 'Sem intervalo'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 min-w-0">
                    <Calendar className="w-4 h-4 shrink-0" style={{ color: theme.accent }} />
                    <div className="min-w-0">
                      <span className="block text-[10px] font-bold uppercase tracking-wider" style={{ color: textSecondary }}>
                        Dias ativos
                      </span>
                      <span className="text-xs sm:text-sm font-semibold truncate block" style={{ color: textPrimary }}>
                        {describePeriodDays(period)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Confirmação de Exclusão */}
                {confirmDeleteId === period.id && (
                  <div
                    className="flex items-center justify-between gap-2 pt-3 border-t"
                    style={{ borderColor }}
                  >
                    <span className="text-xs font-bold text-red-500">
                      Confirmar exclusão deste período?
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="min-h-[38px] px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer"
                        style={{
                          background: inputBg,
                          borderColor,
                          color: textSecondary,
                        }}
                      >
                        Não
                      </button>
                      <button
                        type="button"
                        disabled={deletingId === period.id}
                        onClick={() => period.id && handleDeletePeriod(period.id)}
                        className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-red-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        {deletingId === period.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                        <span>Sim, excluir</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
