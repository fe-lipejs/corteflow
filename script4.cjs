const fs = require('fs');
let content = fs.readFileSync('src/pages/app/equipe/ProfessionalModal.tsx', 'utf-8');

// 1. Add states
const stateOld = `const [maxHomeDistanceKm, setMaxHomeDistanceKm] = useState<string>(String(professional?.max_home_distance_km ?? 10));
  const [homeFee, setHomeFee] = useState<string>(String(professional?.home_fee ?? 0));`;

const stateNew = `const [maxHomeDistanceKm, setMaxHomeDistanceKm] = useState<string>(String(professional?.max_home_distance_km ?? 10));
  const [homeFee, setHomeFee] = useState<string>(String(professional?.home_fee ?? 0));
  const [homeFeeType, setHomeFeeType] = useState<'fixed' | 'per_km'>(professional?.home_fee_type ?? 'fixed');
  const [homeFeePerKm, setHomeFeePerKm] = useState<string>(String(professional?.home_fee_per_km ?? 0));`;
content = content.replace(stateOld, stateNew);

// 2. Add payload for save (hours block)
const payloadOld = `offers_home_service: offersHomeService,
        max_home_distance_km: Number(maxHomeDistanceKm),
        home_fee: Number(homeFee) || 0,`;

const payloadNew = `offers_home_service: offersHomeService,
        max_home_distance_km: Number(maxHomeDistanceKm),
        home_fee: Number(homeFee) || 0,
        home_fee_type: homeFeeType,
        home_fee_per_km: Number(homeFeePerKm) || 0,`;

content = content.replace(payloadOld, payloadNew);
content = content.replace(payloadOld, payloadNew); // There are two occurrences (update and create)

// 3. UI Replacement
const uiOld = `                    <div className="grid grid-cols-2 gap-4 pt-4 border-t" style={{ borderColor: theme.border }}>
                      <div>
                        <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: theme.textSecondary }}>Limite Mximo (km)</label>
                        <input 
                          type="number" 
                          min="1" 
                          value={maxHomeDistanceKm} 
                          onChange={e => setMaxHomeDistanceKm(e.target.value)} 
                          className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none themed-input" 
                          style={{ borderColor: theme.border, background: theme.inputBg, color: theme.textPrimary }} 
                          placeholder="Ex: 10" 
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: theme.textSecondary }}>Taxa Extra (R$)</label>
                        <input 
                          type="number" 
                          min="0" step="0.50" 
                          value={homeFee} 
                          onChange={e => setHomeFee(e.target.value)} 
                          className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none themed-input" 
                          style={{ borderColor: theme.border, background: theme.inputBg, color: theme.textPrimary }} 
                          placeholder="Ex: 0.00" 
                        />
                      </div>
                    </div>`;

// Wait, the special characters like  in Mximo might break the replace.
// Let's use indexOf and substring instead.
const startUI = content.indexOf('{/* Atendimento a Domic');
const endUI = content.indexOf('{/* Agenda color + Status */}', startUI);

const newUI = `{/* Atendimento a Domicílio (Professional override) */}
              <div className="rounded-xl p-5" style={{ background: theme.cardBg, border: \`1px solid \${theme.border}\` }}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="font-bold text-sm" style={{ color: theme.textPrimary }}>Atendimento a Domicílio</h4>
                    <p className="text-xs" style={{ color: theme.textMuted }}>Este profissional faz atendimento na casa do cliente?</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOffersHomeService(!offersHomeService)}
                    className="relative w-12 h-6 rounded-full transition-all shrink-0"
                    style={{ background: offersHomeService ? theme.accent : theme.border }}
                  >
                    <span
                      className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-sm"
                      style={{ left: offersHomeService ? '26px' : '4px' }}
                    />
                  </button>
                </div>

                {offersHomeService && (
                  <div className="space-y-4 pt-4 border-t" style={{ borderColor: theme.border }}>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: theme.textSecondary }}>Limite Máximo (km)</label>
                        <input 
                          type="number" 
                          min="1" 
                          value={maxHomeDistanceKm} 
                          onChange={e => setMaxHomeDistanceKm(e.target.value)} 
                          className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none themed-input" 
                          style={{ borderColor: theme.border, background: theme.inputBg, color: theme.textPrimary }} 
                          placeholder="Ex: 10" 
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: theme.textSecondary }}>Como é a taxa?</label>
                        <div className="flex bg-zinc-900 rounded-xl p-1 border" style={{ borderColor: theme.border, background: theme.inputBg }}>
                          <button
                            type="button"
                            onClick={() => setHomeFeeType('fixed')}
                            className={\`flex-1 text-xs py-2 rounded-lg font-bold transition-colors \${homeFeeType === 'fixed' ? 'bg-[#FFC400] text-black shadow-sm' : 'text-zinc-500 hover:text-white'}\`}
                            style={homeFeeType === 'fixed' ? { background: theme.accent, color: theme.textInverse } : { color: theme.textSecondary }}
                          >
                            Fixa
                          </button>
                          <button
                            type="button"
                            onClick={() => setHomeFeeType('per_km')}
                            className={\`flex-1 text-xs py-2 rounded-lg font-bold transition-colors \${homeFeeType === 'per_km' ? 'bg-[#FFC400] text-black shadow-sm' : 'text-zinc-500 hover:text-white'}\`}
                            style={homeFeeType === 'per_km' ? { background: theme.accent, color: theme.textInverse } : { color: theme.textSecondary }}
                          >
                            Por KM
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      {homeFeeType === 'fixed' ? (
                        <>
                          <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: theme.textSecondary }}>Valor da Taxa Fixa (R$)</label>
                          <input 
                            type="number" 
                            min="0" step="0.50" 
                            value={homeFee} 
                            onChange={e => setHomeFee(e.target.value)} 
                            className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none themed-input" 
                            style={{ borderColor: theme.border, background: theme.inputBg, color: theme.textPrimary }} 
                            placeholder="Ex: 20.00" 
                          />
                        </>
                      ) : (
                        <>
                          <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: theme.textSecondary }}>Valor por cada KM (R$)</label>
                          <input 
                            type="number" 
                            min="0" step="0.50" 
                            value={homeFeePerKm} 
                            onChange={e => setHomeFeePerKm(e.target.value)} 
                            className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none themed-input" 
                            style={{ borderColor: theme.border, background: theme.inputBg, color: theme.textPrimary }} 
                            placeholder="Ex: 1.50" 
                          />
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

              `;

content = content.substring(0, startUI) + newUI + content.substring(endUI);

fs.writeFileSync('src/pages/app/equipe/ProfessionalModal.tsx', content, 'utf-8');
console.log('ProfessionalModal updated successfully!');
