import { useState } from 'react';
import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { Check, AlertTriangle, Loader2, X, CheckCircle2 } from 'lucide-react';
import { getBookingConfirmationInfo } from '../../../lib/bookingConfirmation';
import { WhatsAppSvgIcon } from './BookingMetaIcons';
import { useLockBodyScroll } from '../../../hooks/useLockBodyScroll';

interface BookingConfirmationModalProps {
  booking: any;
  initialStep?: 'confirm' | 'whatsapp';
  onClose: () => void;
  onConfirm: (bookingId: string) => Promise<void>;
}

export default function BookingConfirmationModal({
  booking,
  initialStep = 'confirm',
  onClose,
  onConfirm,
}: BookingConfirmationModalProps) {
  useLockBodyScroll(true);

  const [step, setStep] = useState<'confirm' | 'whatsapp'>(initialStep);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const confInfo = getBookingConfirmationInfo(booking);
  const customerName = booking?.customer?.name || booking?.customers?.name || 'Cliente';
  const serviceName = booking?.service?.name || booking?.services?.name || 'Serviço';
  const scheduledDate = booking?.scheduled_at ? new Date(booking.scheduled_at) : null;

  const dateTimeStr =
    scheduledDate && !Number.isNaN(scheduledDate.getTime())
      ? `${format(scheduledDate, "dd 'de' MMM", { locale: ptBR })} às ${format(scheduledDate, 'HH:mm')}`
      : '';

  const handleConfirmYes = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onConfirm(booking.id);
      if (confInfo.whatsappConfirmationUrl) {
        setStep('whatsapp');
      } else {
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px] animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm rounded-3xl border p-6 shadow-2xl animate-scale-in"
        style={{
          backgroundColor: 'var(--theme-card-bg)',
          borderColor: 'var(--theme-border)',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-black/5 cursor-pointer"
          style={{ color: 'var(--theme-text-secondary)' }}
        >
          <X className="w-4 h-4" />
        </button>

        {step === 'confirm' ? (
          <div className="flex flex-col items-center text-center">
            {/* Ícone com badge de warning amarelo */}
            <div className="relative mb-4">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{
                  background: 'var(--theme-accent-muted)',
                  color: 'var(--theme-accent)',
                }}
              >
                <Check className="w-6 h-6 stroke-[2.5]" />
              </div>
              <span
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center shadow-sm"
                style={{
                  backgroundColor: '#FACC15',
                  color: '#422006',
                  border: '2px solid var(--theme-card-bg)',
                }}
              >
                <AlertTriangle className="w-3 h-3 stroke-[2.6]" />
              </span>
            </div>

            <h3
              className="font-serif text-xl font-bold mb-1"
              style={{ color: 'var(--theme-text-primary)' }}
            >
              Confirmar agendamento?
            </h3>
            <p className="text-xs mb-4 opacity-80" style={{ color: 'var(--theme-text-secondary)' }}>
              Este agendamento está aguardando sua confirmação.
            </p>

            {/* Resumo enxuto */}
            <div
              className="w-full rounded-2xl border px-4 py-3 mb-5 text-left"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg)',
              }}
            >
              <p className="font-bold text-sm truncate" style={{ color: 'var(--theme-text-primary)' }}>
                {customerName}
              </p>
              <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--theme-text-secondary)' }}>
                {serviceName}
                {dateTimeStr ? ` · ${dateTimeStr}` : ''}
              </p>
            </div>

            {/* Ações: Não / Sim */}
            <div className="grid grid-cols-2 gap-2.5 w-full">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="py-3 px-4 rounded-xl border text-xs font-bold transition-opacity hover:opacity-80 cursor-pointer"
                style={{
                  borderColor: 'var(--theme-border)',
                  color: 'var(--theme-text-secondary)',
                }}
              >
                Não
              </button>
              <button
                type="button"
                onClick={handleConfirmYes}
                disabled={isSubmitting}
                className="py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                style={{
                  background: 'var(--theme-accent-gradient)',
                  color: 'var(--theme-btn-primary-text)',
                }}
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4 stroke-[2.5]" />
                )}
                <span>Sim, confirmar</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center">
            {/* Ícone de confirmado + WhatsApp */}
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
              style={{
                backgroundColor: 'rgba(37, 211, 102, 0.14)',
                color: '#25D366',
              }}
            >
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <h3
              className="font-serif text-xl font-bold mb-1.5"
              style={{ color: 'var(--theme-text-primary)' }}
            >
              Agendamento confirmado!
            </h3>
            <p
              className="text-xs leading-relaxed mb-5"
              style={{ color: 'var(--theme-text-secondary)' }}
            >
              Mandar mensagem de confirmação para{' '}
              <strong style={{ color: 'var(--theme-text-primary)' }}>{customerName}</strong> no
              WhatsApp?
            </p>

            <div className="flex flex-col gap-2.5 w-full">
              {confInfo.whatsappConfirmationUrl && (
                <a
                  href={confInfo.whatsappConfirmationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={onClose}
                  className="w-full py-3.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all hover:opacity-95 active:scale-98 cursor-pointer text-white shadow-md"
                  style={{ backgroundColor: '#25D366' }}
                >
                  <WhatsAppSvgIcon className="w-4 h-4" />
                  <span>Mandar confirmação no WhatsApp</span>
                </a>
              )}

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 px-4 rounded-xl border text-xs font-semibold transition-opacity hover:opacity-80 cursor-pointer"
                style={{
                  borderColor: 'var(--theme-border)',
                  color: 'var(--theme-text-secondary)',
                }}
              >
                Agora não
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

