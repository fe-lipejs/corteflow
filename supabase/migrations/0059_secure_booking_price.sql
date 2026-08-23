-- ============================================================
-- Migration 0059: Secure Booking Pricing
-- Impede que usuários anônimos (pela página pública) enviem 
-- preços manipulados na API. Força o cálculo correto do serviço.
-- ============================================================

CREATE OR REPLACE FUNCTION secure_booking_price()
RETURNS TRIGGER AS $$
DECLARE
    v_service_price NUMERIC;
BEGIN
    -- Se for um usuário anônimo (cliente agendando pela vitrine)
    -- E estivermos inserindo (ou atualizando) um agendamento
    IF auth.role() = 'anon' THEN
        -- Busca o preço real do serviço
        SELECT price INTO v_service_price FROM services WHERE id = NEW.service_id;
        
        -- Força o preço total correto (Serviço + Taxa de deslocamento calculada na outra trigger)
        NEW.amount_total := COALESCE(v_service_price, 0) + COALESCE(NEW.travel_fee, 0);

        -- Força o valor pago inicialmente para 0, para evitar que mandem amount_paid > 0
        -- O webhook do Stripe é que vai atualizar isso para > 0 quando o pagamento cair.
        IF TG_OP = 'INSERT' THEN
            NEW.amount_paid := 0;
        END IF;

        -- Força o saldo devedor correto
        NEW.amount_due := NEW.amount_total - NEW.amount_paid;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_z_secure_booking_price ON bookings;
CREATE TRIGGER trigger_z_secure_booking_price
BEFORE INSERT OR UPDATE ON bookings
FOR EACH ROW
EXECUTE FUNCTION secure_booking_price();
