-- ============================================================
-- Migration 0069: Auth Utils for Edge Functions
-- ============================================================

CREATE OR REPLACE FUNCTION get_user_id_by_email(p_email TEXT)
RETURNS UUID AS $$
  SELECT id FROM auth.users WHERE email = p_email LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;
