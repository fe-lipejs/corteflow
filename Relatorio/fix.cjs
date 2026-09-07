const fs = require('fs');
const htmlPath = 'C:/CorteFlow2/navalha/Relatorio/Relatorio - Felipe.html';
const b64Path = 'C:/CorteFlow2/navalha/Relatorio/b64.json';

let html = fs.readFileSync(htmlPath, 'utf8');
const b64 = JSON.parse(fs.readFileSync(b64Path, 'utf8'));

// 1. Fix slide--white background
html = html.replace(
  /background:\s*radial-gradient\(900px 600px at -8% -12%, rgba\(27,94,160,0\.07\), transparent 55%\),\s*radial-gradient\(800px 640px at 106% 108%, rgba\(249,178,31,0\.14\), transparent 55%\),\s*var\(--cream\);/s,
  `background-image:
      radial-gradient(900px 600px at -8% -12%, rgba(27,94,160,0.07), transparent 55%),
      radial-gradient(800px 640px at 106% 108%, rgba(249,178,31,0.14), transparent 55%);
    background-color: var(--cream);`
);

// 2. Replace logos
const blueLogo = `<img src="${b64.logoW}" alt="FOTUS" style="height:44px; display:block;">`;
const whiteLogo = `<img src="${b64.logoD}" alt="FOTUS" style="height:44px; display:block;">`;

const logoRegex = /<div class="logo">[\s\S]*?<\/svg>\s*<\/div>/g;
html = html.replace(logoRegex, (match, offset, string) => {
  const previousText = string.substring(0, offset);
  const lastBlue = previousText.lastIndexOf('slide--blue');
  const lastWhite = previousText.lastIndexOf('slide--white');
  if (lastBlue > lastWhite) {
    return blueLogo;
  } else {
    return whiteLogo;
  }
});

// 3. Replace Mosaic CSS
const oldMosaicCss = /\.mosaic\{\s*display:flex;\s*width:100%;\s*height:46px;\s*border-radius:12px;\s*overflow:hidden;\s*margin-top:34px;\s*position:relative;\s*z-index:2;\s*\}/s;
const newMosaicCss = `.mosaic { width:100%; height:120px; border-radius:12px; margin-top:34px; position:relative; z-index:2; background-image: url("${b64.mosaic}"); background-size: cover; background-position: center; }`;
html = html.replace(oldMosaicCss, newMosaicCss);

// 4. Remove Mosaic JS
const mosaicJsRegex = /\/\* ---- mosaic tiles ---- \*\/.*/s;
html = html.replace(mosaicJsRegex, '})();\n</script>\n\n</body>\n</html>');

// Save HTML
fs.writeFileSync(htmlPath, html);
console.log('HTML updated successfully.');
