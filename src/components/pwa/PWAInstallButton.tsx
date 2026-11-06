import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Smartphone, Share2, PlusSquare, Check, X, Sparkles } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  storeName?: string;
  logoUrl?: string | null;
  accentColor?: string;
  textColor?: string;
  isDark?: boolean;
  className?: string;
  variant?: 'banner' | 'button' | 'pill';
}

export function PWAInstallButton({
  storeName = 'Raffros',
  logoUrl,
  accentColor = '#FF2D78',
  textColor = '#FFFFFF',
  isDark = true,
  className = '',
  variant = 'banner',
}: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, isIOS, promptInstall } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // Se já estiver instalado ou dispensado pelo usuário nesta sessão, não renderiza
  if (isInstalled || isDismissed) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      const installed = await promptInstall();
      if (installed) {
        return;
      }
    } else {
      // No iOS Safari ou navegadores sem prompt nativo automático, abre instrução clara
      setShowIOSModal(true);
    }
  };

  return (
    <>
      {/* VARIANTE 1: BANNER ELEGANTE PARA MOBILE / DESKTOP NA PÁGINA */}
      {variant === 'banner' && (
        <div
          className={`relative overflow-hidden rounded-2xl border transition-all duration-300 shadow-sm ${className}`}
          style={{
            background: isDark
              ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)'
              : 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E2E8F0',
          }}
        >
          <div className="p-3.5 sm:p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shrink-0 shadow-inner relative overflow-hidden"
                style={{
                  background: `${accentColor}18`,
                  color: accentColor,
                  border: `1px solid ${accentColor}30`,
                }}
              >
                {logoUrl ? (
                  <img src={logoUrl} alt={storeName} className="w-full h-full object-cover" />
                ) : (
                  <Smartphone className="w-5 h-5 sm:w-5 sm:h-5" style={{ color: accentColor }} />
                )}
              </div>

              <div className="min-w-0 text-left">
                <div className="flex items-center gap-1.5">
                  <span
                    className="text-xs sm:text-sm font-bold truncate block"
                    style={{ color: isDark ? '#FFFFFF' : '#0F172A' }}
                  >
                    Instalar aplicativo do salão
                  </span>
                  <span
                    className="px-1.5 py-0.2 text-[10px] font-extrabold rounded-md uppercase tracking-wider"
                    style={{ background: `${accentColor}20`, color: accentColor }}
                  >
                    App
                  </span>
                </div>
                <p
                  className="text-[11px] sm:text-xs truncate mt-0.5 opacity-80"
                  style={{ color: isDark ? '#94A3B8' : '#64748B' }}
                >
                  Acesse com 1 toque na tela inicial do celular
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleInstallClick}
                className="flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer"
                style={{
                  background: accentColor,
                  color: textColor,
                }}
              >
                <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span>Instalar</span>
              </motion.button>

              <button
                type="button"
                onClick={() => setIsDismissed(true)}
                className="p-1.5 rounded-lg opacity-40 hover:opacity-100 transition-opacity cursor-pointer"
                style={{ color: isDark ? '#94A3B8' : '#64748B' }}
                title="Fechar"
                aria-label="Dispensar aviso de instalação"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VARIANTE 2: BOTÃO / PÁGINA LATERAL / HEADER */}
      {variant === 'button' && (
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleInstallClick}
          className={`flex items-center justify-center gap-2 py-2.5 px-3.5 rounded-xl border font-bold text-xs shadow-sm transition-all cursor-pointer ${className}`}
          style={{
            background: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0',
            color: isDark ? '#FFFFFF' : '#0F172A',
          }}
        >
          <Smartphone className="w-4 h-4 shrink-0" style={{ color: accentColor }} />
          <span>Baixar App</span>
        </motion.button>
      )}

      {/* VARIANTE 3: PILL COMPACTO */}
      {variant === 'pill' && (
        <motion.button
          type="button"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleInstallClick}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border shadow-sm transition-all cursor-pointer ${className}`}
          style={{
            background: `${accentColor}15`,
            borderColor: `${accentColor}30`,
            color: accentColor,
          }}
        >
          <Download className="w-3 h-3" />
          <span>Instalar App</span>
        </motion.button>
      )}

      {/* MODAL / BOTTOM SHEET DE GUIA DE INSTALAÇÃO (IOS SAFARI OU MANUAL) */}
      <AnimatePresence>
        {showIOSModal && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4"
            style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
            onClick={() => setShowIOSModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.96 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-t-[28px] sm:rounded-3xl p-6 border shadow-2xl relative"
              style={{
                background: isDark ? '#141417' : '#FFFFFF',
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0',
              }}
            >
              <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9' }}>
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ background: `${accentColor}20`, color: accentColor }}
                  >
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold leading-tight" style={{ color: isDark ? '#FFFFFF' : '#0F172A' }}>
                      Instalar {storeName}
                    </h3>
                    <p className="text-[11px] mt-0.5 opacity-70" style={{ color: isDark ? '#94A3B8' : '#64748B' }}>
                      Adicione à tela inicial do seu celular
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowIOSModal(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
                  style={{ color: isDark ? '#FFFFFF' : '#0F172A' }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Instruções passo a passo */}
              <div className="py-5 space-y-4">
                <div className="flex items-start gap-3.5">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 mt-0.5"
                    style={{ background: `${accentColor}20`, color: accentColor }}
                  >
                    1
                  </div>
                  <div className="text-xs leading-relaxed" style={{ color: isDark ? '#E2E8F0' : '#334155' }}>
                    {isIOS ? (
                      <>
                        No Safari do seu iPhone, toque no botão <strong>Compartilhar</strong>{' '}
                        <Share2 className="inline w-3.5 h-3.5 text-blue-500 mx-0.5" /> na barra inferior.
                      </>
                    ) : (
                      <>
                        No menu do navegador (três pontinhos no canto superior direito).
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 mt-0.5"
                    style={{ background: `${accentColor}20`, color: accentColor }}
                  >
                    2
                  </div>
                  <div className="text-xs leading-relaxed" style={{ color: isDark ? '#E2E8F0' : '#334155' }}>
                    {isIOS ? (
                      <>
                        Role as opções e toque em <strong>"Adicionar à Tela de Início"</strong>{' '}
                        <PlusSquare className="inline w-3.5 h-3.5 text-neutral-400 mx-0.5" />.
                      </>
                    ) : (
                      <>
                        Selecione <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela inicial"</strong>.
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 mt-0.5"
                    style={{ background: `${accentColor}20`, color: accentColor }}
                  >
                    3
                  </div>
                  <div className="text-xs leading-relaxed" style={{ color: isDark ? '#E2E8F0' : '#334155' }}>
                    Toque em <strong>Adicionar</strong> no canto superior. Pronto! O ícone ficará junto aos seus outros aplicativos.
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowIOSModal(false)}
                className="w-full py-3 rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer"
                style={{ background: accentColor, color: textColor }}
              >
                Entendi
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

