-- ============================================================================
-- Migration: 20261108020000_raffros_analytics_engine_v2.sql
-- Raffros Analytics — Centro de Inteligência e Analytics do Super Admin
-- ============================================================================

-- 1. Evoluir tabela public.analytics_events com colunas estruturadas
ALTER TABLE public.analytics_events
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'marketing',
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS user_role TEXT,
  ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS step_name TEXT,
  ADD COLUMN IF NOT EXISTS duration_ms INTEGER,
  ADD COLUMN IF NOT EXISTS element_id TEXT;

-- Backfill source para eventos antigos caso existam
UPDATE public.analytics_events
SET source = CASE
  WHEN page_path LIKE '/admin%' OR page_path LIKE '/app%' THEN 'admin'
  WHEN tenant_id IS NOT NULL THEN 'portal'
  ELSE 'marketing'
END
WHERE source IS NULL;

-- 2. Índices compostos para alta performance multi-tenant e por período
CREATE INDEX IF NOT EXISTS idx_analytics_tenant_created
  ON public.analytics_events(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_tenant_source_created
  ON public.analytics_events(tenant_id, source, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_tenant_event_created
  ON public.analytics_events(tenant_id, event_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_source_created
  ON public.analytics_events(source, created_at DESC);

-- 3. Corrigir Row Level Security (RLS) com isolamento multi-tenant rigoroso
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public insert to analytics_events" ON public.analytics_events;
CREATE POLICY "Allow public insert to analytics_events"
  ON public.analytics_events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow admin read analytics_events" ON public.analytics_events;
DROP POLICY IF EXISTS "Super admin and tenant owner isolated read analytics_events" ON public.analytics_events;

CREATE POLICY "Super admin and tenant owner isolated read analytics_events"
  ON public.analytics_events
  FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR (
      analytics_events.tenant_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.tenant_id = analytics_events.tenant_id
          AND p.role IN ('owner', 'admin', 'manager')
      )
    )
  );

-- 4. Função auxiliar para normalizar Sistema Operacional / Plataforma
CREATE OR REPLACE FUNCTION public.normalize_analytics_os(p_os TEXT, p_device TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_os TEXT := LOWER(COALESCE(p_os, ''));
  v_dev TEXT := LOWER(COALESCE(p_device, ''));
BEGIN
  IF v_os LIKE '%android%' THEN
    RETURN 'Android';
  ELSIF v_os LIKE '%ios%' OR v_os LIKE '%iphone%' OR v_os LIKE '%ipad%' THEN
    RETURN 'iPhone / iOS';
  ELSIF v_os LIKE '%win%' THEN
    RETURN 'Windows';
  ELSIF v_os LIKE '%mac%' THEN
    RETURN 'macOS';
  ELSIF v_dev = 'mobile' THEN
    RETURN 'Outros Mobile';
  ELSE
    RETURN 'Outros';
  END IF;
END;
$$;

-- 5. Função auxiliar para normalizar Modalidade de Pagamento
CREATE OR REPLACE FUNCTION public.normalize_analytics_payment_method(p_method TEXT, p_mode TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_m TEXT := LOWER(TRIM(COALESCE(p_method, '')));
  v_mode TEXT := LOWER(TRIM(COALESCE(p_mode, '')));
BEGIN
  IF v_m LIKE '%pix%' THEN
    RETURN 'PIX';
  ELSIF v_m LIKE '%dinheiro%' OR v_m = 'cash' THEN
    RETURN 'Dinheiro';
  ELSIF v_m LIKE '%cart%' OR v_m LIKE '%card%' OR v_m LIKE '%credito%' OR v_m LIKE '%crédito%' OR v_m LIKE '%debito%' OR v_m LIKE '%débito%' THEN
    RETURN 'Cartão';
  ELSIF v_mode IN ('full', 'deposit', 'partial', 'partial_50', 'full_100') AND (v_m = '' OR v_m = 'online' OR v_m = 'stripe') THEN
    RETURN 'Pagamento Online';
  ELSIF v_m = 'local' OR v_mode = 'local' OR v_mode = 'pay_local' THEN
    RETURN 'Presencial (No Local)';
  ELSIF v_m <> '' THEN
    RETURN INITCAP(v_m);
  ELSE
    RETURN 'Presencial (No Local)';
  END IF;
END;
$$;

-- ============================================================================
-- 6. RPC: Analytics Individual Completo de um Estabelecimento (Super Admin)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_raffros_tenant_analytics(
  p_tenant_id UUID,
  p_start TIMESTAMPTZ,
  p_end TIMESTAMPTZ,
  p_pro_id UUID DEFAULT NULL,
  p_service_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_tenant UUID;
  v_caller_role TEXT;
  v_duration INTERVAL;
  v_prev_start TIMESTAMPTZ;
  v_prev_end TIMESTAMPTZ;
  v_tenant RECORD;
  v_overview_curr JSONB;
  v_overview_prev JSONB;
  v_funnel JSONB;
  v_clicks JSONB;
  v_dwell JSONB;
  v_payments JSONB;
  v_temporal JSONB;
  v_financial JSONB;
  v_devices JSONB;
  v_admin_behavior JSONB;
BEGIN
  -- Validação de segurança: Super Admin ou Dono do próprio tenant
  IF NOT public.is_super_admin() THEN
    SELECT tenant_id, role INTO v_caller_tenant, v_caller_role
    FROM public.profiles
    WHERE id = auth.uid();

    IF v_caller_tenant IS DISTINCT FROM p_tenant_id OR v_caller_role NOT IN ('owner', 'admin', 'manager') THEN
      RAISE EXCEPTION 'Acesso negado às métricas deste estabelecimento.';
    END IF;
  END IF;

  SELECT
    t.id,
    t.name,
    t.slug,
    t.business_type,
    t.status,
    t.created_at,
    GREATEST(1, EXTRACT(DAY FROM (NOW() - t.created_at))::INT) AS operating_days,
    ts.logo_url,
    ts.city,
    ts.state
  INTO v_tenant
  FROM public.tenants t
  LEFT JOIN public.tenant_settings ts ON ts.tenant_id = t.id
  WHERE t.id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Estabelecimento não encontrado.';
  END IF;

  v_duration := GREATEST(p_end - p_start, INTERVAL '1 day');
  v_prev_end := p_start;
  v_prev_start := p_start - v_duration;

  -- ──────────────────────────────────────────────────────────────────────────
  -- A. RESUMO EXECUTIVO (PERÍODO ATUAL E PERÍODO ANTERIOR EQUIVALENTE)
  -- ──────────────────────────────────────────────────────────────────────────
  WITH curr_bookings AS (
    SELECT *
    FROM public.bookings b
    WHERE b.tenant_id = p_tenant_id
      AND b.scheduled_at >= p_start
      AND b.scheduled_at <= p_end
      AND (p_pro_id IS NULL OR b.professional_id = p_pro_id)
      AND (p_service_id IS NULL OR b.service_id = p_service_id)
  ),
  curr_payments AS (
    SELECT p.*
    FROM public.payments p
    LEFT JOIN public.bookings b ON b.id = p.booking_id
    WHERE p.tenant_id = p_tenant_id
      AND p.created_at >= p_start
      AND p.created_at <= p_end
      AND (p_pro_id IS NULL OR b.professional_id = p_pro_id)
      AND (p_service_id IS NULL OR b.service_id = p_service_id)
  ),
  curr_refunds AS (
    SELECT r.*
    FROM public.refunds r
    WHERE r.tenant_id = p_tenant_id
      AND r.status = 'succeeded'
      AND r.created_at >= p_start
      AND r.created_at <= p_end
  ),
  curr_manual_tx AS (
    SELECT ft.*
    FROM public.financial_transactions ft
    WHERE ft.tenant_id = p_tenant_id
      AND ft.deleted_at IS NULL
      AND ft.type = 'income'
      AND ft.booking_id IS NULL
      AND COALESCE(ft.status, 'succeeded') IN ('succeeded', 'approved', 'completed')
      AND COALESCE(ft.date, ft.created_at) >= p_start
      AND COALESCE(ft.date, ft.created_at) <= p_end
      AND (p_pro_id IS NULL OR ft.professional_id = p_pro_id)
  ),
  curr_events AS (
    SELECT *
    FROM public.analytics_events ae
    WHERE ae.tenant_id = p_tenant_id
      AND ae.created_at >= p_start
      AND ae.created_at <= p_end
  ),
  curr_customer_stats AS (
    SELECT
      COUNT(DISTINCT cb.customer_id) FILTER (
        WHERE cb.customer_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM public.bookings b_old
            WHERE b_old.tenant_id = p_tenant_id
              AND b_old.customer_id = cb.customer_id
              AND b_old.scheduled_at < p_start
              AND b_old.status <> 'canceled'
          )
      ) AS new_customers,
      COUNT(DISTINCT cb.customer_id) FILTER (
        WHERE cb.customer_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.bookings b_old
            WHERE b_old.tenant_id = p_tenant_id
              AND b_old.customer_id = cb.customer_id
              AND b_old.scheduled_at < p_start
              AND b_old.status <> 'canceled'
          )
      ) AS recurring_customers
    FROM curr_bookings cb
    WHERE cb.status <> 'canceled'
  )
  SELECT jsonb_build_object(
    'total_bookings', COUNT(*),
    'online_bookings', COUNT(*) FILTER (WHERE booking_source = 'online'),
    'manual_bookings', COUNT(*) FILTER (WHERE COALESCE(booking_source, 'manual') = 'manual'),
    'confirmed_bookings', COUNT(*) FILTER (WHERE status IN ('confirmed', 'arrived', 'in_progress') AND COALESCE(confirmation_status, 'confirmed') = 'confirmed'),
    'pending_bookings', COUNT(*) FILTER (WHERE status = 'pending' OR (status = 'confirmed' AND confirmation_status = 'pending')),
    'canceled_bookings', COUNT(*) FILTER (WHERE status = 'canceled'),
    'completed_bookings', COUNT(*) FILTER (WHERE status = 'completed'),
    'no_show_bookings', COUNT(*) FILTER (WHERE status = 'no_show'),
    'scheduled_value', COALESCE(SUM(amount_total) FILTER (WHERE status NOT IN ('canceled', 'no_show')), 0),
    'received_revenue', (
      COALESCE(SUM(
        CASE
          WHEN status = 'completed' OR payment_status = 'paid' THEN COALESCE(NULLIF(amount_paid, 0), amount_total, 0)
          WHEN payment_status = 'partial_paid' THEN COALESCE(amount_paid, 0)
          ELSE 0
        END
      ) FILTER (WHERE status <> 'canceled'), 0)
      + COALESCE((SELECT SUM(amount) FROM curr_manual_tx), 0)
      - COALESCE((SELECT SUM(amount) FROM curr_refunds), 0)
    ),
    'pending_revenue', COALESCE(SUM(
      CASE
        WHEN status IN ('pending', 'confirmed', 'arrived', 'in_progress') AND COALESCE(payment_status, 'pending') <> 'paid'
        THEN GREATEST(0, COALESCE(amount_total, 0) - COALESCE(amount_paid, 0))
        ELSE 0
      END
    ), 0),
    'canceled_refunded_value', (
      COALESCE(SUM(amount_total) FILTER (WHERE status = 'canceled'), 0)
      + COALESCE((SELECT SUM(amount) FROM curr_refunds), 0)
    ),
    'avg_ticket', COALESCE(ROUND(AVG(amount_total) FILTER (WHERE status NOT IN ('canceled', 'no_show')), 2), 0),
    'new_customers', COALESCE((SELECT new_customers FROM curr_customer_stats), 0),
    'recurring_customers', COALESCE((SELECT recurring_customers FROM curr_customer_stats), 0),
    'portal_sessions', COALESCE((SELECT COUNT(DISTINCT session_id) FROM curr_events WHERE source = 'portal'), 0),
    'portal_views', COALESCE((SELECT COUNT(*) FROM curr_events WHERE source = 'portal' AND (event_type = 'page_view' OR event_name IN ('portal_view', 'view_page'))), 0),
    'admin_sessions', COALESCE((SELECT COUNT(DISTINCT session_id) FROM curr_events WHERE source = 'admin'), 0),
    'admin_views', COALESCE((SELECT COUNT(*) FROM curr_events WHERE source = 'admin' AND (event_type = 'page_view' OR event_name IN ('page_view', 'admin_page_view'))), 0)
  ) INTO v_overview_curr
  FROM curr_bookings;

  -- Período anterior equivalente
  WITH prev_bookings AS (
    SELECT *
    FROM public.bookings b
    WHERE b.tenant_id = p_tenant_id
      AND b.scheduled_at >= v_prev_start
      AND b.scheduled_at < v_prev_end
      AND (p_pro_id IS NULL OR b.professional_id = p_pro_id)
      AND (p_service_id IS NULL OR b.service_id = p_service_id)
  ),
  prev_refunds AS (
    SELECT r.*
    FROM public.refunds r
    WHERE r.tenant_id = p_tenant_id
      AND r.status = 'succeeded'
      AND r.created_at >= v_prev_start
      AND r.created_at < v_prev_end
  ),
  prev_manual_tx AS (
    SELECT ft.*
    FROM public.financial_transactions ft
    WHERE ft.tenant_id = p_tenant_id
      AND ft.deleted_at IS NULL
      AND ft.type = 'income'
      AND ft.booking_id IS NULL
      AND COALESCE(ft.status, 'succeeded') IN ('succeeded', 'approved', 'completed')
      AND COALESCE(ft.date, ft.created_at) >= v_prev_start
      AND COALESCE(ft.date, ft.created_at) < v_prev_end
      AND (p_pro_id IS NULL OR ft.professional_id = p_pro_id)
  ),
  prev_events AS (
    SELECT *
    FROM public.analytics_events ae
    WHERE ae.tenant_id = p_tenant_id
      AND ae.created_at >= v_prev_start
      AND ae.created_at < v_prev_end
  )
  SELECT jsonb_build_object(
    'total_bookings', COUNT(*),
    'online_bookings', COUNT(*) FILTER (WHERE booking_source = 'online'),
    'manual_bookings', COUNT(*) FILTER (WHERE COALESCE(booking_source, 'manual') = 'manual'),
    'confirmed_bookings', COUNT(*) FILTER (WHERE status IN ('confirmed', 'arrived', 'in_progress') AND COALESCE(confirmation_status, 'confirmed') = 'confirmed'),
    'pending_bookings', COUNT(*) FILTER (WHERE status = 'pending' OR (status = 'confirmed' AND confirmation_status = 'pending')),
    'canceled_bookings', COUNT(*) FILTER (WHERE status = 'canceled'),
    'completed_bookings', COUNT(*) FILTER (WHERE status = 'completed'),
    'scheduled_value', COALESCE(SUM(amount_total) FILTER (WHERE status NOT IN ('canceled', 'no_show')), 0),
    'received_revenue', (
      COALESCE(SUM(
        CASE
          WHEN status = 'completed' OR payment_status = 'paid' THEN COALESCE(NULLIF(amount_paid, 0), amount_total, 0)
          WHEN payment_status = 'partial_paid' THEN COALESCE(amount_paid, 0)
          ELSE 0
        END
      ) FILTER (WHERE status <> 'canceled'), 0)
      + COALESCE((SELECT SUM(amount) FROM prev_manual_tx), 0)
      - COALESCE((SELECT SUM(amount) FROM prev_refunds), 0)
    ),
    'avg_ticket', COALESCE(ROUND(AVG(amount_total) FILTER (WHERE status NOT IN ('canceled', 'no_show')), 2), 0),
    'portal_sessions', COALESCE((SELECT COUNT(DISTINCT session_id) FROM prev_events WHERE source = 'portal'), 0),
    'admin_sessions', COALESCE((SELECT COUNT(DISTINCT session_id) FROM prev_events WHERE source = 'admin'), 0)
  ) INTO v_overview_prev
  FROM prev_bookings;

  -- ──────────────────────────────────────────────────────────────────────────
  -- B. FUNIL DE CONVERSÃO DO PORTAL E DESISTÊNCIAS POR ETAPA (SEÇÃO 3)
  -- ──────────────────────────────────────────────────────────────────────────
  WITH portal_sessions AS (
    SELECT
      session_id,
      BOOL_OR(event_name IN ('portal_view', 'session_started', 'view_page') OR event_type = 'page_view') AS s_entry,
      BOOL_OR(event_name IN ('service_view', 'service_selected', 'professional_selected', 'date_selected', 'time_selected', 'customer_data_submitted', 'payment_method_selected', 'booking_created', 'booking_completed')) AS s_service_view,
      BOOL_OR(event_name IN ('service_selected', 'professional_selected', 'date_selected', 'time_selected', 'customer_data_submitted', 'payment_method_selected', 'booking_created', 'booking_completed')) AS s_service_sel,
      BOOL_OR(event_name IN ('professional_selected', 'date_selected', 'time_selected', 'customer_data_submitted', 'payment_method_selected', 'booking_created', 'booking_completed')) AS s_pro_sel,
      BOOL_OR(event_name IN ('date_selected', 'time_selected', 'customer_data_submitted', 'payment_method_selected', 'booking_created', 'booking_completed')) AS s_datetime_sel,
      BOOL_OR(event_name IN ('customer_data_submitted', 'payment_method_selected', 'booking_created', 'booking_completed')) AS s_customer_data,
      BOOL_OR(event_name IN ('payment_method_selected', 'checkout_started', 'booking_created', 'booking_completed')) AS s_payment,
      BOOL_OR(event_name IN ('booking_created', 'booking_completed') OR event_type = 'conversion') AS s_completed,
      BOOL_OR(event_name = 'booking_abandoned') AS s_explicit_abandon,
      BOOL_OR(event_name = 'session_idle_timeout') AS s_idle_timeout
    FROM public.analytics_events
    WHERE tenant_id = p_tenant_id
      AND source = 'portal'
      AND created_at >= p_start
      AND created_at <= p_end
    GROUP BY session_id
  )
  SELECT jsonb_build_object(
    'tracked_sessions', COUNT(*),
    'portal_access', COUNT(*) FILTER (WHERE s_entry OR s_service_view),
    'service_viewed', COUNT(*) FILTER (WHERE s_service_view OR s_entry),
    'service_selected', COUNT(*) FILTER (WHERE s_service_sel),
    'professional_selected', COUNT(*) FILTER (WHERE s_pro_sel),
    'datetime_selected', COUNT(*) FILTER (WHERE s_datetime_sel),
    'customer_data_filled', COUNT(*) FILTER (WHERE s_customer_data),
    'payment_step_reached', COUNT(*) FILTER (WHERE s_payment),
    'booking_completed_events', COUNT(*) FILTER (WHERE s_completed),
    'bounced_sessions', COUNT(*) FILTER (WHERE NOT s_service_sel AND NOT s_completed),
    'observable_abandoned_sessions', COUNT(*) FILTER (WHERE s_service_sel AND NOT s_completed),
    'idle_timeout_sessions', COUNT(*) FILTER (WHERE s_idle_timeout AND NOT s_completed),
    'drop_before_service', COUNT(*) FILTER (WHERE (s_entry OR s_service_view) AND NOT s_service_sel AND NOT s_completed),
    'drop_at_professional', COUNT(*) FILTER (WHERE s_service_sel AND NOT s_pro_sel AND NOT s_completed),
    'drop_at_datetime', COUNT(*) FILTER (WHERE s_pro_sel AND NOT s_datetime_sel AND NOT s_completed),
    'drop_at_customer_data', COUNT(*) FILTER (WHERE s_datetime_sel AND NOT s_customer_data AND NOT s_completed),
    'drop_at_payment', COUNT(*) FILTER (WHERE s_customer_data AND NOT s_completed)
  ) INTO v_funnel
  FROM portal_sessions;

  -- ──────────────────────────────────────────────────────────────────────────
  -- C. ONDE OS CLIENTES MAIS CLICAM & CLIQUES REPETIDOS (SEÇÃO 4)
  -- ──────────────────────────────────────────────────────────────────────────
  SELECT jsonb_build_object(
    'top_elements', COALESCE((
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT
          COALESCE(NULLIF(element_id, ''), event_name) AS element_key,
          event_name,
          COALESCE(metadata->>'label', element_id, event_name) AS label,
          COUNT(*) AS total_clicks,
          COUNT(DISTINCT session_id) AS unique_sessions
        FROM public.analytics_events
        WHERE tenant_id = p_tenant_id
          AND source = 'portal'
          AND event_type IN ('click', 'conversion')
          AND created_at >= p_start
          AND created_at <= p_end
        GROUP BY 1, 2, 3
        ORDER BY total_clicks DESC
        LIMIT 15
      ) t
    ), '[]'::jsonb),
    'top_services_selected', COALESCE((
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT
          COALESCE(metadata->>'service_name', 'Serviço') AS service_name,
          COUNT(*) FILTER (WHERE event_name = 'service_selected') AS portal_clicks,
          COUNT(DISTINCT session_id) AS unique_sessions
        FROM public.analytics_events
        WHERE tenant_id = p_tenant_id
          AND source = 'portal'
          AND event_name IN ('service_selected', 'service_view')
          AND metadata ? 'service_name'
          AND created_at >= p_start
          AND created_at <= p_end
        GROUP BY 1
        ORDER BY portal_clicks DESC
        LIMIT 10
      ) t
    ), '[]'::jsonb),
    'top_professionals_selected', COALESCE((
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT
          COALESCE(metadata->>'professional_name', 'Qualquer profissional') AS professional_name,
          COUNT(*) AS selections,
          COUNT(DISTINCT session_id) AS unique_sessions
        FROM public.analytics_events
        WHERE tenant_id = p_tenant_id
          AND source = 'portal'
          AND event_name IN ('professional_selected', 'professional_view')
          AND created_at >= p_start
          AND created_at <= p_end
        GROUP BY 1
        ORDER BY selections DESC
        LIMIT 10
      ) t
    ), '[]'::jsonb),
    'top_hours_clicked', COALESCE((
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT
          COALESCE(metadata->>'time_slot', 'Horário') AS time_slot,
          COUNT(*) AS clicks
        FROM public.analytics_events
        WHERE tenant_id = p_tenant_id
          AND source = 'portal'
          AND event_name = 'time_selected'
          AND metadata ? 'time_slot'
          AND created_at >= p_start
          AND created_at <= p_end
        GROUP BY 1
        ORDER BY clicks DESC
        LIMIT 12
      ) t
    ), '[]'::jsonb),
    'repeated_clicks', COALESCE((
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT
          element_key,
          label,
          COUNT(*) AS affected_sessions,
          SUM(clicks_in_session) AS total_repeated_clicks
        FROM (
          SELECT
            session_id,
            COALESCE(NULLIF(element_id, ''), event_name) AS element_key,
            COALESCE(MAX(metadata->>'label'), COALESCE(NULLIF(element_id, ''), event_name)) AS label,
            COUNT(*) AS clicks_in_session
          FROM public.analytics_events
          WHERE tenant_id = p_tenant_id
            AND source = 'portal'
            AND event_type = 'click'
            AND created_at >= p_start
            AND created_at <= p_end
          GROUP BY session_id, COALESCE(NULLIF(element_id, ''), event_name)
          HAVING COUNT(*) >= 3
        ) sub
        GROUP BY element_key, label
        ORDER BY total_repeated_clicks DESC
        LIMIT 8
      ) t
    ), '[]'::jsonb)
  ) INTO v_clicks;

  -- ──────────────────────────────────────────────────────────────────────────
  -- D. TEMPO DE PERMANÊNCIA ATIVO NO PORTAL (SEÇÃO 6)
  -- ──────────────────────────────────────────────────────────────────────────
  WITH session_times AS (
    SELECT
      session_id,
      LEAST(
        1800,
        GREATEST(
          COALESCE(SUM(duration_ms) FILTER (WHERE duration_ms IS NOT NULL AND duration_ms > 0) / 1000.0, 0),
          EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at)))
        )
      ) AS active_sec,
      EXTRACT(EPOCH FROM (
        MIN(created_at) FILTER (WHERE event_name IN ('booking_created', 'booking_completed'))
        - MIN(created_at)
      )) AS sec_to_complete,
      EXTRACT(EPOCH FROM (
        MIN(created_at) FILTER (WHERE event_name = 'time_selected')
        - MIN(created_at)
      )) AS sec_to_select_time
    FROM public.analytics_events
    WHERE tenant_id = p_tenant_id
      AND source = 'portal'
      AND created_at >= p_start
      AND created_at <= p_end
    GROUP BY session_id
  )
  SELECT jsonb_build_object(
    'avg_session_seconds', COALESCE(ROUND(AVG(active_sec) FILTER (WHERE active_sec > 0)::NUMERIC, 1), 0),
    'median_session_seconds', COALESCE(ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY active_sec) FILTER (WHERE active_sec > 0))::NUMERIC, 1), 0),
    'avg_time_to_complete_seconds', COALESCE(ROUND(AVG(sec_to_complete) FILTER (WHERE sec_to_complete > 0 AND sec_to_complete < 3600)::NUMERIC, 1), 0),
    'avg_time_to_select_time_seconds', COALESCE(ROUND(AVG(sec_to_select_time) FILTER (WHERE sec_to_select_time > 0 AND sec_to_select_time < 1800)::NUMERIC, 1), 0),
    'step_durations', COALESCE((
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT
          step_name,
          ROUND(AVG(duration_ms / 1000.0)::NUMERIC, 1) AS avg_seconds,
          COUNT(DISTINCT session_id) AS sessions
        FROM public.analytics_events
        WHERE tenant_id = p_tenant_id
          AND source = 'portal'
          AND step_name IS NOT NULL
          AND duration_ms IS NOT NULL
          AND duration_ms > 0
          AND duration_ms < 600000
          AND created_at >= p_start
          AND created_at <= p_end
        GROUP BY step_name
        ORDER BY avg_seconds DESC
      ) t
    ), '[]'::jsonb)
  ) INTO v_dwell
  FROM session_times;

  -- ──────────────────────────────────────────────────────────────────────────
  -- E. FORMAS DE PAGAMENTO E STATUS FINANCEIRO (SEÇÃO 5)
  -- ──────────────────────────────────────────────────────────────────────────
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO v_payments
  FROM (
    SELECT
      public.normalize_analytics_payment_method(b.payment_method, b.payment_mode) AS modality,
      COUNT(*) AS total_bookings,
      COUNT(*) FILTER (WHERE b.status = 'completed' OR b.payment_status IN ('paid', 'partial_paid')) AS approved_count,
      COUNT(*) FILTER (WHERE b.status IN ('pending', 'confirmed') AND COALESCE(b.payment_status, 'pending') = 'pending') AS pending_count,
      COUNT(*) FILTER (WHERE b.payment_status = 'failed') AS failed_count,
      COUNT(*) FILTER (WHERE b.status = 'canceled' OR b.payment_status = 'canceled') AS canceled_count,
      COUNT(*) FILTER (WHERE b.payment_status = 'refunded') AS refunded_count,
      COALESCE(SUM(b.amount_total) FILTER (WHERE b.status <> 'canceled'), 0) AS scheduled_amount,
      COALESCE(SUM(
        CASE
          WHEN b.status = 'completed' OR b.payment_status = 'paid' THEN COALESCE(NULLIF(b.amount_paid, 0), b.amount_total, 0)
          WHEN b.payment_status = 'partial_paid' THEN COALESCE(b.amount_paid, 0)
          ELSE 0
        END
      ) FILTER (WHERE b.status <> 'canceled'), 0) AS received_amount,
      COALESCE(SUM(
        CASE
          WHEN b.status IN ('pending', 'confirmed') AND COALESCE(b.payment_status, 'pending') <> 'paid'
          THEN GREATEST(0, COALESCE(b.amount_total, 0) - COALESCE(b.amount_paid, 0))
          ELSE 0
        END
      ), 0) AS pending_amount
    FROM public.bookings b
    WHERE b.tenant_id = p_tenant_id
      AND b.scheduled_at >= p_start
      AND b.scheduled_at <= p_end
      AND (p_pro_id IS NULL OR b.professional_id = p_pro_id)
      AND (p_service_id IS NULL OR b.service_id = p_service_id)
    GROUP BY 1
    ORDER BY total_bookings DESC
  ) t;

  -- ──────────────────────────────────────────────────────────────────────────
  -- F. ANÁLISE TEMPORAL: HORAS, DIAS DA SEMANA, SEMANAS E MESES (SEÇÃO 7)
  -- ──────────────────────────────────────────────────────────────────────────
  SELECT jsonb_build_object(
    'by_hour', COALESCE((
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT
          EXTRACT(HOUR FROM (b.scheduled_at AT TIME ZONE 'America/Sao_Paulo'))::INT AS hour,
          COUNT(*) FILTER (WHERE b.status <> 'canceled') AS bookings_count,
          COUNT(*) FILTER (WHERE b.status = 'completed') AS completed_count,
          COALESCE(SUM(b.amount_total) FILTER (WHERE b.status <> 'canceled'), 0) AS scheduled_value,
          COALESCE(SUM(
            CASE WHEN b.status = 'completed' OR b.payment_status = 'paid'
            THEN COALESCE(NULLIF(b.amount_paid, 0), b.amount_total, 0) ELSE 0 END
          ) FILTER (WHERE b.status <> 'canceled'), 0) AS received_revenue
        FROM public.bookings b
        WHERE b.tenant_id = p_tenant_id
          AND b.scheduled_at >= p_start
          AND b.scheduled_at <= p_end
          AND (p_pro_id IS NULL OR b.professional_id = p_pro_id)
          AND (p_service_id IS NULL OR b.service_id = p_service_id)
        GROUP BY 1
        ORDER BY 1 ASC
      ) t
    ), '[]'::jsonb),
    'by_weekday', COALESCE((
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT
          EXTRACT(DOW FROM (b.scheduled_at AT TIME ZONE 'America/Sao_Paulo'))::INT AS weekday,
          COUNT(*) FILTER (WHERE b.status <> 'canceled') AS bookings_count,
          COUNT(*) FILTER (WHERE b.status = 'completed') AS completed_count,
          COALESCE(SUM(b.amount_total) FILTER (WHERE b.status <> 'canceled'), 0) AS scheduled_value,
          COALESCE(SUM(
            CASE WHEN b.status = 'completed' OR b.payment_status = 'paid'
            THEN COALESCE(NULLIF(b.amount_paid, 0), b.amount_total, 0) ELSE 0 END
          ) FILTER (WHERE b.status <> 'canceled'), 0) AS received_revenue
        FROM public.bookings b
        WHERE b.tenant_id = p_tenant_id
          AND b.scheduled_at >= p_start
          AND b.scheduled_at <= p_end
          AND (p_pro_id IS NULL OR b.professional_id = p_pro_id)
          AND (p_service_id IS NULL OR b.service_id = p_service_id)
        GROUP BY 1
        ORDER BY 1 ASC
      ) t
    ), '[]'::jsonb),
    'by_week', COALESCE((
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT
          TO_CHAR(DATE_TRUNC('week', b.scheduled_at AT TIME ZONE 'America/Sao_Paulo'), 'YYYY-MM-DD') AS week_start,
          COUNT(*) FILTER (WHERE b.status <> 'canceled') AS bookings_count,
          COUNT(*) FILTER (WHERE b.booking_source = 'online' AND b.status <> 'canceled') AS online_count,
          COUNT(*) FILTER (WHERE COALESCE(b.booking_source, 'manual') = 'manual' AND b.status <> 'canceled') AS manual_count,
          COALESCE(SUM(b.amount_total) FILTER (WHERE b.status <> 'canceled'), 0) AS scheduled_value,
          COALESCE(SUM(
            CASE WHEN b.status = 'completed' OR b.payment_status = 'paid'
            THEN COALESCE(NULLIF(b.amount_paid, 0), b.amount_total, 0) ELSE 0 END
          ) FILTER (WHERE b.status <> 'canceled'), 0) AS received_revenue
        FROM public.bookings b
        WHERE b.tenant_id = p_tenant_id
          AND b.scheduled_at >= p_start
          AND b.scheduled_at <= p_end
          AND (p_pro_id IS NULL OR b.professional_id = p_pro_id)
          AND (p_service_id IS NULL OR b.service_id = p_service_id)
        GROUP BY 1
        ORDER BY 1 ASC
      ) t
    ), '[]'::jsonb),
    'by_month', COALESCE((
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT
          TO_CHAR(DATE_TRUNC('month', b.scheduled_at AT TIME ZONE 'America/Sao_Paulo'), 'YYYY-MM') AS month_key,
          COUNT(*) FILTER (WHERE b.status <> 'canceled') AS bookings_count,
          COUNT(*) FILTER (WHERE b.booking_source = 'online' AND b.status <> 'canceled') AS online_count,
          COUNT(*) FILTER (WHERE COALESCE(b.booking_source, 'manual') = 'manual' AND b.status <> 'canceled') AS manual_count,
          COALESCE(SUM(b.amount_total) FILTER (WHERE b.status <> 'canceled'), 0) AS scheduled_value,
          COALESCE(SUM(
            CASE WHEN b.status = 'completed' OR b.payment_status = 'paid'
            THEN COALESCE(NULLIF(b.amount_paid, 0), b.amount_total, 0) ELSE 0 END
          ) FILTER (WHERE b.status <> 'canceled'), 0) AS received_revenue
        FROM public.bookings b
        WHERE b.tenant_id = p_tenant_id
          AND b.scheduled_at >= (NOW() - INTERVAL '12 months')
          AND (p_pro_id IS NULL OR b.professional_id = p_pro_id)
          AND (p_service_id IS NULL OR b.service_id = p_service_id)
        GROUP BY 1
        ORDER BY 1 ASC
      ) t
    ), '[]'::jsonb),
    'heatmap', COALESCE((
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT
          EXTRACT(DOW FROM (b.scheduled_at AT TIME ZONE 'America/Sao_Paulo'))::INT AS weekday,
          EXTRACT(HOUR FROM (b.scheduled_at AT TIME ZONE 'America/Sao_Paulo'))::INT AS hour,
          COUNT(*) FILTER (WHERE b.status <> 'canceled') AS count
        FROM public.bookings b
        WHERE b.tenant_id = p_tenant_id
          AND b.scheduled_at >= p_start
          AND b.scheduled_at <= p_end
          AND (p_pro_id IS NULL OR b.professional_id = p_pro_id)
          AND (p_service_id IS NULL OR b.service_id = p_service_id)
        GROUP BY 1, 2
      ) t
    ), '[]'::jsonb)
  ) INTO v_temporal;

  -- ──────────────────────────────────────────────────────────────────────────
  -- G. RECEITA E DESEMPENHO FINANCEIRO POR DIA, SERVIÇO E PROFISSIONAL (SEÇÃO 8)
  -- ──────────────────────────────────────────────────────────────────────────
  SELECT jsonb_build_object(
    'daily_series', COALESCE((
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT
          TO_CHAR((b.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::DATE, 'YYYY-MM-DD') AS day,
          COUNT(*) FILTER (WHERE b.status <> 'canceled') AS bookings_count,
          COUNT(*) FILTER (WHERE b.booking_source = 'online' AND b.status <> 'canceled') AS online_count,
          COUNT(*) FILTER (WHERE COALESCE(b.booking_source, 'manual') = 'manual' AND b.status <> 'canceled') AS manual_count,
          COALESCE(SUM(b.amount_total) FILTER (WHERE b.status <> 'canceled'), 0) AS scheduled_value,
          COALESCE(SUM(
            CASE WHEN b.status = 'completed' OR b.payment_status = 'paid'
            THEN COALESCE(NULLIF(b.amount_paid, 0), b.amount_total, 0) ELSE 0 END
          ) FILTER (WHERE b.status <> 'canceled'), 0) AS received_revenue
        FROM public.bookings b
        WHERE b.tenant_id = p_tenant_id
          AND b.scheduled_at >= p_start
          AND b.scheduled_at <= p_end
          AND (p_pro_id IS NULL OR b.professional_id = p_pro_id)
          AND (p_service_id IS NULL OR b.service_id = p_service_id)
        GROUP BY 1
        ORDER BY 1 ASC
      ) t
    ), '[]'::jsonb),
    'by_service', COALESCE((
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT
          s.id AS service_id,
          COALESCE(s.name, 'Serviço removido') AS service_name,
          COUNT(b.id) FILTER (WHERE b.status <> 'canceled') AS bookings_count,
          COUNT(b.id) FILTER (WHERE b.status = 'completed') AS completed_count,
          COALESCE(SUM(b.amount_total) FILTER (WHERE b.status <> 'canceled'), 0) AS scheduled_value,
          COALESCE(SUM(
            CASE WHEN b.status = 'completed' OR b.payment_status = 'paid'
            THEN COALESCE(NULLIF(b.amount_paid, 0), b.amount_total, 0) ELSE 0 END
          ) FILTER (WHERE b.status <> 'canceled'), 0) AS received_revenue,
          COALESCE(ROUND(AVG(b.amount_total) FILTER (WHERE b.status <> 'canceled'), 2), 0) AS avg_ticket
        FROM public.bookings b
        LEFT JOIN public.services s ON s.id = b.service_id
        WHERE b.tenant_id = p_tenant_id
          AND b.scheduled_at >= p_start
          AND b.scheduled_at <= p_end
          AND (p_pro_id IS NULL OR b.professional_id = p_pro_id)
          AND (p_service_id IS NULL OR b.service_id = p_service_id)
        GROUP BY s.id, s.name
        ORDER BY received_revenue DESC, bookings_count DESC
      ) t
    ), '[]'::jsonb),
    'by_professional', COALESCE((
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT
          p.id AS professional_id,
          COALESCE(p.name, 'Profissional removido') AS professional_name,
          COUNT(b.id) FILTER (WHERE b.status <> 'canceled') AS bookings_count,
          COUNT(b.id) FILTER (WHERE b.status = 'completed') AS completed_count,
          COALESCE(SUM(b.amount_total) FILTER (WHERE b.status <> 'canceled'), 0) AS scheduled_value,
          COALESCE(SUM(
            CASE WHEN b.status = 'completed' OR b.payment_status = 'paid'
            THEN COALESCE(NULLIF(b.amount_paid, 0), b.amount_total, 0) ELSE 0 END
          ) FILTER (WHERE b.status <> 'canceled'), 0) AS received_revenue,
          COALESCE(ROUND(AVG(b.amount_total) FILTER (WHERE b.status <> 'canceled'), 2), 0) AS avg_ticket
        FROM public.bookings b
        LEFT JOIN public.professionals p ON p.id = b.professional_id
        WHERE b.tenant_id = p_tenant_id
          AND b.scheduled_at >= p_start
          AND b.scheduled_at <= p_end
          AND (p_pro_id IS NULL OR b.professional_id = p_pro_id)
          AND (p_service_id IS NULL OR b.service_id = p_service_id)
        GROUP BY p.id, p.name
        ORDER BY received_revenue DESC, bookings_count DESC
      ) t
    ), '[]'::jsonb)
  ) INTO v_financial;

  -- ──────────────────────────────────────────────────────────────────────────
  -- H. DISPOSITIVOS E SISTEMAS OPERACIONAIS (PORTAL vs PAINEL ADMIN) (SEÇÃO 10)
  -- ──────────────────────────────────────────────────────────────────────────
  SELECT jsonb_build_object(
    'portal', COALESCE((
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        WITH sess AS (
          SELECT
            session_id,
            public.normalize_analytics_os(MAX(os), MAX(device_type)) AS platform,
            MAX(device_type) AS device_type,
            COUNT(*) AS events_count,
            BOOL_OR(event_name IN ('service_selected', 'professional_selected', 'time_selected')) AS started_flow,
            BOOL_OR(event_name IN ('booking_created', 'booking_completed') OR event_type = 'conversion') AS completed_booking,
            LEAST(1800, GREATEST(
              COALESCE(SUM(duration_ms) FILTER (WHERE duration_ms > 0) / 1000.0, 0),
              EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at)))
            )) AS duration_sec
          FROM public.analytics_events
          WHERE tenant_id = p_tenant_id
            AND source = 'portal'
            AND created_at >= p_start
            AND created_at <= p_end
          GROUP BY session_id
        )
        SELECT
          platform,
          COUNT(*) AS sessions,
          SUM(events_count) AS total_events,
          COUNT(*) FILTER (WHERE completed_booking) AS completed_bookings,
          COUNT(*) FILTER (WHERE started_flow AND NOT completed_booking) AS abandoned_sessions,
          ROUND((COUNT(*) FILTER (WHERE completed_booking)::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 1) AS conversion_rate,
          COALESCE(ROUND(AVG(duration_sec) FILTER (WHERE duration_sec > 0)::NUMERIC, 1), 0) AS avg_duration_seconds
        FROM sess
        GROUP BY platform
        ORDER BY sessions DESC
      ) t
    ), '[]'::jsonb),
    'admin', COALESCE((
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        WITH sess AS (
          SELECT
            session_id,
            public.normalize_analytics_os(MAX(os), MAX(device_type)) AS platform,
            COUNT(*) AS events_count,
            LEAST(3600, GREATEST(
              COALESCE(SUM(duration_ms) FILTER (WHERE duration_ms > 0) / 1000.0, 0),
              EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at)))
            )) AS duration_sec
          FROM public.analytics_events
          WHERE tenant_id = p_tenant_id
            AND source = 'admin'
            AND created_at >= p_start
            AND created_at <= p_end
          GROUP BY session_id
        )
        SELECT
          platform,
          COUNT(*) AS sessions,
          SUM(events_count) AS total_events,
          COALESCE(ROUND(AVG(duration_sec) FILTER (WHERE duration_sec > 0)::NUMERIC, 1), 0) AS avg_duration_seconds
        FROM sess
        GROUP BY platform
        ORDER BY sessions DESC
      ) t
    ), '[]'::jsonb)
  ) INTO v_devices;

  -- ──────────────────────────────────────────────────────────────────────────
  -- I. COMPORTAMENTO DO PROPRIETÁRIO / EQUIPE NO PAINEL ADMIN (SEÇÃO 11)
  -- ──────────────────────────────────────────────────────────────────────────
  SELECT jsonb_build_object(
    'summary', (
      SELECT jsonb_build_object(
        'total_sessions', COUNT(DISTINCT session_id),
        'total_page_views', COUNT(*) FILTER (WHERE event_type = 'page_view' OR event_name = 'admin_page_view'),
        'total_actions', COUNT(*) FILTER (WHERE event_type IN ('click', 'conversion') AND event_name <> 'admin_page_view'),
        'active_days', COUNT(DISTINCT (created_at AT TIME ZONE 'America/Sao_Paulo')::DATE),
        'last_access_at', MAX(created_at)
      )
      FROM public.analytics_events
      WHERE tenant_id = p_tenant_id
        AND source = 'admin'
        AND created_at >= p_start
        AND created_at <= p_end
    ),
    'pages', COALESCE((
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT
          COALESCE(NULLIF(step_name, ''), page_path) AS page_key,
          COALESCE(metadata->>'area_label', step_name, page_path) AS label,
          COUNT(*) FILTER (WHERE event_type = 'page_view' OR event_name = 'admin_page_view') AS views,
          COUNT(DISTINCT session_id) AS unique_sessions,
          COALESCE(ROUND(SUM(duration_ms) FILTER (WHERE duration_ms > 0 AND duration_ms < 1800000) / 1000.0, 1), 0) AS total_duration_seconds,
          COALESCE(ROUND(AVG(duration_ms) FILTER (WHERE duration_ms > 0 AND duration_ms < 1800000) / 1000.0, 1), 0) AS avg_duration_seconds
        FROM public.analytics_events
        WHERE tenant_id = p_tenant_id
          AND source = 'admin'
          AND created_at >= p_start
          AND created_at <= p_end
        GROUP BY 1, 2
        ORDER BY views DESC, total_duration_seconds DESC
      ) t
    ), '[]'::jsonb),
    'features', COALESCE((
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT
          event_name,
          COALESCE(MAX(metadata->>'label'), event_name) AS label,
          COUNT(*) AS total_uses,
          COUNT(DISTINCT session_id) AS unique_sessions
        FROM public.analytics_events
        WHERE tenant_id = p_tenant_id
          AND source = 'admin'
          AND event_name NOT IN ('admin_page_view', 'view_page', 'admin_session_started', 'admin_page_dwell')
          AND created_at >= p_start
          AND created_at <= p_end
        GROUP BY event_name
        ORDER BY total_uses DESC
      ) t
    ), '[]'::jsonb),
    'by_role', COALESCE((
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT
          COALESCE(NULLIF(user_role, ''), 'owner') AS user_role,
          COUNT(DISTINCT session_id) AS sessions,
          COUNT(*) AS events_count
        FROM public.analytics_events
        WHERE tenant_id = p_tenant_id
          AND source = 'admin'
          AND created_at >= p_start
          AND created_at <= p_end
        GROUP BY 1
        ORDER BY sessions DESC
      ) t
    ), '[]'::jsonb),
    'by_weekday', COALESCE((
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT
          EXTRACT(DOW FROM (created_at AT TIME ZONE 'America/Sao_Paulo'))::INT AS weekday,
          COUNT(DISTINCT session_id) AS sessions,
          COUNT(*) AS events_count
        FROM public.analytics_events
        WHERE tenant_id = p_tenant_id
          AND source = 'admin'
          AND created_at >= p_start
          AND created_at <= p_end
        GROUP BY 1
        ORDER BY 1 ASC
      ) t
    ), '[]'::jsonb),
    'by_hour', COALESCE((
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT
          EXTRACT(HOUR FROM (created_at AT TIME ZONE 'America/Sao_Paulo'))::INT AS hour,
          COUNT(DISTINCT session_id) AS sessions,
          COUNT(*) AS events_count
        FROM public.analytics_events
        WHERE tenant_id = p_tenant_id
          AND source = 'admin'
          AND created_at >= p_start
          AND created_at <= p_end
        GROUP BY 1
        ORDER BY 1 ASC
      ) t
    ), '[]'::jsonb)
  ) INTO v_admin_behavior;

  RETURN jsonb_build_object(
    'tenant', jsonb_build_object(
      'id', v_tenant.id,
      'name', v_tenant.name,
      'slug', v_tenant.slug,
      'business_type', v_tenant.business_type,
      'status', v_tenant.status,
      'created_at', v_tenant.created_at,
      'operating_days', v_tenant.operating_days,
      'logo_url', v_tenant.logo_url,
      'city', v_tenant.city,
      'state', v_tenant.state
    ),
    'period', jsonb_build_object(
      'start', p_start,
      'end', p_end,
      'prev_start', v_prev_start,
      'prev_end', v_prev_end
    ),
    'overview', jsonb_build_object(
      'current', v_overview_curr,
      'previous', v_overview_prev
    ),
    'funnel', v_funnel,
    'clicks', v_clicks,
    'dwell', v_dwell,
    'payments', v_payments,
    'temporal', v_temporal,
    'financial', v_financial,
    'devices', v_devices,
    'admin_behavior', v_admin_behavior
  );
END;
$$;

-- ============================================================================
-- 7. RPC: Analytics Global da Plataforma e Comparação entre Estabelecimentos
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_raffros_global_analytics(
  p_start TIMESTAMPTZ,
  p_end TIMESTAMPTZ,
  p_business_type TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_duration INTERVAL;
  v_prev_start TIMESTAMPTZ;
  v_prev_end TIMESTAMPTZ;
  v_summary JSONB;
  v_tenants_ranking JSONB;
  v_global_devices JSONB;
  v_global_payments JSONB;
  v_daily_trend JSONB;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Acesso restrito ao Super Admin da plataforma.';
  END IF;

  v_duration := GREATEST(p_end - p_start, INTERVAL '1 day');
  v_prev_end := p_start;
  v_prev_start := p_start - v_duration;

  -- Resumo Global
  WITH valid_tenants AS (
    SELECT id, status, business_type, created_at
    FROM public.tenants
    WHERE deleted_at IS NULL
      AND (p_business_type IS NULL OR p_business_type = 'all' OR business_type = p_business_type)
  ),
  curr_b AS (
    SELECT b.*
    FROM public.bookings b
    JOIN valid_tenants vt ON vt.id = b.tenant_id
    WHERE b.scheduled_at >= p_start AND b.scheduled_at <= p_end
  ),
  prev_b AS (
    SELECT b.*
    FROM public.bookings b
    JOIN valid_tenants vt ON vt.id = b.tenant_id
    WHERE b.scheduled_at >= v_prev_start AND b.scheduled_at < v_prev_end
  ),
  curr_e AS (
    SELECT ae.*
    FROM public.analytics_events ae
    JOIN valid_tenants vt ON vt.id = ae.tenant_id
    WHERE ae.created_at >= p_start AND ae.created_at <= p_end
  )
  SELECT jsonb_build_object(
    'total_tenants', (SELECT COUNT(*) FROM valid_tenants),
    'active_tenants', (SELECT COUNT(*) FROM valid_tenants WHERE status IN ('active', 'trial')),
    'total_bookings', (SELECT COUNT(*) FROM curr_b),
    'prev_total_bookings', (SELECT COUNT(*) FROM prev_b),
    'online_bookings', (SELECT COUNT(*) FROM curr_b WHERE booking_source = 'online'),
    'manual_bookings', (SELECT COUNT(*) FROM curr_b WHERE COALESCE(booking_source, 'manual') = 'manual'),
    'completed_bookings', (SELECT COUNT(*) FROM curr_b WHERE status = 'completed'),
    'canceled_bookings', (SELECT COUNT(*) FROM curr_b WHERE status = 'canceled'),
    'scheduled_value', COALESCE((SELECT SUM(amount_total) FROM curr_b WHERE status NOT IN ('canceled', 'no_show')), 0),
    'received_revenue', COALESCE((
      SELECT SUM(
        CASE WHEN status = 'completed' OR payment_status = 'paid'
        THEN COALESCE(NULLIF(amount_paid, 0), amount_total, 0)
        WHEN payment_status = 'partial_paid' THEN COALESCE(amount_paid, 0)
        ELSE 0 END
      ) FROM curr_b WHERE status <> 'canceled'
    ), 0),
    'prev_received_revenue', COALESCE((
      SELECT SUM(
        CASE WHEN status = 'completed' OR payment_status = 'paid'
        THEN COALESCE(NULLIF(amount_paid, 0), amount_total, 0)
        WHEN payment_status = 'partial_paid' THEN COALESCE(amount_paid, 0)
        ELSE 0 END
      ) FROM prev_b WHERE status <> 'canceled'
    ), 0),
    'portal_sessions', COALESCE((SELECT COUNT(DISTINCT session_id) FROM curr_e WHERE source = 'portal'), 0),
    'admin_sessions', COALESCE((SELECT COUNT(DISTINCT session_id) FROM curr_e WHERE source = 'admin'), 0),
    'total_customers', COALESCE((
      SELECT COUNT(*) FROM public.customers c JOIN valid_tenants vt ON vt.id = c.tenant_id
    ), 0)
  ) INTO v_summary;

  -- Ranking e Comparação entre Estabelecimentos (Seção 13)
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO v_tenants_ranking
  FROM (
    WITH b_agg AS (
      SELECT
        tenant_id,
        COUNT(*) FILTER (WHERE scheduled_at >= p_start AND scheduled_at <= p_end) AS total_bookings,
        COUNT(*) FILTER (WHERE scheduled_at >= v_prev_start AND scheduled_at < v_prev_end) AS prev_bookings,
        COUNT(*) FILTER (WHERE scheduled_at >= p_start AND scheduled_at <= p_end AND booking_source = 'online') AS online_bookings,
        COUNT(*) FILTER (WHERE scheduled_at >= p_start AND scheduled_at <= p_end AND COALESCE(booking_source, 'manual') = 'manual') AS manual_bookings,
        COUNT(*) FILTER (WHERE scheduled_at >= p_start AND scheduled_at <= p_end AND status = 'completed') AS completed_bookings,
        COUNT(*) FILTER (WHERE scheduled_at >= p_start AND scheduled_at <= p_end AND status = 'canceled') AS canceled_bookings,
        COALESCE(SUM(amount_total) FILTER (WHERE scheduled_at >= p_start AND scheduled_at <= p_end AND status NOT IN ('canceled', 'no_show')), 0) AS scheduled_value,
        COALESCE(SUM(
          CASE WHEN status = 'completed' OR payment_status = 'paid'
          THEN COALESCE(NULLIF(amount_paid, 0), amount_total, 0)
          WHEN payment_status = 'partial_paid' THEN COALESCE(amount_paid, 0)
          ELSE 0 END
        ) FILTER (WHERE scheduled_at >= p_start AND scheduled_at <= p_end AND status <> 'canceled'), 0) AS received_revenue,
        COALESCE(SUM(
          CASE WHEN status = 'completed' OR payment_status = 'paid'
          THEN COALESCE(NULLIF(amount_paid, 0), amount_total, 0)
          WHEN payment_status = 'partial_paid' THEN COALESCE(amount_paid, 0)
          ELSE 0 END
        ) FILTER (WHERE scheduled_at >= v_prev_start AND scheduled_at < v_prev_end AND status <> 'canceled'), 0) AS prev_received_revenue
      FROM public.bookings
      WHERE scheduled_at >= v_prev_start AND scheduled_at <= p_end
      GROUP BY tenant_id
    ),
    e_agg AS (
      SELECT
        tenant_id,
        COUNT(DISTINCT session_id) FILTER (WHERE source = 'portal') AS portal_sessions,
        COUNT(*) FILTER (WHERE source = 'portal') AS portal_events,
        COUNT(DISTINCT session_id) FILTER (WHERE source = 'admin') AS admin_sessions,
        COUNT(*) FILTER (WHERE source = 'admin' AND (event_type = 'page_view' OR event_name = 'admin_page_view')) AS admin_page_views,
        MAX(created_at) FILTER (WHERE source = 'admin') AS last_admin_access_at
      FROM public.analytics_events
      WHERE tenant_id IS NOT NULL
        AND created_at >= p_start
        AND created_at <= p_end
      GROUP BY tenant_id
    ),
    c_agg AS (
      SELECT
        tenant_id,
        COUNT(*) AS total_customers,
        COUNT(*) FILTER (WHERE created_at >= p_start AND created_at <= p_end) AS new_customers
      FROM public.customers
      GROUP BY tenant_id
    )
    SELECT
      tn.id,
      tn.name,
      tn.slug,
      tn.business_type,
      tn.status,
      tn.created_at,
      GREATEST(1, EXTRACT(DAY FROM (NOW() - tn.created_at))::INT) AS operating_days,
      ts.logo_url,
      ts.city,
      ts.state,
      COALESCE(ba.total_bookings, 0) AS total_bookings,
      COALESCE(ba.prev_bookings, 0) AS prev_bookings,
      COALESCE(ba.online_bookings, 0) AS online_bookings,
      COALESCE(ba.manual_bookings, 0) AS manual_bookings,
      CASE WHEN COALESCE(ba.total_bookings, 0) > 0
        THEN ROUND((COALESCE(ba.online_bookings, 0)::NUMERIC / ba.total_bookings) * 100, 1)
        ELSE 0 END AS online_share_pct,
      COALESCE(ba.completed_bookings, 0) AS completed_bookings,
      COALESCE(ba.canceled_bookings, 0) AS canceled_bookings,
      COALESCE(ba.scheduled_value, 0) AS scheduled_value,
      COALESCE(ba.received_revenue, 0) AS received_revenue,
      COALESCE(ba.prev_received_revenue, 0) AS prev_received_revenue,
      COALESCE(ca.total_customers, 0) AS total_customers,
      COALESCE(ca.new_customers, 0) AS new_customers,
      COALESCE(ea.portal_sessions, 0) AS portal_sessions,
      CASE WHEN COALESCE(ea.portal_sessions, 0) > 0
        THEN LEAST(100, ROUND((COALESCE(ba.online_bookings, 0)::NUMERIC / ea.portal_sessions) * 100, 1))
        ELSE NULL END AS portal_conversion_rate,
      COALESCE(ea.admin_sessions, 0) AS admin_sessions,
      COALESCE(ea.admin_page_views, 0) AS admin_page_views,
      ea.last_admin_access_at
    FROM public.tenants tn
    LEFT JOIN public.tenant_settings ts ON ts.tenant_id = tn.id
    LEFT JOIN b_agg ba ON ba.tenant_id = tn.id
    LEFT JOIN e_agg ea ON ea.tenant_id = tn.id
    LEFT JOIN c_agg ca ON ca.tenant_id = tn.id
    WHERE tn.deleted_at IS NULL
      AND (p_business_type IS NULL OR p_business_type = 'all' OR tn.business_type = p_business_type)
    ORDER BY COALESCE(ba.received_revenue, 0) DESC, COALESCE(ba.total_bookings, 0) DESC, tn.created_at DESC
  ) t;

  -- Dispositivos Globais
  SELECT jsonb_build_object(
    'portal', COALESCE((
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT
          public.normalize_analytics_os(os, device_type) AS platform,
          COUNT(DISTINCT session_id) AS sessions,
          COUNT(*) AS events
        FROM public.analytics_events
        WHERE source = 'portal'
          AND created_at >= p_start
          AND created_at <= p_end
        GROUP BY 1
        ORDER BY sessions DESC
      ) t
    ), '[]'::jsonb),
    'admin', COALESCE((
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT
          public.normalize_analytics_os(os, device_type) AS platform,
          COUNT(DISTINCT session_id) AS sessions,
          COUNT(*) AS events
        FROM public.analytics_events
        WHERE source = 'admin'
          AND created_at >= p_start
          AND created_at <= p_end
        GROUP BY 1
        ORDER BY sessions DESC
      ) t
    ), '[]'::jsonb)
  ) INTO v_global_devices;

  -- Modalidades de Pagamento Globais
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO v_global_payments
  FROM (
    SELECT
      public.normalize_analytics_payment_method(b.payment_method, b.payment_mode) AS modality,
      COUNT(*) AS bookings_count,
      COALESCE(SUM(b.amount_total) FILTER (WHERE b.status <> 'canceled'), 0) AS scheduled_amount,
      COALESCE(SUM(
        CASE WHEN b.status = 'completed' OR b.payment_status = 'paid'
        THEN COALESCE(NULLIF(b.amount_paid, 0), b.amount_total, 0) ELSE 0 END
      ) FILTER (WHERE b.status <> 'canceled'), 0) AS received_amount
    FROM public.bookings b
    JOIN public.tenants tn ON tn.id = b.tenant_id AND tn.deleted_at IS NULL
    WHERE b.scheduled_at >= p_start
      AND b.scheduled_at <= p_end
      AND (p_business_type IS NULL OR p_business_type = 'all' OR tn.business_type = p_business_type)
    GROUP BY 1
    ORDER BY bookings_count DESC
  ) t;

  -- Evolução Diária Global
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO v_daily_trend
  FROM (
    SELECT
      TO_CHAR((b.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::DATE, 'YYYY-MM-DD') AS day,
      COUNT(*) FILTER (WHERE b.status <> 'canceled') AS bookings_count,
      COUNT(*) FILTER (WHERE b.booking_source = 'online' AND b.status <> 'canceled') AS online_count,
      COUNT(*) FILTER (WHERE COALESCE(b.booking_source, 'manual') = 'manual' AND b.status <> 'canceled') AS manual_count,
      COALESCE(SUM(
        CASE WHEN b.status = 'completed' OR b.payment_status = 'paid'
        THEN COALESCE(NULLIF(b.amount_paid, 0), b.amount_total, 0) ELSE 0 END
      ) FILTER (WHERE b.status <> 'canceled'), 0) AS received_revenue
    FROM public.bookings b
    JOIN public.tenants tn ON tn.id = b.tenant_id AND tn.deleted_at IS NULL
    WHERE b.scheduled_at >= p_start
      AND b.scheduled_at <= p_end
      AND (p_business_type IS NULL OR p_business_type = 'all' OR tn.business_type = p_business_type)
    GROUP BY 1
    ORDER BY 1 ASC
  ) t;

  RETURN jsonb_build_object(
    'period', jsonb_build_object(
      'start', p_start,
      'end', p_end,
      'prev_start', v_prev_start,
      'prev_end', v_prev_end
    ),
    'summary', v_summary,
    'tenants_ranking', v_tenants_ranking,
    'devices', v_global_devices,
    'payments', v_global_payments,
    'daily_trend', v_daily_trend
  );
END;
$$;

NOTIFY pgrst, 'reload schema';

