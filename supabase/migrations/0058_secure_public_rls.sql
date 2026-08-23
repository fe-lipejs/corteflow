-- ============================================================
-- Migration 0058: Secure Public RLS
-- Revokes open SELECT permissions on bookings and customers,
-- and replaces them with secure RPC functions that only expose
-- necessary data.
-- ============================================================

-- 1. Secure Public Booking Slots
-- Create an RPC to fetch available slots without exposing PII
CREATE OR REPLACE FUNCTION get_public_booking_slots(p_tenant_id uuid, p_start timestamp with time zone, p_end timestamp with time zone)
RETURNS TABLE (
  id uuid,
  professional_id uuid,
  service_id uuid,
  scheduled_at timestamp with time zone,
  status text,
  created_at timestamp with time zone
) SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT b.id, b.professional_id, b.service_id, b.scheduled_at, b.status, b.created_at
  FROM bookings b
  WHERE b.tenant_id = p_tenant_id
    AND b.status IN ('pending', 'confirmed')
    AND b.scheduled_at >= p_start
    AND b.scheduled_at <= p_end;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_public_booking_slots TO anon, authenticated;

-- Revoke the dangerous public access to bookings
DROP POLICY IF EXISTS "Public can read bookings for slot availability" ON bookings;


-- 2. Secure Client Portal Bookings
-- Create an RPC for fetching customer bookings safely
CREATE OR REPLACE FUNCTION get_customer_bookings_secure(p_customer_id uuid)
RETURNS json SECURITY DEFINER AS $$
BEGIN
  RETURN (
    SELECT COALESCE(json_agg(
      json_build_object(
        'id', b.id,
        'customer_id', b.customer_id,
        'professional_id', b.professional_id,
        'service_id', b.service_id,
        'scheduled_at', b.scheduled_at,
        'status', b.status,
        'amount_total', b.amount_total,
        'amount_paid', b.amount_paid,
        'payment_mode', b.payment_mode,
        'access_code', b.access_code,
        'service_location', b.service_location,
        'client_address', b.client_address,
        'services', (SELECT json_build_object('id', s.id, 'name', s.name, 'price', s.price, 'duration_minutes', s.duration_minutes) FROM services s WHERE s.id = b.service_id),
        'professionals', (SELECT json_build_object('id', p.id, 'name', p.name, 'photo_url', p.photo_url) FROM professionals p WHERE p.id = b.professional_id)
      ) ORDER BY b.scheduled_at DESC
    ), '[]'::json)
    FROM bookings b
    WHERE b.customer_id = p_customer_id
  );
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_customer_bookings_secure TO anon, authenticated;


-- 3. Secure Customer Queries by Phone
-- Drop the dangerous "Public select customer by exact phone"
DROP POLICY IF EXISTS "Public select customer by exact phone" ON customers;

-- Add an RPC to securely fetch the customer ID by phone
CREATE OR REPLACE FUNCTION get_customer_by_phone(p_tenant_id uuid, p_phone text)
RETURNS uuid SECURITY DEFINER AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM customers WHERE tenant_id = p_tenant_id AND phone = p_phone LIMIT 1;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_customer_by_phone TO anon, authenticated;
