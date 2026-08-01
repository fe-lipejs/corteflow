-- Table: notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  type TEXT NOT NULL, -- 'booking_new', 'booking_canceled', 'booking_rescheduled', 'customer_new'
  is_read BOOLEAN NOT NULL DEFAULT false,
  link TEXT, -- opcional, url interna para redirecionar ao clicar
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for notifications" ON notifications
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()) OR is_super_admin());

-- Modify notification_settings to include sound_enabled
ALTER TABLE notification_settings ADD COLUMN IF NOT EXISTS sound_enabled BOOLEAN NOT NULL DEFAULT true;

-- Setup Realtime Publication
-- Supabase has a default publication called supabase_realtime.
-- Let's ensure the tables are in it.
BEGIN;
  -- Remove from publication if they exist (just to be safe against errors, but PostgreSQL 15+ allows ADD TABLE IF NOT EXISTS, we'll try standard way safely)
  DO $$ 
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'bookings') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE bookings;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'customers') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE customers;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'notifications') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
    END IF;
  END $$;
COMMIT;

-- Ensure replica identity full is set so we can see old records in updates
ALTER TABLE bookings REPLICA IDENTITY FULL;
ALTER TABLE customers REPLICA IDENTITY FULL;
ALTER TABLE notifications REPLICA IDENTITY FULL;

-- DB Trigger for Bookings Notifications
CREATE OR REPLACE FUNCTION notify_booking_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_customer_name TEXT;
  v_service_name TEXT;
  v_pro_name TEXT;
  v_time TEXT;
  v_desc TEXT;
BEGIN
  -- Fetch related names
  SELECT name INTO v_customer_name FROM customers WHERE id = NEW.customer_id;
  SELECT name INTO v_service_name FROM services WHERE id = NEW.service_id;
  
  IF NEW.professional_id IS NOT NULL THEN
    SELECT name INTO v_pro_name FROM professionals WHERE id = NEW.professional_id;
  ELSE
    v_pro_name := 'Qualquer profissional';
  END IF;

  -- Format time as DD/MM HH:MM
  v_time := to_char(NEW.scheduled_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM "às" HH24:MI');

  IF TG_OP = 'INSERT' THEN
    v_desc := v_customer_name || ' agendou ' || v_service_name || ' com ' || v_pro_name || ' para ' || v_time || '.';
    INSERT INTO notifications (tenant_id, title, description, type, link)
    VALUES (NEW.tenant_id, '🎉 Novo agendamento', v_desc, 'booking_new', '/app/agenda');
    
  ELSIF TG_OP = 'UPDATE' THEN
    -- Cancelamento
    IF NEW.status = 'canceled' AND OLD.status != 'canceled' THEN
      v_desc := 'O agendamento de ' || v_customer_name || ' (' || v_service_name || ') marcado para ' || v_time || ' foi cancelado.';
      INSERT INTO notifications (tenant_id, title, description, type, link)
      VALUES (NEW.tenant_id, '❌ Agendamento cancelado', v_desc, 'booking_canceled', '/app/agenda');
    END IF;
    
    -- Remarcação (mudança de horário)
    IF NEW.scheduled_at != OLD.scheduled_at THEN
      v_desc := 'O agendamento de ' || v_customer_name || ' (' || v_service_name || ') foi remarcado para ' || v_time || '.';
      INSERT INTO notifications (tenant_id, title, description, type, link)
      VALUES (NEW.tenant_id, '🔄 Agendamento remarcado', v_desc, 'booking_rescheduled', '/app/agenda');
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_booking_notifications ON bookings;
CREATE TRIGGER trigger_booking_notifications
  AFTER INSERT OR UPDATE
  ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION notify_booking_changes();

-- DB Trigger for New Customers Notifications
CREATE OR REPLACE FUNCTION notify_customer_new()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO notifications (tenant_id, title, description, type, link)
    VALUES (NEW.tenant_id, '👋 Novo cliente', NEW.name || ' acabou de se cadastrar no seu sistema.', 'customer_new', '/app/clientes');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_customer_notifications ON customers;
CREATE TRIGGER trigger_customer_notifications
  AFTER INSERT
  ON customers
  FOR EACH ROW
  EXECUTE FUNCTION notify_customer_new();
