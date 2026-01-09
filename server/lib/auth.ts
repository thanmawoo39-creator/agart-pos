import { scryptSync, randomBytes, timingSafeEqual } from 'crypto';

export function hashPin(pin: string): string {
    const salt = randomBytes(16).toString('hex');
    const hashedPassword = scryptSync(pin, salt, 64).toString('hex');
    return `${salt}:${hashedPassword}`;
}

export function verifyPin(pin: string, hash: string): boolean {
    // Security: NEVER accept plaintext PINs. Hash format is "salt:hashedPassword"
    if (!hash.includes(':')) {
        // Invalid hash format - reject authentication
        return false;
    }
    const [salt, key] = hash.split(':');
    if (!salt || !key) return false;
    const hashedBuffer = scryptSync(pin, salt, 64);
    const keyBuffer = Buffer.from(key, 'hex');
    return timingSafeEqual(hashedBuffer, keyBuffer);
}
