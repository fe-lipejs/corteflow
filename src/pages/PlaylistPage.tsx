import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ArrowUpRight, Quote, RefreshCw, Share2 } from 'lucide-react';
import { SpotifyGlyph } from '../components/SpotifyMoodCard';
import { usePageTracking } from '../hooks/usePageTracking';
import { trackEvent } from '../lib/analytics';

/* ============================================================
   /playlist — "No som da casa"
   Design system: Royal Blue & Laranja (#FC761D / #FF8738 no azul)
   Cards em glassmorphism branco para contrastar com o player escuro do Spotify
============================================================ */

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const ACCENT = '#FC761D';
const ACCENT_ON_DARK = '#FF8738';
const INK = '#0F172A';
const MUTED = '#5B6478';
const ROYAL = '#103875';

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

/* Estilo base dos cards em glassmorphism branco */
const whiteGlassCard: React.CSSProperties = {
    background: 'linear-gradient(145deg, rgba(255,255,255,0.94), rgba(255,255,255,0.80))',
    backdropFilter: 'blur(22px) saturate(180%)',
    WebkitBackdropFilter: 'blur(22px) saturate(180%)',
    border: '1px solid rgba(255,255,255,0.75)',
    borderRadius: '24px',
    boxShadow: '0 30px 70px rgba(4, 18, 48, 0.35), inset 0 1px 0 rgba(255,255,255,0.9)',
    color: INK,
};

function Noise() {
    return (
        <div
            aria-hidden="true"
            style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                opacity: 0.035,
                zIndex: 1,
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 160 160' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.8'/%3E%3C/svg%3E")`,
            }}
        />
    );
}

function GridLines() {
    return (
        <div
            aria-hidden="true"
            style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                overflow: 'hidden',
                opacity: 0.45,
            }}
        >
            {[8, 25, 50, 75, 92].map((left, i) => (
                <span
                    key={i}
                    style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: `${left}%`,
                        width: '1px',
                        background: 'rgba(255,255,255,0.06)',
                    }}
                />
            ))}
        </div>
    );
}

function Eyebrow({ children, onLight = false }: { children: React.ReactNode; onLight?: boolean }) {
    const dot = onLight ? ACCENT : ACCENT_ON_DARK;
    return (
        <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '9px',
            color: onLight ? MUTED : 'rgba(255,255,255,0.7)',
            fontSize: '10px',
            lineHeight: 1,
            letterSpacing: '.18em',
            fontWeight: 700,
            textTransform: 'uppercase',
        }}>
            <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: dot,
                flexShrink: 0,
                boxShadow: onLight ? '0 0 10px rgba(252,118,29,0.45)' : '0 0 14px rgba(255,135,56,0.55)',
            }} />
            {children}
        </div>
    );
}

export default function PlaylistPage() {
    usePageTracking();
    const reduce = useReducedMotion();
    const [index, setIndex] = useState(() => Math.floor(Math.random() * VERSOS.length));
    const [copiado, setCopiado] = useState(false);
    const verso = VERSOS[index]!;

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

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

    const lightButtonBase: React.CSSProperties = {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        borderRadius: '999px',
        border: '1px solid rgba(16,56,117,0.16)',
        background: 'rgba(16,56,117,0.06)',
        color: ROYAL,
        fontWeight: 700,
        textDecoration: 'none',
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'background 0.2s ease, border-color 0.2s ease, transform 0.2s ease',
    };

    return (
        <div style={{
            fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif",
            WebkitFontSmoothing: 'antialiased',
            background: 'radial-gradient(circle at 85% 12%, rgba(244, 114, 182, 0.14), transparent 36%), radial-gradient(circle at 15% 75%, rgba(37, 99, 235, 0.35), transparent 50%), radial-gradient(circle at 50% 30%, rgba(252, 118, 29, 0.06), transparent 35%), linear-gradient(165deg, #0A2550 0%, #0F3876 35%, #164894 70%, #1A3E78 100%)',
            color: '#ffffff',
            minHeight: '100vh',
            overflowX: 'hidden',
            position: 'relative',
        }}>
            {/* Ambient orbs com tons suaves de azul e toque sutil de rosa */}
            <div aria-hidden="true" style={{
                position: 'fixed',
                inset: 0,
                pointerEvents: 'none',
                zIndex: 0,
                background: 'radial-gradient(circle at 88% 15%, rgba(244,114,182,0.12), transparent 45%)',
            }} />
            <div aria-hidden="true" style={{
                position: 'fixed',
                top: '25%',
                left: '5%',
                width: '520px',
                height: '520px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(37,99,235,0.22), transparent 65%)',
                pointerEvents: 'none',
                zIndex: 0,
            }} />

            {/* ── HEADER ── */}
            <header style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                zIndex: 9999,
                height: '64px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 24px',
                background: 'rgba(10, 37, 80, 0.72)',
                backdropFilter: 'blur(20px) saturate(180%)',
                WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                borderBottom: '1px solid rgba(255,255,255,0.10)',
                boxSizing: 'border-box',
            }}>
                {/* ← Voltar */}
                <Link
                    to="/"
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: 'rgba(255,255,255,0.72)',
                        fontSize: '12px',
                        fontWeight: 600,
                        letterSpacing: '0.01em',
                        textDecoration: 'none',
                        transition: 'color 0.2s ease',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = ACCENT_ON_DARK)}
                    onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.72)')}
                >
                    <ArrowLeft size={15} />
                    Voltar
                </Link>

                {/* Logo */}
                <a href="/" style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: '#fff',
                    textDecoration: 'none',
                }}>
                    <img
                        src="/logo.svg"
                        alt="Raffros"
                        style={{ height: '28px', filter: 'invert(1)' }}
                        onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    />
                </a>

                {/* CTA → Começar grátis */}
                <a
                    href="/cadastro"
                    onClick={() => trackEvent('click_cta_da_playlist')}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '7px',
                        height: '36px',
                        padding: '0 16px',
                        borderRadius: '999px',
                        background: ACCENT_ON_DARK,
                        color: '#FFFFFF',
                        fontSize: '11px',
                        fontWeight: 800,
                        letterSpacing: '-0.01em',
                        textDecoration: 'none',
                        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                        boxShadow: '0 8px 24px rgba(255, 135, 56, 0.32)',
                    }}
                    onMouseEnter={e => {
                        (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-1px)';
                        (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 12px 30px rgba(255, 135, 56, 0.45)';
                    }}
                    onMouseLeave={e => {
                        (e.currentTarget as HTMLAnchorElement).style.transform = 'none';
                        (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 8px 24px rgba(255, 135, 56, 0.32)';
                    }}
                >
                    Começar grátis
                    <ArrowRight size={13} />
                </a>
            </header>

            {/* ── MAIN ── */}
            <main style={{ position: 'relative', zIndex: 2, paddingTop: '120px', paddingBottom: '120px' }}>

                {/* ── HERO COPY ── */}
                <section style={{ position: 'relative', overflow: 'hidden', paddingBottom: '64px' }}>
                    <Noise />
                    <GridLines />

                    <div style={{
                        width: 'min(calc(100% - 48px), 1240px)',
                        margin: '0 auto',
                        position: 'relative',
                        zIndex: 2,
                    }}>
                        <motion.div
                            initial={{ opacity: 0, y: reduce ? 0 : 28 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.75, ease: EASE }}
                        >
                            <Eyebrow>No som da casa</Eyebrow>

                            <h1 style={{
                                margin: '22px 0 20px',
                                fontSize: 'clamp(46px, 6vw, 76px)',
                                lineHeight: 0.92,
                                letterSpacing: '-0.065em',
                                fontWeight: 800,
                                color: '#ffffff',
                                maxWidth: '680px',
                            }}>
                                O que a Raffros{' '}
                                <br />
                                <span style={{ color: ACCENT_ON_DARK }}>está ouvindo.</span>
                            </h1>

                            <p style={{
                                margin: 0,
                                maxWidth: '520px',
                                color: 'rgba(255,255,255,0.75)',
                                fontSize: '15px',
                                lineHeight: 1.65,
                                letterSpacing: '-0.01em',
                            }}>
                                Dê um play, respire e leve uma Palavra com você.
                                Aqui é o nosso cafezinho digital — música pra trabalhar
                                leve e versos pra edificar o dia.
                            </p>
                        </motion.div>
                    </div>
                </section>

                {/* ── CARDS ── */}
                <div style={{
                    width: 'min(calc(100% - 32px), 920px)',
                    margin: '0 auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '20px',
                }}>

                    {/* PLAYLIST CARD — glass branco */}
                    <motion.section
                        initial={{ opacity: 0, y: reduce ? 0 : 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.75, delay: 0.1, ease: EASE }}
                        style={{ ...whiteGlassCard, padding: 'clamp(20px, 4vw, 32px)' }}
                    >
                        {/* card header */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '16px',
                            flexWrap: 'wrap',
                            marginBottom: '22px',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                <div style={{
                                    width: '48px',
                                    height: '48px',
                                    borderRadius: '14px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: '#121212',
                                    boxShadow: '0 8px 20px rgba(0,0,0,0.18)',
                                    flexShrink: 0,
                                }}>
                                    <SpotifyGlyph className="w-[24px] h-[24px]" />
                                </div>
                                <div>
                                    <div style={{
                                        fontSize: '20px',
                                        fontWeight: 800,
                                        letterSpacing: '-0.035em',
                                        color: INK,
                                        lineHeight: 1.15,
                                    }}>
                                        Playlist oficial
                                    </div>
                                    <div style={{
                                        fontSize: '13px',
                                        color: MUTED,
                                        marginTop: '4px',
                                    }}>
                                        Atualizada de vez em quando, no capricho.
                                    </div>
                                </div>
                            </div>

                            {PLAYLIST_URL && (
                                <a
                                    href={PLAYLIST_URL}
                                    target="_blank"
                                    rel="noreferrer noopener"
                                    onClick={() => trackEvent('click_spotify_abrir_externo', { metadata: { url: PLAYLIST_URL } })}
                                    style={{
                                        ...lightButtonBase,
                                        height: '40px',
                                        padding: '0 18px',
                                        fontSize: '12px',
                                        flexShrink: 0,
                                    }}
                                    onMouseEnter={e => {
                                        (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(16,56,117,0.12)';
                                        (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(16,56,117,0.28)';
                                        (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-1px)';
                                    }}
                                    onMouseLeave={e => {
                                        (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(16,56,117,0.06)';
                                        (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(16,56,117,0.16)';
                                        (e.currentTarget as HTMLAnchorElement).style.transform = 'none';
                                    }}
                                >
                                    <SpotifyGlyph className="w-[15px] h-[15px]" />
                                    Abrir no Spotify
                                    <ArrowUpRight size={13} />
                                </a>
                            )}
                        </div>

                        {/* iframe */}
                        {PLAYLIST_ID ? (
                            <div style={{
                                borderRadius: '14px',
                                overflow: 'hidden',
                                background: '#121212',
                                boxShadow: '0 14px 34px rgba(4,18,48,0.22)',
                            }}>
                                <iframe
                                    title="Playlist da Raffros no Spotify"
                                    src={`https://open.spotify.com/embed/playlist/${PLAYLIST_ID}?theme=0`}
                                    width="100%"
                                    height="380"
                                    frameBorder="0"
                                    loading="lazy"
                                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                                    style={{ display: 'block', width: '100%' }}
                                />
                            </div>
                        ) : (
                            <div style={{
                                borderRadius: '14px',
                                border: '1px dashed rgba(16,56,117,0.25)',
                                background: 'rgba(16,56,117,0.04)',
                                padding: '48px 24px',
                                textAlign: 'center',
                            }}>
                                <p style={{ margin: 0, color: MUTED, fontSize: '13px' }}>
                                    Defina{' '}
                                    <code style={{ fontFamily: 'ui-monospace, monospace', color: ACCENT }}>VITE_SPOTIFY_PLAYLIST_ID</code>
                                    {' '}no <code style={{ fontFamily: 'ui-monospace, monospace', color: ACCENT }}>.env</code>
                                </p>
                            </div>
                        )}
                    </motion.section>

                    {/* VERSO CARD — glass branco */}
                    <motion.section
                        initial={{ opacity: 0, y: reduce ? 0 : 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.75, delay: 0.18, ease: EASE }}
                        style={{ ...whiteGlassCard, padding: 'clamp(32px, 6vw, 48px) clamp(20px, 5vw, 40px)', textAlign: 'center' }}
                    >
                        <Eyebrow onLight>Palavra do dia</Eyebrow>

                        <div style={{ margin: '26px 0 0', color: 'rgba(252,118,29,0.55)' }}>
                            <Quote size={30} />
                        </div>

                        {/* animated verse */}
                        <div style={{ minHeight: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '8px 0 0' }}>
                            <AnimatePresence mode="wait">
                                <motion.blockquote
                                    key={index}
                                    initial={{ opacity: 0, y: reduce ? 0 : 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: reduce ? 0 : -12 }}
                                    transition={{ duration: 0.45, ease: EASE }}
                                    style={{ margin: 0, maxWidth: '520px' }}
                                >
                                    <p style={{
                                        margin: 0,
                                        fontSize: 'clamp(22px, 4vw, 32px)',
                                        lineHeight: 1.25,
                                        letterSpacing: '-0.04em',
                                        fontWeight: 750,
                                        color: INK,
                                    }}>
                                        "{verso.texto}"
                                    </p>
                                    <cite style={{
                                        display: 'block',
                                        marginTop: '20px',
                                        fontStyle: 'normal',
                                        fontSize: '11px',
                                        fontWeight: 800,
                                        letterSpacing: '.18em',
                                        textTransform: 'uppercase',
                                        color: ACCENT,
                                    }}>
                                        {verso.ref}
                                    </cite>
                                </motion.blockquote>
                            </AnimatePresence>
                        </div>

                        {/* actions */}
                        <div style={{
                            marginTop: '34px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '12px',
                            flexWrap: 'wrap',
                        }}>
                            <button
                                type="button"
                                onClick={() => {
                                    sortear();
                                    trackEvent('click_sortear_versiculo', { metadata: { verso: verso.ref } });
                                }}
                                style={{
                                    height: '48px',
                                    padding: '0 24px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '9px',
                                    borderRadius: '999px',
                                    background: ACCENT,
                                    color: '#FFFFFF',
                                    fontSize: '13px',
                                    fontWeight: 800,
                                    border: 'none',
                                    cursor: 'pointer',
                                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                                    fontFamily: 'inherit',
                                    boxShadow: '0 10px 26px rgba(252,118,29,0.32)',
                                }}
                                onMouseEnter={e => {
                                    (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
                                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 14px 32px rgba(252,118,29,0.42)';
                                }}
                                onMouseLeave={e => {
                                    (e.currentTarget as HTMLButtonElement).style.transform = 'none';
                                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 10px 26px rgba(252,118,29,0.32)';
                                }}
                            >
                                <RefreshCw size={15} />
                                Tirar uma mensagem
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    compartilhar();
                                    trackEvent('click_compartilhar_versiculo', { metadata: { verso: verso.ref } });
                                }}
                                style={{
                                    ...lightButtonBase,
                                    height: '48px',
                                    padding: '0 20px',
                                    fontSize: '13px',
                                }}
                                onMouseEnter={e => {
                                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(16,56,117,0.12)';
                                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(16,56,117,0.28)';
                                    (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
                                }}
                                onMouseLeave={e => {
                                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(16,56,117,0.06)';
                                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(16,56,117,0.16)';
                                    (e.currentTarget as HTMLButtonElement).style.transform = 'none';
                                }}
                            >
                                <Share2 size={15} />
                                {copiado ? 'Copiado!' : 'Compartilhar'}
                            </button>
                        </div>

                        <p style={{
                            margin: '28px auto 0',
                            fontSize: '12px',
                            color: MUTED,
                            maxWidth: '46ch',
                            lineHeight: 1.6,
                        }}>
                            "Assim como o ferro afia o ferro, o homem afia o seu companheiro." — Pv 27:17
                        </p>
                    </motion.section>

                    {/* BACK LINK */}
                    <div style={{ marginTop: '48px', textAlign: 'center' }}>
                        <Link
                            to="/"
                            onClick={() => trackEvent('click_voltar_da_playlist')}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                color: 'rgba(255,255,255,0.65)',
                                fontSize: '12px',
                                fontWeight: 600,
                                letterSpacing: '0.01em',
                                textDecoration: 'none',
                                transition: 'color 0.2s ease',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.color = ACCENT_ON_DARK)}
                            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.65)')}
                        >
                            <ArrowLeft size={14} />
                            Voltar para a Raffros
                        </Link>
                    </div>
                </div>
            </main>

            {/* ── FOOTER ── */}
            <footer style={{
                position: 'relative',
                zIndex: 2,
                borderTop: '1px solid rgba(255,255,255,0.10)',
                padding: '40px 32px',
                textAlign: 'center',
            }}>
                <p style={{
                    margin: 0,
                    fontSize: '11px',
                    color: 'rgba(255,255,255,0.5)',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                }}>
                    © {new Date().getFullYear()} Raffros — Feito com fé e capricho.
                </p>
            </footer>
        </div>
    );
}
