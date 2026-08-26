const fs = require('fs');
let content = fs.readFileSync('src/pages/public/PublicStore.tsx', 'utf-8');

const oldUI = `<div className="space-y-2.5 text-xs">
                            <div className="flex justify-between" style={{ color: theme.textSecondary }}>
                              <span>Valor do Serviço</span>
                              <span className="font-semibold" style={{ color: theme.textPrimary }}>{money(total)}</span>
                            </div>`;

const newUI = `<div className="space-y-2.5 text-xs">
                            <div className="flex justify-between" style={{ color: theme.textSecondary }}>
                              <span>Valor do Serviço</span>
                              <span className="font-semibold" style={{ color: theme.textPrimary }}>{money(selectedService?.price ?? 0)}</span>
                            </div>
                            {bookingMode === 'home' && travelFee > 0 && (
                              <div className="flex justify-between" style={{ color: theme.textSecondary }}>
                                <span>Taxa de Deslocamento</span>
                                <span className="font-semibold" style={{ color: theme.textPrimary }}>{money(travelFee)}</span>
                              </div>
                            )}
                            {bookingMode === 'home' && serviceHomeExtra > 0 && (
                              <div className="flex justify-between" style={{ color: theme.textSecondary }}>
                                <span>Adicional a domicílio</span>
                                <span className="font-semibold" style={{ color: theme.textPrimary }}>{money(serviceHomeExtra)}</span>
                              </div>
                            )}
                            {bookingMode === 'home' && (
                              <div className="flex justify-between font-bold border-t pt-2 mt-2" style={{ color: theme.textPrimary, borderColor: cardBorderColor }}>
                                <span>Total</span>
                                <span>{money(total)}</span>
                              </div>
                            )}`;

if (content.includes(oldUI)) {
  content = content.replace(oldUI, newUI);
  fs.writeFileSync('src/pages/public/PublicStore.tsx', content, 'utf-8');
  console.log('UI updated successfully');
} else {
  console.log('Could not find UI block');
}
