import bcrypt from 'bcryptjs';

export async function hashPIN(pin: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(pin, salt);
}

export async function verifyPIN(pin: string, hash: string): Promise<boolean> {
  if (hash.length === 64 && !hash.startsWith('$')) {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const legacyHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    return legacyHash === hash;
  }
  return bcrypt.compare(pin, hash);
}
