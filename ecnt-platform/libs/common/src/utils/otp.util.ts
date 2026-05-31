import * as crypto from 'crypto';

/**
 * Generates a cryptographically secure numeric OTP of specified length.
 * @param length - Length of the OTP (default: 6)
 * @returns A zero-padded numeric OTP string
 */
export function generateOtp(length = 6): string {
  // Use crypto for secure random generation
  const max = Math.pow(10, length);
  const min = Math.pow(10, length - 1);
  const range = max - min;

  // Generate random bytes and convert to a number in range
  const randomBuffer = crypto.randomBytes(4);
  const randomNumber = randomBuffer.readUInt32BE(0);
  const otp = min + (randomNumber % range);

  return otp.toString().padStart(length, '0');
}

/**
 * Generates a secure alphanumeric token for email verification, etc.
 * @param length - Length of the token in bytes (output will be 2x this in hex)
 * @returns A hex string token
 */
export function generateSecureToken(length = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Calculates the expiry date/time for an OTP.
 * @param minutes - Number of minutes until expiry (default: 10)
 * @returns Date object representing expiry time
 */
export function getOtpExpiry(minutes = 10): Date {
  const expiry = new Date();
  expiry.setMinutes(expiry.getMinutes() + minutes);
  return expiry;
}

/**
 * Checks if an OTP is still valid (not expired).
 * @param expiresAt - The expiry timestamp
 * @returns True if the OTP is still valid
 */
export function isOtpValid(expiresAt: Date): boolean {
  return new Date() < expiresAt;
}
