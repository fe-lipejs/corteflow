/**
 * locationEngine.ts
 *
 * Motor de localização para o modelo híbrido de atendimento (Estabelecimento + Domicílio).
 * Responsável por:
 *   - Calcular distâncias via haversine
 *   - Verificar raio de cobertura
 *   - Calcular taxa de deslocamento
 *   - Filtrar profissionais disponíveis para atendimento a domicílio
 *
 * Não tem dependências externas além dos tipos locais.
 */

import type { HomeServiceConfig, ClientLocation, ProfessionalHomeCapacity } from '../types/location';

// ─── Haversine Distance ───────────────────────────────────────────────────────

/**
 * Calcula a distância em km entre dois pontos geográficos.
 * Usa a fórmula de haversine — precisa o suficiente para raios de até ~100km.
 */
export function haversineKm(
  pos1: { lat: number; lng: number },
  pos2: { lat: number; lng: number }
): number {
  const R = 6371; // raio da Terra em km
  const dLat = ((pos2.lat - pos1.lat) * Math.PI) / 180;
  const dLon = ((pos2.lng - pos1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 *
      Math.cos((pos1.lat * Math.PI) / 180) *
      Math.cos((pos2.lat * Math.PI) / 180);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// ─── Raio de Cobertura ────────────────────────────────────────────────────────

/**
 * Verifica se a posição do cliente está dentro do raio de cobertura.
 *
 * @param clientLat  Latitude do cliente
 * @param clientLng  Longitude do cliente
 * @param storeLat   Latitude do salão
 * @param storeLng   Longitude do salão
 * @param radiusKm   Raio máximo de cobertura em km
 */
export function isWithinServiceRadius(
  clientLat: number,
  clientLng: number,
  storeLat: number,
  storeLng: number,
  radiusKm: number
): boolean {
  if (!radiusKm || radiusKm <= 0) return true; // sem limite = sempre dentro
  const distance = haversineKm(
    { lat: clientLat, lng: clientLng },
    { lat: storeLat, lng: storeLng }
  );
  return distance <= radiusKm;
}

// ─── Taxa de Deslocamento ─────────────────────────────────────────────────────

/**
 * Calcula a taxa de deslocamento com base na configuração do salão e distância.
 *
 * - 'free':   sempre 0
 * - 'fixed':  sempre home_fee_amount (independente da distância)
 * - 'per_km': home_fee_amount (mínimo) + distância × home_fee_per_km
 *
 * @param distanceKm  Distância calculada entre cliente e salão
 * @param config      Configuração global de domicílio do salão
 * @returns           Taxa em BRL (arredondada para 2 casas decimais)
 */
export function computeTravelFee(
  distanceKm: number,
  config: HomeServiceConfig
): number {
  if (!config.enabled) return 0;

  switch (config.feeType) {
    case 'free':
      return 0;
    case 'fixed':
      return config.feeAmount;
    case 'per_km': {
      const fee = config.feeAmount + distanceKm * config.feePerKm;
      return Math.round(fee * 100) / 100;
    }
    default:
      return 0;
  }
}

/**
 * Variante que usa apenas a taxa própria do profissional (home_fee).
 * Se home_fee === 0, retorna a taxa do salão.
 *
 * @param distanceKm    Distância entre cliente e salão
 * @param proCapacity   Capacidade do profissional (home_fee específico)
 * @param salonConfig   Configuração global do salão (fallback)
 */
export function computeTravelFeeForPro(
  distanceKm: number,
  proCapacity: ProfessionalHomeCapacity,
  salonConfig: HomeServiceConfig
): number {
  if (proCapacity.homeFee > 0) {
    // Profissional tem taxa própria (fixa)
    return proCapacity.homeFee;
  }
  // Usa a configuração global do salão
  return computeTravelFee(distanceKm, salonConfig);
}

// ─── Filtro de Profissionais para Domicílio ───────────────────────────────────

/**
 * Filtra a lista de profissionais para retornar apenas os que:
 * 1. Têm `offers_home_service === true`
 * 2. Estão dentro do raio efetivo (raio do profissional ou do salão)
 *
 * Se `distanceKm` for null (cliente não informou coordenadas), filtra apenas
 * por capacidade — o raio não é verificado.
 *
 * @param professionals   Lista de profissionais (com campos de domicílio)
 * @param distanceKm      Distância do cliente ao salão (ou null se desconhecida)
 * @param salonRadiusKm   Raio global do salão (fallback quando pro não tem raio próprio)
 */
export function filterHomeServiceProfessionals(
  professionals: Array<{
    id: string;
    offers_home_service?: boolean;
    max_home_distance_km?: number;
    [key: string]: any;
  }>,
  distanceKm: number | null,
  salonRadiusKm: number
): typeof professionals {
  return professionals.filter((pro) => {
    // 1. Deve oferecer domicílio
    if (!pro.offers_home_service) return false;

    // 2. Se não temos a distância, aceita todos que oferecem domicílio
    if (distanceKm === null) return true;

    // 3. Raio efetivo: usa o do profissional se > 0, senão usa o do salão
    const effectiveRadius =
      pro.max_home_distance_km && pro.max_home_distance_km > 0
        ? pro.max_home_distance_km
        : salonRadiusKm;

    // 0 = sem limite de raio
    if (!effectiveRadius || effectiveRadius <= 0) return true;

    return distanceKm <= effectiveRadius;
  });
}

// ─── Helpers de UI ────────────────────────────────────────────────────────────

/**
 * Formata a distância de forma legível.
 * Ex: 0.8km → "800 m", 1.5km → "1,5 km"
 */
export function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  return `${km.toFixed(1).replace('.', ',')} km`;
}

/**
 * Extrai a configuração de domicílio de `tenant_settings`.
 * Útil para normalizar os dados vindos do Supabase.
 */
export function extractHomeServiceConfig(settings: any): HomeServiceConfig {
  return {
    enabled: settings?.offers_home_service === true,
    radiusKm: settings?.home_service_radius_km ?? 10,
    feeType: settings?.home_fee_type ?? 'fixed',
    feeAmount: settings?.home_fee_amount ?? 0,
    feePerKm: settings?.home_fee_per_km ?? 0,
  };
}

/**
 * Extrai a capacidade de domicílio de um profissional.
 */
export function extractProCapacity(pro: any): ProfessionalHomeCapacity {
  return {
    offersHomeService: pro?.offers_home_service === true,
    maxDistanceKm: pro?.max_home_distance_km ?? 0,
    homeFee: pro?.home_fee ?? 0,
  };
}
