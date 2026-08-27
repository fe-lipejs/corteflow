const fs = require('fs');
const files = ['Agenda.tsx', 'Servicos.tsx', 'Equipe.tsx', 'Financeiro.tsx'];
for (const file of files) {
  const path = 'src/pages/app/' + file;
  let content = fs.readFileSync(path, 'utf8');
  if (!content.includes('PaywallGate')) {
    content = 'import PaywallGate from \'../../components/PaywallGate\';\n' + content;
    
    let feature = 'agenda';
    if (file === 'Servicos.tsx') feature = 'servicos';
    if (file === 'Equipe.tsx') feature = 'profissionais';
    if (file === 'Financeiro.tsx') feature = 'financeiro';
    
    const regex = /return\s*\(\s*(<div[^>]*className=[^>]*>)/;
    content = content.replace(regex, 'return (\n    <PaywallGate feature="' + feature + '">\n      $1');
    
    const lastParen = content.lastIndexOf(');');
    if (lastParen !== -1) {
      content = content.substring(0, lastParen) + '    </PaywallGate>\n  );\n' + content.substring(lastParen + 2);
    }
    
    fs.writeFileSync(path, content);
    console.log('Injected into', file);
  }
}
