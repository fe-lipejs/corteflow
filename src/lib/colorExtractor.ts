export async function extractDominantColor(imageUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas not supported'));
        return;
      }
      
      // Scale down image to make processing faster and naturally "average" the colors
      canvas.width = 50;
      canvas.height = 50;
      ctx.drawImage(img, 0, 0, 50, 50);
      
      const imgData = ctx.getImageData(0, 0, 50, 50);
      const data = imgData.data;
      
      let r = 0, g = 0, b = 0, count = 0;
      
      // Sample every 4th pixel (4 bytes per pixel)
      for (let i = 0; i < data.length; i += 16) {
        // Skip pixels that are too dark (close to black) or too bright (close to white) or transparent
        if (data[i+3] < 128) continue; // transparent
        
        const avg = (data[i] + data[i+1] + data[i+2]) / 3;
        // Avoid pure whites and pure blacks from dominating the logo color
        if (avg < 20 || avg > 240) continue;

        r += data[i];
        g += data[i+1];
        b += data[i+2];
        count++;
      }
      
      if (count === 0) {
        // fallback to average of ALL opaque pixels if we filtered out everything
        for (let i = 0; i < data.length; i += 4) {
          if (data[i+3] >= 128) {
            r += data[i];
            g += data[i+1];
            b += data[i+2];
            count++;
          }
        }
      }

      if (count === 0) {
        resolve('#C9963B'); // Fallback default
        return;
      }

      r = Math.floor(r / count);
      g = Math.floor(g / count);
      b = Math.floor(b / count);

      // Convert to hex
      const hex = '#' + [r, g, b].map(x => {
        const hexStr = x.toString(16);
        return hexStr.length === 1 ? '0' + hexStr : hexStr;
      }).join('');

      resolve(hex);
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageUrl;
  });
}

/**
 * Calculates a slightly lighter or darker variant of a hex color
 */
export function adjustColor(hex: string, percent: number): string {
  // percent > 0 lightens, < 0 darkens
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  
  let r = parseInt(hex.substring(0, 2), 16);
  let g = parseInt(hex.substring(2, 4), 16);
  let b = parseInt(hex.substring(4, 6), 16);

  r = Math.min(255, Math.max(0, Math.floor(r * (1 + percent))));
  g = Math.min(255, Math.max(0, Math.floor(g * (1 + percent))));
  b = Math.min(255, Math.max(0, Math.floor(b * (1 + percent))));

  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

/**
 * Analisa a cor da logo e gera uma paleta completa inteligente e balanceada
 * com base na luminância, garantindo contraste AAA perfeito em fundos escuros ou claros.
 */
export async function generateSmartPaletteFromLogo(
  imageUrl: string,
  mode: 'dark' | 'light' = 'dark'
): Promise<{
  primary: string;
  background: string;
  card: string;
  text: string;
  isDark: boolean;
}> {
  const dominant = await extractDominantColor(imageUrl);

  // Calcula componentes numéricos
  const cleanHex = dominant.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) || 201;
  const g = parseInt(cleanHex.substring(2, 4), 16) || 150;
  const b = parseInt(cleanHex.substring(4, 6), 16) || 59;
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;

  if (mode === 'dark') {
    // Matiz sutil da logo misturada ao fundo escuro (estilo Apple/Spotify)
    const bgR = Math.max(10, Math.min(24, Math.floor(r * 0.08)));
    const bgG = Math.max(10, Math.min(24, Math.floor(g * 0.08)));
    const bgB = Math.max(10, Math.min(24, Math.floor(b * 0.08)));
    const bgHex = '#' + [bgR, bgG, bgB].map(x => x.toString(16).padStart(2, '0')).join('');

    const cardR = Math.max(18, Math.min(32, Math.floor(r * 0.12)));
    const cardG = Math.max(18, Math.min(32, Math.floor(g * 0.12)));
    const cardB = Math.max(18, Math.min(32, Math.floor(b * 0.12)));
    const cardHex = '#' + [cardR, cardG, cardB].map(x => x.toString(16).padStart(2, '0')).join('');

    return {
      primary: dominant,
      background: bgHex,
      card: cardHex,
      text: '#FFFFFF',
      isDark: true,
    };
  } else {
    // Modo Claro (Salão Elegante) — Suave e iluminado com matiz sutil
    const bgR = Math.min(250, Math.max(242, 245 + Math.floor(r * 0.03)));
    const bgG = Math.min(250, Math.max(242, 242 + Math.floor(g * 0.03)));
    const bgB = Math.min(250, Math.max(235, 237 + Math.floor(b * 0.03)));
    const bgHex = '#' + [bgR, bgG, bgB].map(x => x.toString(16).padStart(2, '0')).join('');

    return {
      primary: dominant,
      background: bgHex,
      card: '#FFFFFF',
      text: '#1A1311',
      isDark: false,
    };
  }
}
