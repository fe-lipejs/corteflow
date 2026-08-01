export type Service = {
  id: string;
  name: string;
  description: string;
  price: number;
  original_price?: number;
  duration_minutes: number;
};

export type Professional = {
  id: string;
  name: string;
  role_title: string;
};

export const WEEKDAYS = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

export const businessHours = [
  { weekday: 1, is_open: true, open_time: "09:00:00", close_time: "18:00:00" },
  { weekday: 2, is_open: true, open_time: "09:00:00", close_time: "18:00:00" },
  { weekday: 3, is_open: true, open_time: "09:00:00", close_time: "18:00:00" },
  { weekday: 4, is_open: true, open_time: "09:00:00", close_time: "18:00:00" },
  { weekday: 5, is_open: true, open_time: "09:00:00", close_time: "18:00:00" },
  { weekday: 6, is_open: true, open_time: "09:00:00", close_time: "14:00:00" },
];

export const services: Service[] = [
  {
    id: "s1",
    name: "Corte Clássico",
    description: "Corte na tesoura e máquina, com lavagem e finalização profissional.",
    price: 45.0,
    duration_minutes: 40,
  },
  {
    id: "s2",
    name: "Barba Terapia",
    description: "Barboterapia completa com toalha quente, massagem facial e produtos premium.",
    price: 35.0,
    duration_minutes: 30,
  },
  {
    id: "s3",
    name: "Corte + Barba",
    description: "Pacote completo com desconto. Inclui o corte clássico e a barboterapia.",
    price: 70.0,
    original_price: 80.0,
    duration_minutes: 70,
  },
];

export const professionals: Professional[] = [
  { id: "p1", name: "João", role_title: "Barbeiro Sênior" },
  { id: "p2", name: "Marcos", role_title: "Barbeiro Especialista" },
];

export const storeSettings = {
  fantasy_name: "Navalha Clássica",
  description: "A melhor barbearia da região, com profissionais especializados e ambiente premium.",
  rating: "4.9",
  reviews: 128,
  full_address: "Rua das Flores, 123 - Centro, São Paulo - SP",
  latitude: -23.5505,
  longitude: -46.6333,
  instagram: "@navalha.classica",
  admin_whatsapp: "11999999999",
  phone: "11999999999",
  website: "https://navalhaclassica.com.br",
};

export const money = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

export const onlyDigits = (str: string) => {
  return str.replace(/\D/g, "");
};

export const makeBookingCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

export const haversineKm = (
  pos1: { lat: number; lng: number },
  pos2: { lat: number; lng: number }
) => {
  const R = 6371; // km
  const dLat = ((pos2.lat - pos1.lat) * Math.PI) / 180;
  const dLon = ((pos2.lng - pos1.lng) * Math.PI) / 180;
  const lat1 = (pos1.lat * Math.PI) / 180;
  const lat2 = (pos2.lat * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};
