import { useQuery } from '@tanstack/react-query';
import { supabase } from '../integrations/supabase/client';
import { addDays, startOfDay } from 'date-fns';

export const PUBLIC_STORE_QUERY_KEY = (slug: string) => ['publicStore', slug];

async function fetchPublicStore(slug: string) {
  // 1. Verificar se é um Portal Demo em demo_portals
  if (slug) {
    const { data: demoPortal } = await supabase
      .from('demo_portals')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();

    if (demoPortal) {
      const isExpired = new Date(demoPortal.expires_at) <= new Date();
      if (!demoPortal.active || isExpired) {
        throw new Error('Demonstração expirada ou desativada');
      }

      // Incrementar contagem de visualizações
      supabase.rpc('increment_demo_portal_views', { p_slug: slug }).then(() => {});

      const demoTenant = {
        id: demoPortal.id,
        name: demoPortal.business_name,
        slug: demoPortal.slug,
        business_type: demoPortal.business_type || 'barbearia',
        status: 'active',
        isDemo: true,
        owner_whatsapp: demoPortal.owner_whatsapp,
      };

      const demoSettings = {
        id: 'settings_' + demoPortal.id,
        tenant_id: demoPortal.id,
        fantasy_name: demoPortal.business_name,
        logo_url: demoPortal.logo_url || null,
        banner_url: demoPortal.banner_url || null,
        phone: demoPortal.owner_whatsapp,
        whatsapp_number: demoPortal.owner_whatsapp,
        theme_preset: 'elegant',
        custom_palette: {
          primary: demoPortal.primary_color || '#FD6500',
          background: '#F8FAFC',
          card: '#FFFFFF',
          text: '#0F172A',
          fontStyle: 'sans',
          btnTextColor: '#FFFFFF',
          slogan: '',
          description: '',
        },
        booking_payment_mode: 'local',
        accept_local_payment: true,
        accept_online_payment: false,
        allow_cancel: true,
        allow_reschedule: true,
        deposit_percentage: 50,
        slogan: 'Agende seu horário online em menos de 1 minuto.',
        full_address: 'Atendimento com horário marcado',
      };

      const demoServices = (demoPortal.services || []).map((s: any, idx: number) => ({
        id: s.id || `srv_${idx}`,
        tenant_id: demoPortal.id,
        name: s.name,
        price: Number(s.price) || 0,
        duration_minutes: Number(s.duration_minutes) || 30,
        photo_url: s.photo_url || null,
        active: true,
        display_order: idx,
      }));

      const demoPros = (demoPortal.professionals || []).map((p: any, idx: number) => ({
        id: p.id || `pro_${idx}`,
        tenant_id: demoPortal.id,
        name: p.name,
        photo_url: p.photo_url || null,
        role_title: p.role_title || 'Profissional',
        status: 'active',
        active: true,
      }));

      const demoHours = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
        id: `h_${weekday}`,
        tenant_id: demoPortal.id,
        weekday,
        is_open: weekday !== 0,
        open_time: '09:00:00',
        close_time: weekday === 6 ? '18:00:00' : '19:00:00',
      }));

      return {
        tenant: demoTenant,
        settings: demoSettings,
        services: demoServices,
        professionals: demoPros,
        businessHours: demoHours,
        professionalWorkingHours: [],
        professionalBlockedTimes: [],
        bookings: [],
        professionalServices: [],
        isStripeEnabled: false,
        isDemo: true,
      };
    }
  }

  // 2. Buscar tenant real por slug na tabela tenants
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
    // Keep bookings that are definitively occupying the slot
    if (['confirmed', 'arrived', 'in_progress', 'completed'].includes(b.status)) {
      return true;
    }
    
    // For pending, if older than 15 min, consider abandoned
    if (b.status === 'pending' && b.created_at) {
      const createdAt = new Date(b.created_at);
      const ageMinutes = (now.getTime() - createdAt.getTime()) / (1000 * 60);
      return ageMinutes <= 15;
    }
    
    // Catch-all for any other weird status
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
    isStripeEnabled: !!connectData?.charges_enabled
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

