/**
 * Client-side encryption utility for securing payloads before transmission
 * Uses Web Crypto API for AES-GCM encryption
 */

// Configuration
const ENCRYPTION_CONFIG = {
  algorithm: 'AES-GCM' as const,
  keyLength: 256,
  ivLength: 12, // 96 bits for GCM
  tagLength: 128, // 128 bits authentication tag
};

/**
 * Generate a random encryption key
 * @returns Base64-encoded encryption key
 */
export async function generateEncryptionKey(): Promise<string> {
  const key = await crypto.subtle.generateKey(
    {
      name: ENCRYPTION_CONFIG.algorithm,
      length: ENCRYPTION_CONFIG.keyLength,
    },
    true, // extractable
    ['encrypt', 'decrypt']
  );

  const exportedKey = await crypto.subtle.exportKey('raw', key);
  return btoa(String.fromCharCode(...new Uint8Array(exportedKey)));
}

/**
 * Import a base64-encoded key for encryption/decryption
 * @param base64Key Base64-encoded key string
 * @returns CryptoKey object
 */
async function importKey(base64Key: string): Promise<CryptoKey> {
  // Decode base64 to byte array
  const keyData = Uint8Array.from(atob(base64Key), c => c.charCodeAt(0));

  return await crypto.subtle.importKey(
    'raw',
    keyData,
    ENCRYPTION_CONFIG.algorithm,
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a payload object using AES-GCM
 * @param payload The object to encrypt
 * @param base64Key Optional base64-encoded encryption key (generates new if not provided)
 * @returns Object containing encrypted data (base64) and the key used (base64)
 */
export async function encryptPayload<T>(
  payload: T,
  base64Key?: string
): Promise<{ encryptedData: string; encryptionKey: string }> {
  try {
    // Generate or use provided key
    const keyToUse = base64Key || (await generateEncryptionKey());
    const key = await importKey(keyToUse);

    // Convert payload to JSON string
    const jsonString = JSON.stringify(payload);
    const data = new TextEncoder().encode(jsonString);

    // Generate random IV
    const iv = crypto.getRandomValues(new Uint8Array(ENCRYPTION_CONFIG.ivLength));

    // Encrypt the data
    const encryptedBuffer = await crypto.subtle.encrypt(
      {
        name: ENCRYPTION_CONFIG.algorithm,
        iv: iv,
        tagLength: ENCRYPTION_CONFIG.tagLength,
      },
      key,
      data
    );

    // Combine IV and encrypted data
    const encryptedData = new Uint8Array(encryptedBuffer);
    const combined = new Uint8Array(iv.length + encryptedData.length);
    combined.set(iv, 0);
    combined.set(encryptedData, iv.length);

    // Convert to base64
    const encryptedBase64 = btoa(String.fromCharCode(...combined));

    return {
      encryptedData: encryptedBase64,
      encryptionKey: keyToUse,
    };
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error('Failed to encrypt payload');
  }
}

/**
 * Decrypt an encrypted payload
 * @param encryptedBase64 Base64-encoded encrypted data (includes IV)
 * @param base64Key Base64-encoded encryption key
 * @returns Decrypted payload object
 */
export async function decryptPayload<T>(
  encryptedBase64: string,
  base64Key: string
): Promise<T> {
  try {
    const key = await importKey(base64Key);

    // Decode base64 to byte array
    const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));

    // Extract IV and encrypted data
    const iv = combined.slice(0, ENCRYPTION_CONFIG.ivLength);
    const encryptedData = combined.slice(ENCRYPTION_CONFIG.ivLength);

    // Decrypt the data
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: ENCRYPTION_CONFIG.algorithm,
        iv: iv,
        tagLength: ENCRYPTION_CONFIG.tagLength,
      },
      key,
      encryptedData
    );

    // Convert decrypted data to string
    const jsonString = new TextDecoder().decode(decryptedBuffer);

    // Parse JSON and return
    return JSON.parse(jsonString) as T;
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt payload');
  }
}

/**
 * Hash a string using SHA-256
 * Useful for generating consistent identifiers
 * @param input String to hash
 * @returns Base64-encoded hash
 */
export async function hashString(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  return btoa(String.fromCharCode(...hashArray));
}

/**
 * Generate a secure random string
 * @param length Length of the random string
 * @returns Random string
 */
export function generateRandomString(length: number = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .substring(0, length);
}
