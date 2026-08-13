-- 0023_support_ticket_notification.sql

CREATE OR REPLACE FUNCTION notify_admin_on_new_ticket()
RETURNS TRIGGER AS $$
DECLARE
  tenant_name TEXT;
BEGIN
  SELECT name INTO tenant_name FROM tenants WHERE id = NEW.tenant_id;
  
  INSERT INTO admin_notifications (
    type,
    title,
    body,
    tenant_id,
    tenant_name,
    priority
  ) VALUES (
    'new_ticket',
    'Novo Chamado: ' || NEW.subject,
    'Categoria: ' || NEW.category || ' | Prioridade: ' || NEW.priority,
    NEW.tenant_id,
    tenant_name,
    CASE WHEN NEW.priority = 'high' THEN 'high' ELSE 'normal' END
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_new_support_ticket ON support_tickets;
CREATE TRIGGER on_new_support_ticket
  AFTER INSERT ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION notify_admin_on_new_ticket();
