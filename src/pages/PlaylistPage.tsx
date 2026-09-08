import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ArrowUpRight, Quote, RefreshCw, Share2 } from 'lucide-react';
import { SpotifyGlyph } from '../components/SpotifyMoodCard';
import { usePageTracking } from '../hooks/usePageTracking';
import { trackEvent } from '../lib/analytics';

/* ============================================================
   /playlist — "No som da casa"
   Design system: Apple Noir × Âmbar Elétrico (idêntico à landing)
   Accent: #FF9D2E | Black: #050505 | Font: Inter / SF Pro
============================================================ */

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

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
                opacity: 0.55,
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
                        background: 'rgba(255,255,255,0.055)',
                    }}
                />
            ))}
        </div>
    );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
    return (
        <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '9px',
            color: '#9d9d98',
            fontSize: '9px',
            lineHeight: 1,
            letterSpacing: '.18em',
            fontWeight: 700,
            textTransform: 'uppercase',
        }}>
            <span style={{
                width: '5px',
                height: '5px',
                borderRadius: '50%',
                background: '#FF9D2E',
                flexShrink: 0,
                boxShadow: '0 0 16px rgba(255,157,46,.45)',
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
            background: '#050505',
            color: '#ffffff',
            minHeight: '100vh',
            overflowX: 'hidden',
            position: 'relative',
        }}>
            {/* Ambient orbs */}
            <div aria-hidden="true" style={{
                position: 'fixed',
                inset: 0,
                pointerEvents: 'none',
                zIndex: 0,
                background: 'radial-gradient(circle at 50% 0%, rgba(255,157,46,0.07), transparent 55%)',
            }} />
            <div aria-hidden="true" style={{
                position: 'fixed',
                top: '30%',
                right: '10%',
                width: '500px',
                height: '500px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(255,157,46,0.045), transparent 65%)',
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
                padding: '0 32px',
                background: 'rgba(5,5,5,0.65)',
                backdropFilter: 'blur(20px) saturate(180%)',
                WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                boxSizing: 'border-box',
            }}>
                {/* ← Voltar */}
                <Link
                    to="/"
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: 'rgba(255,255,255,0.55)',
                        fontSize: '11px',
                        fontWeight: 500,
                        letterSpacing: '0.01em',
                        textDecoration: 'none',
                        transition: 'color 0.2s ease',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#FF9D2E')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.55)')}
                >
                    <ArrowLeft size={14} />
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
                        height: '34px',
                        padding: '0 14px',
                        borderRadius: '999px',
                        background: '#FF9D2E',
                        color: '#080808',
                        fontSize: '10px',
                        fontWeight: 800,
                        letterSpacing: '-0.01em',
                        textDecoration: 'none',
                        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                        boxShadow: '0 0 0 1px rgba(255,157,46,.15), 0 5px 25px rgba(255,157,46,.12)',
                    }}
                    onMouseEnter={e => {
                        (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-1px)';
                        (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 0 0 1px rgba(255,157,46,.25), 0 8px 32px rgba(255,157,46,.2)';
                    }}
                    onMouseLeave={e => {
                        (e.currentTarget as HTMLAnchorElement).style.transform = 'none';
                        (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 0 0 1px rgba(255,157,46,.15), 0 5px 25px rgba(255,157,46,.12)';
                    }}
                >
                    Começar grátis
                    <ArrowRight size={12} />
                </a>
            </header>

            {/* ── MAIN ── */}
            <main style={{ position: 'relative', zIndex: 2, paddingTop: '120px', paddingBottom: '120px' }}>

                {/* ── HERO COPY ── */}
                <section style={{ position: 'relative', overflow: 'hidden', paddingBottom: '80px' }}>
                    <Noise />
                    <GridLines />

                    <div style={{
                        width: 'min(calc(100% - 64px), 1240px)',
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
                                fontSize: 'clamp(52px, 6vw, 82px)',
                                lineHeight: 0.93,
                                letterSpacing: '-0.065em',
                                fontWeight: 750,
                                color: '#ffffff',
                                maxWidth: '680px',
                            }}>
                                O que a Raffros{' '}
                                <br />
                                <span style={{ color: '#FF9D2E' }}>está ouvindo.</span>
                            </h1>

                            <p style={{
                                margin: 0,
                                maxWidth: '500px',
                                color: 'rgba(255,255,255,0.5)',
                                fontSize: '14px',
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
                    width: 'min(calc(100% - 64px), 900px)',
                    margin: '0 auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                }}>

                    {/* PLAYLIST CARD */}
                    <motion.section
                        initial={{ opacity: 0, y: reduce ? 0 : 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.75, delay: 0.1, ease: EASE }}
                        style={{
                            background: '#0b0b0b',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '4px',
                            padding: '32px',
                            boxShadow: '0 30px 80px rgba(0,0,0,0.4)',
                        }}
                    >
                        {/* card header */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '16px',
                            flexWrap: 'wrap',
                            marginBottom: '28px',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                <div style={{
                                    width: '44px',
                                    height: '44px',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: 'rgba(255,157,46,0.1)',
                                    border: '1px solid rgba(255,157,46,0.2)',
                                    flexShrink: 0,
                                }}>
                                    <SpotifyGlyph className="w-[22px] h-[22px]" />
                                </div>
                                <div>
                                    <div style={{
                                        fontSize: '18px',
                                        fontWeight: 700,
                                        letterSpacing: '-0.03em',
                                        color: '#ffffff',
                                        lineHeight: 1.2,
                                    }}>
                                        Playlist oficial
                                    </div>
                                    <div style={{
                                        fontSize: '12px',
                                        color: 'rgba(255,255,255,0.38)',
                                        marginTop: '3px',
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
                                        gap: '7px',
                                        height: '40px',
                                        padding: '0 18px',
                                        borderRadius: '999px',
                                        border: '1px solid rgba(255,255,255,0.13)',
                                        background: 'rgba(255,255,255,0.03)',
                                        color: 'rgba(255,255,255,0.76)',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        textDecoration: 'none',
                                        transition: 'background 0.2s ease, border-color 0.2s ease',
                                        flexShrink: 0,
                                    }}
                                    onMouseEnter={e => {
                                        (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.07)';
                                        (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(255,255,255,0.25)';
                                    }}
                                    onMouseLeave={e => {
                                        (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.03)';
                                        (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(255,255,255,0.13)';
                                    }}
                                >
                                    <SpotifyGlyph className="w-[15px] h-[15px]" />
                                    Abrir no Spotify
                                    <ArrowUpRight size={12} />
                                </a>
                            )}
                        </div>

                        {/* iframe */}
                        {PLAYLIST_ID ? (
                            <div style={{
                                borderRadius: '2px',
                                overflow: 'hidden',
                                border: '1px solid rgba(255,255,255,0.08)',
                                background: '#090909',
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
                                borderRadius: '2px',
                                border: '1px dashed rgba(255,255,255,0.14)',
                                background: '#090909',
                                padding: '48px 24px',
                                textAlign: 'center',
                            }}>
                                <p style={{ margin: 0, color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>
                                    Defina{' '}
                                    <code style={{ fontFamily: 'ui-monospace, monospace', color: '#FF9D2E' }}>VITE_SPOTIFY_PLAYLIST_ID</code>
                                    {' '}no <code style={{ fontFamily: 'ui-monospace, monospace', color: '#FF9D2E' }}>.env</code>
                                </p>
                            </div>
                        )}
                    </motion.section>

                    {/* VERSO CARD */}
                    <motion.section
                        initial={{ opacity: 0, y: reduce ? 0 : 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.75, delay: 0.18, ease: EASE }}
                        style={{
                            background: '#0b0b0b',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '4px',
                            padding: '48px 40px',
                            boxShadow: '0 30px 80px rgba(0,0,0,0.35)',
                            textAlign: 'center',
                        }}
                    >
                        <Eyebrow>Palavra do dia</Eyebrow>

                        <div style={{ margin: '32px 0 0', color: 'rgba(255,157,46,0.35)' }}>
                            <Quote size={28} />
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
                                    style={{ margin: 0, maxWidth: '480px' }}
                                >
                                    <p style={{
                                        margin: 0,
                                        fontSize: 'clamp(22px, 4vw, 32px)',
                                        lineHeight: 1.25,
                                        letterSpacing: '-0.04em',
                                        fontWeight: 650,
                                        color: '#ffffff',
                                    }}>
                                        "{verso.texto}"
                                    </p>
                                    <cite style={{
                                        display: 'block',
                                        marginTop: '20px',
                                        fontStyle: 'normal',
                                        fontSize: '9px',
                                        fontWeight: 700,
                                        letterSpacing: '.18em',
                                        textTransform: 'uppercase',
                                        color: '#FF9D2E',
                                    }}>
                                        {verso.ref}
                                    </cite>
                                </motion.blockquote>
                            </AnimatePresence>
                        </div>

                        {/* actions */}
                        <div style={{
                            marginTop: '36px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '11px',
                            flexWrap: 'wrap',
                        }}>
                            <button
                                type="button"
                                onClick={() => {
                                    sortear();
                                    trackEvent('click_sortear_versiculo', { metadata: { verso: verso.ref } });
                                }}
                                style={{
                                    height: '45px',
                                    padding: '0 22px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '9px',
                                    borderRadius: '999px',
                                    background: '#FF9D2E',
                                    color: '#070707',
                                    fontSize: '11px',
                                    fontWeight: 800,
                                    border: 'none',
                                    cursor: 'pointer',
                                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                                    fontFamily: 'inherit',
                                }}
                                onMouseEnter={e => {
                                    (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
                                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 12px 35px rgba(255,157,46,0.2)';
                                }}
                                onMouseLeave={e => {
                                    (e.currentTarget as HTMLButtonElement).style.transform = 'none';
                                    (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
                                }}
                            >
                                <RefreshCw size={14} />
                                Tirar uma mensagem
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    compartilhar();
                                    trackEvent('click_compartilhar_versiculo', { metadata: { verso: verso.ref } });
                                }}
                                style={{
                                    height: '45px',
                                    padding: '0 18px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '9px',
                                    borderRadius: '999px',
                                    border: '1px solid rgba(255,255,255,0.13)',
                                    background: 'rgba(255,255,255,0.025)',
                                    color: 'rgba(255,255,255,0.76)',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    transition: 'background 0.2s ease, border-color 0.2s ease',
                                    fontFamily: 'inherit',
                                }}
                                onMouseEnter={e => {
                                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)';
                                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.23)';
                                }}
                                onMouseLeave={e => {
                                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.025)';
                                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.13)';
                                }}
                            >
                                <Share2 size={14} />
                                {copiado ? 'Copiado!' : 'Compartilhar'}
                            </button>
                        </div>

                        <p style={{
                            margin: '28px auto 0',
                            fontSize: '11px',
                            color: 'rgba(255,255,255,0.22)',
                            maxWidth: '44ch',
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
                                color: 'rgba(255,255,255,0.38)',
                                fontSize: '11px',
                                fontWeight: 500,
                                letterSpacing: '0.01em',
                                textDecoration: 'none',
                                transition: 'color 0.2s ease',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.color = '#FF9D2E')}
                            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.38)')}
                        >
                            <ArrowLeft size={13} />
                            Voltar para a Raffros
                        </Link>
                    </div>
                </div>
            </main>

            {/* ── FOOTER ── */}
            <footer style={{
                position: 'relative',
                zIndex: 2,
                borderTop: '1px solid rgba(255,255,255,0.08)',
                padding: '40px 32px',
                textAlign: 'center',
            }}>
                <p style={{
                    margin: 0,
                    fontSize: '10px',
                    color: 'rgba(255,255,255,0.2)',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                }}>
                    © {new Date().getFullYear()} Raffros — Feito com fé e capricho.
                </p>
            </footer>
        </div>
    );
}
