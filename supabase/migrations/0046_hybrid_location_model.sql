-- ============================================================
-- Migration 0046: Modelo Híbrido de Atendimento
-- Estabelecimento + Domicílio (Location-based Scheduling)
--
-- TODAS as colunas são aditivas com defaults seguros.
-- Negócios existentes (só presencial) NÃO são impactados.
-- ============================================================

-- ─── 1. SERVICES — Modalidade de atendimento ─────────────────────────────────
-- service_mode: onde o serviço é prestado
-- home_price_extra: acréscimo no preço para atendimento a domicílio
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS service_mode TEXT DEFAULT 'instore'
    CHECK (service_mode IN ('instore', 'home', 'both')),
  ADD COLUMN IF NOT EXISTS home_price_extra NUMERIC DEFAULT 0;

COMMENT ON COLUMN services.service_mode IS
  'Modalidade: instore=só no estabelecimento, home=só domicílio, both=ambos';
COMMENT ON COLUMN services.home_price_extra IS
  'Valor adicional cobrado quando o atendimento é a domicílio (soma-se ao price base)';

-- ─── 2. PROFESSIONALS — Capacidade de domicílio ──────────────────────────────
-- offers_home_service: profissional aceita ir a domicílio?
-- max_home_distance_km: raio máximo deste profissional (0 = sem limite próprio, usa o do salão)
-- home_fee: taxa de deslocamento própria deste profissional (0 = usa a do salão)
ALTER TABLE professionals
  ADD COLUMN IF NOT EXISTS offers_home_service BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_home_distance_km NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS home_fee NUMERIC DEFAULT 0;

COMMENT ON COLUMN professionals.offers_home_service IS
  'true = este profissional atende a domicílio';
COMMENT ON COLUMN professionals.max_home_distance_km IS
  'Raio máximo de atendimento deste profissional em km (0 = usa raio global do salão)';
COMMENT ON COLUMN professionals.home_fee IS
  'Taxa de deslocamento própria do profissional (0 = usa a configuração global do salão)';

-- ─── 3. BOOKINGS — Local de atendimento e dados do cliente ───────────────────
-- service_location: registra se o atendimento foi presencial ou a domicílio
-- client_address: endereço do cliente informado no momento do agendamento
-- client_lat / client_lng: coordenadas (para cálculo de rota e taxa por km)
-- travel_fee: taxa de deslocamento aplicada neste booking (já inclusa no amount_total)
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS service_location TEXT DEFAULT 'instore'
    CHECK (service_location IN ('instore', 'home')),
  ADD COLUMN IF NOT EXISTS client_address TEXT,
  ADD COLUMN IF NOT EXISTS client_lat NUMERIC,
  ADD COLUMN IF NOT EXISTS client_lng NUMERIC,
  ADD COLUMN IF NOT EXISTS travel_fee NUMERIC DEFAULT 0;

COMMENT ON COLUMN bookings.service_location IS
  'instore=atendimento no salão, home=atendimento no endereço do cliente';
COMMENT ON COLUMN bookings.client_address IS
  'Endereço completo do cliente (preenchido apenas quando service_location=home)';
COMMENT ON COLUMN bookings.client_lat IS
  'Latitude do cliente (opcional, usado para cálculo de rota/taxa por km)';
COMMENT ON COLUMN bookings.client_lng IS
  'Longitude do cliente (opcional, usado para cálculo de rota/taxa por km)';
COMMENT ON COLUMN bookings.travel_fee IS
  'Taxa de deslocamento já inclusa no amount_total (0 para atendimento presencial)';

-- Índice para facilitar filtros de agendamentos por localidade
CREATE INDEX IF NOT EXISTS idx_bookings_service_location ON bookings(tenant_id, service_location);

-- ─── 4. TENANT_SETTINGS — Configuração global de domicílio ──────────────────
-- offers_home_service: o salão oferece atendimento a domicílio?
-- home_service_radius_km: raio máximo de cobertura do salão
-- home_fee_type: tipo da taxa de deslocamento (grátis, valor fixo, por km)
-- home_fee_amount: valor base da taxa (usado para 'fixed' e como mínimo para 'per_km')
-- home_fee_per_km: valor por km adicional (usado apenas para 'per_km')
ALTER TABLE tenant_settings
  ADD COLUMN IF NOT EXISTS offers_home_service BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS home_service_radius_km NUMERIC DEFAULT 10,
  ADD COLUMN IF NOT EXISTS home_fee_type TEXT DEFAULT 'fixed'
    CHECK (home_fee_type IN ('fixed', 'per_km', 'free')),
  ADD COLUMN IF NOT EXISTS home_fee_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS home_fee_per_km NUMERIC DEFAULT 0;

COMMENT ON COLUMN tenant_settings.offers_home_service IS
  'true = este salão oferece atendimento a domicílio globalmente';
COMMENT ON COLUMN tenant_settings.home_service_radius_km IS
  'Raio máximo de cobertura do salão em km (padrão: 10km)';
COMMENT ON COLUMN tenant_settings.home_fee_type IS
  'fixed=taxa fixa, per_km=valor por km, free=sem cobrança';
COMMENT ON COLUMN tenant_settings.home_fee_amount IS
  'Valor da taxa fixa (ou mínima para per_km)';
COMMENT ON COLUMN tenant_settings.home_fee_per_km IS
  'Valor cobrado por km além do mínimo (apenas para home_fee_type=per_km)';

-- ─── 5. CUSTOMERS — Endereço salvo do cliente ────────────────────────────────
-- address: endereço salvo do cliente (preenchido após primeiro agendamento a domicílio)
-- address_lat / address_lng: coordenadas para facilitar futuros agendamentos
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS address_lat NUMERIC,
  ADD COLUMN IF NOT EXISTS address_lng NUMERIC;

COMMENT ON COLUMN customers.address IS
  'Endereço salvo do cliente (preenchido após agendamento a domicílio)';
COMMENT ON COLUMN customers.address_lat IS
  'Latitude do endereço salvo do cliente';
COMMENT ON COLUMN customers.address_lng IS
  'Longitude do endereço salvo do cliente';

-- ─── FIM DA MIGRAÇÃO ─────────────────────────────────────────────────────────
-- Resumo das alterações:
--   services         +2 colunas: service_mode, home_price_extra
--   professionals    +3 colunas: offers_home_service, max_home_distance_km, home_fee
--   bookings         +5 colunas: service_location, client_address, client_lat, client_lng, travel_fee
--   tenant_settings  +5 colunas: offers_home_service, home_service_radius_km, home_fee_type, home_fee_amount, home_fee_per_km
--   customers        +3 colunas: address, address_lat, address_lng
--
-- NENHUMA constraint existente foi removida ou alterada.
-- NENHUM dado existente é afetado (todos os defaults são neutros).
