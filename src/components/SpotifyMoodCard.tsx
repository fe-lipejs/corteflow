import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { trackEvent } from '../lib/analytics';

const EASE: [number, number, number, number] = [0.16, 0.8, 0.24, 1];

/** Logo oficial do Spotify (path) — herda a cor do container (currentColor). */
export function SpotifyGlyph({ className = 'w-5 h-5' }: { className?: string }) {
    return (
        <svg viewBox="0 0 168 168" className={className} fill="currentColor" aria-hidden="true">
            <path d="M84 0a84 84 0 1 0 0 168A84 84 0 0 0 84 0zm38.5 121.1a5.2 5.2 0 0 1-7.2 1.7c-19.7-12-44.5-14.8-73.7-8.1a5.2 5.2 0 1 1-2.3-10.2c31.9-7.3 59.4-4.1 81.5 9.4a5.2 5.2 0 0 1 1.7 7.2zm10.3-22.9a6.5 6.5 0 0 1-9 2.1c-22.6-13.9-57-17.9-83.7-9.8a6.5 6.5 0 1 1-3.8-12.5c30.5-9.2 68.4-4.7 94.4 11.2a6.5 6.5 0 0 1 2.1 9zm.9-23.9c-27.1-16.1-71.8-17.6-97.7-9.7a7.8 7.8 0 1 1-4.5-14.9c29.7-9 79.1-7.3 110.3 11.3a7.8 7.8 0 0 1-8.1 13.3z" />
        </svg>
    );
}

/**
 * Card do hero — maior, no tamanho demarcado (~420px de largura),
 * mas ainda minimalista: superfície quase invisível, sem brilho nem equalizer.
 * Fica entre os CTAs e os números, como um respiro visual.
 */
export function HeroPlaylistLine() {
    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.25 }}
            className="mt-8 mb-9 w-full max-w-[420px]"
        >
            <Link
                to="/playlist"
                onClick={() => trackEvent('click_hero_playlist_pill')}
                className="group block rounded-[18px] border border-white/[0.08] bg-white/[0.025] hover:bg-white/[0.045] hover:border-white/[0.16] transition-colors p-5 sm:p-[22px]"
            >
                <div className="flex items-center gap-4">
                    <span className="shrink-0 grid place-items-center w-11 h-11 rounded-full border border-white/[0.1] bg-black/40 text-[#F59E0B]/90 group-hover:text-[#F59E0B] transition-colors">
                        <SpotifyGlyph className="w-[21px] h-[21px]" />
                    </span>

                    <div className="min-w-0 flex-1">
                        <p className="font-display text-[15.5px] font-medium text-white tracking-[-0.01em]">
                            Louvor &amp; Palavra do dia
                        </p>
                        <p className="text-[12.5px] text-[#71717A] mt-[3px] leading-snug">
                            A playlist da casa e um verso pra edificar. Só um café.
                        </p>
                    </div>

                    <span className="shrink-0 text-[#3F3F46] group-hover:text-[#F59E0B] group-hover:translate-x-0.5 transition-all text-[15px]">
                        →
                    </span>
                </div>
            </Link>
        </motion.div>
    );
}

/**
 * Faixa "quebra-gelo" minimalista — uma linha só, sem card e sem botão gritante.
 * Fica entre "Para quem é" e "Automação": visível, mas sem competir com a venda.
 */
export default function SpotifyMoodCard() {
    return (
        <section
            id="playlist"
            className="bg-[#0A0A0C] border-y border-white/[0.07] px-6 md:px-12 py-14 sm:py-16 md:py-20"
        >
            <motion.div
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-8%' }}
                transition={{ duration: 0.7, ease: EASE }}
                className="max-w-[1100px] mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6"
            >
                <div className="flex items-start sm:items-center gap-4">
                    <span className="mt-[3px] sm:mt-0 text-[#71717A] shrink-0">
                        <SpotifyGlyph className="w-[22px] h-[22px]" />
                    </span>
                    <div>
                        <p className="font-display text-[17px] sm:text-[19px] font-medium text-white tracking-[-0.01em]">
                            Um café, um som e uma palavra.
                        </p>
                        <p className="text-[13.5px] sm:text-[14px] text-[#71717A] mt-1 max-w-[48ch]">
                            Enquanto a agenda roda sozinha, deixamos a playlist da casa e um verso do dia por aqui.
                        </p>
                    </div>
                </div>

                <Link
                    to="/playlist"
                    onClick={() => trackEvent('click_playlist_spotify', { metadata: { origem: 'landing_faixa' } })}
                    className="group inline-flex items-center gap-2 self-start sm:self-auto text-[13.5px] font-medium text-[#A1A1A6] hover:text-white border-b border-white/[0.14] hover:border-[#F59E0B] pb-1 transition-colors whitespace-nowrap"
                >
                    Ouvir a playlist
                    <span className="text-[#F59E0B] group-hover:translate-x-0.5 transition-transform">→</span>
                </Link>
            </motion.div>
        </section>
    );
}

/**
 * Badge flutuante removido de propósito: poluía a tela e atrapalhava a venda.
 * Mantido como no-op para não quebrar o import existente na LandingPage.
 */
export function FloatingPlaylistBadge() {
    return null;
}

