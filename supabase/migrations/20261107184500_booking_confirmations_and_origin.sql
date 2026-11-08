-- Migration: Add confirmation_status, confirmed_at, booking_source, and payment_method to bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS confirmation_status TEXT NOT NULL DEFAULT 'confirmed'
    CHECK (confirmation_status IN ('pending', 'confirmed')),
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS booking_source TEXT NOT NULL DEFAULT 'manual'
    CHECK (booking_source IN ('manual', 'online')),
  ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'local';

-- Backfill booking_source based on order_number pattern (BOK-* = manual, 6-char = online)
UPDATE public.bookings
SET booking_source = CASE
  WHEN order_number LIKE 'BOK-%' THEN 'manual'
  ELSE 'online'
END
WHERE booking_source = 'manual' AND order_number NOT LIKE 'BOK-%';

-- Backfill payment_method from payments table or payment_mode
UPDATE public.bookings b
SET payment_method = COALESCE(
  (
    SELECT p.payment_method
    FROM public.payments p
    WHERE p.booking_id = b.id
    ORDER BY p.created_at DESC
    LIMIT 1
  ),
  CASE
    WHEN b.payment_mode = 'local' OR b.payment_mode IS NULL THEN 'local'
    ELSE 'pix'
  END
);

-- Set confirmation_status = 'pending' for upcoming online bookings that have not been completed/canceled yet
UPDATE public.bookings
SET confirmation_status = 'pending'
WHERE booking_source = 'online'
  AND status = 'confirmed'
  AND scheduled_at >= NOW() - INTERVAL '12 hours'
  AND confirmed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_tenant_confirmation_scheduled
  ON public.bookings(tenant_id, confirmation_status, scheduled_at);

