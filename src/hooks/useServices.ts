import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../integrations/supabase/client';

export interface Service {
  id: string;
  tenant_id: string;
  name: string;
  price: number;
  original_price: number | null;
  duration_minutes: number;
  buffer_minutes: number;
  category: string | null;
  description: string | null;
  commission_pct: number;
  code: string | null;
  tags: string[];
  notes: string | null;
  color: string | null;
  photo_url: string | null;
  active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
  service_mode: "instore" | "home" | "both";
  home_price_extra: number;
}

export type ServiceInput = Omit<Service, 'id' | 'tenant_id' | 'created_at' | 'updated_at'> & {
  photoFile?: File;
};

const BUCKET = 'public_assets';

async function uploadServicePhoto(file: File, tenantId: string, serviceId: string): Promise<string> {
  const ext = file.name.split('.').pop();
  const path = `${tenantId}/service_${serviceId}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}

async function deleteServicePhoto(photoUrl: string) {
  try {
    const match = photoUrl.match(/public_assets\/(.+?)(\?|$)/);
    if (match?.[1]) await supabase.storage.from(BUCKET).remove([match[1]]);
  } catch { /* non-critical */ }
}

export const SERVICES_QUERY_KEY = (tenantId: string) => ['services', tenantId];

async function fetchServices(tenantId: string): Promise<Service[]> {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('display_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Service[];
}

export function useServices(tenantId: string | null) {
  return useQuery({
    queryKey: SERVICES_QUERY_KEY(tenantId ?? ''),
    queryFn: () => fetchServices(tenantId!),
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 3,
  });
}

export function useCreateService(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ServiceInput) => {
      const { photoFile, ...fields } = input;
      const { data: svc, error } = await supabase
        .from('services')
        .insert({ ...fields, tenant_id: tenantId } as any)
        .select('*').single();
      if (error) throw error;
      if (photoFile) {
        const url = await uploadServicePhoto(photoFile, tenantId, svc.id);
        await supabase.from('services').update({ photo_url: url } as any).eq('id', svc.id);
      }
      return svc;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: SERVICES_QUERY_KEY(tenantId) }),
  });
}

export function useUpdateService(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, photoFile, ...fields }: Partial<ServiceInput> & { id: string }) => {
      let photoUrl: string | undefined;
      if (photoFile) photoUrl = await uploadServicePhoto(photoFile, tenantId, id);
      const payload = photoUrl ? { ...fields, photo_url: photoUrl } : fields;
      const { error } = await supabase.from('services').update(payload as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: SERVICES_QUERY_KEY(tenantId) }),
  });
}

export function useDeleteService(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, photoUrl }: { id: string; photoUrl: string | null }) => {
      if (photoUrl) await deleteServicePhoto(photoUrl);
      const { error } = await supabase.from('services').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: SERVICES_QUERY_KEY(tenantId) }),
  });
}

