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
   Fundo dinâmico com feixe de luz + Cards BRANCOS em white glassmorphism premium
============================================================ */

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const ACCENT = '#FC761D';
const ACCENT_ON_DARK = '#FF8738';
const INK = '#0F172A';
const MUTED = '#5B6478';

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

/* Estilo base dos cards BRANCOS em glassmorphism ultra-premium */
const whiteGlassCard: React.CSSProperties = {
    background: 'linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(255, 255, 255, 0.92))',
    backdropFilter: 'blur(28px) saturate(180%)',
    WebkitBackdropFilter: 'blur(28px) saturate(180%)',
    border: '1px solid rgba(255, 255, 255, 0.90)',
    borderRadius: '28px',
    boxShadow: '0 30px 80px rgba(4, 18, 48, 0.40), inset 0 1px 0 #FFFFFF',
    color: INK,
    position: 'relative',
    overflow: 'hidden',
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
                zIndex: 1,
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
    if (onLight) {
        return (
            <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                borderRadius: '9999px',
                background: 'rgba(252, 118, 29, 0.08)',
                border: '1px solid rgba(252, 118, 29, 0.20)',
                color: '#C25400',
                fontSize: '11px',
                lineHeight: 1,
                letterSpacing: '.16em',
                fontWeight: 800,
                textTransform: 'uppercase',
            }}>
                <span style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: ACCENT,
                    flexShrink: 0,
                    boxShadow: '0 0 10px rgba(252,118,29,0.5)',
                }} />
                {children}
            </div>
        );
    }

    return (
        <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 14px',
            borderRadius: '9999px',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            color: 'rgba(255,255,255,0.85)',
            fontSize: '11px',
            lineHeight: 1,
            letterSpacing: '.16em',
            fontWeight: 800,
            textTransform: 'uppercase',
            boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
        }}>
            <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: ACCENT_ON_DARK,
                flexShrink: 0,
                boxShadow: '0 0 12px #FF8738',
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

    return (
        <div style={{
            fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif",
            WebkitFontSmoothing: 'antialiased',
            background: 'radial-gradient(circle at 85% 12%, rgba(244, 114, 182, 0.14), transparent 38%), radial-gradient(circle at 12% 85%, rgba(37, 99, 235, 0.38), transparent 52%), radial-gradient(circle at 50% 30%, rgba(252, 118, 29, 0.08), transparent 45%), linear-gradient(165deg, #0B2958 0%, #0F3775 40%, #164894 75%, #1A3E78 100%)',
            color: '#ffffff',
            minHeight: '100vh',
            overflowX: 'hidden',
            position: 'relative',
        }}>
            {/* ── CSS KEYFRAMES PARA O FEIXE DE LUZ CONTÍNUO (LANDING PAGE STYLE) ── */}
            <style>{`
                @keyframes rfLightSweep {
                    0% {
                        transform: translateX(-120%) rotate(-25deg);
                        opacity: 0;
                    }
                    15% {
                        opacity: 0.5;
                    }
                    50% {
                        opacity: 0.75;
                    }
                    85% {
                        opacity: 0.5;
                    }
                    100% {
                        transform: translateX(220%) rotate(-25deg);
                        opacity: 0;
                    }
                }
                @keyframes rfLightBreath {
                    0%, 100% {
                        transform: scale(1) translate(0, 0);
                        opacity: 0.28;
                    }
                    50% {
                        transform: scale(1.15) translate(-20px, 15px);
                        opacity: 0.45;
                    }
                }
                .rf-ambient-beam {
                    position: fixed;
                    top: -20%;
                    left: 0;
                    width: 480px;
                    height: 140vh;
                    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.08), rgba(255, 135, 56, 0.06), transparent);
                    filter: blur(45px);
                    pointer-events: none;
                    z-index: 0;
                    animation: rfLightSweep 16s ease-in-out infinite;
                }
                .rf-ambient-beam-two {
                    position: fixed;
                    top: -10%;
                    left: 20%;
                    width: 320px;
                    height: 130vh;
                    background: linear-gradient(90deg, transparent, rgba(37, 99, 235, 0.15), rgba(244, 114, 182, 0.08), transparent);
                    filter: blur(55px);
                    pointer-events: none;
                    z-index: 0;
                    animation: rfLightSweep 22s ease-in-out infinite 5s;
                }
                .rf-ambient-orb {
                    position: fixed;
                    top: 20%;
                    right: 8%;
                    width: 580px;
                    height: 580px;
                    border-radius: 50%;
                    background: radial-gradient(circle, rgba(244, 114, 182, 0.12), rgba(37, 99, 235, 0.20), transparent 68%);
                    filter: blur(50px);
                    pointer-events: none;
                    z-index: 0;
                    animation: rfLightBreath 10s ease-in-out infinite alternate;
                }
            `}</style>

            {/* Ambient continuous light sweeps */}
            <div className="rf-ambient-beam" aria-hidden="true" />
            <div className="rf-ambient-beam-two" aria-hidden="true" />
            <div className="rf-ambient-orb" aria-hidden="true" />

            {/* ── HEADER (PERFEITAMENTE ALINHADO COM A LANDING PAGE) ── */}
            <header style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                zIndex: 9999,
                height: '68px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 clamp(16px, 4vw, 36px)',
                background: 'rgba(11, 41, 88, 0.78)',
                backdropFilter: 'blur(20px) saturate(180%)',
                WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.10)',
                boxSizing: 'border-box',
            }}>
                {/* Lado Esquerdo: Marca Oficial + Link Voltar ao Início */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <Link
                        to="/"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '10px',
                            color: '#ffffff',
                            textDecoration: 'none',
                        }}
                    >
                        <img
                            src="/logo.svg"
                            alt="Raffros"
                            style={{
                                height: '32px',
                                width: '32px',
                                filter: 'invert(1)',
                                borderRadius: '6px',
                                display: 'block',
                                boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
                            }}
                            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                        />
                        <span style={{
                            fontSize: '18px',
                            fontWeight: 900,
                            letterSpacing: '-0.045em',
                            color: '#FFFFFF',
                            lineHeight: 1,
                        }}>
                            RAFFROS<span style={{ color: ACCENT_ON_DARK }}>.</span>
                        </span>
                    </Link>

                    {/* Divisor sutil */}
                    <span style={{
                        width: '1px',
                        height: '18px',
                        background: 'rgba(255, 255, 255, 0.16)',
                        display: 'inline-block',
                    }} />

                    {/* Botão sutil Voltar */}
                    <Link
                        to="/"
                        onClick={() => trackEvent('click_voltar_header_playlist')}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 12px',
                            borderRadius: '9999px',
                            background: 'rgba(255, 255, 255, 0.06)',
                            border: '1px solid rgba(255, 255, 255, 0.10)',
                            color: 'rgba(255, 255, 255, 0.80)',
                            fontSize: '12px',
                            fontWeight: 600,
                            letterSpacing: '0.01em',
                            textDecoration: 'none',
                            transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.color = '#FFFFFF';
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)';
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.22)';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.80)';
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.10)';
                        }}
                    >
                        <ArrowLeft size={13} />
                        Início
                    </Link>
                </div>

                {/* Lado Direito: CTA de Alta Conversão no padrão Landing Page */}
                <Link
                    to="/cadastro"
                    onClick={() => trackEvent('click_cta_da_playlist')}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        height: '40px',
                        padding: '0 20px',
                        borderRadius: '9999px',
                        background: ACCENT_ON_DARK,
                        color: '#FFFFFF',
                        fontSize: '12px',
                        fontWeight: 800,
                        letterSpacing: '-0.01em',
                        textDecoration: 'none',
                        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                        boxShadow: '0 8px 24px rgba(255, 135, 56, 0.38)',
                    }}
                    onMouseEnter={e => {
                        (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-1px)';
                        (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 12px 30px rgba(255, 135, 56, 0.50)';
                    }}
                    onMouseLeave={e => {
                        (e.currentTarget as HTMLAnchorElement).style.transform = 'none';
                        (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 8px 24px rgba(255, 135, 56, 0.38)';
                    }}
                >
                    Começar grátis
                    <ArrowRight size={14} />
                </Link>
            </header>

            {/* ── MAIN CONTENT ── */}
            <main style={{ position: 'relative', zIndex: 2, paddingTop: '120px', paddingBottom: '120px' }}>

                {/* ── HERO COPY ── */}
                <section style={{ position: 'relative', overflow: 'hidden', paddingBottom: '54px' }}>
                    <Noise />
                    <GridLines />

                    <div style={{
                        width: 'min(calc(100% - 40px), 1200px)',
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
                                fontSize: 'clamp(46px, 6.5vw, 78px)',
                                lineHeight: 0.94,
                                letterSpacing: '-0.055em',
                                fontWeight: 900,
                                color: '#ffffff',
                                maxWidth: '720px',
                            }}>
                                O que a Raffros{' '}
                                <br />
                                <span style={{ color: ACCENT_ON_DARK }}>está ouvindo.</span>
                            </h1>

                            <p style={{
                                margin: 0,
                                maxWidth: '540px',
                                color: 'rgba(255,255,255,0.78)',
                                fontSize: '16px',
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

                {/* ── CARDS BRANCOS EM ULTRA-PREMIUM WHITE GLASSMORPHISM ── */}
                <div style={{
                    width: 'min(calc(100% - 32px), 940px)',
                    margin: '0 auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '24px',
                    position: 'relative',
                    zIndex: 2,
                }}>

                    {/* CARD 1: PLAYLIST OFICIAL (BRANCO) */}
                    <motion.section
                        initial={{ opacity: 0, y: reduce ? 0 : 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.75, delay: 0.1, ease: EASE }}
                        style={{ ...whiteGlassCard, padding: 'clamp(22px, 4vw, 36px)' }}
                    >
                        {/* Card Header */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '16px',
                            flexWrap: 'wrap',
                            marginBottom: '24px',
                            position: 'relative',
                            zIndex: 2,
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <div style={{
                                    width: '52px',
                                    height: '52px',
                                    borderRadius: '16px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: '#121212',
                                    color: '#1DB954',
                                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.20)',
                                    flexShrink: 0,
                                }}>
                                    <SpotifyGlyph className="w-[26px] h-[26px]" />
                                </div>
                                <div>
                                    <div style={{
                                        fontSize: '22px',
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
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        height: '42px',
                                        padding: '0 20px',
                                        borderRadius: '9999px',
                                        background: '#0F172A',
                                        color: '#FFFFFF',
                                        fontSize: '12px',
                                        fontWeight: 800,
                                        letterSpacing: '-0.01em',
                                        textDecoration: 'none',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        boxShadow: '0 4px 16px rgba(15, 23, 42, 0.18)',
                                    }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.background = '#1E293B';
                                        e.currentTarget.style.transform = 'translateY(-1px)';
                                        e.currentTarget.style.boxShadow = '0 8px 22px rgba(15, 23, 42, 0.28)';
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.background = '#0F172A';
                                        e.currentTarget.style.transform = 'none';
                                        e.currentTarget.style.boxShadow = '0 4px 16px rgba(15, 23, 42, 0.18)';
                                    }}
                                >
                                    <SpotifyGlyph className="w-[16px] h-[16px] text-[#1DB954]" />
                                    Abrir no Spotify
                                    <ArrowUpRight size={13} />
                                </a>
                            )}
                        </div>

                        {/* Embed Spotify Iframe */}
                        {PLAYLIST_ID ? (
                            <div style={{
                                borderRadius: '18px',
                                overflow: 'hidden',
                                background: '#121212',
                                border: '1px solid rgba(0, 0, 0, 0.08)',
                                boxShadow: '0 12px 30px rgba(0, 0, 0, 0.15)',
                                position: 'relative',
                                zIndex: 2,
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
                                borderRadius: '18px',
                                border: '1px dashed rgba(16, 56, 117, 0.25)',
                                background: 'rgba(16, 56, 117, 0.04)',
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

                    {/* CARD 2: PALAVRA DO DIA (BRANCO) */}
                    <motion.section
                        initial={{ opacity: 0, y: reduce ? 0 : 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.75, delay: 0.18, ease: EASE }}
                        style={{
                            ...whiteGlassCard,
                            padding: 'clamp(36px, 6vw, 54px) clamp(22px, 5vw, 44px)',
                            textAlign: 'center',
                        }}
                    >
                        <div style={{ position: 'relative', zIndex: 2 }}>
                            <Eyebrow onLight>Palavra do dia</Eyebrow>

                            <div style={{
                                margin: '24px auto 0',
                                width: '56px',
                                height: '56px',
                                borderRadius: '18px',
                                background: 'linear-gradient(135deg, rgba(252, 118, 29, 0.14), rgba(252, 118, 29, 0.04))',
                                border: '1px solid rgba(252, 118, 29, 0.25)',
                                color: ACCENT,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 8px 22px rgba(252, 118, 29, 0.15)',
                            }}>
                                <Quote size={28} />
                            </div>

                            {/* Versículo animado */}
                            <div style={{
                                minHeight: '160px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '14px 0 0',
                            }}>
                                <AnimatePresence mode="wait">
                                    <motion.blockquote
                                        key={index}
                                        initial={{ opacity: 0, y: reduce ? 0 : 12 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: reduce ? 0 : -12 }}
                                        transition={{ duration: 0.45, ease: EASE }}
                                        style={{ margin: 0, maxWidth: '620px' }}
                                    >
                                        <p style={{
                                            margin: 0,
                                            fontSize: 'clamp(24px, 4.5vw, 35px)',
                                            lineHeight: 1.25,
                                            letterSpacing: '-0.04em',
                                            fontWeight: 850,
                                            color: INK,
                                        }}>
                                            "{verso.texto}"
                                        </p>
                                        <cite style={{
                                            display: 'inline-block',
                                            marginTop: '22px',
                                            fontStyle: 'normal',
                                            fontSize: '11px',
                                            fontWeight: 800,
                                            letterSpacing: '.20em',
                                            textTransform: 'uppercase',
                                            color: ACCENT,
                                            padding: '6px 16px',
                                            borderRadius: '9999px',
                                            background: 'rgba(252, 118, 29, 0.08)',
                                            border: '1px solid rgba(252, 118, 29, 0.22)',
                                        }}>
                                            {verso.ref}
                                        </cite>
                                    </motion.blockquote>
                                </AnimatePresence>
                            </div>

                            {/* Ações em formato Pill Buttons Premium */}
                            <div style={{
                                marginTop: '36px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '14px',
                                flexWrap: 'wrap',
                            }}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        sortear();
                                        trackEvent('click_sortear_versiculo', { metadata: { verso: verso.ref } });
                                    }}
                                    style={{
                                        height: '50px',
                                        padding: '0 28px',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        borderRadius: '9999px',
                                        background: ACCENT,
                                        color: '#FFFFFF',
                                        fontSize: '13.5px',
                                        fontWeight: 800,
                                        border: 'none',
                                        cursor: 'pointer',
                                        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                                        fontFamily: 'inherit',
                                        boxShadow: '0 10px 26px rgba(252, 118, 29, 0.35)',
                                    }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                        e.currentTarget.style.boxShadow = '0 14px 32px rgba(252, 118, 29, 0.45)';
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.transform = 'none';
                                        e.currentTarget.style.boxShadow = '0 10px 26px rgba(252, 118, 29, 0.35)';
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
                                        height: '50px',
                                        padding: '0 24px',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '9px',
                                        borderRadius: '9999px',
                                        background: '#F1F5F9',
                                        border: '1px solid #E2E8F0',
                                        color: INK,
                                        fontSize: '13.5px',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        fontFamily: 'inherit',
                                    }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.background = '#E2E8F0';
                                        e.currentTarget.style.borderColor = '#CBD5E1';
                                        e.currentTarget.style.transform = 'translateY(-1px)';
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.background = '#F1F5F9';
                                        e.currentTarget.style.borderColor = '#E2E8F0';
                                        e.currentTarget.style.transform = 'none';
                                    }}
                                >
                                    <Share2 size={15} />
                                    {copiado ? 'Copiado para a área de transferência!' : 'Compartilhar'}
                                </button>
                            </div>

                            {/* Citação de rodapé */}
                            <p style={{
                                margin: '32px auto 0',
                                fontSize: '12.5px',
                                color: MUTED,
                                maxWidth: '50ch',
                                lineHeight: 1.6,
                                fontStyle: 'italic',
                            }}>
                                "Assim como o ferro afia o ferro, o homem afia o seu companheiro." — Pv 27:17
                            </p>
                        </div>
                    </motion.section>

                    {/* LINK INFERIOR VOLTAR */}
                    <div style={{ marginTop: '36px', textAlign: 'center' }}>
                        <Link
                            to="/"
                            onClick={() => trackEvent('click_voltar_da_playlist')}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                color: 'rgba(255,255,255,0.70)',
                                fontSize: '13px',
                                fontWeight: 600,
                                letterSpacing: '0.01em',
                                textDecoration: 'none',
                                transition: 'color 0.2s ease',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.color = ACCENT_ON_DARK)}
                            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.70)')}
                        >
                            <ArrowLeft size={15} />
                            Voltar para a página inicial
                        </Link>
                    </div>
                </div>
            </main>

            {/* ── FOOTER ── */}
            <footer style={{
                position: 'relative',
                zIndex: 2,
                borderTop: '1px solid rgba(255,255,255,0.10)',
                padding: '36px 24px',
                textAlign: 'center',
                background: 'rgba(10, 37, 80, 0.45)',
            }}>
                <p style={{
                    margin: 0,
                    fontSize: '11px',
                    color: 'rgba(255,255,255,0.55)',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    fontWeight: 600,
                }}>
                    © {new Date().getFullYear()} Raffros — Feito com fé e capricho.
                </p>
            </footer>
        </div>
    );
}
