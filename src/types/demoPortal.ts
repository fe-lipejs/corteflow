export interface DemoService {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
  photo_url?: string | null;
}

export interface DemoProfessional {
  id: string;
  name: string;
  photo_url?: string | null;
  role_title?: string;
}

export interface DemoPortal {
  id: string;
  slug: string;
  business_name: string;
  business_type?: 'barbearia' | 'salao' | 'esmalteria' | string;
  logo_url: string | null;
  banner_url: string | null;
  primary_color: string | null;
  services: DemoService[];
  professionals: DemoProfessional[];
  owner_whatsapp: string;
  active: boolean;
  expires_at: string;
  views: number;
  created_at: string;
}

export interface CreateDemoPortalInput {
  business_name: string;
  business_type?: 'barbearia' | 'salao' | 'esmalteria' | string;
  slug?: string;
  logo_url?: string | null;
  banner_url?: string | null;
  primary_color?: string;
  services: (Omit<DemoService, 'id'> & { id?: string })[];
  professionals: (Omit<DemoProfessional, 'id'> & { id?: string })[];
  owner_whatsapp: string;
  expires_in_days?: number;
}


