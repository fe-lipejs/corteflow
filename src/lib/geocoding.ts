export interface GeocodingResult {
  latitude: number;
  longitude: number;
  formattedAddress: string;
}

export interface ViaCepResult {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

/**
 * Busca o endereço completo no ViaCEP através de um CEP
 */
export async function fetchViaCEP(cep: string): Promise<ViaCepResult | null> {
  const cleanCep = cep.replace(/\D/g, '');
  if (cleanCep.length !== 8) return null;

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
    if (!response.ok) return null;
    const data = await response.json();
    
    if (data.erro) return null;
    
    return data as ViaCepResult;
  } catch (error) {
    console.error('Erro na consulta do ViaCEP:', error);
    return null;
  }
}

/**
 * Extrai coordenadas (latitude e longitude) de uma URL longa do Google Maps
 */
export function extractLatLngFromGoogleMapsUrl(url: string): { lat: number, lng: number } | null {
  if (!url || typeof url !== 'string') return null;
  
  // Tenta extrair da sintaxe padrão @lat,lng,z
  const regexAt = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
  const matchAt = url.match(regexAt);
  if (matchAt && matchAt.length >= 3) {
    return {
      lat: parseFloat(matchAt[1]),
      lng: parseFloat(matchAt[2])
    };
  }

  // Tenta extrair da sintaxe query ?q=lat,lng ou ?ll=lat,lng
  const regexQuery = /[?&](q|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/;
  const matchQuery = url.match(regexQuery);
  if (matchQuery && matchQuery.length >= 4) {
    return {
      lat: parseFloat(matchQuery[2]),
      lng: parseFloat(matchQuery[3])
    };
  }

  // Tenta extrair do path /place/lat,lng
  const regexPlace = /\/place\/(-?\d+\.\d+),(-?\d+\.\d+)/;
  const matchPlace = url.match(regexPlace);
  if (matchPlace && matchPlace.length >= 3) {
    return {
      lat: parseFloat(matchPlace[1]),
      lng: parseFloat(matchPlace[2])
    };
  }

  return null;
}

/**
 * Converte um endereço em coordenadas via Nominatim (OpenStreetMap)
 */
export async function geocodeAddress(addressQuery: string): Promise<GeocodingResult | null> {
  if (!addressQuery || !addressQuery.trim()) return null;

  try {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.append('q', addressQuery);
    url.searchParams.append('format', 'json');
    url.searchParams.append('limit', '1');
    url.searchParams.append('countrycodes', 'br');

    // A API do Nominatim exige o envio de User-Agent e restringe requisições muito agressivas.
    // Usamos um user-agent personalizado genérico para evitar bloqueio.
    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Navalha-Booking-App/1.0'
      }
    });

    if (!response.ok) {
      throw new Error('Falha na resposta do Nominatim');
    }

    const data = await response.json();

    if (data && data.length > 0) {
      return {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon),
        formattedAddress: data[0].display_name
      };
    }

    return null;
  } catch (error) {
    console.error('Erro de Geocoding:', error);
    return null;
  }
}
