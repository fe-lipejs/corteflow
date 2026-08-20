-- 0051_analytics_engine.sql
-- Create analytics_events table for tracking visits, clicks, and conversion events

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  event_type TEXT NOT NULL, -- 'page_view', 'click', 'conversion'
  event_name TEXT NOT NULL, -- 'view_landing', 'click_cta_hero', etc.
  page_path TEXT NOT NULL,
  page_title TEXT,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  device_type TEXT DEFAULT 'desktop', -- 'mobile', 'desktop', 'tablet'
  browser TEXT,
  os TEXT,
  screen_resolution TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Allow anyone (public/anon and authenticated) to insert tracking events
DROP POLICY IF EXISTS "Allow public insert to analytics_events" ON public.analytics_events;
CREATE POLICY "Allow public insert to analytics_events"
  ON public.analytics_events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Allow Super Admin and Tenant Owners to read events
DROP POLICY IF EXISTS "Allow admin read analytics_events" ON public.analytics_events;
CREATE POLICY "Allow admin read analytics_events"
  ON public.analytics_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'super_admin' OR profiles.role = 'owner')
    )
  );

-- Create indexes for fast reporting queries
CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON public.analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON public.analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_event_name ON public.analytics_events(event_name);
CREATE INDEX IF NOT EXISTS idx_analytics_visitor_id ON public.analytics_events(visitor_id);
CREATE INDEX IF NOT EXISTS idx_analytics_session_id ON public.analytics_events(session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_page_path ON public.analytics_events(page_path);
