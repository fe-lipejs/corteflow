-- 0013_audit_log.sql
-- Sprint 11.10: Sistema de Auditoria

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name TEXT,
  action TEXT NOT NULL,        -- 'login', 'tenant_status_changed', 'plan_changed', etc.
  target_type TEXT,            -- 'tenant', 'user', 'plan', 'subscription'
  target_id TEXT,
  target_name TEXT,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast queries
CREATE INDEX IF NOT EXISTS admin_audit_log_actor_id_idx ON admin_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS admin_audit_log_created_at_idx ON admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_action_idx ON admin_audit_log(action);
CREATE INDEX IF NOT EXISTS admin_audit_log_target_type_idx ON admin_audit_log(target_type);

-- RLS: Only super_admin can read
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin can manage audit log" ON admin_audit_log
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());
