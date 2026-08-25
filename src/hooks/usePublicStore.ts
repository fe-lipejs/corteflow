import { useQuery } from '@tanstack/react-query';
import { supabase } from '../integrations/supabase/client';
import { addDays, startOfDay } from 'date-fns';

export const PUBLIC_STORE_QUERY_KEY = (slug: string) => ['publicStore', slug];

async function fetchPublicStore(slug: string) {
  // Fetch tenant by slug
  let { data: tenant } = await supabase.from('tenants').select('*').eq('slug', slug).maybeSingle();
  
  if (!tenant) {
    if (slug === 'demo' || !slug) {
      const { data } = await supabase.from('tenants').select('*').is('deleted_at', null).limit(1).maybeSingle();
      tenant = data;
    }
  }

  // If tenant is soft-deleted or marked blocked/suspended/deleted
  if (tenant && (tenant.deleted_at || ['blocked', 'suspended', 'deleted', 'canceled'].includes(tenant.status))) {
    tenant = null;
  }

  if (!tenant) {
    throw new Error('Barbearia/Salão não encontrado ou desativado');
  }

  const todayStr = startOfDay(new Date()).toISOString();
  const futureStr = addDays(new Date(), 30).toISOString();

  const [
    { data: settings },
    { data: srvData },
    { data: proData },
    { data: hData },
    { data: proHoursData },
    { data: blockedData },
    { data: bookingsData },
    { data: proServicesData },
    { data: connectData }
  ] = await Promise.all([
    supabase.from('tenant_settings').select('*').eq('tenant_id', tenant.id).maybeSingle(),
    supabase.from('services').select('*').eq('tenant_id', tenant.id),
    supabase.from('professionals').select('*').eq('tenant_id', tenant.id),
    supabase.from('business_hours').select('*').eq('tenant_id', tenant.id),
    supabase.from('professional_working_hours').select('*').eq('tenant_id', tenant.id),
    supabase.from('professional_blocked_times').select('*').eq('tenant_id', tenant.id).gte('ends_at', todayStr).lte('starts_at', futureStr),
    supabase.rpc('get_public_booking_slots', { p_tenant_id: tenant.id, p_start: todayStr, p_end: futureStr }),
    supabase.from('professional_services').select('*').eq('tenant_id', tenant.id),
    supabase.from('stripe_connect_accounts').select('charges_enabled, stripe_account_id').eq('tenant_id', tenant.id).maybeSingle()
  ]);

  // Filtra serviços ativos garantindo compatibilidade caso a flag 'active' seja null no banco antigo
  const services = (srvData ?? []).filter((s: any) => s.active !== false).sort((a: any, b: any) => {
    if (a.display_order !== b.display_order) return (a.display_order || 0) - (b.display_order || 0);
    return a.name?.localeCompare(b.name || '');
  });

  // Filtra profissionais ativos
  const professionals = (proData ?? []).filter((p: any) => 
    p.status === "active" || !p.status
  ).sort((a: any, b: any) => a.name?.localeCompare(b.name || ''));

  const now = new Date();
  const validBookings = (bookingsData ?? []).filter((b: any) => {
    if (b.status === 'confirmed') return true;
    // For pending, if older than 15 min, consider abandoned
    if (b.created_at) {
      const createdAt = new Date(b.created_at);
      const ageMinutes = (now.getTime() - createdAt.getTime()) / (1000 * 60);
      return ageMinutes <= 15;
    }
    return true;
  });

  return {
    tenant,
    settings: settings || null,
    services,
    professionals,
    businessHours: hData || [],
    professionalWorkingHours: proHoursData || [],
    professionalBlockedTimes: blockedData || [],
    bookings: validBookings,
    professionalServices: proServicesData || [],
    isStripeEnabled: !!connectData?.stripe_account_id
  };
}

export function usePublicStore(slug: string | null | undefined) {
  return useQuery({
    queryKey: PUBLIC_STORE_QUERY_KEY(slug || ''),
    queryFn: () => fetchPublicStore(slug!),
    enabled: !!slug,
    staleTime: 0, // Always fetch fresh to reflect admin changes instantly
    retry: 1
  });
}

