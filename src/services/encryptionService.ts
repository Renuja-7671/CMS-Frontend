/**
 * Encryption service for end-to-end encryption with backend.
 * Uses hybrid RSA + AES encryption:
 * 1. Fetch RSA public key from backend
 * 2. Generate random AES-256 key for each request
 * 3. Encrypt request payload with AES-GCM
 * 4. Encrypt AES key with RSA public key
 * 5. Send encrypted payload and encrypted key to backend
 * 6. Backend decrypts AES key with RSA private key
 * 7. Backend decrypts payload with AES key
 * 8. Backend encrypts response with same AES key
 * 9. Client decrypts response with same AES key
 */

import axios from 'axios';
import { encryptPayload, decryptPayload, generateEncryptionKey } from '../utils/encryptionUtil';

const API_BASE_URL = 'http://localhost:8090/api';

// RSA configuration
const RSA_CONFIG = {
  name: 'RSA-OAEP' as const,
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]), // 65537
  hash: 'SHA-256' as const,
};

/**
 * Public key response from backend (wrapped in ApiResponse)
 */
interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

/**
 * Public key data
 */
interface PublicKeyData {
  sessionId: string;
  publicKey: string;
  expiryTime: string;
  ttlSeconds: number;
}

/**
 * Encrypted request payload
 */
export interface EncryptedRequest {
  sessionId: string;
  encryptedData: string;
  encryptedKey: string;
  payloadType?: string;
}

/**
 * Encrypted response payload
 */
export interface EncryptedResponse {
  sessionId: string;
  encryptedData: string;
  encryptedKey: string;
}

/**
 * Session info stored in memory
 */
interface SessionInfo {
  sessionId: string;
  publicKey: string;
  expiryTime: Date;
}

/**
 * Map to store AES keys per session ID
 * This allows multiple concurrent requests without key conflicts
 */
interface AESKeyStore {
  [sessionId: string]: string;
}

// In-memory session storage
let currentSession: SessionInfo | null = null;

// Store AES keys per session ID to support concurrent requests
const aesKeyStore: AESKeyStore = {};

/**
 * Import RSA public key from base64-encoded DER format (Java format)
 */
async function importRSAPublicKeyFromBase64(base64Key: string): Promise<CryptoKey> {
  try {
    // Validate base64 string
    if (!base64Key || base64Key.trim().length === 0) {
      throw new Error('Public key is empty or invalid');
    }

    // Remove any whitespace
    const cleanedKey = base64Key.trim();

    // Decode base64 to get DER-encoded key
    let binaryDer: ArrayBuffer;
    try {
      const binaryString = atob(cleanedKey);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      binaryDer = bytes.buffer as ArrayBuffer;
    } catch (e) {
      throw new Error('Invalid base64 encoding in public key');
    }

    // Import key using SubjectPublicKeyInfo format (X.509)
    const publicKey = await crypto.subtle.importKey(
      'spki',
      binaryDer,
      RSA_CONFIG,
      true,
      ['encrypt']
    );

    return publicKey;
  } catch (error) {
    console.error('Failed to import RSA public key:', error);
    throw new Error('Failed to import RSA public key');
  }
}

/**
 * Encrypt data with RSA public key
 */
async function encryptWithRSA(data: string, publicKey: CryptoKey): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);

    const encryptedBuffer = await crypto.subtle.encrypt(
      {
        name: 'RSA-OAEP',
      },
      publicKey,
      dataBuffer
    );

    // Convert to base64
    const encryptedArray = new Uint8Array(encryptedBuffer);
    return btoa(String.fromCharCode(...encryptedArray));
  } catch (error) {
    console.error('RSA encryption failed:', error);
    throw new Error('Failed to encrypt with RSA');
  }
}

/**
 * Fetch public key from backend and establish session
 */
export async function getPublicKey(): Promise<SessionInfo> {
  try {
    const response = await axios.get<ApiResponse<PublicKeyData>>(`${API_BASE_URL}/encryption/public-key`);
    
    // Unwrap the data from ApiResponse
    const publicKeyData = response.data.data;
    
    if (!publicKeyData || !publicKeyData.sessionId || !publicKeyData.publicKey) {
      console.error('Invalid public key response:', response.data);
      throw new Error('Invalid public key response from server');
    }
    
    const { sessionId, publicKey, expiryTime } = publicKeyData;

    // Store session info
    currentSession = {
      sessionId,
      publicKey,
      expiryTime: new Date(expiryTime),
    };

    return currentSession;
  } catch (error) {
    console.error('Failed to get public key:', error);
    throw new Error('Failed to establish secure session');
  }
}

/**
 * Encrypt a request payload using hybrid RSA + AES encryption
 * Each request gets its own session to support concurrent requests
 */
export async function encryptRequest<T>(payload: T, payloadType?: string): Promise<EncryptedRequest> {
  try {
    // Get a fresh session for this request to support concurrent requests
    // This ensures each request has its own session ID and AES key
    const session = await getPublicKey();

    if (!session || !session.publicKey) {
      throw new Error('Failed to establish session');
    }

    // Step 1: Generate random AES key for this specific request
    const aesKey = await generateEncryptionKey();
    
    // Store AES key indexed by this request's session ID
    // This allows the response to be decrypted using the correct AES key
    aesKeyStore[session.sessionId] = aesKey;

    // Step 2: Encrypt payload with AES
    const { encryptedData } = await encryptPayload(payload, aesKey);

    // Step 3: Import RSA public key
    const rsaPublicKey = await importRSAPublicKeyFromBase64(session.publicKey);

    // Step 4: Encrypt AES key with RSA
    const encryptedKey = await encryptWithRSA(aesKey, rsaPublicKey);

    return {
      sessionId: session.sessionId,
      encryptedData,
      encryptedKey,
      payloadType,
    };
  } catch (error) {
    console.error('Failed to encrypt request:', error);
    throw new Error('Failed to encrypt request payload');
  }
}

/**
 * Decrypt a response payload using the AES key stored for the session ID
 */
export async function decryptResponse<T>(encryptedResponse: EncryptedResponse): Promise<T> {
  try {
    const { sessionId, encryptedData } = encryptedResponse;
    
    // Look up the AES key for this session ID
    const aesKey = aesKeyStore[sessionId];
    
    if (!aesKey) {
      console.error('No AES key found for session:', sessionId);
      console.error('Available sessions:', Object.keys(aesKeyStore));
      throw new Error(`No AES key found for session: ${sessionId}`);
    }

    // Use the AES key that was used for this specific request
    const decrypted = await decryptPayload<T>(encryptedData, aesKey);
    
    // Clean up the AES key after successful decryption
    delete aesKeyStore[sessionId];

    return decrypted;
  } catch (error) {
    console.error('Failed to decrypt response:', error);
    throw new Error('Failed to decrypt response payload');
  }
}

/**
 * Check if response is encrypted
 */
export function isEncryptedResponse(response: any): response is EncryptedResponse {
  return (
    response &&
    typeof response.sessionId === 'string' &&
    typeof response.encryptedData === 'string' &&
    typeof response.encryptedKey === 'string'
  );
}

/**
 * Clear current session (useful for logout or error recovery)
 */
export function clearSession(): void {
  currentSession = null;
}

/**
 * Get current session info (for debugging)
 */
export function getCurrentSession(): SessionInfo | null {
  return currentSession;
}

// Export for backward compatibility
export const encryptionService = {
  getPublicKey,
  encryptRequest,
  decryptResponse,
  isEncryptedResponse,
  clearSession,
  getCurrentSession,
};

export default encryptionService;
