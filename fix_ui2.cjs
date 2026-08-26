const fs = require("fs");
const content = fs.readFileSync("src/pages/public/PublicStore.tsx", "utf-8");
const idx = content.indexOf("Taxa de Deslocamento");
const spanStart = content.lastIndexOf("<span>", idx);
const afterSpan = content.indexOf("</span>\n                                <span", spanStart);
const closeSecond = content.indexOf("</span>", afterSpan + 10) + 7;

const oldBlock = content.substring(spanStart, closeSecond);
console.log("--- OLD ---");
console.log(oldBlock);

const newBlock = `<span>
                                    Taxa de Deslocamento
                                    {selectedPro && selectedPro !== 'any' && (selectedPro as any).home_fee_type === 'per_km' && homeLocationData?.distanceKm != null && (
                                      <span className="block text-xs opacity-60 font-normal">{homeLocationData.distanceKm.toFixed(1)} km × {money((selectedPro as any).home_fee_per_km || 0)}/km</span>
                                    )}
                                  </span>
                                <span className="font-semibold" style={{ color: theme.textPrimary }}>{money(travelFee)}</span>`;

const newContent = content.substring(0, spanStart) + newBlock + content.substring(closeSecond);
fs.writeFileSync("src/pages/public/PublicStore.tsx", newContent, "utf-8");
console.log("Fix 3 applied!");
