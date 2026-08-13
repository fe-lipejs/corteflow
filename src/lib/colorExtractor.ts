// ─── Smart Color Extractor & Vibrancy Engine ─────────────────────────────────
// Extração inteligente de cores com análise HSL, clusterização de matiz (Hue Bucketing)
// e algoritmo de vibração (Vibrancy Scoring estilo Google Material You / Apple / Canva).

export interface ExtractedColor {
  hex: string;
  hsl: { h: number; s: number; l: number };
  score: number;
  population: number;
}

export interface ExtractedLogoPalette {
  dominant: string;
  palette: string[]; // Top 4-5 cores mais expressivas
}

/**
 * Converte RGB (0-255) para HSL (h: 0-360, s: 0-100, l: 0-100)
 */
export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * Converte HSL para Hex
 */
export function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;

  if (0 <= h && h < 60) {
    r = c; g = x; b = 0;
  } else if (60 <= h && h < 120) {
    r = x; g = c; b = 0;
  } else if (120 <= h && h < 180) {
    r = 0; g = c; b = x;
  } else if (180 <= h && h < 240) {
    r = 0; g = x; b = c;
  } else if (240 <= h && h < 300) {
    r = x; g = 0; b = c;
  } else if (300 <= h && h < 360) {
    r = c; g = 0; b = x;
  }

  const toHex = (n: number) => {
    const hex = Math.round((n + m) * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * Extrai a cor mais expressiva e a lista de cores da imagem
 */
export async function extractSmartPalette(imageUrl: string): Promise<ExtractedLogoPalette> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ dominant: '#C9963B', palette: ['#C9963B', '#1E293B', '#3B82F6', '#EF4444'] });
          return;
        }

        // Redimensiona para resolução suficiente para clustering
        const sampleSize = 80;
        canvas.width = sampleSize;
        canvas.height = sampleSize;
        ctx.drawImage(img, 0, 0, sampleSize, sampleSize);

        const imgData = ctx.getImageData(0, 0, sampleSize, sampleSize);
        const data = imgData.data;

        // 16 buckets de matiz (22.5 graus cada)
        const buckets: {
          [bucketKey: string]: {
            r: number;
            g: number;
            b: number;
            count: number;
            maxSat: number;
            hSum: number;
            sSum: number;
            lSum: number;
          };
        } = {};

        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3];
          if (a < 150) continue; // ignora pixels transparentes

          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          const hsl = rgbToHsl(r, g, b);

          // Filtra ruído extremo: quase preto absoluto (l < 8) ou quase branco puro (l > 94)
          if (hsl.l < 8 || hsl.l > 94) continue;

          // Chave do bucket por matiz quantizado (16 regiões de cor)
          const bucketIndex = Math.floor(hsl.h / 22.5) % 16;
          const satTier = hsl.s < 20 ? 'neutral' : 'vibrant';
          const key = `${bucketIndex}_${satTier}`;

          if (!buckets[key]) {
            buckets[key] = { r: 0, g: 0, b: 0, count: 0, maxSat: 0, hSum: 0, sSum: 0, lSum: 0 };
          }

          buckets[key].r += r;
          buckets[key].g += g;
          buckets[key].b += b;
          buckets[key].count++;
          buckets[key].hSum += hsl.h;
          buckets[key].sSum += hsl.s;
          buckets[key].lSum += hsl.l;
          if (hsl.s > buckets[key].maxSat) buckets[key].maxSat = hsl.s;
        }

        const candidates: ExtractedColor[] = [];

        Object.values(buckets).forEach((b) => {
          if (b.count < 10) return;

          const avgR = Math.round(b.r / b.count);
          const avgG = Math.round(b.g / b.count);
          const avgB = Math.round(b.b / b.count);
          const hsl = rgbToHsl(avgR, avgG, avgB);

          // Algoritmo de Pontuação de Vibração (Vibrancy Score)
          // Dá preferência a cores bem saturadas, com luminosidade entre 35% e 70% (ótimo para accent de UI)
          const satScore = (hsl.s / 100) * 2.2;
          const lumIdeal = 1 - Math.abs(hsl.l - 52) / 50; // Pico em 52% de luminosidade
          const lumScore = Math.max(0, lumIdeal) * 1.5;
          const popScore = Math.min(b.count / 300, 1) * 0.8;

          const score = satScore + lumScore + popScore;

          const hex = hslToHex(hsl.h, Math.max(hsl.s, 40), Math.min(Math.max(hsl.l, 35), 65));

          candidates.push({
            hex,
            hsl,
            score,
            population: b.count,
          });
        });

        // Ordena por pontuação de vivacidade e impacto
        candidates.sort((a, b) => b.score - a.score);

        if (candidates.length === 0) {
          resolve({ dominant: '#C9963B', palette: ['#C9963B', '#3B82F6', '#10B981', '#F59E0B'] });
          return;
        }

        // Filtra para remover cores excessivamente parecidas na paleta
        const distinctPalette: string[] = [];
        for (const cand of candidates) {
          const isTooSimilar = distinctPalette.some((existingHex) => {
            const rgb1 = hexToRgb(existingHex);
            const rgb2 = hexToRgb(cand.hex);
            if (!rgb1 || !rgb2) return false;
            const dist = Math.sqrt(
              Math.pow(rgb1.r - rgb2.r, 2) +
              Math.pow(rgb1.g - rgb2.g, 2) +
              Math.pow(rgb1.b - rgb2.b, 2)
            );
            return dist < 45; // Distância mínima de cor
          });

          if (!isTooSimilar) {
            distinctPalette.push(cand.hex);
          }
          if (distinctPalette.length >= 5) break;
        }

        const dominant = distinctPalette[0] || candidates[0].hex;

        resolve({
          dominant,
          palette: distinctPalette.length > 0 ? distinctPalette : [dominant],
        });
      } catch {
        resolve({ dominant: '#C9963B', palette: ['#C9963B', '#1E293B', '#3B82F6'] });
      }
    };

    img.onerror = () => {
      resolve({ dominant: '#C9963B', palette: ['#C9963B', '#1E293B', '#3B82F6'] });
    };

    img.src = imageUrl;
  });
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  if (hex.length !== 6) return null;
  return {
    r: parseInt(hex.substring(0, 2), 16),
    g: parseInt(hex.substring(2, 4), 16),
    b: parseInt(hex.substring(4, 6), 16),
  };
}

/**
 * Calcula a cor ideal do texto para botões e fundos (garante contraste AAA)
 */
export function getOptimalTextColor(bgColorHex: string): '#FFFFFF' | '#0F172A' {
  const rgb = hexToRgb(bgColorHex);
  if (!rgb) return '#FFFFFF';
  const lum = 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
  return lum > 145 ? '#0F172A' : '#FFFFFF';
}

/**
 * Gera paleta completa e profissional baseada na cor de destaque escolhida e no modo (Noturno/Claro)
 */
export function generatePaletteFromAccent(
  accentHex: string,
  mode: 'dark' | 'light' = 'dark'
): {
  primary: string;
  background: string;
  card: string;
  text: string;
  btnText: string;
  isDark: boolean;
} {
  const rgb = hexToRgb(accentHex) || { r: 201, g: 150, b: 59 };
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

  if (mode === 'dark') {
    // Modo Noturno Premium
    const bgHex = hslToHex(hsl.h, 10, 6); // Fundo ultra-escuro elegante (#0B0B0D)
    const cardHex = hslToHex(hsl.h, 12, 11); // Cartão refinado com elevação suave (#141418)

    // Ajusta o accent para brilhar perfeitamente no fundo escuro
    const calibratedAccent = hslToHex(hsl.h, Math.max(hsl.s, 60), Math.min(Math.max(hsl.l, 46), 65));
    const btnText = getOptimalTextColor(calibratedAccent);

    return {
      primary: calibratedAccent,
      background: bgHex,
      card: cardHex,
      text: '#FFFFFF',
      btnText,
      isDark: true,
    };
  } else {
    // Modo Claro / Diurno Luxuoso
    const bgHex = hslToHex(hsl.h, 15, 97); // Off-white límpido (#FAF9F6)
    const cardHex = '#FFFFFF';

    // Accent calibrado para contraste forte no fundo branco
    const calibratedAccent = hslToHex(hsl.h, Math.max(hsl.s, 70), Math.min(Math.max(hsl.l, 32), 48));
    const btnText = getOptimalTextColor(calibratedAccent);

    return {
      primary: calibratedAccent,
      background: bgHex,
      card: cardHex,
      text: '#0F172A',
      btnText,
      isDark: false,
    };
  }
}

/**
 * Função unificada chamada pela tela de configurações
 */
export async function generateSmartPaletteFromLogo(
  imageUrl: string,
  mode: 'dark' | 'light' = 'dark'
): Promise<{
  primary: string;
  background: string;
  card: string;
  text: string;
  btnText: string;
  isDark: boolean;
  extractedPalette: string[];
}> {
  const { dominant, palette } = await extractSmartPalette(imageUrl);
  const generated = generatePaletteFromAccent(dominant, mode);

  return {
    ...generated,
    extractedPalette: palette,
  };
}
