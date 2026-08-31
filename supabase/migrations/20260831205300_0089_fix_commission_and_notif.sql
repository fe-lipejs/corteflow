-- ============================================================
-- Correção de Comissão, Notificações, Horários e Clientes
-- ============================================================

-- 1. Cria a coluna de comissão no profissional (Evita o Erro 400 no Finalizado)
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS commission_value NUMERIC DEFAULT 0;

-- 2. Adiciona suporte ao profissional nas notificações (Bug do Sino)
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS professional_id UUID REFERENCES professionals(id) ON DELETE CASCADE;

-- 3. Permite que o profissional leia o nome dos clientes (Bug do Cliente anônimo)
DROP POLICY IF EXISTS "Professionals read tenant customers" ON customers;
CREATE POLICY "Professionals read tenant customers" ON customers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM professionals 
      WHERE auth_user_id = auth.uid() 
      AND tenant_id = customers.tenant_id
    )
  );

-- 4. Atualiza o gatilho de notificações para endereçar ao profissional correto
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

-- 5. Corrige a verificação da Agenda Pública (Riscado / Portas Abertas)
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
    AND b.status IN ('pending', 'confirmed', 'arrived', 'in_progress', 'completed')
    AND b.scheduled_at >= p_start
    AND b.scheduled_at <= p_end;
END;
$$ LANGUAGE plpgsql;
