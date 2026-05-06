export const DELIVERY_RATES: Record<string, number> = {
  "PASEO": 900,
  "VIBO PLACE": 850,
  "SM SEASIDE": 900,
  "BTC": 800,
  "ROBINSONS GALLERIA": 800,
  "IT PARK": 800,
  "BASELINE": 850,
  "SM CEBU": 800,
  "8 BANAWA": 900,
  "GRUBHUB MINGLANILLA": 1150,
  "PUSO VILLAGE": 850,
  "OUTLETS-PUEBLO VERDE": 800,
  "NU": 800,
  "MANDANI": 750,
  "LG GARDEN": 900,
  "MACTAN AIRPORT": 800,
};

function normalize(s: string): string {
  return s.trim().toUpperCase().replace(/\s+/g, " ");
}

export function getDeliveryRate(storeName?: string | null): number {
  if (!storeName) return 0;
  const key = normalize(storeName);
  if (DELIVERY_RATES[key] != null) return DELIVERY_RATES[key];
  // Fuzzy: match if any known location key is contained in store name
  for (const k of Object.keys(DELIVERY_RATES)) {
    if (key.includes(k)) return DELIVERY_RATES[k];
  }
  return 0;
}
