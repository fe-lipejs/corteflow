-- ============================================================================
-- Migration: Complete PWA & Web Push Notifications Architecture (Android & iOS)
-- ============================================================================

-- 1. Server-only table for auto-provisioned VAPID keys fallback
--    RLS is enabled with ZERO public/authenticated policies so ONLY service_role
--    inside Supabase Edge Functions can read or write to this table.
CREATE TABLE IF NOT EXISTS public.system_vapid_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  public_key TEXT NOT NULL,
  private_key_jwk JSONB NOT NULL,
  subject TEXT NOT NULL DEFAULT 'mailto:contato@raffros.com',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.system_vapid_config ENABLE ROW LEVEL SECURITY;

-- 2. Table: push_subscriptions (Stores subscribed devices per user & tenant)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  professional_id UUID REFERENCES public.professionals(id) ON DELETE SET NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  device_name TEXT NOT NULL DEFAULT 'Dispositivo',
  platform TEXT NOT NULL DEFAULT 'web',
  user_agent TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT push_subscriptions_user_tenant_endpoint_unique UNIQUE (user_id, tenant_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_tenant_active
  ON public.push_subscriptions(tenant_id, is_active);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_tenant
  ON public.push_subscriptions(user_id, tenant_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Helper function to validate if auth.uid() belongs to a given tenant_id
CREATE OR REPLACE FUNCTION public.user_belongs_to_tenant(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND (tenant_id = p_tenant_id OR role = 'super_admin')
  )
  OR EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE user_id = auth.uid() AND tenant_id = p_tenant_id AND status = 'active'
  )
  OR EXISTS (
    SELECT 1 FROM public.professionals
    WHERE auth_user_id = auth.uid() AND tenant_id = p_tenant_id AND active = true
  )
  OR EXISTS (
    SELECT 1 FROM public.tenants
    WHERE id = p_tenant_id AND owner_user_id = auth.uid()
  );
$$;

DROP POLICY IF EXISTS "Users manage own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users manage own push subscriptions"
  ON public.push_subscriptions
  FOR ALL
  USING (
    auth.uid() = user_id
    AND public.user_belongs_to_tenant(tenant_id)
  )
  WITH CHECK (
    auth.uid() = user_id
    AND public.user_belongs_to_tenant(tenant_id)
  );

-- 3. Table: push_notification_preferences (Per-user, per-tenant event preferences)
CREATE TABLE IF NOT EXISTS public.push_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  push_enabled BOOLEAN NOT NULL DEFAULT true,
  notify_new_booking BOOLEAN NOT NULL DEFAULT true,
  notify_cancellation BOOLEAN NOT NULL DEFAULT true,
  notify_reschedule BOOLEAN NOT NULL DEFAULT true,
  notify_reminder BOOLEAN NOT NULL DEFAULT true,
  notify_daily_summary BOOLEAN NOT NULL DEFAULT true,
  reminder_minutes_before INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT push_notification_prefs_user_tenant_unique UNIQUE (user_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_push_notification_prefs_tenant
  ON public.push_notification_preferences(tenant_id);

ALTER TABLE public.push_notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own push notification preferences" ON public.push_notification_preferences;
CREATE POLICY "Users manage own push notification preferences"
  ON public.push_notification_preferences
  FOR ALL
  USING (
    auth.uid() = user_id
    AND public.user_belongs_to_tenant(tenant_id)
  )
  WITH CHECK (
    auth.uid() = user_id
    AND public.user_belongs_to_tenant(tenant_id)
  );

-- 4. Table: push_delivery_logs (Deduplication & Delivery Audit)
CREATE TABLE IF NOT EXISTS public.push_delivery_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  subscription_id UUID REFERENCES public.push_subscriptions(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  dedup_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  status_code INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT push_delivery_logs_dedup_sub_unique UNIQUE (dedup_key, subscription_id)
);

CREATE INDEX IF NOT EXISTS idx_push_delivery_logs_tenant_created
  ON public.push_delivery_logs(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_push_delivery_logs_dedup
  ON public.push_delivery_logs(dedup_key);

ALTER TABLE public.push_delivery_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own push delivery logs" ON public.push_delivery_logs;
CREATE POLICY "Users read own push delivery logs"
  ON public.push_delivery_logs
  FOR SELECT
  USING (
    auth.uid() = user_id
    AND public.user_belongs_to_tenant(tenant_id)
  );

-- 5. Enhance notifications table for deep-linking & multi-tenant professional access
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS event_key TEXT;

DROP POLICY IF EXISTS "Tenant isolation for notifications" ON public.notifications;
CREATE POLICY "Tenant isolation for notifications"
  ON public.notifications
  FOR ALL
  USING (public.user_belongs_to_tenant(tenant_id))
  WITH CHECK (public.user_belongs_to_tenant(tenant_id));

-- 6. Fix notify_booking_changes() trigger:
--    - Never fires before booking confirmation (ignores pending online payment drafts)
--    - Fires when status transitions from 'pending' -> 'confirmed' OR inserted as 'confirmed'
--    - Uses clean UTF-8 titles and deep-links directly to the booking (/admin/agenda?bookingId=...&date=...)
CREATE OR REPLACE FUNCTION public.notify_booking_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_customer_name TEXT;
  v_service_name TEXT;
  v_pro_name TEXT;
  v_time TEXT;
  v_date_param TEXT;
  v_desc TEXT;
  v_link TEXT;
  v_is_online_draft BOOLEAN;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  -- Check if this row is an unconfirmed online payment draft
  v_is_online_draft := (
    NEW.status = 'pending'
    AND NEW.payment_mode IN ('deposit', 'full')
    AND (NEW.payment_status IS NULL OR NEW.payment_status = 'pending')
  );

  -- Do not trigger notifications for unconfirmed online drafts
  IF TG_OP = 'INSERT' AND v_is_online_draft THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(name, 'Cliente') INTO v_customer_name FROM public.customers WHERE id = NEW.customer_id;
  SELECT COALESCE(name, 'Serviço') INTO v_service_name FROM public.services WHERE id = NEW.service_id;

  IF NEW.professional_id IS NOT NULL THEN
    SELECT COALESCE(name, 'Profissional') INTO v_pro_name FROM public.professionals WHERE id = NEW.professional_id;
  ELSE
    v_pro_name := 'Qualquer profissional';
  END IF;

  v_time := to_char(NEW.scheduled_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY "às" HH24:MI');
  v_date_param := to_char(NEW.scheduled_at AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD');
  v_link := '/admin/agenda?bookingId=' || NEW.id::text || '&date=' || v_date_param;

  IF TG_OP = 'INSERT' THEN
    v_desc := COALESCE(v_customer_name, 'Cliente') || ' agendou ' || COALESCE(v_service_name, 'Serviço') || ' com ' || COALESCE(v_pro_name, 'Profissional') || ' para ' || v_time || '.';
    INSERT INTO public.notifications (tenant_id, professional_id, booking_id, event_key, title, description, type, link)
    VALUES (
      NEW.tenant_id,
      NEW.professional_id,
      NEW.id,
      'booking_new:' || NEW.id::text,
      '🎉 Novo agendamento',
      v_desc,
      'booking_new',
      v_link
    );

  ELSIF TG_OP = 'UPDATE' THEN
    -- Case A: Online payment draft just became confirmed
    IF OLD.status = 'pending' AND NEW.status = 'confirmed' AND (OLD.payment_mode IN ('deposit', 'full')) THEN
      v_desc := COALESCE(v_customer_name, 'Cliente') || ' confirmou ' || COALESCE(v_service_name, 'Serviço') || ' com ' || COALESCE(v_pro_name, 'Profissional') || ' para ' || v_time || '.';
      IF NOT EXISTS (
        SELECT 1 FROM public.notifications
        WHERE booking_id = NEW.id AND type = 'booking_new'
      ) THEN
        INSERT INTO public.notifications (tenant_id, professional_id, booking_id, event_key, title, description, type, link)
        VALUES (
          NEW.tenant_id,
          NEW.professional_id,
          NEW.id,
          'booking_new:' || NEW.id::text,
          '🎉 Novo agendamento',
          v_desc,
          'booking_new',
          v_link
        );
      END IF;
    END IF;

    -- Case B: Cancellation (ignore if it was an unpaid pending online draft being cleaned up)
    IF NEW.status = 'canceled' AND OLD.status != 'canceled' AND NOT (OLD.status = 'pending' AND OLD.payment_mode IN ('deposit', 'full') AND COALESCE(OLD.payment_status, 'pending') = 'pending') THEN
      v_desc := 'O agendamento de ' || COALESCE(v_customer_name, 'Cliente') || ' (' || COALESCE(v_service_name, 'Serviço') || ') marcado para ' || v_time || ' foi cancelado.';
      INSERT INTO public.notifications (tenant_id, professional_id, booking_id, event_key, title, description, type, link)
      VALUES (
        NEW.tenant_id,
        NEW.professional_id,
        NEW.id,
        'booking_canceled:' || NEW.id::text,
        '❌ Agendamento cancelado',
        v_desc,
        'booking_canceled',
        v_link
      );
    END IF;

    -- Case C: Rescheduled
    IF NEW.scheduled_at != OLD.scheduled_at AND NEW.status != 'canceled' THEN
      v_desc := 'O agendamento de ' || COALESCE(v_customer_name, 'Cliente') || ' (' || COALESCE(v_service_name, 'Serviço') || ') foi remarcado para ' || v_time || '.';
      INSERT INTO public.notifications (tenant_id, professional_id, booking_id, event_key, title, description, type, link)
      VALUES (
        NEW.tenant_id,
        NEW.professional_id,
        NEW.id,
        'booking_rescheduled:' || NEW.id::text || ':' || extract(epoch from NEW.scheduled_at)::bigint::text,
        '🔄 Agendamento remarcado',
        v_desc,
        'booking_rescheduled',
        v_link
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_booking_notifications ON public.bookings;
CREATE TRIGGER trigger_booking_notifications
  AFTER INSERT OR UPDATE
  ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_booking_changes();

