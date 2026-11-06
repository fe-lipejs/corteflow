import { useQuery } from '@tanstack/react-query';
import { endOfDay, startOfDay } from 'date-fns';
import { supabase } from '../integrations/supabase/client';
import { DEFAULT_MAX_ADVANCE_DAYS, resolveMaxAdvanceDays } from '../lib/bookingHorizon';

export const TENANT_BOOKING_HORIZON_KEY = (tenantId: string | null | undefined) => [
  'tenant_booking_horizon',
  tenantId ?? '',
];

export const TENANT_AVAILABILITY_META_KEY = (tenantId: string | null | undefined) => [
  'tenant_availability_meta',
  tenantId ?? '',
];

export const TENANT_DAY_BLOCKS_KEY = (tenantId: string | null | undefined, dateKey: string) => [
  'tenant_day_blocks',
  tenantId ?? '',
  dateKey,
];

/**
 * Busca `max_advance_days` atualizado do estabelecimento (`staleTime: 0` para evitar cache defasado).
 * Retorna `number` (dias contando com hoje) ou `null` ("Sem limite").
 */
export function useTenantBookingHorizon(tenantId: string | null | undefined) {
  const query = useQuery({
    queryKey: TENANT_BOOKING_HORIZON_KEY(tenantId),
    enabled: !!tenantId,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_settings')
        .select('id, max_advance_days')
        .eq('tenant_id', tenantId!)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        return { maxAdvanceDays: DEFAULT_MAX_ADVANCE_DAYS, hasSettingsRow: false };
      }
      return {
        maxAdvanceDays: resolveMaxAdvanceDays((data as any).max_advance_days, true),
        hasSettingsRow: true,
      };
    },
  });

  return {
    ...query,
    maxAdvanceDays: query.data ? query.data.maxAdvanceDays : DEFAULT_MAX_ADVANCE_DAYS,
  };
}

/**
 * Metadados de disponibilidade da equipe para o agendamento/reagendamento manual na Agenda
 * (`professional_working_hours` e `professional_services`), garantindo paridade total com a página pública.
 */
export function useTenantAvailabilityMeta(tenantId: string | null | undefined) {
  return useQuery({
    queryKey: TENANT_AVAILABILITY_META_KEY(tenantId),
    enabled: !!tenantId,
    staleTime: 30_000,
    queryFn: async () => {
      const [{ data: proWorkingHours }, { data: proServices }] = await Promise.all([
        supabase
          .from('professional_working_hours')
          .select('*')
          .eq('tenant_id', tenantId!),
        supabase
          .from('professional_services')
          .select('*')
          .eq('tenant_id', tenantId!),
      ]);

      return {
        professionalWorkingHours: proWorkingHours ?? [],
        professionalServices: proServices ?? [],
      };
    },
  });
}

/**
 * Busca bloqueios ativos (`professional_blocked_times` + `blocked_times`) que interceptam o dia selecionado.
 */
export function useTenantDayBlocks(tenantId: string | null | undefined, date: Date | null | undefined) {
  const dayStart = date ? startOfDay(date) : null;
  const dayEnd = date ? endOfDay(date) : null;
  const dateKey = dayStart ? dayStart.toISOString().slice(0, 10) : '';

  return useQuery({
    queryKey: TENANT_DAY_BLOCKS_KEY(tenantId, dateKey),
    enabled: !!tenantId && !!dayStart && !!dayEnd,
    staleTime: 0,
    queryFn: async () => {
      const startIso = dayStart!.toISOString();
      const endIso = dayEnd!.toISOString();

      const [{ data: proBlocks }, { data: legacyBlocks }] = await Promise.all([
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

      const normalizedLegacy = (legacyBlocks ?? []).map((b: any) => ({
        id: b.id,
        tenant_id: b.tenant_id,
        professional_id: b.professional_id ?? null,
        starts_at: b.start_at,
        ends_at: b.end_at,
        reason: b.reason ?? null,
      }));

      return [...(proBlocks ?? []), ...normalizedLegacy];
    },
  });
}

