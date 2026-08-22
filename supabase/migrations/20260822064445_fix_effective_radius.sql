-- Migração para corrigir a lógica do raio efetivo de atendimento a domicílio
-- O limite efetivo deve ser sempre O MENOR entre o raio do salão e o limite do profissional.

CREATE OR REPLACE FUNCTION check_home_booking_rules()
RETURNS TRIGGER AS $$
DECLARE
    v_salon_radius NUMERIC;
    v_pro_max_distance NUMERIC;
    v_pro_home_fee NUMERIC;
    v_home_fee_type TEXT;
    v_home_fee_amount NUMERIC;
    v_home_fee_per_km NUMERIC;
    v_salon_lat NUMERIC;
    v_salon_lng NUMERIC;
    
    v_distance NUMERIC;
    v_effective_radius NUMERIC;
    v_expected_fee NUMERIC;
BEGIN
    -- Se não for domicílio, apenas limpa os dados caso tenham sido enviados
    IF NEW.service_location != 'home' THEN
        NEW.client_lat := NULL;
        NEW.client_lng := NULL;
        NEW.travel_fee := 0;
        RETURN NEW;
    END IF;

    -- Para home, coordenadas são obrigatórias
    IF NEW.client_lat IS NULL OR NEW.client_lng IS NULL THEN
        RAISE EXCEPTION 'Para atendimento a domicílio, as coordenadas do cliente (client_lat, client_lng) são obrigatórias.';
    END IF;

    -- Busca as configurações do salão e do profissional
    SELECT 
        ts.home_service_radius_km, 
        ts.home_fee_type, 
        ts.home_fee_amount, 
        ts.home_fee_per_km,
        ts.latitude,
        ts.longitude
    INTO 
        v_salon_radius, 
        v_home_fee_type, 
        v_home_fee_amount, 
        v_home_fee_per_km,
        v_salon_lat,
        v_salon_lng
    FROM tenant_settings ts 
    WHERE ts.tenant_id = NEW.tenant_id;

    SELECT 
        max_home_distance_km, 
        home_fee
    INTO 
        v_pro_max_distance, 
        v_pro_home_fee
    FROM professionals 
    WHERE id = NEW.professional_id AND tenant_id = NEW.tenant_id;

    -- Calcula a distância usando Haversine no BD
    v_distance := haversine_distance_km(v_salon_lat, v_salon_lng, NEW.client_lat, NEW.client_lng);

    -- 1. Verifica Raio Efetivo (SEMPRE O MENOR LIMITE APLICÁVEL)
    v_effective_radius := CASE 
                            WHEN v_pro_max_distance > 0 THEN LEAST(v_pro_max_distance, v_salon_radius)
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
        IF v_home_fee_type = 'fixed' THEN
            v_expected_fee := v_home_fee_amount;
        ELSIF v_home_fee_type = 'per_km' THEN
            v_expected_fee := v_distance * v_home_fee_per_km;
        ELSE
            v_expected_fee := 0;
        END IF;
    END IF;

    -- 3. Impede fraudes de taxa
    -- Se o frontend enviou uma taxa diferente, ou se enviou 0 (e era pra ser mais), a gente bloqueia ou conserta
    -- Para segurança, barramos se a diferença for maior que 1 real (margem de arredondamento)
    IF ABS(NEW.travel_fee - v_expected_fee) > 1.00 THEN
        RAISE EXCEPTION 'Taxa de deslocamento incorreta. Esperado: %, Recebido: %.', v_expected_fee, NEW.travel_fee;
    END IF;

    -- Corrige exatamente para o valor esperado para evitar centavos errados
    NEW.travel_fee := v_expected_fee;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
