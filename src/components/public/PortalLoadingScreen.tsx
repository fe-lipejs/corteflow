import React from 'react';
import { Loader2 } from 'lucide-react';
import type { PortalThemeInfo } from '../../hooks/useTenantPortalTheme';

interface PortalLoadingScreenProps {
  portalTheme: PortalThemeInfo;
  message?: string;
  badgeText?: string;
}

export function PortalLoadingScreen({
  portalTheme,
  message = 'Preparando serviços, equipe e horários disponíveis…',
  badgeText = 'Agendamento Inteligente',
}: PortalLoadingScreenProps) {
  const { accent, bg, textPrimary, textMuted, logoUrl, name } = portalTheme;

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6 font-sans transition-colors duration-300"
      style={{
        backgroundColor: bg || '#000000',
        color: textPrimary || '#FFFFFF',
      }}
    >
      {logoUrl && (
        <img
          src={logoUrl}
          alt={name || 'Logo do Estabelecimento'}
          className="h-12 w-auto max-w-[150px] object-contain mb-4 rounded-xl opacity-95 transition-opacity duration-300 shadow-lg"
        />
      )}

      {name && (
        <h3
          className="font-bold text-base tracking-tight mb-4 text-center max-w-xs"
          style={{ color: textPrimary || '#FFFFFF' }}
        >
          {name}
        </h3>
      )}

      <Loader2
        className="w-8 h-8 animate-spin mb-4"
        style={{
          color: accent,
          filter: `drop-shadow(0 0 10px ${accent}60)`,
        }}
      />

      <p
        className="text-xs font-mono leading-relaxed text-center max-w-xs transition-colors duration-300"
        style={{ color: textMuted || '#A1A1A6' }}
      >
        {message}
      </p>

      <div
        className="flex items-center gap-2 mt-12 text-[10px] font-mono transition-colors duration-300"
        style={{ color: textMuted || '#71717A' }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full animate-pulse"
          style={{
            backgroundColor: accent,
            boxShadow: `0 0 8px ${accent}`,
          }}
        />
        {badgeText}
      </div>
    </div>
  );
}
