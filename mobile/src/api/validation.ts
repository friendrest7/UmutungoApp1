export function isValidRwandaPhone(value: string) { return value.replace(/\D/g, '').length >= 9; }
export function isValidListingPrice(value: string) { const amount = Number(value); return Number.isFinite(amount) && amount > 0; }
