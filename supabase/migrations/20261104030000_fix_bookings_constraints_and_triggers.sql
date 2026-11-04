-- ==========================================
-- MIGRATION: Fix Bookings Constraints, Payment Statuses & Customer Metrics Trigger
-- ==========================================

-- 1. Drop and recreate bookings_payment_status_check so BOTH 'paid' and 'full_paid' are accepted
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_payment_status_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_payment_status_check
  CHECK (payment_status IN ('pending', 'partial_paid', 'paid', 'full_paid', 'refunded', 'credit_generated', 'failed', 'canceled'));

-- 2. Drop and recreate bookings_payment_mode_check so all payment mode variants are accepted
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_payment_mode_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_payment_mode_check
  CHECK (payment_mode IN ('local', 'deposit', 'full', 'pay_local', 'partial_50', 'full_100', 'partial'));

-- 3. Fix update_customer_metrics() trigger so unpaid 'pending' online checkouts are NOT counted as visits/spent,
-- while completed bookings AND confirmed bookings with online payments ARE properly reflected.
CREATE OR REPLACE FUNCTION public.update_customer_metrics()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    target_customer_id UUID;
    v_total NUMERIC(10,2);
    v_count INTEGER;
    v_last_visit TIMESTAMPTZ;
BEGIN
    IF TG_OP = 'DELETE' THEN
        target_customer_id := OLD.customer_id;
    ELSE
        target_customer_id := NEW.customer_id;
    END IF;

    IF target_customer_id IS NOT NULL THEN
        SELECT 
            COALESCE(SUM(
                CASE 
                    WHEN status = 'completed' OR (status = 'confirmed' AND scheduled_at <= NOW()) THEN COALESCE(amount_total, 0)
                    WHEN status = 'confirmed' AND COALESCE(amount_paid, 0) > 0 THEN COALESCE(amount_paid, 0)
                    ELSE 0
                END
            ), 0),
            COUNT(id) FILTER (
                WHERE status = 'completed' 
                   OR (status = 'confirmed' AND scheduled_at <= NOW())
                   OR (status = 'confirmed' AND COALESCE(amount_paid, 0) > 0)
            ),
            MAX(scheduled_at) FILTER (
                WHERE status = 'completed' 
                   OR (status = 'confirmed' AND scheduled_at <= NOW())
                   OR (status = 'confirmed' AND COALESCE(amount_paid, 0) > 0)
            )
        INTO v_total, v_count, v_last_visit
        FROM public.bookings
        WHERE customer_id = target_customer_id
          AND status NOT IN ('canceled', 'no_show', 'pending');

        UPDATE public.customers
        SET 
            total_spent = v_total,
            visit_count = v_count,
            last_visit = v_last_visit,
            segment = CASE 
                WHEN v_total >= 500 OR v_count >= 10 THEN 'vip'
                WHEN v_count >= 3 THEN 'fiel'
                ELSE 'novo'
            END
        WHERE id = target_customer_id;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_customer_metrics ON public.bookings;
CREATE TRIGGER trigger_update_customer_metrics
AFTER INSERT OR UPDATE OR DELETE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.update_customer_metrics();

