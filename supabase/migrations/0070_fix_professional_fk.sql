-- ============================================================
-- Migration 0070: Fix bookings FK for professional deletion
-- ============================================================

-- Change ON DELETE RESTRICT to ON DELETE SET NULL on bookings.professional_id
-- This allows deleting a professional while keeping their booking history (professional_id becomes NULL)
ALTER TABLE bookings
  DROP CONSTRAINT IF EXISTS bookings_professional_id_fkey;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_professional_id_fkey
  FOREIGN KEY (professional_id)
  REFERENCES professionals(id)
  ON DELETE SET NULL;

-- Also ensure tenant_users can be deleted without cascading issues  
ALTER TABLE tenant_users
  DROP CONSTRAINT IF EXISTS tenant_users_user_id_fkey;

ALTER TABLE tenant_users
  ADD CONSTRAINT tenant_users_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES profiles(id)
  ON DELETE CASCADE;
