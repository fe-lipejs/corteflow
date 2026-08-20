import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowLeft, Quote, RefreshCw, Share2 } from 'lucide-react';
import { SpotifyGlyph } from '../components/SpotifyMoodCard';
import { usePageTracking } from '../hooks/usePageTracking';
import { trackEvent } from '../lib/analytics';

/* ============================================================
   /playlist — "No som da casa"
   Mesmo idioma visual da landing (Apple Noir + Âmbar Elétrico).

   Configure no seu .env:
   VITE_SPOTIFY_PLAYLIST_ID=37i9dQZF1DXcBWIGoYBM5M
   VITE_SPOTIFY_PLAYLIST_URL=https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M
============================================================ */

const EASE: [number, number, number, number] = [0.16, 0.8, 0.24, 1];

const PLAYLIST_ID = import.meta.env['VITE_SPOTIFY_PLAYLIST_ID'] || '6BcMYfYsOH9qUGNp2FRthF';
const PLAYLIST_URL =
    import.meta.env['VITE_SPOTIFY_PLAYLIST_URL'] ||
    `https://open.spotify.com/playlist/${PLAYLIST_ID}`;

const VERSOS: { texto: string; ref: string }[] = [
    { texto: 'O Senhor é o meu pastor; nada me faltará.', ref: 'Salmos 23:1' },
    { texto: 'Tudo posso naquele que me fortalece.', ref: 'Filipenses 4:13' },
    { texto: 'Entrega o teu caminho ao Senhor, confia nele, e ele tudo fará.', ref: 'Salmos 37:5' },
    { texto: 'Cantai ao Senhor um cântico novo, porque ele fez maravilhas.', ref: 'Salmos 98:1' },
    { texto: 'Alegrai-vos na esperança, sede pacientes na tribulação, perseverai na oração.', ref: 'Romanos 12:12' },
    { texto: 'A tua palavra é lâmpada para os meus pés e luz para o meu caminho.', ref: 'Salmos 119:105' },
    { texto: 'E tudo quanto fizerdes, fazei-o de todo o coração, como ao Senhor.', ref: 'Colossenses 3:23' },
    { texto: 'Não temas, porque eu sou contigo; não te assombres, porque eu sou o teu Deus.', ref: 'Isaías 41:10' },
    { texto: 'O amor é sofredor, é benigno; o amor não é invejoso.', ref: '1 Coríntios 13:4' },
    { texto: 'Vinde a mim, todos os que estais cansados e oprimidos, e eu vos aliviarei.', ref: 'Mateus 11:28' },
];

export default function PlaylistPage() {
    usePageTracking();
    const reduce = useReducedMotion();
    const [index, setIndex] = useState(() => Math.floor(Math.random() * VERSOS.length));
    const [copiado, setCopiado] = useState(false);
    const verso = VERSOS[index]!;

    const sortear = () => {
        setCopiado(false);
        setIndex((atual) => {
            if (VERSOS.length < 2) return atual;
            let proximo = atual;
            while (proximo === atual) proximo = Math.floor(Math.random() * VERSOS.length);
            return proximo;
        });
    };

    const compartilhar = async () => {
        const texto = `"${verso.texto}" — ${verso.ref}`;
        try {
            if (typeof navigator !== 'undefined' && navigator.share) {
                await navigator.share({ text: texto });
                return;
            }
            await navigator.clipboard.writeText(texto);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2200);
        } catch {
            /* usuário cancelou */
        }
    };

    return (
        <div className="font-body bg-[#000000] text-[#F5F5F7] selection:bg-[#F59E0B] selection:text-black min-h-screen overflow-x-hidden">
            <div
                className="pointer-events-none fixed inset-0 -z-0"
                style={{ background: 'radial-gradient(60% 50% at 50% 0%, rgba(245,158,11,0.16), transparent 62%)' }}
            />

            <header className="relative z-10 px-6 md:px-12 pt-7 pb-2">
                <div className="max-w-[860px] mx-auto flex items-center justify-between gap-4">
                    <Link
                        to="/"
                        className="inline-flex items-center gap-2 text-[13.5px] font-medium text-[#A1A1A6] hover:text-[#F59E0B] transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Voltar
                    </Link>
                    <span className="inline-flex items-center gap-2.5 font-display font-bold text-[18px] text-white tracking-tight">
                        <img src="/logo.svg" alt="Raffros" className="h-7 w-auto object-contain drop-shadow-[0_0_10px_rgba(245,158,11,0.35)]" />
                        <span>Raffros</span>
                    </span>
                </div>
            </header>

            <main className="relative z-10 px-6 md:px-12 pt-10 pb-24">
                <div className="max-w-[860px] mx-auto">
                    {/* Cabeçalho */}
                    <motion.div
                        initial={{ opacity: 0, y: reduce ? 0 : 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.7, ease: EASE }}
                        className="text-center"
                    >
                        <span className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.16em] uppercase font-semibold mb-5 text-[#F59E0B]">
                            <span className="w-4 h-[1.5px] bg-[#F59E0B]" />
                            No som da casa
                        </span>
                        <h1 className="font-display font-semibold text-[clamp(30px,7vw,50px)] leading-[1.08] tracking-[-0.02em] text-white">
                            O que a Raffros<br />
                            <em
                                className="not-italic"
                                style={{
                                    background: 'linear-gradient(135deg, #F59E0B, #FBBF24)',
                                    WebkitBackgroundClip: 'text',
                                    backgroundClip: 'text',
                                    color: 'transparent',
                                }}
                            >
                                está ouvindo.
                            </em>
                        </h1>
                        <p className="text-[16px] leading-relaxed text-[#A1A1A6] max-w-[48ch] mx-auto mt-6">
                            Dá o play, respira e leva uma palavra com você. Aqui é o nosso cafezinho
                            digital — música pra trabalhar leve e versos pra edificar o dia.
                        </p>
                    </motion.div>

                    {/* CARD SUPERIOR — PLAYLIST */}
                    <motion.section
                        initial={{ opacity: 0, y: reduce ? 0 : 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.1, ease: EASE }}
                        className="mt-14 rounded-[28px] border border-white/[0.1] bg-[#0C0C0F] p-6 sm:p-8 shadow-2xl"
                    >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 mb-6">
                            <div className="flex items-center gap-3">
                                <span className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-[#F59E0B] shrink-0">
                                    <SpotifyGlyph className="w-[22px] h-[22px]" />
                                </span>
                                <div>
                                    <h2 className="font-display text-[19px] font-semibold text-white">Playlist oficial</h2>
                                    <p className="text-[13px] text-[#71717A]">Atualizada de vez em quando, no capricho.</p>
                                </div>
                            </div>

                            {PLAYLIST_URL && (
                                <a
                                    href={PLAYLIST_URL}
                                    target="_blank"
                                    rel="noreferrer noopener"
                                    className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full font-bold text-[14px] text-black shadow-[0_18px_36px_-16px_rgba(245,158,11,0.55)] hover:scale-[1.03] transition-all shrink-0"
                                    style={{ background: 'linear-gradient(135deg, #F59E0B, #FBBF24)' }}
                                >
                                    <SpotifyGlyph className="w-[18px] h-[18px]" />
                                    Abrir no Spotify
                                </a>
                            )}
                        </div>

                        {PLAYLIST_ID ? (
                            <div className="rounded-[20px] overflow-hidden border border-white/[0.1] bg-[#0A0A0C]">
                                <iframe
                                    title="Playlist da Raffros no Spotify"
                                    src={`https://open.spotify.com/embed/playlist/${PLAYLIST_ID}?theme=0`}
                                    width="100%"
                                    height="380"
                                    frameBorder="0"
                                    loading="lazy"
                                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                                    className="block w-full"
                                />
                            </div>
                        ) : (
                            <div className="rounded-[20px] border border-dashed border-white/[0.14] bg-[#0A0A0C] px-6 py-12 text-center">
                                <p className="text-[14px] text-[#A1A1A6]">
                                    Defina{' '}
                                    <code className="font-mono text-[13px] text-[#F59E0B]">VITE_SPOTIFY_PLAYLIST_ID</code>{' '}
                                    no seu <code className="font-mono text-[13px] text-[#F59E0B]">.env</code> para exibir a playlist aqui.
                                </p>
                            </div>
                        )}
                    </motion.section>

                    {/* CARD INFERIOR — VERSOS */}
                    <motion.section
                        initial={{ opacity: 0, y: reduce ? 0 : 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.18, ease: EASE }}
                        className="mt-8 sm:mt-10 rounded-[28px] border border-white/[0.1] bg-[#0C0C0F] p-7 sm:p-10 shadow-2xl text-center"
                    >
                        <span className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.16em] uppercase font-semibold mb-6 text-[#F59E0B]">
                            <span className="w-4 h-[1.5px] bg-[#F59E0B]" />
                            Palavra do dia
                        </span>

                        <Quote className="w-7 h-7 text-[#F59E0B]/50 mx-auto mb-5" />

                        <div className="min-h-[132px] flex items-center justify-center">
                            <AnimatePresence mode="wait">
                                <motion.blockquote
                                    key={index}
                                    initial={{ opacity: 0, y: reduce ? 0 : 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: reduce ? 0 : -12 }}
                                    transition={{ duration: 0.45, ease: EASE }}
                                    className="max-w-[38ch] mx-auto"
                                >
                                    <p className="font-display text-[clamp(20px,4.4vw,29px)] leading-[1.32] text-white">
                                        “{verso.texto}”
                                    </p>
                                    <cite className="not-italic block font-mono text-[12px] tracking-[0.14em] uppercase text-[#F59E0B] mt-5">
                                        {verso.ref}
                                    </cite>
                                </motion.blockquote>
                            </AnimatePresence>
                        </div>

                        <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3.5">
                            <button
                                type="button"
                                onClick={sortear}
                                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-4 rounded-full font-bold text-[15px] text-black shadow-[0_20px_40px_-16px_rgba(245,158,11,0.6)] hover:scale-[1.03] active:scale-[0.99] transition-all"
                                style={{ background: 'linear-gradient(135deg, #F59E0B, #FBBF24)' }}
                            >
                                <RefreshCw className="w-4 h-4" />
                                Tirar uma mensagem
                            </button>

                            <button
                                type="button"
                                onClick={compartilhar}
                                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-4 rounded-full font-semibold text-[15px] text-white border border-white/[0.18] hover:border-[#F59E0B] hover:text-[#F59E0B] transition-all bg-[#0A0A0C]/60"
                            >
                                <Share2 className="w-4 h-4" />
                                {copiado ? 'Copiado!' : 'Compartilhar'}
                            </button>
                        </div>

                        <p className="text-[12.5px] text-[#71717A] mt-7 max-w-[44ch] mx-auto">
                            “Assim como o ferro afia o ferro, o homem afia o seu companheiro.” — Provérbios 27:17
                        </p>
                    </motion.section>

                    <div className="mt-14 text-center">
                        <Link
                            to="/"
                            className="inline-flex items-center gap-2 text-[14px] font-medium text-[#A1A1A6] hover:text-[#F59E0B] transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Voltar para a Raffros
                        </Link>
                    </div>
                </div>
            </main>

            <footer className="relative z-10 border-t border-white/[0.08] px-6 md:px-12 py-10 text-center">
                <p className="text-[12px] text-[#71717A]">© {new Date().getFullYear()} Raffros. Feito com fé e capricho.</p>
            </footer>
        </div>
    );
}
