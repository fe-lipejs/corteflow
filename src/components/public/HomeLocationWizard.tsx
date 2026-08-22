import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Search, CheckCircle2, AlertTriangle, ArrowLeft, ChevronUp, Map, Loader2 } from 'lucide-react';
import { fetchViaCEP, geocodeAddress, extractLatLngFromGoogleMapsUrl, type ViaCepResult } from '../../lib/geocoding';
import { haversineKm, computeTravelFee } from '../../lib/locationEngine';
import { supabase } from '../../integrations/supabase/client';

export interface LocationWizardResult {
  address: string;
  lat: number;
  lng: number;
  distanceKm: number;
  travelFee: number;
}

interface HomeLocationWizardProps {
  theme: any;
  storeCoords: { lat: number, lng: number } | null;
  maxRadiusKm: number;
  feeConfig: {
    enabled: boolean;
    feeType: 'fixed' | 'per_km' | 'free';
    feeAmount: number;
    feePerKm: number;
    radiusKm: number;
  };
  onSuccess: (result: LocationWizardResult) => void;
  onCancel: () => void;
}

export function HomeLocationWizard({ theme, storeCoords, maxRadiusKm, feeConfig, onSuccess, onCancel }: HomeLocationWizardProps) {
  const [step, setStep] = useState<'cep' | 'confirm' | 'form' | 'maps' | 'error_out'>('cep');
  
  const [cep, setCep] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [viaCepData, setViaCepData] = useState<ViaCepResult | null>(null);
  const [approxCoords, setApproxCoords] = useState<{lat: number, lng: number} | null>(null);
  
  // Form fields
  const [addressNum, setAddressNum] = useState('');
  const [addressComp, setAddressComp] = useState('');
  const [addressRef, setAddressRef] = useState('');
  
  // Maps fields
  const [mapsUrl, setMapsUrl] = useState('');

  const handleCepCheck = async () => {
    if (!cep || cep.replace(/\D/g, '').length !== 8) {
      setErrorMsg('Por favor, informe um CEP válido.');
      return;
    }
    
    if (!storeCoords) {
      setErrorMsg('Coordenadas do salão não configuradas.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    try {
      const data = await fetchViaCEP(cep);
      if (!data) {
        setErrorMsg('CEP não encontrado.');
        setIsLoading(false);
        return;
      }
      
      setViaCepData(data);
      
      // Busca coordenada aproximada para pré-validação
      const query = `${data.logradouro}, ${data.bairro}, ${data.localidade} - ${data.uf}, Brasil`;
      const geo = await geocodeAddress(query);
      
      if (geo) {
        const dist = haversineKm({ lat: geo.latitude, lng: geo.longitude }, storeCoords);
        // Pré-validação com margem de tolerância (2.5km)
        const tolerance = 2.5;
        if (dist > maxRadiusKm + tolerance) {
          setStep('error_out');
          setIsLoading(false);
          return;
        }
        setApproxCoords({ lat: geo.latitude, lng: geo.longitude });
      }
      
      setStep('confirm');
    } catch (err) {
      setErrorMsg('Erro ao consultar CEP. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinalValidation = async (lat: number, lng: number, fullAddress: string) => {
    if (!storeCoords) return;
    
    const dist = haversineKm({ lat, lng }, storeCoords);
    if (dist > maxRadiusKm) {
      setStep('error_out');
      return;
    }
    
    const travelFee = computeTravelFee(dist, feeConfig);
    
    onSuccess({
      address: fullAddress,
      lat,
      lng,
      distanceKm: dist,
      travelFee
    });
  };

  const submitForm = async () => {
    if (!addressNum.trim()) {
      setErrorMsg('O número é obrigatório.');
      return;
    }
    
    if (!viaCepData) return;
    
    setIsLoading(true);
    setErrorMsg('');
    
    const fullAddress = `${viaCepData.logradouro}, ${addressNum}${addressComp ? ` - ${addressComp}` : ''}${addressRef ? ` (${addressRef})` : ''}, ${viaCepData.bairro}, ${viaCepData.localidade} - ${viaCepData.uf}, ${cep}`;
    const query = `${viaCepData.logradouro}, ${addressNum}, ${viaCepData.localidade} - ${viaCepData.uf}, Brasil`;
    
    try {
      const geo = await geocodeAddress(query);
      if (!geo && !approxCoords) {
        setErrorMsg('Não foi possível encontrar a localização exata no mapa. Tente colar o link do Google Maps.');
        setIsLoading(false);
        return;
      }
      
      const finalLat = geo ? geo.latitude : approxCoords!.lat;
      const finalLng = geo ? geo.longitude : approxCoords!.lng;
      
      await handleFinalValidation(finalLat, finalLng, fullAddress);
    } catch (err) {
      setErrorMsg('Erro ao validar endereço.');
    } finally {
      setIsLoading(false);
    }
  };

  const submitMaps = async () => {
    if (!mapsUrl.trim()) {
      setErrorMsg('Cole o link do Google Maps.');
      return;
    }
    
    setIsLoading(true);
    setErrorMsg('');
    
    let coords = extractLatLngFromGoogleMapsUrl(mapsUrl);
    
    // Fallback: If it's a short link or unknown format, try edge function
    if (!coords && (mapsUrl.includes('goo.gl') || mapsUrl.includes('google.com/maps'))) {
      try {
        const { data, error } = await supabase.functions.invoke('resolve-map-link', {
          body: { url: mapsUrl },
        });
        if (!error && data?.success && data.latitude && data.longitude) {
          coords = { lat: data.latitude, lng: data.longitude };
        }
      } catch (err) {
        console.error('Error resolving short map link:', err);
      }
    }

    if (!coords) {
      setErrorMsg('Não foi possível ler as coordenadas desse link. Por favor, cole o link longo ou use a opção de "Completar endereço" manualmente.');
      setIsLoading(false);
      return;
    }
    
    const fullAddress = viaCepData 
      ? `${viaCepData.logradouro}, ${viaCepData.bairro}, ${viaCepData.localidade} - ${viaCepData.uf} (Via Google Maps)`
      : `Localização via Google Maps`;
      
    await handleFinalValidation(coords.lat, coords.lng, fullAddress);
    setIsLoading(false);
  };

  return (
    <div className="w-full max-w-lg mx-auto mt-4 bg-white/5 rounded-2xl border p-4 sm:p-6 shadow-sm" style={{ borderColor: theme.borderActive }}>
      <AnimatePresence mode="wait">
        
        {step === 'cep' && (
          <motion.div key="cep" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <div className="flex items-center gap-3 mb-5">
              <button 
                onClick={onCancel} 
                className="w-10 h-10 rounded-2xl sm:rounded-full border flex items-center justify-center shrink-0 transition-colors shadow-sm"
                style={{ borderColor: theme.borderActive, background: theme.inputBg, color: theme.textPrimary }}
              >
                <ChevronUp className="w-5 h-5 -rotate-90" />
              </button>
              <div>
                <h3 className="text-base font-bold" style={{ color: theme.textPrimary }}>Onde será o atendimento?</h3>
              </div>
            </div>
            <p className="text-xs mb-4" style={{ color: theme.textSecondary }}>Digite o CEP do seu endereço para verificarmos se atendemos sua região.</p>
            
            <div className="relative mb-2">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: theme.textSecondary }} />
              <input
                type="text"
                placeholder="00000-000"
                value={cep}
                onChange={e => setCep(e.target.value)}
                maxLength={9}
                className="w-full pl-10 pr-4 py-3 rounded-xl border text-sm focus:outline-none transition-all"
                style={{ background: theme.inputBg, borderColor: theme.inputFocusBorder, color: theme.textPrimary }}
              />
            </div>
            
            {errorMsg && <p className="text-red-500 text-xs mb-3 font-medium">{errorMsg}</p>}
            
            <button 
              onClick={handleCepCheck}
              disabled={isLoading}
              className="w-full py-3 rounded-xl text-sm font-bold flex justify-center items-center gap-2 transition-all"
              style={{ background: theme.accent, color: theme.btnPrimaryText }}
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Consultar CEP
            </button>
          </motion.div>
        )}
        
        {step === 'confirm' && viaCepData && (
          <motion.div key="confirm" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <h3 className="text-sm font-bold" style={{ color: theme.textPrimary }}>Encontramos seu endereço!</h3>
            </div>
            
            <div className="p-3 rounded-lg mb-4 text-xs font-medium border" style={{ background: theme.inputBg, borderColor: theme.borderActive, color: theme.textSecondary }}>
              <p>{viaCepData.logradouro}</p>
              <p>{viaCepData.bairro}</p>
              <p>{viaCepData.localidade} - {viaCepData.uf}</p>
            </div>
            
            <p className="text-xs mb-3 font-bold uppercase tracking-wide" style={{ color: theme.textPrimary }}>Escolha como confirmar:</p>
            
            <div className="space-y-3">
              <button 
                onClick={() => setStep('form')}
                className="w-full py-3 rounded-xl text-sm font-bold flex justify-center items-center gap-2 transition-all border"
                style={{ borderColor: theme.accent, color: theme.accent, background: 'transparent' }}
              >
                ✏️ Completar endereço
              </button>
              
              <button 
                onClick={() => setStep('maps')}
                className="w-full py-3 rounded-xl text-sm font-bold flex justify-center items-center gap-2 transition-all border"
                style={{ borderColor: theme.borderActive, color: theme.textPrimary, background: theme.inputBg }}
              >
                📍 Colar link do Google Maps
              </button>
              
              <button onClick={() => setStep('cep')} className="w-full py-2 text-xs font-medium" style={{ color: theme.textSecondary }}>
                Alterar CEP
              </button>
            </div>
          </motion.div>
        )}

        {step === 'form' && (
          <motion.div key="form" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <button onClick={() => setStep('confirm')} className="flex items-center gap-1 text-xs mb-4 font-medium" style={{ color: theme.textSecondary }}>
              <ArrowLeft className="w-3 h-3" /> Voltar
            </button>
            
            <h3 className="text-sm font-bold mb-3" style={{ color: theme.textPrimary }}>Complete seu endereço</h3>
            
            <div className="space-y-3 mb-4">
              <input
                type="text"
                placeholder="Número *"
                value={addressNum}
                onChange={e => setAddressNum(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border text-sm focus:outline-none transition-all"
                style={{ background: theme.inputBg, borderColor: theme.inputFocusBorder, color: theme.textPrimary }}
              />
              <input
                type="text"
                placeholder="Complemento (Opcional)"
                value={addressComp}
                onChange={e => setAddressComp(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border text-sm focus:outline-none transition-all"
                style={{ background: theme.inputBg, borderColor: theme.borderActive, color: theme.textPrimary }}
              />
              <input
                type="text"
                placeholder="Ponto de referência (Opcional)"
                value={addressRef}
                onChange={e => setAddressRef(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border text-sm focus:outline-none transition-all"
                style={{ background: theme.inputBg, borderColor: theme.borderActive, color: theme.textPrimary }}
              />
            </div>
            
            {errorMsg && <p className="text-red-500 text-xs mb-3 font-medium">{errorMsg}</p>}
            
            <button 
              onClick={submitForm}
              disabled={isLoading}
              className="w-full py-3 rounded-xl text-sm font-bold flex justify-center items-center gap-2 transition-all"
              style={{ background: theme.accent, color: theme.btnPrimaryText }}
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Confirmar Endereço
            </button>
          </motion.div>
        )}

        {step === 'maps' && (
          <motion.div key="maps" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <button onClick={() => setStep('confirm')} className="flex items-center gap-1 text-xs mb-4 font-medium" style={{ color: theme.textSecondary }}>
              <ArrowLeft className="w-3 h-3" /> Voltar
            </button>
            
            <h3 className="text-sm font-bold mb-2" style={{ color: theme.textPrimary }}>Localização Exata</h3>
            <p className="text-xs mb-4" style={{ color: theme.textSecondary }}>Cole o link de compartilhamento do Google Maps apontando para a sua localização exata.</p>
            
            <div className="relative mb-4">
              <Map className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: theme.textSecondary }} />
              <input
                type="url"
                placeholder="https://maps.google.com/..."
                value={mapsUrl}
                onChange={e => setMapsUrl(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border text-sm focus:outline-none transition-all"
                style={{ background: theme.inputBg, borderColor: theme.inputFocusBorder, color: theme.textPrimary }}
              />
            </div>
            
            {errorMsg && <p className="text-red-500 text-xs mb-3 font-medium">{errorMsg}</p>}
            
            <button 
              onClick={submitMaps}
              disabled={isLoading}
              className="w-full py-3 rounded-xl text-sm font-bold flex justify-center items-center gap-2 transition-all"
              style={{ background: theme.accent, color: theme.btnPrimaryText }}
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Validar Localização
            </button>
          </motion.div>
        )}

        {step === 'error_out' && (
          <motion.div key="error_out" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="text-center py-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: 'rgba(239,68,68,0.1)' }}>
              <AlertTriangle className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-base font-bold mb-2" style={{ color: theme.textPrimary }}>Ops! Não atendemos nessa região.</h3>
            <p className="text-xs mb-5" style={{ color: theme.textSecondary }}>O endereço informado está fora da nossa área de atendimento a domicílio.</p>
            
            <button onClick={onCancel} className="w-full py-3 rounded-xl text-sm font-bold flex justify-center items-center gap-2 mb-2 transition-all border border-transparent hover:opacity-90" style={{ background: theme.accent, color: theme.btnPrimaryText }}>
              📍 Agendar no estabelecimento
            </button>
            <button onClick={() => setStep('cep')} className="w-full py-3 text-xs font-bold" style={{ color: theme.textSecondary }}>
              ✏️ Alterar CEP
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
