-- Criação de restrição para evitar que dois agendamentos ativos ocorram no mesmo exato horário para o mesmo profissional.
-- Uma constraint mais forte seria EXCLUDE usando tsrange, mas para simplificar e garantir a integridade da UI atual
-- que divide os blocos de hora em intervalos exatos, um índice parcial único na data e profissional já bloqueia cliques simultâneos no mesmo bloco.

CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_professional_time_unique 
ON public.bookings (professional_id, scheduled_at) 
WHERE status IN ('pending', 'confirmed', 'completed');
