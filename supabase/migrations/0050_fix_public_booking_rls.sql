-- ============================================================
-- Migration 0050: Fix Public Booking RLS Policies
-- Ensures anonymous clients on Netlify / public domain can view
-- active professionals, schedules, services and calculate slot availability.
-- ============================================================

-- 1. PROFESSIONALS: Allow public/anon to read active professionals
DROP POLICY IF EXISTS "Public can read active professionals" ON professionals;
CREATE POLICY "Public can read active professionals" ON professionals
  FOR SELECT
  USING (status = 'active' OR status IS NULL);

-- 2. PROFESSIONAL WORKING HOURS: Allow public/anon to read work schedules
DROP POLICY IF EXISTS "Public can read professional hours" ON professional_working_hours;
CREATE POLICY "Public can read professional hours" ON professional_working_hours
  FOR SELECT
  USING (true);

-- 3. PROFESSIONAL SERVICES: Allow public/anon to read services offered by professionals
DROP POLICY IF EXISTS "Public can read professional services" ON professional_services;
CREATE POLICY "Public can read professional services" ON professional_services
  FOR SELECT
  USING (true);

-- 4. PROFESSIONAL BLOCKED TIMES: Allow public/anon to read blocked slots for availability
DROP POLICY IF EXISTS "Public can read professional blocks" ON professional_blocked_times;
CREATE POLICY "Public can read professional blocks" ON professional_blocked_times
  FOR SELECT
  USING (true);

-- 5. STRIPE CONNECT ACCOUNTS: Allow public/anon to check if online payments are enabled
DROP POLICY IF EXISTS "Public can read stripe connect status" ON stripe_connect_accounts;
CREATE POLICY "Public can read stripe connect status" ON stripe_connect_accounts
  FOR SELECT
  USING (true);

-- 6. BOOKINGS: Allow public/anon to view bookings for slot collision checks and access codes
DROP POLICY IF EXISTS "Public can read bookings for slot availability" ON bookings;
CREATE POLICY "Public can read bookings for slot availability" ON bookings
  FOR SELECT
  USING (true);
