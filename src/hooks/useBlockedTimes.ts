import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { startOfDay, endOfDay, format, addMinutes, isBefore, isAfter, addDays } from 'date-fns';
import { supabase } from '../integrations/supabase/client';

export interface NormalizedBlock {
  id: string;
  tenant_id: string;
  professional_id: string | null;
  starts_at: string;
  ends_at: string;
  reason: string | null;
  block_type: 'vacation' | 'day_off' | 'leave' | 'custom';
  source: 'pro' | 'legacy';
}

export interface TimeRange {
  start: Date;
  end: Date;
}

export const TENANT_BLOCKS_RANGE_KEY = (
  tenantId: string | null | undefined,
  startKey: string,
  endKey: string
) => ['tenant_blocks_range', tenantId ?? '', startKey, endKey];

export const TENANT_ALL_UPCOMING_BLOCKS_KEY = (tenantId: string | null | undefined) => [
  'tenant_blocks_range',
  'all_upcoming',
  tenantId ?? '',
];

/**
 * Busca todos os bloqueios (`professional_blocked_times` + `blocked_times`) dentro de uma janela de datas.
 */
export function useTenantBlocksInRange(
  tenantId: string | null | undefined,
  startDate: Date | null | undefined,
  endDate: Date | null | undefined
) {
  const rangeStart = startDate ? startOfDay(startDate) : null;
  const rangeEnd = endDate ? endOfDay(endDate) : null;
  const startIso = rangeStart ? rangeStart.toISOString() : '';
  const endIso = rangeEnd ? rangeEnd.toISOString() : '';
  const startKey = rangeStart ? format(rangeStart, 'yyyy-MM-dd') : '';
  const endKey = rangeEnd ? format(rangeEnd, 'yyyy-MM-dd') : '';

  return useQuery({
    queryKey: TENANT_BLOCKS_RANGE_KEY(tenantId, startKey, endKey),
    enabled: !!tenantId && !!rangeStart && !!rangeEnd,
    staleTime: 0,
    queryFn: async (): Promise<NormalizedBlock[]> => {
      const [{ data: proBlocks, error: proErr }, { data: legacyBlocks }] = await Promise.all([
        supabase
          .from('professional_blocked_times')
          .select('*')
          .eq('tenant_id', tenantId!)
          .gte('ends_at', startIso)
          .lte('starts_at', endIso),
        supabase
          .from('blocked_times')
          .select('*')
          .eq('tenant_id', tenantId!)
          .gte('end_at', startIso)
          .lte('start_at', endIso),
      ]);

      if (proErr) {
        console.error('Erro ao buscar bloqueios:', proErr);
      }

      const normalizedPro: NormalizedBlock[] = (proBlocks ?? []).map((b: any) => ({
        id: b.id,
        tenant_id: b.tenant_id,
        professional_id: b.professional_id,
        starts_at: b.starts_at,
        ends_at: b.ends_at,
        reason: b.reason ?? null,
        block_type: b.block_type ?? 'custom',
        source: 'pro',
      }));

      const normalizedLegacy: NormalizedBlock[] = (legacyBlocks ?? []).map((b: any) => ({
        id: b.id,
        tenant_id: b.tenant_id,
        professional_id: b.professional_id ?? null,
        starts_at: b.start_at,
        ends_at: b.end_at,
        reason: b.reason ?? null,
        block_type: 'custom',
        source: 'legacy',
      }));

      return [...normalizedPro, ...normalizedLegacy];
    },
  });
}

/**
 * Busca todos os bloqueios ativos/futuros (a partir de hoje) para a tela de visualização de bloqueios.
 */
export function useAllUpcomingTenantBlocks(tenantId: string | null | undefined) {
  return useQuery({
    queryKey: TENANT_ALL_UPCOMING_BLOCKS_KEY(tenantId),
    enabled: !!tenantId,
    staleTime: 0,
    queryFn: async (): Promise<NormalizedBlock[]> => {
      const todayIso = startOfDay(new Date()).toISOString();
      const [{ data: proBlocks }, { data: legacyBlocks }] = await Promise.all([
        supabase
          .from('professional_blocked_times')
          .select('*')
          .eq('tenant_id', tenantId!)
          .gte('ends_at', todayIso)
          .order('starts_at', { ascending: true }),
        supabase
          .from('blocked_times')
          .select('*')
          .eq('tenant_id', tenantId!)
          .gte('end_at', todayIso)
          .order('start_at', { ascending: true }),
      ]);

      const normalizedPro: NormalizedBlock[] = (proBlocks ?? []).map((b: any) => ({
        id: b.id,
        tenant_id: b.tenant_id,
        professional_id: b.professional_id,
        starts_at: b.starts_at,
        ends_at: b.ends_at,
        reason: b.reason ?? null,
        block_type: b.block_type ?? 'custom',
        source: 'pro',
      }));

      const normalizedLegacy: NormalizedBlock[] = (legacyBlocks ?? []).map((b: any) => ({
        id: b.id,
        tenant_id: b.tenant_id,
        professional_id: b.professional_id ?? null,
        starts_at: b.start_at,
        ends_at: b.end_at,
        reason: b.reason ?? null,
        block_type: 'custom',
        source: 'legacy',
      }));

      return [...normalizedPro, ...normalizedLegacy];
    },
  });
}

/**
 * Verifica se um intervalo [slotStart, slotEnd] está bloqueado para um único profissional.
 */
export function isIntervalBlockedForPro(
  slotStart: Date,
  slotEnd: Date,
  blocks: NormalizedBlock[],
  proId: string
): boolean {
  const sMs = slotStart.getTime();
  const eMs = slotEnd.getTime();
  return blocks.some((b) => {
    if (b.professional_id !== null && b.professional_id !== proId) return false;
    const bs = new Date(b.starts_at).getTime();
    const be = new Date(b.ends_at).getTime();
    return sMs < be && bs < eMs;
  });
}

/**
 * Verifica se um intervalo [slotStart, slotEnd] está bloqueado para todos os profissionais alvo.
 * Se `targetProIds` estiver vazio, considera qualquer bloqueio no intervalo.
 */
export function isSlotBlockedForTarget(
  slotStart: Date,
  slotEnd: Date,
  blocks: NormalizedBlock[],
  targetProIds: string[]
): boolean {
  if (targetProIds.length === 0) {
    const sMs = slotStart.getTime();
    const eMs = slotEnd.getTime();
    return blocks.some((b) => {
      const bs = new Date(b.starts_at).getTime();
      const be = new Date(b.ends_at).getTime();
      return sMs < be && bs < eMs;
    });
  }
  return targetProIds.every((proId) => isIntervalBlockedForPro(slotStart, slotEnd, blocks, proId));
}

/**
 * Gera os slots de grade do dia (ex: de 30 em 30 min) dentro do expediente.
 */
export function buildDayTimeSlots(
  day: Date,
  openTimeStr = '08:00',
  closeTimeStr = '20:00',
  stepMinutes = 30
): TimeRange[] {
  const [oh, om] = openTimeStr.split(':').map(Number);
  const [ch, cm] = closeTimeStr.split(':').map(Number);

  const base = startOfDay(day);
  const start = new Date(base);
  start.setHours(Number.isFinite(oh) ? oh : 8, Number.isFinite(om) ? om : 0, 0, 0);

  const end = new Date(base);
  end.setHours(Number.isFinite(ch) ? ch : 20, Number.isFinite(cm) ? cm : 0, 0, 0);

  if (!isBefore(start, end)) {
    start.setHours(8, 0, 0, 0);
    end.setHours(20, 0, 0, 0);
  }

  const slots: TimeRange[] = [];
  let cursor = start;
  while (isBefore(cursor, end)) {
    const next = addMinutes(cursor, stepMinutes);
    if (isAfter(next, end)) break;
    slots.push({ start: cursor, end: next });
    cursor = next;
  }
  return slots;
}

/**
 * Verifica se o dia inteiro está bloqueado para os profissionais alvo.
 */
export function isDayFullyBlocked(
  day: Date,
  blocks: NormalizedBlock[],
  targetProIds: string[],
  openTimeStr = '08:00',
  closeTimeStr = '20:00'
): boolean {
  const slots = buildDayTimeSlots(day, openTimeStr, closeTimeStr, 30);
  if (slots.length === 0) return false;
  return slots.every((s) => isSlotBlockedForTarget(s.start, s.end, blocks, targetProIds));
}

/**
 * Verifica se o dia possui pelo menos um horário bloqueado (parcial ou total).
 */
export function isDayPartiallyOrFullyBlocked(
  day: Date,
  blocks: NormalizedBlock[],
  targetProIds: string[],
  openTimeStr = '08:00',
  closeTimeStr = '20:00'
): { isFullyBlocked: boolean; isPartiallyBlocked: boolean; blockedSlotsCount: number; totalSlotsCount: number } {
  const slots = buildDayTimeSlots(day, openTimeStr, closeTimeStr, 30);
  if (slots.length === 0) {
    return { isFullyBlocked: false, isPartiallyBlocked: false, blockedSlotsCount: 0, totalSlotsCount: 0 };
  }
  const blockedCount = slots.filter((s) => isSlotBlockedForTarget(s.start, s.end, blocks, targetProIds)).length;
  const isFully = blockedCount === slots.length;
  const isPartial = blockedCount > 0 && blockedCount < slots.length;
  return {
    isFullyBlocked: isFully,
    isPartiallyBlocked: isPartial,
    blockedSlotsCount: blockedCount,
    totalSlotsCount: slots.length,
  };
}

/**
 * Mescla intervalos contíguos de horários bloqueados em blocos contínuos limpos.
 */
export function mergeContiguousIntervals(intervals: TimeRange[]): TimeRange[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: TimeRange[] = [{ start: sorted[0].start, end: sorted[0].end }];

  for (let i = 1; i < sorted.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = sorted[i];
    if (curr.start.getTime() <= prev.end.getTime()) {
      if (curr.end.getTime() > prev.end.getTime()) {
        prev.end = curr.end;
      }
    } else {
      merged.push({ start: curr.start, end: curr.end });
    }
  }
  return merged;
}

/**
 * Retorna os intervalos bloqueados consolidados dentro de um dia específico para exibição na Agenda.
 */
export function getConsolidatedDayBlocks(
  day: Date,
  blocks: NormalizedBlock[],
  targetProIds: string[],
  openTimeStr = '08:00',
  closeTimeStr = '20:00'
): TimeRange[] {
  const slots = buildDayTimeSlots(day, openTimeStr, closeTimeStr, 30);
  const blockedSlots = slots.filter((s) => isSlotBlockedForTarget(s.start, s.end, blocks, targetProIds));
  return mergeContiguousIntervals(blockedSlots);
}

/**
 * Substitui os bloqueios de um dia específico para uma lista de profissionais,
 * preservando eventuais partes de bloqueios multi-dia que comecem antes ou terminem depois.
 */
export async function applyDayBlocksInDb(params: {
  tenantId: string;
  date: Date;
  targetProIds: string[];
  newBlockedRanges: TimeRange[];
  isFullDay?: boolean;
  reason?: string;
}) {
  const { tenantId, date, newBlockedRanges, isFullDay, reason } = params;
  let targetProIds = params.targetProIds;

  // Fallback seguro: se targetProIds vier vazio, busca todos os profissionais ativos do salão
  if (targetProIds.length === 0) {
    const { data: pros } = await supabase
      .from('professionals')
      .select('id, active, status')
      .eq('tenant_id', tenantId);
    targetProIds = (pros ?? [])
      .filter((p: any) => p.active !== false && (!p.status || p.status === 'active'))
      .map((p: any) => p.id);
  }

  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);
  const dayStartMs = dayStart.getTime();
  const dayEndMs = dayEnd.getTime();

  // 1. Buscar bloqueios existentes que interceptam este dia
  const { data: existingProBlocks } = await supabase
    .from('professional_blocked_times')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('ends_at', dayStart.toISOString())
    .lte('starts_at', dayEnd.toISOString());

  const { data: existingLegacyBlocks } = await supabase
    .from('blocked_times')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('end_at', dayStart.toISOString())
    .lte('start_at', dayEnd.toISOString());

  const affectedProBlocks = (existingProBlocks ?? []).filter((b: any) =>
    targetProIds.includes(b.professional_id)
  );

  // Recortes para preservar partes fora do dia caso haja bloqueio multi-dias
  const preservedClips: Array<{
    professional_id: string;
    tenant_id: string;
    starts_at: string;
    ends_at: string;
    reason: string | null;
    block_type: 'vacation' | 'day_off' | 'leave' | 'custom';
  }> = [];

  for (const b of affectedProBlocks) {
    const bs = new Date(b.starts_at).getTime();
    const be = new Date(b.ends_at).getTime();
    if (bs < dayStartMs) {
      preservedClips.push({
        professional_id: b.professional_id,
        tenant_id: tenantId,
        starts_at: new Date(bs).toISOString(),
        ends_at: new Date(dayStartMs - 1000).toISOString(),
        reason: b.reason,
        block_type: b.block_type || 'custom',
      });
    }
    if (be > dayEndMs) {
      preservedClips.push({
        professional_id: b.professional_id,
        tenant_id: tenantId,
        starts_at: new Date(dayEndMs + 1000).toISOString(),
        ends_at: new Date(be).toISOString(),
        reason: b.reason,
        block_type: b.block_type || 'custom',
      });
    }
  }

  // Deletar os bloqueios afetados do dia
  if (affectedProBlocks.length > 0) {
    const idsToDelete = affectedProBlocks.map((b: any) => b.id);
    await supabase.from('professional_blocked_times').delete().in('id', idsToDelete);
  }

  // Se existir bloqueio legado no dia correspondente, limpar também
  const affectedLegacy = (existingLegacyBlocks ?? []).filter(
    (b: any) => b.professional_id === null || targetProIds.includes(b.professional_id)
  );
  if (affectedLegacy.length > 0) {
    const legacyIds = affectedLegacy.map((b: any) => b.id);
    await supabase.from('blocked_times').delete().in('id', legacyIds);
  }

  // Montar novas linhas a inserir
  const merged = isFullDay
    ? [{ start: dayStart, end: dayEnd }]
    : mergeContiguousIntervals(newBlockedRanges);

  const rowsToInsert: Array<{
    professional_id: string;
    tenant_id: string;
    starts_at: string;
    ends_at: string;
    reason: string | null;
    block_type: 'vacation' | 'day_off' | 'leave' | 'custom';
  }> = [...preservedClips];

  for (const proId of targetProIds) {
    for (const rng of merged) {
      rowsToInsert.push({
        professional_id: proId,
        tenant_id: tenantId,
        starts_at: rng.start.toISOString(),
        ends_at: rng.end.toISOString(),
        reason: reason ?? (isFullDay ? 'Dia bloqueado' : 'Horário bloqueado'),
        block_type: isFullDay ? 'day_off' : 'custom',
      });
    }
  }

  if (rowsToInsert.length > 0) {
    const { error: insertErr } = await supabase
      .from('professional_blocked_times')
      .insert(rowsToInsert as any);
    if (insertErr) throw insertErr;
  }

  return {
    previousProBlocks: affectedProBlocks,
    dateKey: format(date, 'yyyy-MM-dd'),
  };
}

/**
 * Agrupa bloqueios ativos/futuros por data local (`yyyy-MM-dd`), separando dias inteiros bloqueados
 * de dias com intervalos de horários bloqueados.
 */
export function groupBlocksByDaySummary(
  blocks: NormalizedBlock[],
  targetProIds: string[],
  businessHours: any[]
): Array<{
  date: Date;
  dateKey: string;
  isFullDay: boolean;
  intervals: TimeRange[];
}> {
  if (blocks.length === 0) return [];

  const uniqueDateKeys = new Set<string>();
  const today = startOfDay(new Date());

  for (const b of blocks) {
    if (
      targetProIds.length > 0 &&
      b.professional_id !== null &&
      !targetProIds.includes(b.professional_id)
    ) {
      continue;
    }
    let cursor = startOfDay(new Date(b.starts_at));
    if (isBefore(cursor, today)) cursor = today;
    const endDay = startOfDay(new Date(b.ends_at));
    let safety = 0;
    while (!isAfter(cursor, endDay) && safety < 366) {
      uniqueDateKeys.add(format(cursor, 'yyyy-MM-dd'));
      cursor = addDays(cursor, 1);
      safety++;
    }
  }

  const sortedKeys = Array.from(uniqueDateKeys).sort();
  const summaries: Array<{
    date: Date;
    dateKey: string;
    isFullDay: boolean;
    intervals: TimeRange[];
  }> = [];

  for (const key of sortedKeys) {
    const [yy, mm, dd] = key.split('-').map(Number);
    const d = new Date(yy, mm - 1, dd);
    const bh = businessHours.find((x: any) => x.weekday === d.getDay());
    const openTime = bh?.open_time ? String(bh.open_time).slice(0, 5) : '08:00';
    const closeTime = bh?.close_time ? String(bh.close_time).slice(0, 5) : '20:00';

    const status = isDayPartiallyOrFullyBlocked(d, blocks, targetProIds, openTime, closeTime);
    if (!status.isFullyBlocked && !status.isPartiallyBlocked) continue;

    const intervals = getConsolidatedDayBlocks(d, blocks, targetProIds, openTime, closeTime);
    summaries.push({
      date: d,
      dateKey: key,
      isFullDay: status.isFullyBlocked,
      intervals,
    });
  }

  return summaries;
}

/**
 * Hook com mutações para bloqueio/liberação rápida de horários e múltiplos dias,
 * invalidando automaticamente o cache da Agenda e da Página Pública.
 */
export function useManageBlockedTimes(tenantId: string | null | undefined) {
  const qc = useQueryClient();

  const invalidateAllAvailability = () => {
    qc.invalidateQueries({ queryKey: ['tenant_blocks_range'] });
    qc.invalidateQueries({ queryKey: ['tenant_day_blocks'] });
    qc.invalidateQueries({ queryKey: ['publicStore'] });
    qc.invalidateQueries({ queryKey: ['publicStoreFarDay'] });
  };

  const saveDayBlocksMutation = useMutation({
    mutationFn: async (params: {
      date: Date;
      targetProIds: string[];
      newBlockedRanges: TimeRange[];
      isFullDay?: boolean;
      reason?: string;
    }) => {
      if (!tenantId) throw new Error('Estabelecimento não identificado');
      return applyDayBlocksInDb({
        tenantId,
        ...params,
      });
    },
    onSuccess: () => {
      invalidateAllAvailability();
    },
  });

  const batchDaysBlockMutation = useMutation({
    mutationFn: async (params: {
      dates: Date[];
      targetProIds: string[];
      block: boolean;
      reason?: string;
    }) => {
      if (!tenantId) throw new Error('Estabelecimento não identificado');
      const { dates, targetProIds, block, reason } = params;

      await Promise.all(
        dates.map((d) =>
          applyDayBlocksInDb({
            tenantId,
            date: d,
            targetProIds,
            newBlockedRanges: block ? [{ start: startOfDay(d), end: endOfDay(d) }] : [],
            isFullDay: block,
            reason: reason ?? (block ? 'Dia bloqueado' : undefined),
          })
        )
      );
    },
    onSuccess: () => {
      invalidateAllAvailability();
    },
  });

  const saveMultiDaysToggleMutation = useMutation({
    mutationFn: async (params: {
      daysToBlock: Date[];
      daysToUnblock: Date[];
      targetProIds: string[];
      reason?: string;
    }) => {
      if (!tenantId) throw new Error('Estabelecimento não identificado');
      const { daysToBlock, daysToUnblock, targetProIds, reason } = params;

      await Promise.all([
        ...daysToBlock.map((d) =>
          applyDayBlocksInDb({
            tenantId,
            date: d,
            targetProIds,
            newBlockedRanges: [{ start: startOfDay(d), end: endOfDay(d) }],
            isFullDay: true,
            reason: reason ?? 'Dia bloqueado',
          })
        ),
        ...daysToUnblock.map((d) =>
          applyDayBlocksInDb({
            tenantId,
            date: d,
            targetProIds,
            newBlockedRanges: [],
            isFullDay: false,
          })
        ),
      ]);
    },
    onSuccess: () => {
      invalidateAllAvailability();
    },
  });

  return {
    saveDayBlocks: saveDayBlocksMutation,
    batchDaysBlock: batchDaysBlockMutation,
    saveMultiDaysToggle: saveMultiDaysToggleMutation,
    invalidateAllAvailability,
  };
}
