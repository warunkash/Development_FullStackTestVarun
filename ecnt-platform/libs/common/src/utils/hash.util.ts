import * as bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

/**
 * Hashes a plain-text password using bcrypt.
 * @param password - The plain-text password to hash
 * @returns The hashed password string
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compares a plain-text password against a bcrypt hash.
 * @param password - The plain-text password to check
 * @param hash - The bcrypt hash to compare against
 * @returns True if the password matches the hash
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Hashes any string value using bcrypt (useful for tokens, API keys, etc.)
 * @param value - The value to hash
 * @returns The hashed string
 */
export async function hashValue(value: string): Promise<string> {
  return bcrypt.hash(value, SALT_ROUNDS);
}

/**
 * Compares a plain value against its hash.
 * @param value - The plain-text value
 * @param hash - The hash to compare against
 * @returns True if the value matches the hash
 */
export async function compareValue(value: string, hash: string): Promise<boolean> {
  return bcrypt.compare(value, hash);
}
