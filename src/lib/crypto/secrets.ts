/**
 * AES-256-GCM Encryption for Project Secrets
 *
 * Security features:
 * - AES-256-GCM provides authenticated encryption (confidentiality + integrity)
 * - Unique IV per encryption prevents pattern analysis
 * - Auth tag detects tampering
 * - Key stored only in environment variables
 *
 * @see docs/RULES.md for security guidelines
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits

export interface EncryptedData {
  encryptedValue: string;
  iv: string;
  authTag: string;
}

/**
 * Encrypts a secret value using AES-256-GCM
 *
 * @param plaintext - The secret value to encrypt
 * @returns Encrypted data with IV and auth tag
 * @throws Error if encryption key is not configured
 *
 * SECURITY: Never log the plaintext value
 */
export function encryptSecret(plaintext: string): EncryptedData {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const authTag = cipher.getAuthTag();

  return {
    encryptedValue: encrypted,
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}

/**
 * Decrypts a secret value using AES-256-GCM
 *
 * @param data - The encrypted data with IV and auth tag
 * @returns Decrypted plaintext
 * @throws Error if decryption fails (wrong key, tampered data, etc.)
 *
 * SECURITY: Only call server-side when absolutely needed
 */
export function decryptSecret(data: EncryptedData): string {
  const key = getEncryptionKey();
  const iv = Buffer.from(data.iv, 'base64');
  const authTag = Buffer.from(data.authTag, 'base64');

  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(data.encryptedValue, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Gets the encryption key from environment variables
 * Key must be exactly 32 bytes (256 bits) in hex format
 *
 * @returns Buffer containing the encryption key
 * @throws Error if key is missing or invalid length
 */
function getEncryptionKey(): Buffer {
  const keyHex = process.env.SECRETS_ENCRYPTION_KEY;

  if (!keyHex) {
    throw new Error(
      'SECRETS_ENCRYPTION_KEY environment variable is not set. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }

  const key = Buffer.from(keyHex, 'hex');

  if (key.length !== 32) {
    throw new Error(
      `SECRETS_ENCRYPTION_KEY must be exactly 32 bytes (64 hex characters). Got ${key.length} bytes.`
    );
  }

  return key;
}

/**
 * Generates a new encryption key for initial setup
 * Run once and store securely in environment variables
 *
 * Usage: npx tsx -e "import { generateEncryptionKey } from './src/lib/crypto/secrets'; console.log(generateEncryptionKey())"
 * Or: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * @returns 64-character hex string (32 bytes)
 */
export function generateEncryptionKey(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Validates that the encryption key is properly configured
 * Call this at startup to fail fast if misconfigured
 *
 * @returns true if key is valid
 * @throws Error if key is invalid
 */
export function validateEncryptionKeyConfig(): boolean {
  getEncryptionKey(); // Will throw if invalid
  return true;
}
