import { addDays, differenceInCalendarDays, format, isAfter, isBefore, isSameDay, startOfDay } from 'date-fns';

export const BOOKING_HORIZON_PRESETS = [7, 15, 30, 45, 60, 90, 180, 365] as const;

export type BookingHorizonSelectValue =
  | '7'
  | '15'
  | '30'
  | '45'
  | '60'
  | '90'
  | '180'
  | '365'
  | 'custom'
  | 'unlimited';

export const BOOKING_HORIZON_OPTIONS: ReadonlyArray<{
  value: BookingHorizonSelectValue;
  label: string;
}> = [
  { value: '7', label: '7 dias' },
  { value: '15', label: '15 dias' },
  { value: '30', label: '30 dias (1 mês)' },
  { value: '45', label: '45 dias' },
  { value: '60', label: '60 dias (2 meses)' },
  { value: '90', label: '90 dias (3 meses)' },
  { value: '180', label: '180 dias (6 meses)' },
  { value: '365', label: '365 dias (1 ano)' },
  { value: 'custom', label: 'Personalizado (quantidade de dias)' },
  { value: 'unlimited', label: 'Sem limite' },
];

export const DEFAULT_MAX_ADVANCE_DAYS = 30;
export const INITIAL_CAROUSEL_DAYS_CAP = 90;
export const CAROUSEL_LOAD_MORE_STEP = 60;

/**
 * Resolve o valor efetivo de antecedência máxima de agendamento:
 * - Se o estabelecimento ainda não possui registro em `tenant_settings` (`hasSettingsRow = false`)
 *   ou a coluna veio `undefined`, retorna 30 dias (padrão).
 * - Se `rawValue === null` (com registro existente), retorna `null` ("Sem limite").
 * - Se inteiro positivo >= 1, retorna `Math.floor(rawValue)`.
 */
export function resolveMaxAdvanceDays(
  rawValue: number | null | undefined,
  hasSettingsRow = true
): number | null {
  if (!hasSettingsRow || rawValue === undefined) {
    return DEFAULT_MAX_ADVANCE_DAYS;
  }
  if (rawValue === null) {
    return null;
  }
  if (typeof rawValue === 'number' && Number.isFinite(rawValue) && rawValue >= 1) {
    return Math.floor(rawValue);
  }
  return DEFAULT_MAX_ADVANCE_DAYS;
}

/**
 * Converte o valor salvo no banco em `{ selectValue, customDays }` para o formulário de Configurações.
 */
export function maxAdvanceDaysToFormState(
  rawValue: number | null | undefined,
  hasSettingsRow = true
): { selectValue: BookingHorizonSelectValue; customDays: string } {
  const resolved = resolveMaxAdvanceDays(rawValue, hasSettingsRow);
  if (resolved === null) {
    return { selectValue: 'unlimited', customDays: '30' };
  }
  if ((BOOKING_HORIZON_PRESETS as readonly number[]).includes(resolved)) {
    return { selectValue: String(resolved) as BookingHorizonSelectValue, customDays: String(resolved) };
  }
  return { selectValue: 'custom', customDays: String(resolved) };
}

/**
 * Data limite máxima permitida (início do dia), contando com hoje:
 * Ex.: `maxAdvanceDays = 7` -> hoje + 6 dias (7 dias no total).
 * Retorna `null` quando configurado como "Sem limite".
 */
export function getMaxBookingDate(
  maxAdvanceDays: number | null,
  now: Date = new Date()
): Date | null {
  if (maxAdvanceDays === null) return null;
  const safeDays = Math.max(1, Math.floor(maxAdvanceDays));
  return addDays(startOfDay(now), safeDays - 1);
}

/**
 * Verifica se uma data está dentro do intervalo permitido para NOVOS agendamentos / reagendamentos
 * (a partir de hoje até `hoje + (maxAdvanceDays - 1)`, ou qualquer data futura se `Sem limite`).
 */
export function isDateWithinBookingHorizon(
  date: Date,
  maxAdvanceDays: number | null,
  now: Date = new Date()
): boolean {
  const today = startOfDay(now);
  const target = startOfDay(date);
  if (isBefore(target, today)) return false;
  if (maxAdvanceDays === null) return true;
  const maxDate = getMaxBookingDate(maxAdvanceDays, now);
  if (!maxDate) return true;
  return !isAfter(target, maxDate);
}

/**
 * Texto descritivo amigável da antecedência configurada.
 */
export function formatBookingHorizonSummary(
  maxAdvanceDays: number | null,
  now: Date = new Date()
): string {
  if (maxAdvanceDays === null) {
    return 'Sem limite de antecedência (qualquer data futura disponível)';
  }
  const maxDate = getMaxBookingDate(maxAdvanceDays, now)!;
  const formattedMax = format(maxDate, 'dd/MM/yyyy');
  return `${maxAdvanceDays} ${maxAdvanceDays === 1 ? 'dia' : 'dias'} contando com hoje (disponível até ${formattedMax})`;
}

/**
 * Constrói a lista de datas para carrosséis horizontais sem sobrecarregar o DOM em horizontes longos
 * (180, 365, personalizado grande ou Sem limite), garantindo que `selectedDate` e `preserveExtraDate`
 * (data original de reserva já existente fora do novo limite) estejam visíveis na lista.
 */
export function buildHorizonDateList(params: {
  maxAdvanceDays: number | null;
  visibleCount?: number;
  selectedDate?: Date | null;
  preserveExtraDate?: Date | null;
  now?: Date;
}): {
  dates: Date[];
  hasMore: boolean;
  minDateISO: string;
  maxDateISO: string | undefined;
} {
  const now = params.now ?? new Date();
  const today = startOfDay(now);
  const visibleCount = Math.max(1, params.visibleCount ?? INITIAL_CAROUSEL_DAYS_CAP);
  const maxDate = getMaxBookingDate(params.maxAdvanceDays, now);

  const minDateISO = format(today, 'yyyy-MM-dd');
  const maxDateISO = maxDate ? format(maxDate, 'yyyy-MM-dd') : undefined;

  const dateMap = new Map<string, Date>();
  const addUnique = (d: Date) => {
    const clean = startOfDay(d);
    const key = format(clean, 'yyyy-MM-dd');
    if (!dateMap.has(key)) {
      dateMap.set(key, clean);
    }
  };

  let hasMore = false;

  if (params.maxAdvanceDays !== null) {
    const totalDays = Math.max(1, Math.floor(params.maxAdvanceDays));
    const countToRender = Math.min(totalDays, visibleCount);
    for (let i = 0; i < countToRender; i++) {
      addUnique(addDays(today, i));
    }
    hasMore = countToRender < totalDays;

    // Se o usuário pulou para uma data válida via seletor de calendário além de visibleCount,
    // adiciona uma janela ao redor da data selecionada respeitando [today, maxDate]
    if (params.selectedDate && isDateWithinBookingHorizon(params.selectedDate, params.maxAdvanceDays, now)) {
      const selStart = startOfDay(params.selectedDate);
      const diff = differenceInCalendarDays(selStart, today);
      if (diff >= countToRender) {
        for (let offset = -3; offset <= 10; offset++) {
          const candidate = addDays(selStart, offset);
          if (!isBefore(candidate, today) && (!maxDate || !isAfter(candidate, maxDate))) {
            addUnique(candidate);
          }
        }
      }
    }
  } else {
    // Sem limite: renderiza os primeiros `visibleCount` dias + janela ao redor de `selectedDate` se distante
    for (let i = 0; i < visibleCount; i++) {
      addUnique(addDays(today, i));
    }
    hasMore = true;

    if (params.selectedDate && !isBefore(startOfDay(params.selectedDate), today)) {
      const selStart = startOfDay(params.selectedDate);
      const diff = differenceInCalendarDays(selStart, today);
      if (diff >= visibleCount) {
        for (let offset = -3; offset <= 10; offset++) {
          const candidate = addDays(selStart, offset);
          if (!isBefore(candidate, today)) {
            addUnique(candidate);
          }
        }
      }
    }
  }

  // Preserva a data original de um agendamento já confirmado (ex: +60 dias após reduzir limite p/ 30)
  if (params.preserveExtraDate) {
    addUnique(params.preserveExtraDate);
  }

  const dates = Array.from(dateMap.values()).sort((a, b) => a.getTime() - b.getTime());

  return {
    dates,
    hasMore,
    minDateISO,
    maxDateISO,
  };
}

/**
 * Garante que uma cor usada em concatenação hexadecimal (`${color}16`) seja sempre um HEX válido `#RRGGBB`,
 * evitando valores legados como `'var(--theme-accent)'` que gerariam CSS inválido.
 */
export function sanitizeHexColor(
  rawColor: string | null | undefined,
  fallback = '#C9963B'
): string {
  const safeFallback = /^#[0-9A-Fa-f]{6}$/.test(fallback) ? fallback : '#C9963B';
  if (!rawColor || typeof rawColor !== 'string') return safeFallback;
  const trimmed = rawColor.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(trimmed)) return trimmed;
  if (/^#[0-9A-Fa-f]{3}$/.test(trimmed)) {
    const r = trimmed[1];
    const g = trimmed[2];
    const b = trimmed[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return safeFallback;
}

/**
 * Verifica se duas datas representam exatamente o mesmo dia do calendário.
 */
export function isSameCalendarDate(a: Date | null | undefined, b: Date | null | undefined): boolean {
  if (!a || !b) return false;
  return isSameDay(a, b);
}

