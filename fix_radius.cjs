const fs = require("fs");
const content = fs.readFileSync("src/pages/public/PublicStore.tsx", "utf-8");

// The exact buggy block we need to replace
const idx = content.indexOf("if (bookingMode === 'home') {\r\n      const salonRadius");
if (idx < 0) { console.log("ERROR: pattern not found"); process.exit(1); }

// Find end of that block (closing brace of the filter)
const closeFilter = content.indexOf("return homeLocationData!.distanceKm! <= effectiveRadius;\r\n      });\r\n    }");
if (closeFilter < 0) { console.log("ERROR: closing not found"); process.exit(1); }

const endIdx = closeFilter + "return homeLocationData!.distanceKm! <= effectiveRadius;\r\n      });\r\n    }".length;

const oldBlock = content.substring(idx, endIdx);
console.log("--- OLD BLOCK ---");
console.log(oldBlock);

const newBlock = `if (bookingMode === 'home') {
      list = list.filter((p: any) => {
        if (!p.offers_home_service) return false;
        if ((homeLocationData?.distanceKm ?? null) == null) return true;
        // Use ONLY the professional's own radius - no global salon cap
        const effectiveRadius = p.max_home_distance_km && p.max_home_distance_km > 0
          ? p.max_home_distance_km
          : 9999; // No limit if not set
        return homeLocationData!.distanceKm! <= effectiveRadius;
      });
    }`;

const newContent = content.substring(0, idx) + newBlock + content.substring(endIdx);
fs.writeFileSync("src/pages/public/PublicStore.tsx", newContent, "utf-8");
console.log("Fix 1 applied!");
