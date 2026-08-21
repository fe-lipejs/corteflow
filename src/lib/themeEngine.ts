// ─── Theme & Contrast Engine ───────────────────────────────────────────────
// Motor dinâmico para garantir legibilidade, contraste e estética premium
// em qualquer tema (Dark, Light, Classic, Noir, Elegant, Customizado)
// mesmo com fotos de banner com áreas claras, reflexos ou fundos complexos.

import type { ThemeTokens } from "../contexts/ThemeContext";

/**
 * Converte qualquer string de cor (hex, rgb, rgba) para valores numéricos [r, g, b, a]
 */
export function parseColor(color: string): { r: number; g: number; b: number; a: number } {
  if (!color || typeof color !== "string") {
    return { r: 20, g: 20, b: 20, a: 1 };
  }

  const trimmed = color.trim().toLowerCase();

  // Hex: #fff ou #ffffff ou #ffffff80
  if (trimmed.startsWith("#")) {
    let hex = trimmed.slice(1);
    if (hex.length === 3) {
      hex = hex.split("").map((c) => c + c).join("");
    }
    if (hex.length === 6) {
      const num = parseInt(hex, 16);
      return {
        r: (num >> 16) & 255,
        g: (num >> 8) & 255,
        b: num & 255,
        a: 1,
      };
    }
    if (hex.length === 8) {
      const num = parseInt(hex, 16);
      return {
        r: (num >> 24) & 255,
        g: (num >> 16) & 255,
        b: (num >> 8) & 255,
        a: (num & 255) / 255,
      };
    }
  }

  // RGB ou RGBA: rgba(37, 33, 24, 0.8)
  const rgbaMatch = trimmed.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/);
  if (rgbaMatch) {
    return {
      r: parseInt(rgbaMatch[1], 10),
      g: parseInt(rgbaMatch[2], 10),
      b: parseInt(rgbaMatch[3], 10),
      a: rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 1,
    };
  }

  return { r: 20, g: 20, b: 20, a: 1 };
}

/**
 * Calcula a luminosidade percebida de 0 (preto absoluto) a 255 (branco puro)
 */
export function getLuminance(color: string): number {
  const { r, g, b } = parseColor(color);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Retorna se uma cor é considerada escura (luminância < 135)
 */
export function isDarkColor(color: string): boolean {
  return getLuminance(color) < 135;
}

export interface ContrastTokens {
  isDark: boolean;
  isLight: boolean;
  
  // Banner & Backdrop Overlays
  bannerVignette: string;
  bannerGradient: string;
  bannerBackdropFilter: string;
  
  // Glassmorphism Badges & Cards
  heroInfoCardBg: string;
  heroInfoCardBorder: string;
  heroInfoCardShadow: string;
  
  // Rating Pill
  ratingPillBg: string;
  ratingPillBorder: string;
  ratingPillText: string;
  
  // Description & Text Contrast
  titleColor: string;
  titleTextShadow: string;
  descriptionColor: string;
  descriptionTextShadow: string;
  
  // Social Action Buttons
  socialBtnBg: string;
  socialBtnBorder: string;
  socialBtnHoverBg: string;
  socialBtnHoverBorder: string;
  socialIconColor: string;
  
  // Quick Info Cards (Horários, Endereço)
  quickCardBg: string;
  quickCardBorder: string;
  quickCardHoverBg: string;
}

/**
 * Motor de Contraste e Apresentação Visual
 * Recebe o objeto theme e gera tokens de alta legibilidade e contraste evidente.
 */
export function getThemeContrastEngine(theme: ThemeTokens): ContrastTokens {
  const cardBgLuminance = getLuminance(theme.cardBg || theme.bg);
  const isDark = cardBgLuminance < 135;
  const isLight = !isDark;

  // Extrair componentes RGB da cor de card para fusão perfeita no gradiente
  const { r, g, b } = parseColor(theme.cardBg || theme.bg);
  const rgbBase = `${r}, ${g}, ${b}`;

  if (isDark) {
    return {
      isDark: true,
      isLight: false,

      // Camada 1: Vinheta fotográfica suave no topo
      bannerVignette: "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.05) 25%, rgba(0,0,0,0.4) 100%)",
      
      // Camada 2: Degradê contínuo multi-stop que transiciona suavemente e atinge 100% de opacidade antes dos textos
      bannerGradient: `linear-gradient(to bottom, rgba(${rgbBase}, 0) 0%, rgba(${rgbBase}, 0.08) 20%, rgba(${rgbBase}, 0.55) 38%, rgba(${rgbBase}, 0.95) 54%, rgba(${rgbBase}, 1) 68%, rgba(${rgbBase}, 1) 100%)`,
      
      bannerBackdropFilter: "none",

      // Container de proteção para as informações no hero
      heroInfoCardBg: "transparent",
      heroInfoCardBorder: "transparent",
      heroInfoCardShadow: "none",

      // Badge de estrelas
      ratingPillBg: "rgba(255, 255, 255, 0.08)",
      ratingPillBorder: "rgba(255, 255, 255, 0.12)",
      ratingPillText: "#FFFFFF",

      // Sombras de texto limpas e naturais
      titleColor: "#FFFFFF",
      titleTextShadow: "0 2px 10px rgba(0, 0, 0, 0.6)",
      descriptionColor: "#CBD5E1", // Slate-300 suave e super nítido
      descriptionTextShadow: "none",

      // Botões Sociais
      socialBtnBg: "rgba(255, 255, 255, 0.08)",
      socialBtnBorder: "rgba(255, 255, 255, 0.14)",
      socialBtnHoverBg: "rgba(255, 255, 255, 0.18)",
      socialBtnHoverBorder: `${theme.accent}80`,
      socialIconColor: "#F8FAFC",

      // Cartões rápidos
      quickCardBg: "rgba(255, 255, 255, 0.04)",
      quickCardBorder: "rgba(255, 255, 255, 0.08)",
      quickCardHoverBg: "rgba(255, 255, 255, 0.08)",
    };
  } else {
    // Tema Claro (ex: Salão Elegante, fundo Rosé/Bege/Branco)
    return {
      isDark: false,
      isLight: true,

      // Camada 1: Vinheta suave
      bannerVignette: "linear-gradient(to bottom, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.02) 25%, rgba(0,0,0,0.18) 100%)",
      
      // Camada 2: Degradê contínuo multi-stop que transiciona suavemente e atinge 100% de opacidade antes dos textos
      bannerGradient: `linear-gradient(to bottom, rgba(${rgbBase}, 0) 0%, rgba(${rgbBase}, 0.12) 20%, rgba(${rgbBase}, 0.60) 38%, rgba(${rgbBase}, 0.96) 54%, rgba(${rgbBase}, 1) 68%, rgba(${rgbBase}, 1) 100%)`,
      
      bannerBackdropFilter: "none",

      // Container de proteção para as informações no hero
      heroInfoCardBg: "transparent",
      heroInfoCardBorder: "transparent",
      heroInfoCardShadow: "none",

      // Badge de estrelas
      ratingPillBg: "rgba(0, 0, 0, 0.04)",
      ratingPillBorder: "rgba(0, 0, 0, 0.08)",
      ratingPillText: "#1E293B",

      // Sombras de texto
      titleColor: "#0F172A",
      titleTextShadow: "none",
      descriptionColor: "#334155", // Slate-700 escuro e de alta legibilidade
      descriptionTextShadow: "none",

      // Botões Sociais
      socialBtnBg: "rgba(0, 0, 0, 0.04)",
      socialBtnBorder: "rgba(0, 0, 0, 0.08)",
      socialBtnHoverBg: "rgba(0, 0, 0, 0.08)",
      socialBtnHoverBorder: `${theme.accent}90`,
      socialIconColor: "#1E293B",

      // Cartões rápidos
      quickCardBg: "rgba(0, 0, 0, 0.03)",
      quickCardBorder: "rgba(0, 0, 0, 0.06)",
      quickCardHoverBg: "rgba(0, 0, 0, 0.06)",
    };
  }
}

