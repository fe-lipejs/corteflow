-- ============================================================
-- Migration 0071: Fix Multitenant Security
-- Addresses critical RLS vulnerabilities in public inserts
-- and booking history access.
-- ============================================================

-- 1. Fix Bookings Public Insert
-- Prevent arbitrary cross-tenant insertions
DROP POLICY IF EXISTS "Public can create bookings" ON bookings;
CREATE POLICY "Public can create bookings" ON bookings
  FOR INSERT WITH CHECK (
    tenant_id IN (SELECT id FROM tenants WHERE status NOT IN ('blocked', 'suspended'))
    AND (professional_id IS NULL OR professional_id IN (SELECT id FROM professionals WHERE tenant_id = bookings.tenant_id))
    AND (service_id IS NULL OR service_id IN (SELECT id FROM services WHERE tenant_id = bookings.tenant_id))
  );

-- 2. Fix Customers Public Insert
-- Prevent inserting customers into arbitrary or blocked tenants
DROP POLICY IF EXISTS "Public can insert customers" ON customers;
CREATE POLICY "Public can insert customers" ON customers
  FOR INSERT WITH CHECK (
    tenant_id IN (SELECT id FROM tenants WHERE status NOT IN ('blocked', 'suspended'))
  );

-- 3. Fix Booking History Public Access
-- The previous policy allowed anyone to read history if they knew the booking ID.
-- We drop it. The "Tenant isolation for booking_history" policy already covers
-- authenticated users (owners/professionals) reading their tenant's history.
DROP POLICY IF EXISTS "Public read for own booking_history" ON booking_history;

-- If a client needs to see history, it should be done via a secure RPC (like get_customer_bookings_secure)
-- rather than opening the table publicly.
