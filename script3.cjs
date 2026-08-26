const fs = require('fs');
let content = fs.readFileSync('src/pages/app/Configuracoes.tsx', 'utf-8');

// 1. Remove map modal
const startMap = content.indexOf('{/* 🗺️ RADIUS MAP MODAL 🗺️ */}');
if (startMap !== -1) {
  const endMap = content.indexOf('{/* 🛡️ TAB: STATUS DA CONTA', startMap);
  if (endMap !== -1) {
    content = content.substring(0, startMap) + content.substring(endMap);
    console.log('Removed Map Modal');
  }
}

// 2. Remove payload variables
const oldPayload = `        // Home Service (migration 0046)
        offers_home_service: offersHomeService,
        home_service_radius_km: homeServiceRadiusKm,
        home_fee_type: homeFeeType,
        home_fee_amount: homeFeeAmount,
        home_fee_per_km: homeFeePerKm,`;
const newPayload = '';

content = content.replace(oldPayload, newPayload);

fs.writeFileSync('src/pages/app/Configuracoes.tsx', content, 'utf-8');
console.log('Fixes applied successfully!');
