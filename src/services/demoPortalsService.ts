import { supabase } from '../integrations/supabase/client';
import type { DemoPortal, CreateDemoPortalInput } from '../types/demoPortal';

/**
 * Utilitário para limpar e formatar slug
 */
export function sanitizeSlug(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Utilitário para gerar slug amigável com sufixo aleatório
 * Exemplo: "Barbearia Dom João" -> "barbearia-dom-joao-x7k2"
 */
export function generateDemoSlug(businessName: string): string {
  const base = sanitizeSlug(businessName) || 'demo';
  const suffix = Math.random().toString(36).substring(2, 6);
  return `${base}-${suffix}`;
}

export const demoPortalsService = {
  sanitizeSlug,

  async listAll(): Promise<DemoPortal[]> {
    const { data, error } = await supabase
      .from('demo_portals')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as DemoPortal[];
  },

  async getBySlug(slug: string): Promise<DemoPortal | null> {
    const { data, error } = await supabase
      .from('demo_portals')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Não encontrado
      throw error;
    }

    return data as DemoPortal;
  },

  async create(input: CreateDemoPortalInput): Promise<DemoPortal> {
    let slug = input.slug ? sanitizeSlug(input.slug) : '';
    if (!slug) {
      slug = generateDemoSlug(input.business_name);
    } else {
      const { data: existing } = await supabase
        .from('demo_portals')
        .select('id')
        .eq('slug', slug)
        .maybeSingle();

      if (existing) {
        throw new Error(`O link "/paginas/${slug}" já está em uso. Por favor, escolha outro link.`);
      }
    }

    const expiresInDays = input.expires_in_days && input.expires_in_days > 0 ? input.expires_in_days : 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const servicesWithIds = input.services.map((s) => ({
      id: s.id || 'srv_' + Math.random().toString(36).substring(2, 9),
      name: s.name.trim(),
      price: Number(s.price) || 0,
      duration_minutes: Number(s.duration_minutes) || 30,
      photo_url: s.photo_url || null,
    }));

    const professionalsWithIds = input.professionals.map((p) => ({
      id: p.id || 'pro_' + Math.random().toString(36).substring(2, 9),
      name: p.name.trim(),
      photo_url: p.photo_url || null,
      role_title: p.role_title || '',
    }));

    const { data, error } = await supabase
      .from('demo_portals')
      .insert({
        slug,
        business_name: input.business_name.trim(),
        business_type: input.business_type || 'barbearia',
        logo_url: input.logo_url || null,
        banner_url: input.banner_url || null,
        primary_color: input.primary_color || '#FD6500',
        services: servicesWithIds,
        professionals: professionalsWithIds,
        owner_whatsapp: input.owner_whatsapp.trim(),
        active: true,
        expires_at: expiresAt.toISOString(),
        views: 0,
      })
      .select()
      .single();

    if (error) throw error;
    return data as DemoPortal;
  },

  async update(id: string, updates: Partial<DemoPortal>): Promise<DemoPortal> {
    const payload: Record<string, any> = { ...updates };

    if (payload.slug !== undefined) {
      const cleanSlug = sanitizeSlug(payload.slug);
      if (!cleanSlug) {
        throw new Error('O link personalizado não pode ficar vazio.');
      }
      const { data: existing } = await supabase
        .from('demo_portals')
        .select('id')
        .eq('slug', cleanSlug)
        .neq('id', id)
        .maybeSingle();

      if (existing) {
        throw new Error(`O link "/paginas/${cleanSlug}" já está em uso por outro portal de teste. Escolha outro.`);
      }
      payload.slug = cleanSlug;
    }

    if (payload.services) {
      payload.services = payload.services.map((s: any) => ({
        id: s.id || 'srv_' + Math.random().toString(36).substring(2, 9),
        name: s.name.trim(),
        price: Number(s.price) || 0,
        duration_minutes: Number(s.duration_minutes) || 30,
        photo_url: s.photo_url || null,
      }));
    }

    if (payload.professionals) {
      payload.professionals = payload.professionals.map((p: any) => ({
        id: p.id || 'pro_' + Math.random().toString(36).substring(2, 9),
        name: p.name.trim(),
        photo_url: p.photo_url || null,
        role_title: p.role_title || '',
      }));
    }

    const { data, error } = await supabase
      .from('demo_portals')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as DemoPortal;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('demo_portals')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async incrementViews(slug: string): Promise<void> {
    try {
      await supabase.rpc('increment_demo_portal_views', { p_slug: slug });
    } catch (err) {
      console.warn('Erro ao incrementar visualizações do demo:', err);
    }
  },

  async uploadImage(file: File, folder: string = 'general'): Promise<string> {
    const fileExt = file.name.split('.').pop() || 'png';
    const fileName = `${folder}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
    const filePath = `${folder}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('demo-portals')
      .upload(filePath, file, { cacheControl: '3600', upsert: true });

    if (uploadError) {
      // Fallback para tenant-assets caso o bucket demo-portals tenha restrição
      const { error: fallbackError } = await supabase.storage
        .from('tenant-assets')
        .upload(filePath, file, { cacheControl: '3600', upsert: true });

      if (fallbackError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('tenant-assets')
        .getPublicUrl(filePath);

      return publicUrlData.publicUrl;
    }

    const { data: publicUrlData } = supabase.storage
      .from('demo-portals')
      .getPublicUrl(filePath);

    return publicUrlData.publicUrl;
  },

  async uploadLogo(file: File): Promise<string> {
    return this.uploadImage(file, 'logos');
  },

  async uploadBanner(file: File): Promise<string> {
    return this.uploadImage(file, 'banners');
  },

  async uploadServicePhoto(file: File): Promise<string> {
    return this.uploadImage(file, 'services');
  },

  async uploadProfessionalPhoto(file: File): Promise<string> {
    return this.uploadImage(file, 'professionals');
  },
};

