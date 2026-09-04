-- ============================================================
-- Correção de Permissão no Booking History
-- ============================================================

-- Permite que o profissional registre o histórico de agendamentos
DROP POLICY IF EXISTS "Professionals access tenant booking_history" ON booking_history;
CREATE POLICY "Professionals access tenant booking_history" ON booking_history
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM professionals 
      WHERE auth_user_id = auth.uid() 
      AND tenant_id = booking_history.tenant_id
    )
  );
