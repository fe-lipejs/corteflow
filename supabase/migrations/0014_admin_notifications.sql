-- 0014_admin_notifications.sql
-- Sprint 11.11: Central de Notificações

CREATE TABLE IF NOT EXISTS admin_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL,          -- 'new_signup', 'trial_expiring', 'payment_failed', 'payment_confirmed', etc.
  title TEXT NOT NULL,
  body TEXT,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  tenant_name TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast unread queries
CREATE INDEX IF NOT EXISTS admin_notifications_read_idx ON admin_notifications(read);
CREATE INDEX IF NOT EXISTS admin_notifications_created_at_idx ON admin_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS admin_notifications_type_idx ON admin_notifications(type);

-- RLS: Only super_admin
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin can manage notifications" ON admin_notifications
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());
