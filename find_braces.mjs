
const fs = require('fs');
const code = fs.readFileSync('src/pages/Onboarding.tsx', 'utf8');
const lines = code.split('\n');
let depth = 0;
for(let i=0; i<lines.length; i++) {
  let noStrings = lines[i].replace(/('|\|\x22).*?\1/g, '');
  const opens = (noStrings.match(/\{/g) || []).length;
  const closes = (noStrings.match(/\}/g) || []).length;
  depth += opens - closes;
  if(depth < 0 || depth > 20) {
      console.log('Depth', depth, 'at line', i+1);
  }
}
console.log('Final depth:', depth);
