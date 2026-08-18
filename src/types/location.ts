// ─── Location Types — Modelo Híbrido de Atendimento ──────────────────────────
// Estabelecimento (instore) + Domicílio (home)
// Usado em services, professionals, bookings e tenant_settings

// ── Enums ──────────────────────────────────────────────────────────────────────

/**
 * Modalidade de atendimento de um serviço.
 * - instore: serviço realizado apenas no estabelecimento
 * - home:    serviço realizado apenas a domicílio
 * - both:    serviço pode ser realizado nos dois modos (cliente escolhe)
 */
export type ServiceMode = 'instore' | 'home' | 'both';

/**
 * Modalidade de atendimento de um BOOKING específico.
 * Registra onde o atendimento de fato ocorreu (ou vai ocorrer).
 */
export type ServiceLocation = 'instore' | 'home';

/**
 * Tipo de cálculo da taxa de deslocamento.
 * - fixed:  taxa fixa independente da distância
 * - per_km: valor base + (distância km × home_fee_per_km)
 * - free:   sem cobrança de deslocamento
 */
export type HomeFeeType = 'fixed' | 'per_km' | 'free';

// ── Interfaces ─────────────────────────────────────────────────────────────────

/**
 * Configuração global de atendimento a domicílio do salão
 * (derivada de tenant_settings)
 */
export interface HomeServiceConfig {
  /** O salão oferece atendimento a domicílio? */
  enabled: boolean;
  /** Raio máximo de cobertura em km */
  radiusKm: number;
  /** Tipo de cálculo da taxa de deslocamento */
  feeType: HomeFeeType;
  /** Valor da taxa fixa ou mínima (BRL) */
  feeAmount: number;
  /** Valor por km adicional (apenas para feeType=per_km) */
  feePerKm: number;
}

/**
 * Localização do cliente durante um agendamento a domicílio.
 * Calculada no frontend antes de finalizar a reserva.
 */
export interface ClientLocation {
  /** Endereço completo digitado pelo cliente */
  address: string;
  /** Latitude do cliente */
  lat: number;
  /** Longitude do cliente */
  lng: number;
  /** Distância em km entre cliente e salão (calculada via haversine) */
  distanceKm: number;
  /** true se distância ≤ raio de cobertura do salão/profissional */
  isWithinRadius: boolean;
  /** Taxa de deslocamento calculada para esta distância */
  travelFee: number;
}

/**
 * Capacidade de domicílio de um profissional específico.
 * (derivada dos campos offers_home_service, max_home_distance_km, home_fee)
 */
export interface ProfessionalHomeCapacity {
  /** Este profissional atende a domicílio? */
  offersHomeService: boolean;
  /**
   * Raio máximo deste profissional em km.
   * 0 = sem raio próprio → usa o raio global do salão.
   */
  maxDistanceKm: number;
  /**
   * Taxa de deslocamento própria deste profissional (BRL).
   * 0 = sem taxa própria → usa a configuração global do salão.
   */
  homeFee: number;
}

/**
 * Opção de localização exibida no seletor do wizard de agendamento.
 */
export interface LocationOption {
  key: ServiceLocation;
  label: string;
  description: string;
  icon: string; // emoji ou nome de ícone lucide
}
