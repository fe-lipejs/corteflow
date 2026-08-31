-- ============================================================
-- Fixes for Commission and Notifications
-- ============================================================

-- 1. Fix missing commission_value column
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS commission_value NUMERIC DEFAULT 0;

-- 2. Add professional_id to notifications for targeted delivery
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS professional_id UUID REFERENCES professionals(id) ON DELETE CASCADE;

-- 3. Update the realtime trigger to populate professional_id
CREATE OR REPLACE FUNCTION notify_booking_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_customer_name TEXT;
  v_service_name TEXT;
  v_pro_name TEXT;
  v_time TEXT;
  v_desc TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  SELECT name INTO v_customer_name FROM customers WHERE id = NEW.customer_id;
  SELECT name INTO v_service_name FROM services WHERE id = NEW.service_id;
  SELECT name INTO v_pro_name FROM professionals WHERE id = NEW.professional_id;
  v_time := to_char(NEW.scheduled_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI');

  IF TG_OP = 'INSERT' THEN
    v_desc := v_customer_name || ' agendou ' || v_service_name || ' com ' || v_pro_name || ' para ' || v_time || '.';
    INSERT INTO notifications (tenant_id, professional_id, title, description, type, link)
    VALUES (NEW.tenant_id, NEW.professional_id, '?? Novo agendamento', v_desc, 'booking_new', '/app/agenda');
    
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'canceled' AND OLD.status != 'canceled' THEN
      v_desc := 'O agendamento de ' || v_customer_name || ' (' || v_service_name || ') marcado para ' || v_time || ' foi cancelado.';
      INSERT INTO notifications (tenant_id, professional_id, title, description, type, link)
      VALUES (NEW.tenant_id, NEW.professional_id, '? Agendamento cancelado', v_desc, 'booking_canceled', '/app/agenda');
    END IF;
    
    IF NEW.scheduled_at != OLD.scheduled_at THEN
      v_desc := 'O agendamento de ' || v_customer_name || ' (' || v_service_name || ') foi remarcado para ' || v_time || '.';
      INSERT INTO notifications (tenant_id, professional_id, title, description, type, link)
      VALUES (NEW.tenant_id, NEW.professional_id, '?? Agendamento remarcado', v_desc, 'booking_rescheduled', '/app/agenda');
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
