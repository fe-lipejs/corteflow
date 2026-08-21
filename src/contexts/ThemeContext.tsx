import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';

// ─── Theme Token Interface ────────────────────────────────────────────────────
export interface ThemeTokens {
  id: string;
  name: string;
  description: string;

  // Backgrounds
  bg: string;
  bgCard: string;
  bgInput: string;
  bgSidebar: string;
  bgHover: string;
  bgOverlay: string;
  bgGlass: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;

  // Accent / Brand
  accent: string;
  accentLight: string;
  accentMuted: string;
  accentGradient: string;
  accentHover: string;

  // Borders
  border: string;
  borderHover: string;
  borderActive: string;

  // Buttons
  btnPrimaryBg: string;
  btnPrimaryText: string;
  btnPrimaryHover: string;
  btnOutlineBorder: string;
  btnOutlineText: string;
  btnOutlineHoverBg: string;

  // Calendar
  calendarActiveBg: string;
  calendarActiveText: string;
  calendarAvailableBg: string;
  calendarUnavailableBg: string;

  // Inputs
  inputBg: string;
  inputBorder: string;
  inputFocusBorder: string;
  inputPlaceholder: string;
  inputText: string;

  // Cards / Glass
  cardBg: string;
  cardBorder: string;
  cardShadow: string;
  glassBlur: string;

  // Sidebar specific
  sidebarBg: string;
  sidebarBorder: string;
  sidebarHover: string;
  sidebarActiveItemBg: string;
  sidebarActiveItemText: string;

  // Status
  success: string;
  warning: string;
  error: string;
  info: string;

  // Shadows
  shadowSm: string;
  shadowMd: string;
  shadowLg: string;
  shadowAccent: string;

  // Typography
  fontSans: string;
  fontSerif: string;

  // Misc
  skeletonBase: string;
  skeletonShimmer: string;
  scrollbarThumb: string;
  scrollbarTrack: string;
}

// ─── Theme Presets ────────────────────────────────────────────────────────────

export const THEME_CLASSIC: ThemeTokens = {
  id: 'classic',
  name: 'Barbearia Clássica',
  description: 'Escuro, com dourado e navalha',

  bg: '#1A1714',
  bgCard: 'rgba(37, 33, 24, 0.8)',
  bgInput: '#1A1714',
  bgSidebar: '#141210',
  bgHover: '#1E1B17',
  bgOverlay: 'rgba(0, 0, 0, 0.6)',
  bgGlass: 'rgba(37, 33, 24, 0.7)',

  textPrimary: '#FFFFFF',
  textSecondary: '#A09888',
  textMuted: '#666666',
  textInverse: '#1A1714',

  accent: '#C9963B',
  accentLight: '#E8B86D',
  accentMuted: 'rgba(201, 150, 59, 0.15)',
  accentGradient: 'linear-gradient(135deg, #C9963B, #E8B960)',
  accentHover: '#D9A64B',

  border: '#2A2520',
  borderHover: '#3A3530',
  borderActive: '#C9963B',

  btnPrimaryBg: 'linear-gradient(135deg, #C9963B, #E8B960)',
  btnPrimaryText: '#1A1714',
  btnPrimaryHover: '0 0 20px rgba(201, 150, 59, 0.4)',
  btnOutlineBorder: '#2A2520',
  btnOutlineText: '#FFFFFF',
  btnOutlineHoverBg: 'rgba(201, 150, 59, 0.1)',

  calendarActiveBg: '#C9963B',
  calendarActiveText: '#1A1714',
  calendarAvailableBg: 'rgba(201, 150, 59, 0.1)',
  calendarUnavailableBg: 'rgba(255, 255, 255, 0.03)',

  inputBg: '#1A1714',
  inputBorder: '#2A2520',
  inputFocusBorder: '#C9963B',
  inputPlaceholder: '#666666',
  inputText: '#FFFFFF',

  cardBg: 'rgba(37, 33, 24, 0.8)',
  cardBorder: '#3A3530',
  cardShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  glassBlur: '12px',

  sidebarBg: 'rgba(20, 18, 16, 0.8)',
  sidebarBorder: '#2A2520',
  sidebarHover: '#1E1B17',
  sidebarActiveItemBg: '#C9963B',
  sidebarActiveItemText: '#1A1714',

  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',

  shadowSm: '0 1px 2px rgba(0, 0, 0, 0.3)',
  shadowMd: '0 4px 6px rgba(0, 0, 0, 0.3)',
  shadowLg: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
  shadowAccent: '0 0 20px rgba(201, 150, 59, 0.2)',

  fontSans: "'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  fontSerif: "'Playfair Display', Georgia, serif",

  skeletonBase: '#252118',
  skeletonShimmer: '#3A3530',
  scrollbarThumb: '#3A3530',
  scrollbarTrack: '#1A1714',
};

export const THEME_NOIR: ThemeTokens = {
  id: 'noir',
  name: 'Noir',
  description: 'Preto absoluto com dourado',

  bg: '#000000',
  bgCard: 'rgba(15, 15, 15, 0.9)',
  bgInput: '#0A0A0A',
  bgSidebar: '#050505',
  bgHover: '#111111',
  bgOverlay: 'rgba(0, 0, 0, 0.8)',
  bgGlass: 'rgba(10, 10, 10, 0.85)',

  textPrimary: '#FFFFFF',
  textSecondary: '#999999',
  textMuted: '#555555',
  textInverse: '#000000',

  accent: '#DE870D',
  accentLight: '#F5A623',
  accentMuted: 'rgba(222, 135, 13, 0.12)',
  accentGradient: 'linear-gradient(135deg, #DE870D, #F5A623)',
  accentHover: '#C67509',

  border: '#1A1A1A',
  borderHover: '#2A2A2A',
  borderActive: '#DE870D',

  btnPrimaryBg: 'linear-gradient(135deg, #DE870D, #F5A623)',
  btnPrimaryText: '#000000',
  btnPrimaryHover: '0 0 25px rgba(222, 135, 13, 0.5)',
  btnOutlineBorder: '#1A1A1A',
  btnOutlineText: '#FFFFFF',
  btnOutlineHoverBg: 'rgba(222, 135, 13, 0.08)',

  calendarActiveBg: '#DE870D',
  calendarActiveText: '#000000',
  calendarAvailableBg: 'rgba(222, 135, 13, 0.08)',
  calendarUnavailableBg: 'rgba(255, 255, 255, 0.02)',

  inputBg: '#0A0A0A',
  inputBorder: '#1A1A1A',
  inputFocusBorder: '#DE870D',
  inputPlaceholder: '#444444',
  inputText: '#FFFFFF',

  cardBg: 'rgba(15, 15, 15, 0.9)',
  cardBorder: '#1A1A1A',
  cardShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
  glassBlur: '16px',

  sidebarBg: 'rgba(5, 5, 5, 0.9)',
  sidebarBorder: '#1A1A1A',
  sidebarHover: '#111111',
  sidebarActiveItemBg: '#DE870D',
  sidebarActiveItemText: '#000000',

  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',

  shadowSm: '0 1px 2px rgba(0, 0, 0, 0.5)',
  shadowMd: '0 4px 6px rgba(0, 0, 0, 0.5)',
  shadowLg: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
  shadowAccent: '0 0 25px rgba(222, 135, 13, 0.3)',

  fontSans: "'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  fontSerif: "'Playfair Display', Georgia, serif",

  skeletonBase: '#111111',
  skeletonShimmer: '#1A1A1A',
  scrollbarThumb: '#2A2A2A',
  scrollbarTrack: '#000000',
};

export const THEME_ELEGANT: ThemeTokens = {
  id: 'elegant',
  name: 'Modo Claro',
  description: 'Branco puro, limpo e profissional com toque âmbar',

  bg: '#F8FAFC',
  bgCard: '#FFFFFF',
  bgInput: '#FFFFFF',
  bgSidebar: '#FFFFFF',
  bgHover: '#F1F5F9',
  bgOverlay: 'rgba(15, 23, 42, 0.4)',
  bgGlass: 'rgba(255, 255, 255, 0.95)',

  textPrimary: '#0F172A',
  textSecondary: '#334155',
  textMuted: '#64748B',
  textInverse: '#FFFFFF',

  accent: '#DE870D',
  accentLight: '#F5A623',
  accentMuted: 'rgba(222, 135, 13, 0.12)',
  accentGradient: 'linear-gradient(135deg, #DE870D, #F5A623)',
  accentHover: '#C67509',

  border: '#E2E8F0',
  borderHover: '#CBD5E1',
  borderActive: '#DE870D',

  btnPrimaryBg: 'linear-gradient(135deg, #DE870D, #F5A623)',
  btnPrimaryText: '#FFFFFF',
  btnPrimaryHover: 'none',
  btnOutlineBorder: '#E2E8F0',
  btnOutlineText: '#0F172A',
  btnOutlineHoverBg: '#F1F5F9',

  calendarActiveBg: '#DE870D',
  calendarActiveText: '#FFFFFF',
  calendarAvailableBg: 'rgba(222, 135, 13, 0.08)',
  calendarUnavailableBg: '#F8FAFC',

  inputBg: '#FFFFFF',
  inputBorder: '#CBD5E1',
  inputFocusBorder: '#DE870D',
  inputPlaceholder: '#94A3B8',
  inputText: '#0F172A',

  cardBg: '#FFFFFF',
  cardBorder: '#E2E8F0',
  cardShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)',
  glassBlur: '16px',

  sidebarBg: '#FFFFFF',
  sidebarBorder: '#E2E8F0',
  sidebarHover: '#F1F5F9',
  sidebarActiveItemBg: '#DE870D',
  sidebarActiveItemText: '#FFFFFF',

  success: '#16a34a',
  warning: '#d97706',
  error: '#dc2626',
  info: '#2563eb',

  shadowSm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  shadowMd: '0 4px 6px -1px rgba(0, 0, 0, 0.07)',
  shadowLg: '0 10px 15px -3px rgba(0, 0, 0, 0.08)',
  shadowAccent: 'none',

  fontSans: "'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  fontSerif: "'Playfair Display', Georgia, serif",

  skeletonBase: '#F1F5F9',
  skeletonShimmer: '#E2E8F0',
  scrollbarThumb: '#CBD5E1',
  scrollbarTrack: '#F8FAFC',
};

export type FontStyle = 'serif' | 'sans';

export interface CustomPaletteConfig {
  primary?: string;
  background?: string;
  text?: string;
  card?: string;
  fontStyle?: FontStyle;
}

// ─── Theme Map ────────────────────────────────────────────────────────────────
export const THEMES: Record<string, ThemeTokens> = {
  classic: THEME_CLASSIC,
  noir: THEME_NOIR,
  elegant: THEME_ELEGANT,
};

// ─── Context ──────────────────────────────────────────────────────────────────
interface ThemeContextType {
  theme: ThemeTokens;
  themeId: string;
  fontStyle: FontStyle;
  setFontStyle: (style: FontStyle) => void;
  setThemeId: (id: string) => void;
  setCustomPalette: (palette: CustomPaletteConfig | undefined) => void;
  themes: typeof THEMES;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// ─── Apply CSS Variables ──────────────────────────────────────────────────────
function applyThemeToDOM(tokens: ThemeTokens) {
  const root = document.documentElement;

  root.style.setProperty('--theme-bg', tokens.bg);
  root.style.setProperty('--theme-bg-card', tokens.bgCard);
  root.style.setProperty('--theme-bg-input', tokens.bgInput);
  root.style.setProperty('--theme-bg-sidebar', tokens.bgSidebar);
  root.style.setProperty('--theme-bg-hover', tokens.bgHover);
  root.style.setProperty('--theme-bg-overlay', tokens.bgOverlay);
  root.style.setProperty('--theme-bg-glass', tokens.bgGlass);

  root.style.setProperty('--theme-text-primary', tokens.textPrimary);
  root.style.setProperty('--theme-text-secondary', tokens.textSecondary);
  root.style.setProperty('--theme-text-muted', tokens.textMuted);
  root.style.setProperty('--theme-text-inverse', tokens.textInverse);

  root.style.setProperty('--theme-accent', tokens.accent);
  root.style.setProperty('--theme-accent-light', tokens.accentLight);
  root.style.setProperty('--theme-accent-muted', tokens.accentMuted);
  root.style.setProperty('--theme-accent-gradient', tokens.accentGradient);
  root.style.setProperty('--theme-accent-hover', tokens.accentHover);

  root.style.setProperty('--theme-border', tokens.border);
  root.style.setProperty('--theme-border-hover', tokens.borderHover);
  root.style.setProperty('--theme-border-active', tokens.borderActive);

  root.style.setProperty('--theme-btn-primary-bg', tokens.btnPrimaryBg);
  root.style.setProperty('--theme-btn-primary-text', tokens.btnPrimaryText);
  root.style.setProperty('--theme-btn-primary-hover', tokens.btnPrimaryHover);

  root.style.setProperty('--theme-calendar-active-bg', tokens.calendarActiveBg);
  root.style.setProperty('--theme-calendar-active-text', tokens.calendarActiveText);
  root.style.setProperty('--theme-calendar-available-bg', tokens.calendarAvailableBg);

  root.style.setProperty('--theme-input-bg', tokens.inputBg);
  root.style.setProperty('--theme-input-border', tokens.inputBorder);
  root.style.setProperty('--theme-input-focus-border', tokens.inputFocusBorder);
  root.style.setProperty('--theme-input-placeholder', tokens.inputPlaceholder);
  root.style.setProperty('--theme-input-text', tokens.inputText);

  root.style.setProperty('--theme-card-bg', tokens.cardBg);
  root.style.setProperty('--theme-card-border', tokens.cardBorder);
  root.style.setProperty('--theme-card-shadow', tokens.cardShadow);
  root.style.setProperty('--theme-glass-blur', tokens.glassBlur);

  root.style.setProperty('--theme-sidebar-bg', tokens.sidebarBg);
  root.style.setProperty('--theme-sidebar-border', tokens.sidebarBorder);
  root.style.setProperty('--theme-sidebar-hover', tokens.sidebarHover);
  root.style.setProperty('--theme-sidebar-active-bg', tokens.sidebarActiveItemBg);
  root.style.setProperty('--theme-sidebar-active-text', tokens.sidebarActiveItemText);

  root.style.setProperty('--theme-success', tokens.success);
  root.style.setProperty('--theme-warning', tokens.warning);
  root.style.setProperty('--theme-error', tokens.error);
  root.style.setProperty('--theme-info', tokens.info);

  root.style.setProperty('--theme-shadow-sm', tokens.shadowSm);
  root.style.setProperty('--theme-shadow-md', tokens.shadowMd);
  root.style.setProperty('--theme-shadow-lg', tokens.shadowLg);
  root.style.setProperty('--theme-shadow-accent', tokens.shadowAccent);

  root.style.setProperty('--theme-font-sans', tokens.fontSans);
  root.style.setProperty('--theme-font-serif', tokens.fontSerif);

  root.style.setProperty('--theme-skeleton-base', tokens.skeletonBase);
  root.style.setProperty('--theme-skeleton-shimmer', tokens.skeletonShimmer);
  root.style.setProperty('--theme-scrollbar-thumb', tokens.scrollbarThumb);
  root.style.setProperty('--theme-scrollbar-track', tokens.scrollbarTrack);

  // Also update body background directly for immediate visual feedback
  document.body.style.background = tokens.bg;
  document.body.style.color = tokens.textPrimary;
}

// ─── Helper for Dynamic Gradients ─────────────────────────────────────────────
export function adjustColorBrightness(hexColor: string, percent: number): string {
  const cleanHex = hexColor.replace('#', '');
  if (cleanHex.length !== 6) return hexColor;
  let r = parseInt(cleanHex.substring(0, 2), 16) || 0;
  let g = parseInt(cleanHex.substring(2, 4), 16) || 0;
  let b = parseInt(cleanHex.substring(4, 6), 16) || 0;

  r = Math.min(255, Math.max(0, Math.round(r + (255 - r) * (percent / 100))));
  g = Math.min(255, Math.max(0, Math.round(g + (255 - g) * (percent / 100))));
  b = Math.min(255, Math.max(0, Math.round(b + (255 - b) * (percent / 100))));

  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export const ThemeProvider: React.FC<{
  children: React.ReactNode;
  initialThemeId?: string;
  initialCustomPalette?: CustomPaletteConfig;
}> = ({
  children,
  initialThemeId = 'elegant',
  initialCustomPalette = { primary: '#DE870D', fontStyle: 'sans' },
}) => {
  const [themeId, setThemeId] = useState(initialThemeId);
  const [customPalette, setCustomPalette] = useState<CustomPaletteConfig | undefined>(initialCustomPalette);
  const [fontStyle, setFontStyle] = useState<FontStyle>(
    initialCustomPalette?.fontStyle || 'sans'
  );

  const theme = useMemo(() => {
    const baseTheme = THEMES[themeId] || THEME_ELEGANT;
    const isLightMode = themeId === 'elegant' || baseTheme.id === 'elegant';

    // Apply font override
    const activeFontStyle = customPalette?.fontStyle || fontStyle;
    const resolvedFontSerif = activeFontStyle === 'sans'
      ? "'Plus Jakarta Sans', 'Inter', -apple-system, sans-serif"
      : "'Playfair Display', Georgia, serif";

    let btnTextColor = baseTheme.btnPrimaryText;
    if (customPalette?.primary) {
      // Calculate luminance for high contrast text on buttons
      const hex = customPalette.primary.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16) || 201;
      const g = parseInt(hex.substring(2, 4), 16) || 150;
      const b = parseInt(hex.substring(4, 6), 16) || 59;
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      btnTextColor = lum > 145 ? '#000000' : '#FFFFFF';
    }

    return {
      ...baseTheme,
      fontSerif: resolvedFontSerif,
      ...(isLightMode && {
        shadowAccent: 'none',
        btnPrimaryHover: 'none',
        cardShadow: 'none',
        shadowSm: 'none',
        shadowMd: 'none',
        shadowLg: 'none',
      }),
      ...(customPalette?.background && { bg: customPalette.background }),
      ...(customPalette?.card && {
        cardBg: customPalette.card,
        bgCard: customPalette.card,
      }),
      ...(customPalette?.text && { textPrimary: customPalette.text }),
      ...(customPalette?.primary && {
        accent: customPalette.primary,
        accentLight: adjustColorBrightness(customPalette.primary, 15),
        accentHover: adjustColorBrightness(customPalette.primary, 8),
        accentMuted: `${customPalette.primary}25`,
        accentGradient: `linear-gradient(135deg, ${customPalette.primary}, ${adjustColorBrightness(customPalette.primary, 18)})`,
        btnPrimaryBg: `linear-gradient(135deg, ${customPalette.primary}, ${adjustColorBrightness(customPalette.primary, 18)})`,
        btnPrimaryText: btnTextColor,
        btnPrimaryHover: isLightMode ? 'none' : `0 0 20px ${customPalette.primary}60`,
        borderActive: customPalette.primary,
        inputFocusBorder: customPalette.primary,
        calendarActiveBg: customPalette.primary,
        calendarActiveText: btnTextColor,
        calendarAvailableBg: `${customPalette.primary}18`,
        sidebarActiveItemBg: customPalette.primary,
        sidebarActiveItemText: btnTextColor,
        shadowAccent: isLightMode ? 'none' : `0 0 25px ${customPalette.primary}40`,
      }),
    };
  }, [themeId, customPalette, fontStyle]);

  useEffect(() => {
    applyThemeToDOM(theme);
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      themeId,
      fontStyle,
      setFontStyle: (s: FontStyle) => {
        setFontStyle(s);
        setCustomPalette(prev => ({ ...prev, fontStyle: s }));
      },
      setThemeId,
      setCustomPalette,
      themes: THEMES,
    }),
    [theme, themeId, fontStyle]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// ─── Utility: Get theme by ID (for public pages that load theme from DB) ─────
export function getThemeById(id: string): ThemeTokens {
  return THEMES[id] || THEME_CLASSIC;
}

