export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ─── Enums / Literals ────────────────────────────────────────────────────────
export type BusinessType = 'barbearia' | 'salao' | 'esmalteria';
export type TenantStatus = 'trial' | 'active' | 'suspended' | 'blocked' | 'canceled';
export type Language = 'pt' | 'en' | 'es' | 'fr' | 'de';
export type UserRole = 'super_admin' | 'admin' | 'manager' | 'professional' | 'client' | 'owner';
export type PlanKey = 'starter' | 'growth';
export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'canceled' | 'no_show';
export type PaymentMode = 'local' | 'deposit' | 'full';
export type TransactionType = 'income' | 'expense';
export type ProfessionalStatus = 'active' | 'vacation' | 'leave' | 'inactive';
export type BlockType = 'vacation' | 'day_off' | 'leave' | 'custom';
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Sun, 6=Sat

// ─── Core Row Types ───────────────────────────────────────────────────────────
export interface Professional {
  id: string;
  tenant_id: string;
  name: string;
  role_title: string | null;
  photo_url: string | null;
  // Extended fields (from migration 0002)
  instagram: string | null;
  phone: string | null;
  email: string | null;
  bio: string | null;
  specialties: string[];
  agenda_color: string;
  status: ProfessionalStatus;
  // New fields
  experience_years: number | null;
  languages: string[] | null;
  created_at: string;
  updated_at: string;
  // Relations (joined)
  professional_working_hours?: ProfessionalWorkingHour[];
  professional_services?: ProfessionalService[];
}

export interface ProfessionalWorkingHour {
  id: string;
  professional_id: string;
  tenant_id: string;
  weekday: Weekday;
  is_working: boolean;
  open_time: string | null;   // "HH:mm:ss"
  close_time: string | null;
  lunch_start: string | null;
  lunch_end: string | null;
  created_at: string;
}

export interface ProfessionalService {
  id: string;
  professional_id: string;
  service_id: string;
  tenant_id: string;
  created_at: string;
  // Joined
  service?: Service;
}

export interface ProfessionalBlockedTime {
  id: string;
  professional_id: string;
  tenant_id: string;
  reason: string | null;
  block_type: BlockType;
  starts_at: string;
  ends_at: string;
  created_at: string;
}

export interface Service {
  id: string;
  tenant_id: string;
  name: string;
  price: number;
  duration_minutes: number;
  buffer_minutes: number;
  category: string | null;
  color: string | null;
  active: boolean;
  // New fields
  photo_url: string | null;
  description: string | null;
  original_price: number | null;
}

export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string;
          owner_user_id: string;
          business_type: BusinessType;
          name: string;
          slug: string;
          status: TenantStatus;
          language: Language;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['tenants']['Row'], 'id' | 'created_at' | 'status' | 'language'> & {
          id?: string;
          status?: TenantStatus;
          language?: Language;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['tenants']['Insert']>;
      };
      profiles: {
        Row: {
          id: string;
          tenant_id: string | null;
          role: UserRole;
          full_name: string;
          avatar_url: string | null;
          onboarding_completed: boolean;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'onboarding_completed'> & {
          onboarding_completed?: boolean;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      categories: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          type: 'service' | 'product' | 'both';
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['categories']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['categories']['Insert']>;
      };
      plans: {
        Row: {
          id: string;
          key: PlanKey;
          name: string;
          description: string | null;
          max_professionals: number;
          allow_products: boolean;
          features: Json;
          permissions: Json;
          limits: Json;
          trial_days: number;
          active: boolean;
          sort_order: number;
        };
        Insert: Omit<Database['public']['Tables']['plans']['Row'], 'id'> & { id?: string };
        Update: Partial<Database['public']['Tables']['plans']['Insert']>;
      };
      subscriptions: {
        Row: {
          id: string;
          tenant_id: string;
          plan_id: string;
          stripe_subscription_id: string | null;
          stripe_customer_id: string | null;
          status: string;
          trial_ends_at: string | null;
          current_period_end: string | null;
        };
        Insert: Omit<Database['public']['Tables']['subscriptions']['Row'], 'id'> & { id?: string };
        Update: Partial<Database['public']['Tables']['subscriptions']['Insert']>;
      };
      subscription_contracts: {
        Row: {
          subscription_id: string;
          plan_id: string;
          price_amount: number;
          currency: string;
          max_professionals: number;
          allow_products: boolean;
          features: Json;
          permissions: Json;
          limits: Json;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['subscription_contracts']['Row'], 'created_at' | 'updated_at'> & { created_at?: string, updated_at?: string };
        Update: Partial<Database['public']['Tables']['subscription_contracts']['Insert']>;
      };
      sys_permissions: {
        Row: {
          key: string;
          module: string;
          description: string | null;
        };
        Insert: Database['public']['Tables']['sys_permissions']['Row'];
        Update: Partial<Database['public']['Tables']['sys_permissions']['Insert']>;
      };
      sys_features: {
        Row: {
          key: string;
          module: string;
          description: string | null;
        };
        Insert: Database['public']['Tables']['sys_features']['Row'];
        Update: Partial<Database['public']['Tables']['sys_features']['Insert']>;
      };
      sys_role_permissions: {
        Row: {
          role: string;
          permission_key: string;
        };
        Insert: Database['public']['Tables']['sys_role_permissions']['Row'];
        Update: Partial<Database['public']['Tables']['sys_role_permissions']['Insert']>;
      };
      professionals: {
        Row: Professional;
        Insert: Omit<Professional, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['professionals']['Insert']>;
      };
      professional_working_hours: {
        Row: ProfessionalWorkingHour;
        Insert: Omit<ProfessionalWorkingHour, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Database['public']['Tables']['professional_working_hours']['Insert']>;
      };
      professional_services: {
        Row: ProfessionalService;
        Insert: Omit<ProfessionalService, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Database['public']['Tables']['professional_services']['Insert']>;
      };
      professional_blocked_times: {
        Row: ProfessionalBlockedTime;
        Insert: Omit<ProfessionalBlockedTime, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Database['public']['Tables']['professional_blocked_times']['Insert']>;
      };
      services: {
        Row: Service;
        Insert: Omit<Service, 'id'> & { id?: string };
        Update: Partial<Database['public']['Tables']['services']['Insert']>;
      };
      products: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          description: string | null;
          category: string | null;
          price: number;
          promo_price: number | null;
          code: string | null;
          stock: number;
          min_stock: number;
          brand: string | null;
          photo_url: string | null;
          active: boolean;
          display_order: number;
          created_at: string;
          updated_at: string;
          linked_service_id: string | null;
        };
        Insert: Omit<Database['public']['Tables']['products']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['products']['Insert']>;
      };
      customers: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          phone: string;
          email: string | null;
          notes: string | null;
          birthday: string | null;
          segment: 'novo' | 'fiel' | 'vip' | 'inativo' | null;
          total_spent: number;
          first_visit: string | null;
          last_visit: string | null;
          next_visit: string | null;
          visit_count: number;
          past_services: string[] | null;
          favorite_professionals: string[] | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['customers']['Row'], 'id' | 'created_at' | 'total_spent' | 'visit_count'> & {
          id?: string;
          created_at?: string;
          total_spent?: number;
          visit_count?: number;
          first_visit?: string | null;
          last_visit?: string | null;
          next_visit?: string | null;
          past_services?: string[] | null;
          favorite_professionals?: string[] | null;
        };
        Update: Partial<Database['public']['Tables']['customers']['Insert']>;
      };
      bookings: {
        Row: {
          id: string;
          tenant_id: string;
          customer_id: string;
          professional_id: string | null;
          service_id: string;
          order_number: string;
          scheduled_at: string;
          status: BookingStatus;
          payment_mode: PaymentMode;
          amount_paid: number;
          amount_total: number;
          notes: string | null;
          access_code: string | null;
          reschedule_count: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['bookings']['Row'], 'id' | 'created_at' | 'amount_paid' | 'reschedule_count'> & {
          id?: string;
          created_at?: string;
          amount_paid?: number;
          reschedule_count?: number;
        };
        Update: Partial<Database['public']['Tables']['bookings']['Insert']>;
      };
      booking_history: {
        Row: {
          id: string;
          tenant_id: string;
          booking_id: string;
          action: string;
          reason: string | null;
          details: Json | null;
          actor_type: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['booking_history']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['booking_history']['Insert']>;
      };
      tenant_settings: {
        Row: {
          id: string;
          tenant_id: string;
          theme_preset: string | null;
          custom_palette: Json | null;
          logo_url: string | null;
          banner_url: string | null;
          short_description: string | null;
          phone: string | null;
          address: string | null;
          instagram: string | null;
          whatsapp_number: string | null;
          booking_payment_mode: string | null;
          deposit_percentage: number | null;
          // New fields
          fantasy_name: string | null;
          slogan: string | null;
          description: string | null;
          facebook: string | null;
          tiktok: string | null;
          website: string | null;
          email: string | null;
          founded_year: number | null;
          average_response_time: string | null;
          languages_spoken: string[] | null;
          map_link: string | null;
          latitude: number | null;
          longitude: number | null;
          full_address: string | null;
          zip_code: string | null;
          street_number: string | null;
          complement: string | null;
          neighborhood: string | null;
          city: string | null;
          state: string | null;
          country: string | null;
          allow_reschedule: boolean;
          reschedule_deadline_hours: number;
          max_reschedules: number;
          allow_cancel: boolean;
          cancel_deadline_hours: number;
        };
        Insert: Omit<Database['public']['Tables']['tenant_settings']['Row'], 'id'> & {
          id?: string;
          allow_reschedule?: boolean;
          reschedule_deadline_hours?: number;
          max_reschedules?: number;
          allow_cancel?: boolean;
          cancel_deadline_hours?: number;
        };
        Update: Partial<Database['public']['Tables']['tenant_settings']['Insert']>;
      };
      business_hours: {
        Row: {
          id: string;
          tenant_id: string;
          weekday: number;
          is_open: boolean;
          open_time: string;
          close_time: string;
          lunch_start: string | null;
          lunch_end: string | null;
        };
        Insert: Omit<Database['public']['Tables']['business_hours']['Row'], 'id'> & { id?: string };
        Update: Partial<Database['public']['Tables']['business_hours']['Insert']>;
      };
    };
    Enums: {};
  };
}
