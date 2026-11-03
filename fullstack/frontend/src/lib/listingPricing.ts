export const listingPriceBands = [
  { id: '0-300000', label: 'RWF 0–300,000', minimum: 0, maximum: 300_000, rate: 0.01, percent: '1%' },
  { id: '300000-1000000', label: 'RWF 300,001–1,000,000', minimum: 300_001, maximum: 1_000_000, rate: 0.02, percent: '2%' },
  { id: '1000000-10000000', label: 'RWF 1,000,001–10,000,000', minimum: 1_000_001, maximum: 10_000_000, rate: 0.03, percent: '3%' },
  { id: '10000000-30000000', label: 'RWF 10,000,001–30,000,000', minimum: 10_000_001, maximum: 30_000_000, rate: 0.031, percent: '3.1%' },
  { id: '30000000-100000000', label: 'RWF 30,000,001–100,000,000', minimum: 30_000_001, maximum: 100_000_000, rate: 0.032, percent: '3.2%' },
  { id: '100000000-plus', label: 'Over RWF 100,000,000', minimum: 100_000_001, maximum: null, rate: 0.012, percent: '1.2%' },
] as const;

export type ListingPriceBand = (typeof listingPriceBands)[number];

export function priceBandForAmount(amount: number): ListingPriceBand {
  if (amount >= 0 && amount <= 300_000) return listingPriceBands[0];
  if (amount <= 1_000_000) return listingPriceBands[1];
  if (amount <= 10_000_000) return listingPriceBands[2];
  if (amount <= 30_000_000) return listingPriceBands[3];
  if (amount <= 100_000_000) return listingPriceBands[4];
  return listingPriceBands[5];
}

export function priceBandIndex(id: string) {
  return listingPriceBands.findIndex((band) => band.id === id);
}
