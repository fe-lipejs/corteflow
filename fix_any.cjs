const fs = require("fs");
const content = fs.readFileSync("src/pages/public/PublicStore.tsx", "utf-8");

const idx1 = content.indexOf("Qualquer profissional");
const idx2 = content.indexOf("Qualquer profissional", idx1 + 10);
const start = content.lastIndexOf("<motion.button", idx2);
const end = content.indexOf("</motion.button>", idx2) + 16;

const buttonCode = content.substring(start, end);
const newButtonCode = `{bookingMode !== 'home' && (
                        ${buttonCode.replace(/\n/g, '\n  ')}
                      )}`;

const newContent = content.substring(0, start) + newButtonCode + content.substring(end);
fs.writeFileSync("src/pages/public/PublicStore.tsx", newContent, "utf-8");
console.log("Fix any professional applied!");
