export interface GeocodingResult {
  latitude: number;
  longitude: number;
  formattedAddress: string;
}

export async function geocodeAddress(addressQuery: string): Promise<GeocodingResult | null> {
  if (!addressQuery || !addressQuery.trim()) return null;

  try {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.append('q', addressQuery);
    url.searchParams.append('format', 'json');
    url.searchParams.append('limit', '1');
    url.searchParams.append('countrycodes', 'br');

    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json'
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

export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; 
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1); 
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
    ; 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const d = R * c; 
  return d;
}

function deg2rad(deg: number): number {
  return deg * (Math.PI/180);
}
