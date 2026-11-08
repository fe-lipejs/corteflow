import { Globe, UserCheck, CreditCard, Store } from 'lucide-react';
import type { BookingOriginType, BookingPaymentMethodType } from '../../../lib/bookingConfirmation';

export function WhatsAppSvgIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12.031 2c-5.516 0-9.969 4.453-9.969 9.969 0 1.758.459 3.473 1.331 4.988L2 22l5.188-1.361a9.927 9.927 0 0 0 4.843 1.258h.004c5.515 0 9.965-4.451 9.965-9.966A9.908 9.908 0 0 0 19.08 4.91 9.906 9.906 0 0 0 12.031 2Zm5.821 14.265c-.246.693-1.43 1.326-1.988 1.409-.508.075-1.151.107-1.857-.117-.428-.136-.978-.318-1.682-.622-2.961-1.278-4.894-4.261-5.042-4.459-.148-.197-1.205-1.603-1.205-3.058 0-1.455.763-2.171 1.034-2.467.271-.296.591-.37.788-.37.197 0 .394.002.567.01.182.009.426-.069.666.508.246.592.838 2.048.912 2.196.074.148.123.321.025.518-.099.198-.148.321-.296.494-.148.173-.311.386-.444.518-.148.148-.302.309-.13.605.173.296.766 1.264 1.645 2.047 1.13.999 2.083 1.309 2.379 1.457.296.148.469.123.642-.074.173-.198.74-.864.937-1.16.197-.296.395-.247.666-.148.271.099 1.726.814 2.022.962.296.148.493.222.567.345.074.124.074.716-.172 1.409Z" />
    </svg>
  );
}

export function PixSvgIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M15.8 8.2 12 12l-3.8-3.8a2.5 2.5 0 0 1 0-3.5l2-2a2.5 2.5 0 0 1 3.5 0l2.1 2a2.5 2.5 0 0 1 0 3.5Z" />
      <path d="M8.2 15.8 12 12l3.8 3.8a2.5 2.5 0 0 1 0 3.5l-2 2a2.5 2.5 0 0 1-3.5 0l-2.1-2a2.5 2.5 0 0 1 0-3.5Z" />
      <path d="m8.2 8.2-2-2a2.5 2.5 0 0 0-3.5 0l-1 1a2.5 2.5 0 0 0 0 3.5l2 2" />
      <path d="m15.8 15.8 2 2a2.5 2.5 0 0 0 3.5 0l1-1a2.5 2.5 0 0 0 0-3.5l-2-2" />
    </svg>
  );
}

interface BookingMetaIconsProps {
  origin: BookingOriginType;
  originLabel: string;
  paymentType: BookingPaymentMethodType;
  paymentLabel: string;
  accentColor?: string;
  textSecondaryColor?: string;
}

export function BookingMetaIcons({
  origin,
  originLabel,
  paymentType,
  paymentLabel,
}: BookingMetaIconsProps) {
  return (
    <span className="inline-flex items-center gap-1 shrink-0">
      {/* Origem: Online (Globe) vs Manual (UserCheck) — sempre cor neutra */}
      <span
        className="inline-flex items-center justify-center w-4 h-4 rounded text-[var(--theme-text-secondary)] opacity-70"
        title={`Origem: ${originLabel}`}
      >
        {origin === 'online' ? (
          <Globe className="w-3.5 h-3.5" />
        ) : (
          <UserCheck className="w-3.5 h-3.5" />
        )}
      </span>

      {/* Pagamento: PIX / Cartão / No local (Store) — sempre cor neutra normal sem tint */}
      <span
        className="inline-flex items-center justify-center w-4 h-4 rounded text-[var(--theme-text-secondary)] opacity-70"
        title={`Pagamento: ${paymentLabel}`}
      >
        {paymentType === 'pix' ? (
          <PixSvgIcon className="w-3.5 h-3.5" />
        ) : paymentType === 'card' ? (
          <CreditCard className="w-3.5 h-3.5" />
        ) : (
          <Store className="w-3.5 h-3.5" />
        )}
      </span>
    </span>
  );
}


