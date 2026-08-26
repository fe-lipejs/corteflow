const fs = require("fs");
const content = fs.readFileSync("src/pages/public/PublicStore.tsx", "utf-8");

// Fix 2: travelFee calculation - use per_km when configured
const oldFee = "const travelFee = (bookingMode === 'home' && selectedPro && selectedPro !== 'any') ? (selectedPro.home_fee || 0) : 0;";
if (!content.includes(oldFee)) { console.log("WARNING: travelFee pattern not found"); } else {
  const newFee = `const travelFee = (() => {
    if (bookingMode !== 'home' || !selectedPro || selectedPro === 'any') return 0;
    if (selectedPro.home_fee_type === 'per_km') {
      return Math.round(((selectedPro.home_fee_per_km || 0) * (homeLocationData?.distanceKm ?? 0)) * 100) / 100;
    }
    return selectedPro.home_fee || 0;
  })();`;
  const newContent = content.replace(oldFee, newFee);
  fs.writeFileSync("src/pages/public/PublicStore.tsx", newContent, "utf-8");
  console.log("Fix 2: travelFee updated!");
}
