const fs = require('fs');
let content = fs.readFileSync('src/pages/public/PublicStore.tsx', 'utf-8');

// Fix 1: Remove the salonRadius Math.min bug - use ONLY the professional's own radius
const buggy = `      if (bookingMode === 'home') {
        const salonRadius = settings?.home_service_radius_km || 10;
        list = list.filter((p: any) => {
          if (!p.offers_home_service) return false;
          if ((homeLocationData?.distanceKm ?? null) == null) return true;
          const effectiveRadius = p.max_home_distance_km && p.max_home_distance_km > 0
            ? Math.min(p.max_home_distance_km, salonRadius)
            : salonRadius;
          return homeLocationData!.distanceKm! <= effectiveRadius;
        });`;
const fixed = `      if (bookingMode === 'home') {
        list = list.filter((p: any) => {
          if (!p.offers_home_service) return false;
          if ((homeLocationData?.distanceKm ?? null) == null) return true;
          // Use ONLY the professional's own radius - no global salon cap
          const effectiveRadius = p.max_home_distance_km && p.max_home_distance_km > 0
            ? p.max_home_distance_km
            : 999; // If professional has no limit set, allow all
          return homeLocationData!.distanceKm! <= effectiveRadius;
        });`;

if (content.includes(`const salonRadius = settings?.home_service_radius_km || 10;`)) {
  content = content.replace(buggy, fixed);
  console.log('Fix 1: salonRadius bug removed');
} else {
  console.log('WARNING: Could not find salonRadius pattern!');
}

// Fix 2: Update travelFee to handle per_km type
const travelFeeOld = `const travelFee = (bookingMode === 'home' && selectedPro && selectedPro !== 'any') ? (selectedPro.home_fee || 0) : 0;`;
const travelFeeNew = `const travelFee = (() => {
    if (bookingMode !== 'home' || !selectedPro || selectedPro === 'any') return 0;
    if (selectedPro.home_fee_type === 'per_km') {
      return (selectedPro.home_fee_per_km || 0) * (homeLocationData?.distanceKm ?? 0);
    }
    return selectedPro.home_fee || 0;
  })();`;

if (content.includes(travelFeeOld)) {
  content = content.replace(travelFeeOld, travelFeeNew);
  console.log('Fix 2: travelFee updated with per_km logic');
} else {
  console.log('WARNING: Could not find travelFee pattern!');
}

// Fix 3: Also update the useMemo dependency to remove home_service_radius_km
const depsOld = `(homeLocationData?.distanceKm ?? null), settings?.home_service_radius_km]);\n\n  const availableSlots`;
const depsNew = `(homeLocationData?.distanceKm ?? null)]);\n\n  const availableSlots`;
if (content.includes(`settings?.home_service_radius_km])`)) {
  content = content.replace(`settings?.home_service_radius_km])`, `])`);
  console.log('Fix 3: dependency array cleaned');
} else {
  console.log('WARNING: Could not find deps pattern!');
}

fs.writeFileSync('src/pages/public/PublicStore.tsx', content, 'utf-8');
console.log('PublicStore.tsx updated!');
