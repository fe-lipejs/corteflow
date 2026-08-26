const fs = require("fs");
let content = fs.readFileSync("supabase/migrations/0074_professional_email.sql", "utf8");
if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
fs.writeFileSync("supabase/migrations/0074_professional_email.sql", content, "utf8");
