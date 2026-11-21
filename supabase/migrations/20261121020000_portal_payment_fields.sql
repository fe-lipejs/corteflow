-- Adiciona payment_status, payment_method, amount_due e created_at em get_customer_bookings_secure
-- para exibir corretamente status de pagamento, saldo restante e filtrar rascunhos abandonados no Portal do Cliente.

CREATE OR REPLACE FUNCTION public.get_customer_bookings_secure(p_customer_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(json_agg(
      json_build_object(
        'id', b.id,
        'order_number', b.order_number,
        'customer_id', b.customer_id,
        'professional_id', b.professional_id,
        'service_id', b.service_id,
        'scheduled_at', b.scheduled_at,
        'created_at', b.created_at,
        'status', b.status,
        'notes', b.notes,
        'reschedule_count', COALESCE(b.reschedule_count, 0),
        'amount_total', b.amount_total,
        'amount_paid', b.amount_paid,
        'amount_due', b.amount_due,
        'payment_mode', b.payment_mode,
        'payment_status', b.payment_status,
        'payment_method', b.payment_method,
        'access_code', b.access_code,
        'service_location', b.service_location,
        'client_address', b.client_address,
        'services', (
          SELECT json_build_object(
            'id', s.id,
            'name', s.name,
            'price', s.price,
            'duration_minutes', s.duration_minutes
          )
          FROM services s
          WHERE s.id = b.service_id
        ),
        'professionals', (
          SELECT json_build_object(
            'id', p.id,
            'name', p.name,
            'photo_url', p.photo_url
          )
          FROM professionals p
          WHERE p.id = b.professional_id
        )
      ) ORDER BY b.scheduled_at DESC
    ), '[]'::json)
    FROM bookings b
    WHERE b.customer_id = p_customer_id
      AND NOT (
        b.status = 'pending'
        AND b.payment_mode IN ('deposit', 'full')
        AND b.created_at < (now() - interval '15 minutes')
      )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_customer_bookings_secure(uuid) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
