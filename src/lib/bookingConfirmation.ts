import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { buildWhatsAppUrl, formatBrPhoneMask } from './phoneValidation';

export type ConfirmationState = 'confirmed' | 'pending' | 'overdue';
export type BookingOriginType = 'manual' | 'online';
export type BookingPaymentMethodType = 'local' | 'pix' | 'card';

export interface BookingConfirmationInput {
  id?: string;
  status?: string | null;
  confirmation_status?: 'pending' | 'confirmed' | string | null;
  confirmed_at?: string | null;
  booking_source?: 'manual' | 'online' | string | null;
  payment_method?: string | null;
  payment_mode?: string | null;
  order_number?: string | null;
  scheduled_at?: string | null;
  created_at?: string | null;
  customer?: {
    name?: string | null;
    phone?: string | null;
  } | null;
  customers?: {
    name?: string | null;
    phone?: string | null;
  } | null;
  service?: {
    name?: string | null;
  } | null;
  services?: {
    name?: string | null;
  } | null;
}

export interface BookingConfirmationInfo {
  confirmationStatus: 'confirmed' | 'pending';
  confirmationState: ConfirmationState;
  confirmationLabel: string;
  confirmationShortLabel: string;
  isConfirmed: boolean;
  isPending: boolean;
  isOverdue: boolean;
  isPastUnconfirmed: boolean;
  origin: BookingOriginType;
  originLabel: string;
  paymentType: BookingPaymentMethodType;
  paymentLabel: string;
  paymentModeLabel: string | null;
  whatsappUrl: string | null;
  whatsappConfirmationUrl: string | null;
  formattedPhone: string;
}

/**
 * Regra determinística de "Confirmação atrasada":
 * Um agendamento com confirmation_status = 'pending' passa a ser considerado "Confirmação atrasada" quando:
 * 1) O horário agendado já passou (scheduled_at <= now), OU
 * 2) Faltam 3 horas ou menos para o atendimento (hoursUntilScheduled <= 3) e já se passaram pelo menos 20 minutos desde a criação, OU
 * 3) Já se passaram 4 horas ou mais desde a criação do agendamento (hoursSinceCreated >= 4) sem confirmação do proprietário.
 *
 * Agendamentos criados agora para dias futuros não nascem atrasados — nascem como "Aguarda confirmação".
 */
export function evaluateOverdueConfirmation(
  scheduledAtIso: string | null | undefined,
  createdAtIso: string | null | undefined,
  now: Date = new Date()
): { isOverdue: boolean; isPastUnconfirmed: boolean } {
  if (!scheduledAtIso) {
    return { isOverdue: false, isPastUnconfirmed: false };
  }

  const scheduledMs = new Date(scheduledAtIso).getTime();
  if (Number.isNaN(scheduledMs)) {
    return { isOverdue: false, isPastUnconfirmed: false };
  }

  const nowMs = now.getTime();
  const isPastUnconfirmed = scheduledMs <= nowMs;
  if (isPastUnconfirmed) {
    return { isOverdue: true, isPastUnconfirmed: true };
  }

  const createdMs = createdAtIso ? new Date(createdAtIso).getTime() : nowMs;
  const validCreatedMs = Number.isNaN(createdMs) ? nowMs : createdMs;

  const hoursUntilScheduled = (scheduledMs - nowMs) / (1000 * 60 * 60);
  const minutesSinceCreated = (nowMs - validCreatedMs) / (1000 * 60);
  const hoursSinceCreated = minutesSinceCreated / 60;

  // Se o atendimento está próximo (<= 3h) e já tem >= 20 min de criação
  if (hoursUntilScheduled <= 3 && minutesSinceCreated >= 20) {
    return { isOverdue: true, isPastUnconfirmed: false };
  }

  // Se foi criado há 4 horas ou mais e ainda não foi confirmado
  if (hoursSinceCreated >= 4) {
    return { isOverdue: true, isPastUnconfirmed: false };
  }

  return { isOverdue: false, isPastUnconfirmed: false };
}

/**
 * Resolve a origem do agendamento (Manual vs Online) com fallback seguro para registros antigos.
 */
export function resolveBookingOrigin(booking: BookingConfirmationInput): BookingOriginType {
  if (booking.booking_source === 'online') return 'online';
  if (booking.booking_source === 'manual') return 'manual';

  // Fallback para registros legados antes da coluna booking_source
  const orderNumber = booking.order_number || '';
  if (orderNumber.startsWith('BOK-')) return 'manual';
  if (orderNumber.length === 6) return 'online';
  return 'manual';
}

/**
 * Resolve a forma de pagamento escolhida (No local, PIX ou Cartão).
 */
export function resolveBookingPayment(booking: BookingConfirmationInput): {
  paymentType: BookingPaymentMethodType;
  paymentLabel: string;
  paymentModeLabel: string | null;
} {
  const rawMethod = (booking.payment_method || '').toLowerCase().trim();
  const rawMode = (booking.payment_mode || 'local').toLowerCase().trim();

  let paymentType: BookingPaymentMethodType = 'local';
  if (rawMethod === 'pix') {
    paymentType = 'pix';
  } else if (rawMethod === 'card' || rawMethod === 'cartao' || rawMethod === 'credit_card') {
    paymentType = 'card';
  } else if (rawMethod === 'local' || rawMethod === 'cash') {
    paymentType = 'local';
  } else if (rawMode === 'deposit' || rawMode === 'full') {
    paymentType = 'card';
  }

  const baseLabel =
    paymentType === 'pix'
      ? 'PIX'
      : paymentType === 'card'
        ? 'Cartão'
        : 'No local';

  const paymentModeLabel =
    rawMode === 'deposit'
      ? 'Sinal'
      : rawMode === 'full' && paymentType !== 'local'
        ? '100% online'
        : null;

  return {
    paymentType,
    paymentLabel: paymentModeLabel === 'Sinal' ? `${baseLabel} (Sinal)` : baseLabel,
    paymentModeLabel,
  };
}

/**
 * Gera o link do WhatsApp já preenchido com a mensagem de confirmação do agendamento para o cliente.
 */
export function buildClientConfirmationWhatsAppUrl(booking: BookingConfirmationInput): string | null {
  const phone = booking.customer?.phone || booking.customers?.phone || '';
  const baseUrl = buildWhatsAppUrl(phone);
  if (!baseUrl) return null;

  const customerName = booking.customer?.name || booking.customers?.name || 'Cliente';
  const firstName = customerName.trim().split(' ')[0] || 'Cliente';
  const serviceName = booking.service?.name || booking.services?.name || 'atendimento';

  let dateTimePart = '';
  if (booking.scheduled_at) {
    const dt = new Date(booking.scheduled_at);
    if (!Number.isNaN(dt.getTime())) {
      const dateStr = format(dt, "dd/MM", { locale: ptBR });
      const timeStr = format(dt, 'HH:mm');
      dateTimePart = ` para o dia *${dateStr}* às *${timeStr}*`;
    }
  }

  const message = `Olá, ${firstName}! Passando para avisar que seu agendamento de *${serviceName}*${dateTimePart} está *confirmado*! Te esperamos.`;
  return `${baseUrl}?text=${encodeURIComponent(message)}`;
}

/**
 * Fonte única da verdade para o estado de confirmação, origem, pagamento e link de WhatsApp de um agendamento.
 */
export function getBookingConfirmationInfo(
  booking: BookingConfirmationInput,
  now: Date = new Date()
): BookingConfirmationInfo {
  const origin = resolveBookingOrigin(booking);
  const originLabel = origin === 'online' ? 'Online' : 'Manual';

  const { paymentType, paymentLabel, paymentModeLabel } = resolveBookingPayment(booking);

  // Determina se está pendente de confirmação ou confirmado
  const rawConfStatus = booking.confirmation_status;
  const isConfirmed =
    rawConfStatus === 'confirmed' ||
    booking.status === 'completed' ||
    booking.status === 'arrived' ||
    booking.status === 'in_progress' ||
    (!rawConfStatus && origin === 'manual');

  const confirmationStatus: 'confirmed' | 'pending' = isConfirmed ? 'confirmed' : 'pending';

  let confirmationState: ConfirmationState = 'confirmed';
  let isOverdue = false;
  let isPastUnconfirmed = false;

  if (!isConfirmed) {
    const evalResult = evaluateOverdueConfirmation(booking.scheduled_at, booking.created_at, now);
    isOverdue = evalResult.isOverdue;
    isPastUnconfirmed = evalResult.isPastUnconfirmed;
    confirmationState = isOverdue ? 'overdue' : 'pending';
  }

  const confirmationLabel =
    confirmationState === 'confirmed'
      ? 'Confirmado'
      : confirmationState === 'overdue'
        ? 'Confirmação atrasada'
        : 'Aguarda confirmação';

  const confirmationShortLabel =
    confirmationState === 'confirmed'
      ? 'confirmado'
      : confirmationState === 'overdue'
        ? 'confirmação atrasada'
        : 'aguarda confirmação';

  const phone = booking.customer?.phone || booking.customers?.phone || '';
  const whatsappUrl = buildWhatsAppUrl(phone);
  const whatsappConfirmationUrl = buildClientConfirmationWhatsAppUrl(booking);
  const formattedPhone = phone ? formatBrPhoneMask(phone) : '';

  return {
    confirmationStatus,
    confirmationState,
    confirmationLabel,
    confirmationShortLabel,
    isConfirmed,
    isPending: !isConfirmed,
    isOverdue,
    isPastUnconfirmed,
    origin,
    originLabel,
    paymentType,
    paymentLabel,
    paymentModeLabel,
    whatsappUrl,
    whatsappConfirmationUrl,
    formattedPhone,
  };
}
