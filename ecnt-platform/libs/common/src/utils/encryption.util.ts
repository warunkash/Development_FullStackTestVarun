import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32; // 256 bits

/**
 * Derives a 32-byte encryption key from the provided secret.
 * Uses SHA-256 to ensure correct key length regardless of input size.
 */
function deriveKey(secret: string): Buffer {
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts a string value using AES-256-GCM.
 * @param text - Plain-text string to encrypt
 * @param secret - Encryption secret key
 * @returns Base64-encoded encrypted string (iv:authTag:ciphertext)
 */
export function encrypt(text: string, secret: string): string {
  const key = deriveKey(secret);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv) as crypto.CipherGCM;

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Combine iv + authTag + encrypted as colon-separated hex strings
  const combined = `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  return Buffer.from(combined).toString('base64');
}

/**
 * Decrypts a string encrypted with the encrypt() function.
 * @param encryptedText - Base64-encoded encrypted string
 * @param secret - Encryption secret key (must match the one used for encryption)
 * @returns Decrypted plain-text string
 */
export function decrypt(encryptedText: string, secret: string): string {
  const key = deriveKey(secret);
  const combined = Buffer.from(encryptedText, 'base64').toString('utf8');
  const parts = combined.split(':');

  if (parts.length !== 3) {
    throw new Error('Invalid encrypted text format');
  }

  const [ivHex, authTagHex, encrypted] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv) as crypto.DecipherGCM;
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Generates a secure random string suitable for use as an API key.
 * @param length - Length in bytes (output will be 2x in hex)
 * @returns Hex string prefixed with 'ecnt_'
 */
export function generateApiKey(length = 32): string {
  return `ecnt_${crypto.randomBytes(length).toString('hex')}`;
}

/**
 * Generates a HMAC-SHA256 signature for webhook payloads.
 * @param payload - The payload string to sign
 * @param secret - The webhook secret
 * @returns Hex HMAC signature
 */
export function generateWebhookSignature(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Verifies a webhook signature using timing-safe comparison.
 * @param payload - The received payload
 * @param signature - The signature to verify
 * @param secret - The webhook secret
 * @returns True if signature is valid
 */
export function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const expectedSignature = generateWebhookSignature(payload, secret);
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');
  const receivedBuffer = Buffer.from(signature.replace(/^sha256=/, ''), 'hex');

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

/**
 * Masks a sensitive string (e.g. card number, phone) for display.
 * @param value - The value to mask
 * @param visibleChars - Number of characters to show at start and end
 * @returns Masked string like "9876****1234"
 */
export function maskSensitiveValue(value: string, visibleChars = 4): string {
  if (value.length <= visibleChars * 2) {
    return '*'.repeat(value.length);
  }
  const start = value.substring(0, visibleChars);
  const end = value.substring(value.length - visibleChars);
  const masked = '*'.repeat(value.length - visibleChars * 2);
  return `${start}${masked}${end}`;
}
