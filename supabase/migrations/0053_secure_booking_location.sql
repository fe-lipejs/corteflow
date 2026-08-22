-- ============================================================
-- Migration 0053: Secure Booking Location
-- Cria uma Trigger para validar as regras de agendamento Híbrido
-- e impedir que requisições maliciosas burlem a taxa ou a distância.
-- ============================================================

-- Função para calcular distância Haversine em Km direto no banco (PostgreSQL puro)
CREATE OR REPLACE FUNCTION haversine_distance_km(lat1 NUMERIC, lon1 NUMERIC, lat2 NUMERIC, lon2 NUMERIC)
RETURNS NUMERIC AS $$
DECLARE
    R NUMERIC := 6371; -- Raio da Terra em km
    dLat NUMERIC;
    dLon NUMERIC;
    a NUMERIC;
    c NUMERIC;
BEGIN
    dLat := (lat2 - lat1) * pi() / 180;
    dLon := (lon2 - lon1) * pi() / 180;
    
    a := sin(dLat/2) * sin(dLat/2) +
         cos(lat1 * pi() / 180) * cos(lat2 * pi() / 180) *
         sin(dLon/2) * sin(dLon/2);
         
    c := 2 * atan2(sqrt(a), sqrt(1-a));
    
    RETURN R * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger Function para validar o booking antes do INSERT
CREATE OR REPLACE FUNCTION check_home_booking_rules()
RETURNS TRIGGER AS $$
DECLARE
    v_salon_lat NUMERIC;
    v_salon_lng NUMERIC;
    v_salon_radius NUMERIC;
    v_salon_fee_type TEXT;
    v_salon_fee_amount NUMERIC;
    v_salon_fee_per_km NUMERIC;
    
    v_pro_max_distance NUMERIC;
    v_pro_home_fee NUMERIC;
    
    v_distance NUMERIC;
    v_effective_radius NUMERIC;
    v_expected_fee NUMERIC;
BEGIN
    -- Se não for domicílio, apenas limpa os dados caso tenham sido enviados
    IF NEW.service_location != 'home' THEN
        NEW.client_lat := NULL;
        NEW.client_lng := NULL;
        NEW.client_address := NULL;
        NEW.travel_fee := 0;
        RETURN NEW;
    END IF;

    -- Se for domicílio, DEVE ter lat/lng
    IF NEW.client_lat IS NULL OR NEW.client_lng IS NULL THEN
        RAISE EXCEPTION 'Para atendimento a domicílio, as coordenadas do cliente (client_lat, client_lng) são obrigatórias.';
    END IF;

    -- Busca configurações do salão
    SELECT 
        COALESCE(latitude, -20.3155), -- Fallback para Vitória/ES se não preenchido
        COALESCE(longitude, -40.3128),
        COALESCE(home_service_radius_km, 0),
        COALESCE(home_fee_type, 'free'),
        COALESCE(home_fee_amount, 0),
        COALESCE(home_fee_per_km, 0)
    INTO 
        v_salon_lat, v_salon_lng, v_salon_radius, v_salon_fee_type, v_salon_fee_amount, v_salon_fee_per_km
    FROM tenant_settings
    WHERE tenant_id = NEW.tenant_id;

    -- Busca configurações do profissional
    SELECT 
        COALESCE(max_home_distance_km, 0),
        COALESCE(home_fee, 0)
    INTO 
        v_pro_max_distance, v_pro_home_fee
    FROM professionals
    WHERE id = NEW.professional_id;

    -- Calcula distância
    v_distance := haversine_distance_km(NEW.client_lat, NEW.client_lng, v_salon_lat, v_salon_lng);

    -- 1. Verifica Raio Efetivo
    v_effective_radius := CASE 
                            WHEN v_pro_max_distance > 0 THEN v_pro_max_distance 
                            ELSE v_salon_radius 
                          END;
                          
    -- Tolerância de 2.5km na API, mas no banco a gente aceita a tolerância também 
    -- para bater com a pré-validação do frontend.
    IF v_effective_radius > 0 AND v_distance > (v_effective_radius + 2.5) THEN
        RAISE EXCEPTION 'A distância (%.2f km) excede o raio de cobertura permitido (%.2f km).', v_distance, v_effective_radius;
    END IF;

    -- 2. Calcula Taxa Esperada
    IF v_pro_home_fee > 0 THEN
        v_expected_fee := v_pro_home_fee;
    ELSE
        CASE v_salon_fee_type
            WHEN 'free' THEN v_expected_fee := 0;
            WHEN 'fixed' THEN v_expected_fee := v_salon_fee_amount;
            WHEN 'per_km' THEN v_expected_fee := v_salon_fee_amount + (v_distance * v_salon_fee_per_km);
            ELSE v_expected_fee := 0;
        END CASE;
    END IF;

    -- Arredonda para 2 casas
    v_expected_fee := ROUND(v_expected_fee, 2);

    -- Permite uma pequena margem de diferença por causa de arredondamento de JS vs PG
    IF ABS(NEW.travel_fee - v_expected_fee) > 1.00 THEN
        RAISE EXCEPTION 'Taxa de deslocamento incorreta. Esperado: %, Recebido: %.', v_expected_fee, NEW.travel_fee;
    END IF;

    -- Corrige exatamente para o valor esperado para evitar centavos errados
    NEW.travel_fee := v_expected_fee;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_home_booking ON bookings;
CREATE TRIGGER trigger_check_home_booking
    BEFORE INSERT ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION check_home_booking_rules();
