import { describe, expect, it } from '@jest/globals';
import { isValidListingPrice, isValidRwandaPhone } from './validation';

describe('mobile form validation', () => {
  it('accepts Rwanda phone numbers with at least nine digits', () => {
    expect(isValidRwandaPhone('+250 788 123 456')).toBe(true);
    expect(isValidRwandaPhone('1234')).toBe(false);
  });

  it('accepts only positive listing prices', () => {
    expect(isValidListingPrice('1250000')).toBe(true);
    expect(isValidListingPrice('0')).toBe(false);
    expect(isValidListingPrice('not-a-price')).toBe(false);
  });
});
