import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../integrations/supabase/client';
import type { Professional, ProfessionalWorkingHour, Service } from '../types/database';

// ─── Query Keys ───────────────────────────────────────────────────────────────
export const PROFESSIONALS_KEY = (tenantId: string) => ['professionals', tenantId];
export const SERVICES_KEY = (tenantId: string) => ['services', tenantId];

// ─── Default weekly schedule (all days off) ───────────────────────────────────
const DEFAULT_HOURS = (professionalId: string, tenantId: string): Omit<ProfessionalWorkingHour, 'id' | 'created_at'>[] =>
  [0, 1, 2, 3, 4, 5, 6].map(weekday => ({
    professional_id: professionalId,
    tenant_id: tenantId,
    weekday: weekday as ProfessionalWorkingHour['weekday'],
    is_working: weekday >= 1 && weekday <= 6, // Mon–Sat default
    open_time: '09:00:00',
    close_time: '18:00:00',
    lunch_start: '12:00:00',
    lunch_end: '13:00:00',
  }));

const BUCKET = 'public_assets';

// ─── Upload photo to Storage ──────────────────────────────────────────────────
async function uploadPhoto(file: File, tenantId: string, professionalId: string): Promise<string> {
  const ext = file.name.includes('.') ? file.name.split('.').pop() : 'jpg';
  const path = `${tenantId}/professional_${professionalId}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type || 'image/jpeg' });

  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  // Bust cache with a timestamp
  return `${data.publicUrl}?t=${Date.now()}`;
}

async function deletePhoto(photoUrl: string): Promise<void> {
  try {
    // Extract path from public URL
    const match = photoUrl.match(/public_assets\/(.+?)(\?|$)/);
    if (match?.[1]) {
      await supabase.storage.from(BUCKET).remove([match[1]]);
    }
  } catch {
    // Non-critical: don't throw if photo removal fails
  }
}

// ─── Fetch all professionals for tenant ──────────────────────────────────────
async function fetchProfessionals(tenantId: string): Promise<Professional[]> {
  const { data, error } = await supabase
    .from('professionals')
    .select(`
      *,
      professional_working_hours (*),
      professional_services (*, service:services(*))
    `)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as Professional[];
}

// ─── Fetch all services for tenant ───────────────────────────────────────────
async function fetchServices(tenantId: string): Promise<Service[]> {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .order('name', { ascending: true });

  if (error) throw error;
  return (data ?? []) as Service[];
}

// ─── Hooks ────────────────────────────────────────────────────────────────────
export function useProfessionals(tenantId: string | null) {
  return useQuery({
    queryKey: PROFESSIONALS_KEY(tenantId ?? ''),
    queryFn: () => fetchProfessionals(tenantId!),
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 2, // 2 min
  });
}

export function useServices(tenantId: string | null) {
  return useQuery({
    queryKey: SERVICES_KEY(tenantId ?? ''),
    queryFn: () => fetchServices(tenantId!),
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 5,
  });
}

// ─── Create Professional ──────────────────────────────────────────────────────
export interface CreateProfessionalInput {
  name: string;
  role_title: string;
  phone?: string;
  email?: string;
  instagram?: string;
  bio?: string;
  specialties: string[];
  agenda_color: string;
  status: Professional['status'];
  photoFile?: File;
  workingHours: Omit<ProfessionalWorkingHour, 'id' | 'created_at' | 'professional_id' | 'tenant_id'>[];
  serviceIds: string[];
  offers_home_service?: boolean;
  max_home_distance_km?: number;
  home_fee?: number;
}

export function useCreateProfessional(tenantId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateProfessionalInput) => {
      // 1. Insert professional row
      const { data: pro, error: proErr } = await supabase
        .from('professionals')
        .insert({
          tenant_id: tenantId,
          name: input.name,
          role_title: input.role_title || null,
          phone: input.phone || null,
          email: input.email || null,
          instagram: input.instagram || null,
          bio: input.bio || null,
          specialties: input.specialties,
          agenda_color: input.agenda_color,
          status: input.status,
          offers_home_service: input.offers_home_service ?? false,
          max_home_distance_km: input.max_home_distance_km ?? 0,
          home_fee: input.home_fee ?? 0,
        } as any)
        .select('*')
        .single();

      if (proErr) {
        if (proErr.message?.includes('LIMITE_PROFISSIONAIS_ATINGIDO')) {
          throw new Error('Limite de profissionais ativos atingido no seu plano. Faça um upgrade para adicionar mais.');
        }
        throw proErr;
      }
      const proId = pro.id;

      // 2. Upload photo if provided
      if (input.photoFile) {
        const photoUrl = await uploadPhoto(input.photoFile, tenantId, proId);
        await supabase.from('professionals').update({ photo_url: photoUrl } as any).eq('id', proId);
      }

      // 3. Insert working hours
      const hours = input.workingHours.map(h => ({
        ...h,
        professional_id: proId,
        tenant_id: tenantId,
      }));
      if (hours.length > 0) {
        const { error: hoursErr } = await supabase.from('professional_working_hours').insert(hours as any);
        if (hoursErr) throw hoursErr;
      } else {
        // Insert defaults
        const { error: hoursErr } = await supabase
          .from('professional_working_hours')
          .insert(DEFAULT_HOURS(proId, tenantId) as any);
        if (hoursErr) throw hoursErr;
      }

      // 4. Insert service relationships
      if (input.serviceIds.length > 0) {
        const rows = input.serviceIds.map(sid => ({
          professional_id: proId,
          service_id: sid,
          tenant_id: tenantId,
        }));
        const { error: svcErr } = await supabase.from('professional_services').insert(rows as any);
        if (svcErr) throw svcErr;
      }

      return pro;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PROFESSIONALS_KEY(tenantId) });
    },
  });
}

// ─── Update Professional ──────────────────────────────────────────────────────
export interface UpdateProfessionalInput extends Partial<CreateProfessionalInput> {
  id: string;
  currentPhotoUrl?: string | null;
}

export function useUpdateProfessional(tenantId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateProfessionalInput) => {
      const { id, photoFile, workingHours, serviceIds, ...fields } = input;

      // 1. Upload new photo if provided
      let photoUrl: string | undefined;
      if (photoFile) {
        photoUrl = await uploadPhoto(photoFile, tenantId, id);
      }

      // 2. Update core row
      const updatePayload: Record<string, unknown> = { ...fields };
      if (photoUrl) updatePayload.photo_url = photoUrl;
      delete updatePayload.currentPhotoUrl;

      const { error: upErr } = await supabase
        .from('professionals')
        .update(updatePayload as any)
        .eq('id', id);
      if (upErr) {
        if (upErr.message?.includes('LIMITE_PROFISSIONAIS_ATINGIDO')) {
          throw new Error('Limite de profissionais ativos atingido no seu plano. Faça um upgrade para adicionar mais.');
        }
        throw upErr;
      }

      // 3. Upsert working hours
      if (workingHours && workingHours.length > 0) {
        const rows = workingHours.map(h => ({
          ...h,
          professional_id: id,
          tenant_id: tenantId,
        }));
        const { error: hErr } = await supabase
          .from('professional_working_hours')
          .upsert(rows as any, { onConflict: 'professional_id,weekday' });
        if (hErr) throw hErr;
      }

      // 4. Replace service relationships
      if (serviceIds !== undefined) {
        // Delete existing
        await supabase.from('professional_services').delete().eq('professional_id', id);
        // Insert new
        if (serviceIds.length > 0) {
          const rows = serviceIds.map(sid => ({
            professional_id: id,
            service_id: sid,
            tenant_id: tenantId,
          }));
          const { error: sErr } = await supabase.from('professional_services').insert(rows as any);
          if (sErr) throw sErr;
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PROFESSIONALS_KEY(tenantId) });
    },
  });
}

// ─── Delete Professional ──────────────────────────────────────────────────────
export function useDeleteProfessional(tenantId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, photoUrl }: { id: string; photoUrl: string | null }) => {
      // 1. Remove photo from Storage first
      if (photoUrl) await deletePhoto(photoUrl);

      // 2. Soft delete the row (set status to inactive) instead of hard delete
      const { error } = await supabase.from('professionals').update({ status: 'inactive' } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PROFESSIONALS_KEY(tenantId) });
    },
  });
}

