-- Support Tickets System

CREATE TABLE support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  subject TEXT NOT NULL,
  category TEXT CHECK (category IN ('billing', 'technical', 'feature', 'other')) NOT NULL DEFAULT 'other',
  status TEXT CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')) NOT NULL DEFAULT 'open',
  priority TEXT CHECK (priority IN ('low', 'medium', 'high')) NOT NULL DEFAULT 'medium',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES support_tickets(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  sender_role TEXT CHECK (sender_role IN ('owner', 'super_admin')) NOT NULL,
  content TEXT NOT NULL,
  read_by_admin BOOLEAN NOT NULL DEFAULT false,
  read_by_owner BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_support_tickets_tenant_id ON support_tickets(tenant_id);
CREATE INDEX idx_support_tickets_status ON support_tickets(status);
CREATE INDEX idx_support_messages_ticket_id ON support_messages(ticket_id);

-- Auto-update updated_at on tickets when a message is added
CREATE OR REPLACE FUNCTION update_ticket_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE support_tickets SET updated_at = now() WHERE id = NEW.ticket_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_support_message_insert
  AFTER INSERT ON support_messages
  FOR EACH ROW EXECUTE FUNCTION update_ticket_timestamp();

-- RLS
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

-- Tickets: owner can see/create their own; super_admin can see all
CREATE POLICY "owner_can_manage_own_tickets" ON support_tickets
  FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    OR is_super_admin()
  );

-- Messages: accessible if the user is linked to the ticket
CREATE POLICY "users_can_access_ticket_messages" ON support_messages
  FOR ALL USING (
    ticket_id IN (
      SELECT id FROM support_tickets
      WHERE tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
      OR is_super_admin()
    )
  );

-- Enable realtime for live chat feel
ALTER PUBLICATION supabase_realtime ADD TABLE support_tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE support_messages;
