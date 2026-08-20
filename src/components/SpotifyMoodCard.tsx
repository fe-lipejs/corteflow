import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Quote, Sparkles, X } from 'lucide-react';
import { trackEvent } from '../lib/analytics';

const EASE: [number, number, number, number] = [0.16, 0.8, 0.24, 1];

const VERSES_PREVIEW = [
  { text: 'O Senhor é o meu pastor; nada me faltará.', ref: 'Salmos 23:1' },
  { text: 'Tudo posso naquele que me fortalece.', ref: 'Filipenses 4:13' },
  { text: 'Entrega o teu caminho ao Senhor, confia nele, e ele tudo fará.', ref: 'Salmos 37:5' },
  { text: 'A tua palavra é lâmpada para os meus pés e luz para o meu caminho.', ref: 'Salmos 119:105' },
];

/** Logo oficial do Spotify (path), tingida no tom da landing (âmbar). */
export function SpotifyGlyph({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 168 168" className={className} fill="currentColor" aria-hidden="true">
      <path d="M84 0a84 84 0 1 0 0 168A84 84 0 0 0 84 0zm38.5 121.1a5.2 5.2 0 0 1-7.2 1.7c-19.7-12-44.5-14.8-73.7-8.1a5.2 5.2 0 1 1-2.3-10.2c31.9-7.3 59.4-4.1 81.5 9.4a5.2 5.2 0 0 1 1.7 7.2zm10.3-22.9a6.5 6.5 0 0 1-9 2.1c-22.6-13.9-57-17.9-83.7-9.8a6.5 6.5 0 1 1-3.8-12.5c30.5-9.2 68.4-4.7 94.4 11.2a6.5 6.5 0 0 1 2.1 9zm.9-23.9c-27.1-16.1-71.8-17.6-97.7-9.7a7.8 7.8 0 1 1-4.5-14.9c29.7-9 79.1-7.3 110.3 11.3a7.8 7.8 0 0 1-8.1 13.3z" />
    </svg>
  );
}

const PLAYLIST_ID = import.meta.env['VITE_SPOTIFY_PLAYLIST_ID'] || '6BcMYfYsOH9qUGNp2FRthF';

/**
 * Faixa estratégica "No som da casa" — bloco de alto destaque, acolhedor e visualmente no padrão Apple Noir.
 */
export default function SpotifyMoodCard() {
  const [verseIdx, setVerseIdx] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setVerseIdx((prev) => (prev + 1) % VERSES_PREVIEW.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const currentVerse = VERSES_PREVIEW[verseIdx];

  return (
    <section
      id="playlist"
      className="relative bg-[#0A0A0C] border-y border-white/[0.08] px-6 md:px-12 py-16 sm:py-20 md:py-[110px] overflow-hidden"
    >
      <div
        className="absolute inset-0 -z-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(55% 70% at 50% 50%, rgba(245,158,11,0.14), transparent 68%), radial-gradient(35% 45% at 90% 20%, rgba(245,158,11,0.08), transparent 60%)',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 22 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-8%' }}
        transition={{ duration: 0.8, ease: EASE }}
        className="relative z-10 max-w-[1200px] mx-auto rounded-[32px] border border-amber-500/30 bg-[#0C0C0F] p-7 sm:p-10 md:p-12 shadow-[0_25px_70px_-20px_rgba(0,0,0,0.8),0_0_35px_rgba(245,158,11,0.12)] grid lg:grid-cols-[1.05fr_0.95fr] gap-10 lg:gap-12 items-center"
      >
        {/* Left Side: Copy & Direct Value */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <span className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.16em] uppercase font-semibold text-[#F59E0B]">
              <span className="w-4 h-[1.5px] bg-[#F59E0B]" />
              No som da casa
            </span>

            {/* Subtle Animated Audio Bars */}
            <div className="flex items-end gap-1 h-3.5 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20">
              <span className="w-1 bg-[#F59E0B] rounded-full animate-[pulse_1s_infinite_0ms] h-3" />
              <span className="w-1 bg-[#F59E0B] rounded-full animate-[pulse_1.2s_infinite_200ms] h-2" />
              <span className="w-1 bg-[#F59E0B] rounded-full animate-[pulse_0.8s_infinite_400ms] h-3.5" />
            </div>
          </div>

          <h2 className="font-display font-semibold text-[clamp(26px,5vw,40px)] leading-[1.12] tracking-[-0.01em] text-white">
            Passou por aqui? <br />
            <em
              className="not-italic"
              style={{
                background: 'linear-gradient(135deg, #F59E0B, #FBBF24)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              Leve uma palavra e o som da casa.
            </em>
          </h2>

          <p className="text-[15.5px] sm:text-[16.5px] leading-relaxed text-[#A1A1A6] max-w-[50ch] mt-4">
            Mesmo que você não precise de um sistema de agendamento hoje, criamos este espaço
            com carinho para abençoar o seu dia. Ouça os louvores que tocam no salão e receba
            uma mensagem de fé.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <Link
              to="/playlist"
              onClick={() => trackEvent('click_playlist_spotify', { metadata: { origem: 'landing_faixa_principal' } })}
              className="group inline-flex items-center justify-center gap-3 px-8 py-4 rounded-full font-bold text-[15px] text-black shadow-[0_20px_40px_-16px_rgba(245,158,11,0.6)] hover:scale-[1.03] active:scale-[0.99] transition-all"
              style={{ background: 'linear-gradient(135deg, #F59E0B, #FBBF24)' }}
            >
              <SpotifyGlyph className="w-[20px] h-[20px]" />
              Abrir Página Completa &amp; Versos
            </Link>

            <span className="text-xs font-mono text-[#71717A] text-center sm:text-left">
              100% gratuito e aberto a todos
            </span>
          </div>
        </div>

        {/* Right Side: Interactive Preview Card with Real Spotify Embed */}
        <div className="relative rounded-[24px] bg-[#141418] border border-amber-500/20 p-5 sm:p-6 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3.5 mb-3 border-b border-white/[0.08]">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-[#F59E0B]">
                <SpotifyGlyph className="w-5 h-5" />
              </span>
              <div>
                <h4 className="text-sm font-semibold text-white">Corte Flow Worship</h4>
                <p className="text-[11.5px] text-[#71717A] font-mono">Dá o play e ouça agora</p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[11px] font-mono font-medium text-[#F59E0B] bg-amber-500/10 border border-amber-500/20 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" />
              Palavra de Hoje
            </span>
          </div>

          {/* Compact Spotify Iframe Player */}
          <div className="rounded-[16px] overflow-hidden bg-[#0A0A0C] border border-white/[0.08] mb-4">
            <iframe
              title="Player do Spotify"
              src={`https://open.spotify.com/embed/playlist/${PLAYLIST_ID}?theme=0`}
              width="100%"
              height="152"
              frameBorder="0"
              loading="lazy"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              className="block w-full"
            />
          </div>

          <div className="p-3.5 rounded-[16px] bg-white/[0.03] border border-white/[0.06] mb-3">
            <AnimatePresence mode="wait">
              <motion.div
                key={verseIdx}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.35 }}
                className="w-full text-center sm:text-left"
              >
                <p className="text-[14.5px] text-white/95 font-serif italic leading-snug">
                  "{currentVerse?.text}"
                </p>
                <span className="block text-[11px] font-mono text-[#F59E0B] font-semibold mt-1.5 tracking-wider uppercase">
                  — {currentVerse?.ref}
                </span>
              </motion.div>
            </AnimatePresence>
          </div>

          <Link
            to="/playlist"
            onClick={() => trackEvent('click_playlist_preview_card')}
            className="w-full text-center py-2.5 px-4 rounded-xl bg-white/[0.06] hover:bg-amber-500/20 hover:text-[#F59E0B] border border-white/[0.1] text-xs font-semibold text-[#A1A1A6] transition-all"
          >
            Abrir página dedicada com sorteador de versículos →
          </Link>
        </div>
      </motion.div>
    </section>
  );
}

/**
 * Chip flutuante no canto inferior direito para acesso rápido sem atrapalhar a navegação.
 */
export function FloatingPlaylistBadge() {
  const [closed, setClosed] = useState(false);

  if (closed) return null;

  return (
    <div className="fixed bottom-6 right-6 z-40">
      <div className="relative group">
        <Link
          to="/playlist"
          onClick={() => trackEvent('click_floating_playlist_badge')}
          className="flex items-center gap-3 px-4 py-3 rounded-full bg-[#0E0E12]/95 border border-amber-500/40 text-white shadow-[0_15px_35px_rgba(0,0,0,0.8),0_0_20px_rgba(245,158,11,0.25)] backdrop-blur-xl hover:scale-[1.03] hover:border-amber-500 transition-all active:scale-95"
        >
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#F59E0B] opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-[#F59E0B]" />
          </span>
          <SpotifyGlyph className="w-4 h-4 text-[#F59E0B]" />
          <div className="flex flex-col text-left pr-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#F59E0B] font-bold">
              No som da casa
            </span>
            <span className="text-[12.5px] font-semibold text-white leading-none mt-0.5">
              Louvor &amp; Palavra do Dia
            </span>
          </div>
        </Link>

        <button
          type="button"
          aria-label="Fechar atalho"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setClosed(true);
          }}
          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#18181E] border border-white/20 text-[#A1A1A6] hover:text-white flex items-center justify-center text-[10px] opacity-70 hover:opacity-100 transition-opacity"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
