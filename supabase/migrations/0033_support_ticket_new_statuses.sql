-- Add new statuses to support_tickets

ALTER TABLE support_tickets DROP CONSTRAINT support_tickets_status_check;

ALTER TABLE support_tickets ADD CONSTRAINT support_tickets_status_check 
CHECK (status IN ('open', 'in_progress', 'resolved', 'closed', 'waiting_user', 'waiting_support'));
