import { describe, it, expect } from 'vitest';
import { hashPIN, verifyPIN } from './crypto';

describe('crypto PIN verification logic', () => {
  it('should hash a 4-digit PIN with bcrypt and verify it successfully', async () => {
    const pin = '1234';
    const hash = await hashPIN(pin);

    expect(hash).toBeDefined();
    expect(hash.startsWith('$2')).toBe(true);

    const isValid = await verifyPIN(pin, hash);
    expect(isValid).toBe(true);
  });

  it('should reject an incorrect PIN with bcrypt hash', async () => {
    const pin = '1234';
    const wrongPin = '4321';
    const hash = await hashPIN(pin);

    const isValid = await verifyPIN(wrongPin, hash);
    expect(isValid).toBe(false);
  });

  it('should correctly verify legacy SHA-256 hex hashes', async () => {
    // SHA-256 hash of "1234" is "03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4"
    const pin = '1234';
    const legacyHash = '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4';

    const isValid = await verifyPIN(pin, legacyHash);
    expect(isValid).toBe(true);

    const isInvalid = await verifyPIN('9999', legacyHash);
    expect(isInvalid).toBe(false);
  });
});
