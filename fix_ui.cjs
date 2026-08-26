const fs = require("fs");
const content = fs.readFileSync("src/pages/public/PublicStore.tsx", "utf-8");

// Find the travel fee display span and improve it to show per-km detail
const oldUI = `                                <span>Taxa de Deslocamento</span>
                                  <span className="font-semibold" style={{ color: theme.textPrimary }}>{money(travelFee)}</span>`;

const newUI = `                                <span>
                                    Taxa de Deslocamento
                                    {selectedPro && selectedPro !== 'any' && selectedPro.home_fee_type === 'per_km' && homeLocationData?.distanceKm && (
                                      <span className="text-xs ml-1 opacity-60">({homeLocationData.distanceKm.toFixed(1)} km × {money(selectedPro.home_fee_per_km || 0)}/km)</span>
                                    )}
                                  </span>
                                  <span className="font-semibold" style={{ color: theme.textPrimary }}>{money(travelFee)}</span>`;

if (content.includes(oldUI)) {
  const newContent = content.replace(oldUI, newUI);
  fs.writeFileSync("src/pages/public/PublicStore.tsx", newContent, "utf-8");
  console.log("Fix 3: per-km detail in checkout UI applied!");
} else {
  console.log("WARNING: could not find UI pattern, skipping this fix.");
}
