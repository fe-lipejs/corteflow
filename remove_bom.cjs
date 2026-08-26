const fs = require("fs");
let content = fs.readFileSync("supabase/migrations/0073_home_fee_type.sql", "utf8");
// Remove BOM if present
if (content.charCodeAt(0) === 0xFEFF) {
  content = content.slice(1);
}
fs.writeFileSync("supabase/migrations/0073_home_fee_type.sql", content, "utf8");
