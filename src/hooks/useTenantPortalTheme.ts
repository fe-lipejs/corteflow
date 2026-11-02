import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../integrations/supabase/client';
import {
  getThemeById,
  adjustColorBrightness,
  normalizeAccentColor,
  DEFAULT_ACCENT,
  type ThemeTokens,
} from '../contexts/ThemeContext';

export interface PortalThemeInfo {
  accent: string;
  bg: string;
  textPrimary: string;
  textMuted: string;
  cardBg: string;
  cardBorder: string;
  logoUrl: string | null;
  name: string | null;
  isDark: boolean;
  theme: ThemeTokens;
}

const STORAGE_PREFIX = 'corte_portal_theme_';

/**
 * Builds a complete PortalThemeInfo object based on preset, custom palette, and salon branding.
 */
export function buildPortalTheme(
  themePreset?: string | null,
  customPalette?: any | null,
  logoUrl?: string | null,
  name?: string | null
): PortalThemeInfo {
  const presetId = themePreset || 'classic';
  const base = getThemeById(presetId);

  const rawPrimary = customPalette?.primary ? normalizeAccentColor(customPalette.primary) : null;
  const accent = rawPrimary || base.accent || DEFAULT_ACCENT;

  const bgHex = (customPalette?.background || base.bg || '#09090b').replace('#', '');
  const bgR = parseInt(bgHex.substring(0, 2), 16) || 14;
  const bgG = parseInt(bgHex.substring(2, 4), 16) || 16;
  const bgB = parseInt(bgHex.substring(4, 6), 16) || 19;
  const bgLum = 0.2126 * bgR + 0.7152 * bgG + 0.0722 * bgB;
  const isDark = bgLum < 135;

  const textPrimary = customPalette?.text || (isDark ? '#FFFFFF' : '#0F172A');
  const textMuted = isDark ? '#71717A' : '#64748B';
  const textSecondary = isDark ? '#A1A1AA' : '#475569';
  const border = isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0';
  const cardBg = customPalette?.card || (isDark ? '#121417' : '#FFFFFF');

  let btnTextColor = base.btnPrimaryText;
  if (accent) {
    const hex = accent.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16) || 201;
    const g = parseInt(hex.substring(2, 4), 16) || 150;
    const b = parseInt(hex.substring(4, 6), 16) || 59;
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    btnTextColor = customPalette?.btnTextColor || (lum > 145 ? '#0F172A' : '#FFFFFF');
  }

  const resolvedTheme: ThemeTokens = {
    ...base,
    bg: customPalette?.background || base.bg,
    textPrimary,
    textSecondary,
    textMuted,
    border,
    cardBorder: border,
    cardBg,
    accent,
    accentLight: adjustColorBrightness(accent, 15),
    accentHover: adjustColorBrightness(accent, 8),
    accentMuted: `${accent}25`,
    accentGradient: `linear-gradient(135deg, ${accent}, ${accent})`,
    btnPrimaryBg: `linear-gradient(135deg, ${accent}, ${accent})`,
    btnPrimaryText: btnTextColor,
    btnPrimaryHover: 'none',
    borderActive: accent,
    inputFocusBorder: accent,
    calendarActiveBg: accent,
    calendarActiveText: btnTextColor,
    calendarAvailableBg: `${accent}18`,
  };

  return {
    accent,
    bg: customPalette?.background || base.bg,
    textPrimary,
    textMuted,
    cardBg,
    cardBorder: border,
    logoUrl: logoUrl || null,
    name: name || null,
    isDark,
    theme: resolvedTheme,
  };
}

/**
 * Reads cached portal theme from localStorage synchronously to ensure instant 0ms first render.
 */
export function getCachedPortalTheme(slug?: string | null): PortalThemeInfo | null {
  if (!slug || typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${slug}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return buildPortalTheme(
      parsed.themePreset,
      parsed.customPalette,
      parsed.logoUrl,
      parsed.name
    );
  } catch {
    return null;
  }
}

/**
 * Persists portal theme to localStorage for future instant loads.
 */
export function saveCachedPortalTheme(
  slug: string,
  themePreset?: string | null,
  customPalette?: any | null,
  logoUrl?: string | null,
  name?: string | null
) {
  if (!slug || typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      `${STORAGE_PREFIX}${slug}`,
      JSON.stringify({
        themePreset,
        customPalette,
        logoUrl,
        name,
        updatedAt: Date.now(),
      })
    );
  } catch (err) {
    console.error('Error saving portal theme cache:', err);
  }
}

/**
 * Hook to resolve the salon/tenant theme and accent color for public portal and loading states.
 */
export function useTenantPortalTheme(
  slug?: string | null,
  storeSettings?: any | null,
  storeTenant?: any | null
): PortalThemeInfo {
  // 1. Initial synchronous state from localStorage or default
  const [cachedInfo, setCachedInfo] = useState<PortalThemeInfo>(() => {
    const fromCache = getCachedPortalTheme(slug);
    if (fromCache) return fromCache;
    return buildPortalTheme('classic', null, null, null);
  });

  // Re-read cache whenever slug changes
  useEffect(() => {
    if (slug) {
      const fromCache = getCachedPortalTheme(slug);
      if (fromCache) {
        setCachedInfo(fromCache);
      }
    }
  }, [slug]);

  // 2. When storeSettings or storeTenant is provided, update immediately and persist to cache
  useEffect(() => {
    if (storeSettings || storeTenant) {
      const updated = buildPortalTheme(
        storeSettings?.theme_preset,
        storeSettings?.custom_palette,
        storeSettings?.logo_url,
        storeSettings?.fantasy_name || storeTenant?.name
      );
      setCachedInfo(updated);
      if (slug) {
        saveCachedPortalTheme(
          slug,
          storeSettings?.theme_preset,
          storeSettings?.custom_palette,
          storeSettings?.logo_url,
          storeSettings?.fantasy_name || storeTenant?.name
        );
      }
    }
  }, [slug, storeSettings, storeTenant]);

  // 3. Fast lightweight query if neither storeSettings nor valid cache is present
  const { data: fastThemeData } = useQuery({
    queryKey: ['tenant-fast-theme', slug],
    queryFn: async () => {
      if (!slug) return null;

      // 3.1 Check demo_portals
      const { data: demo } = await supabase
        .from('demo_portals')
        .select('business_name, logo_url, primary_color')
        .eq('slug', slug)
        .maybeSingle();

      if (demo) {
        return {
          themePreset: 'elegant',
          customPalette: { primary: demo.primary_color || DEFAULT_ACCENT },
          logoUrl: demo.logo_url,
          name: demo.business_name,
        };
      }

      // 3.2 Check real tenants
      const { data: tenant } = await supabase
        .from('tenants')
        .select('id, name, slug')
        .eq('slug', slug)
        .maybeSingle();

      if (!tenant) return null;

      const { data: settings } = await supabase
        .from('tenant_settings')
        .select('theme_preset, custom_palette, logo_url, fantasy_name')
        .eq('tenant_id', tenant.id)
        .maybeSingle();

      return {
        themePreset: settings?.theme_preset || 'classic',
        customPalette: settings?.custom_palette || null,
        logoUrl: settings?.logo_url || null,
        name: settings?.fantasy_name || tenant.name || null,
      };
    },
    enabled: !!slug && !storeSettings,
    staleTime: 1000 * 60 * 5, // 5 min
  });

  useEffect(() => {
    if (fastThemeData && !storeSettings && slug) {
      const resolved = buildPortalTheme(
        fastThemeData.themePreset,
        fastThemeData.customPalette,
        fastThemeData.logoUrl,
        fastThemeData.name
      );
      setCachedInfo(resolved);
      saveCachedPortalTheme(
        slug,
        fastThemeData.themePreset,
        fastThemeData.customPalette,
        fastThemeData.logoUrl,
        fastThemeData.name
      );
    }
  }, [fastThemeData, storeSettings, slug]);

  return cachedInfo;
}
