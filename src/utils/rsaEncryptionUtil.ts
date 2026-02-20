/**
 * RSA Encryption Utility for Frontend
 * Handles RSA public key encryption for secure key exchange
 * Works with backend's RSA/ECB/OAEPWITHSHA-256ANDMGF1PADDING
 */

/**
 * Convert Base64-encoded public key to CryptoKey object
 * @param base64PublicKey Base64-encoded public key from backend
 * @returns CryptoKey object for encryption
 */
async function importPublicKey(base64PublicKey: string): Promise<CryptoKey> {
  try {
    // Remove PEM headers if present
    const pemHeader = "-----BEGIN PUBLIC KEY-----";
    const pemFooter = "-----END PUBLIC KEY-----";
    const pemContents = base64PublicKey
      .replace(pemHeader, "")
      .replace(pemFooter, "")
      .replace(/\s/g, "");

    // Decode base64 to binary
    const binaryDer = atob(pemContents);
    const binaryDerArray = new Uint8Array(binaryDer.length);
    for (let i = 0; i < binaryDer.length; i++) {
      binaryDerArray[i] = binaryDer.charCodeAt(i);
    }

    // Import the key
    return await crypto.subtle.importKey(
      "spki",
      binaryDerArray.buffer,
      {
        name: "RSA-OAEP",
        hash: "SHA-256",
      },
      false,
      ["encrypt"]
    );
  } catch (error) {
    console.error("Failed to import RSA public key:", error);
    throw new Error("Failed to import RSA public key");
  }
}

/**
 * Encrypt data with RSA public key
 * Uses RSA-OAEP with SHA-256 to match backend configuration
 * 
 * @param data Data to encrypt (typically an AES key)
 * @param base64PublicKey Base64-encoded RSA public key
 * @returns Base64-encoded encrypted data
 */
export async function encryptWithPublicKey(
  data: Uint8Array,
  base64PublicKey: string
): Promise<string> {
  try {
    const publicKey = await importPublicKey(base64PublicKey);

    // Encrypt the data using RSA-OAEP
    const encryptedBuffer = await crypto.subtle.encrypt(
      {
        name: "RSA-OAEP",
      },
      publicKey,
      data as BufferSource
    );

    // Convert to base64
    const encryptedArray = new Uint8Array(encryptedBuffer);
    return btoa(String.fromCharCode(...encryptedArray));
  } catch (error) {
    console.error("RSA encryption failed:", error);
    throw new Error("Failed to encrypt with RSA public key");
  }
}

/**
 * Encrypt AES key with RSA public key
 * 
 * @param base64AESKey Base64-encoded AES key
 * @param base64PublicKey Base64-encoded RSA public key
 * @returns Base64-encoded encrypted AES key
 */
export async function encryptAESKey(
  base64AESKey: string,
  base64PublicKey: string
): Promise<string> {
  try {
    // Decode the AES key from base64 to bytes
    const aesKeyBytes = Uint8Array.from(atob(base64AESKey), c => c.charCodeAt(0));
    
    // Encrypt with RSA public key
    return await encryptWithPublicKey(aesKeyBytes, base64PublicKey);
  } catch (error) {
    console.error("Failed to encrypt AES key:", error);
    throw new Error("Failed to encrypt AES key with RSA");
  }
}

/**
 * Fetch RSA public key from backend
 * 
 * @param apiBaseUrl Base URL of the API
 * @returns Object containing sessionId and publicKey
 */
export async function fetchPublicKey(apiBaseUrl: string): Promise<{
  sessionId: string;
  publicKey: string;
}> {
  try {
    const response = await fetch(`${apiBaseUrl}/encryption/public-key`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch public key: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.data || !data.data.sessionId || !data.data.publicKey) {
      throw new Error('Invalid public key response format');
    }

    return {
      sessionId: data.data.sessionId,
      publicKey: data.data.publicKey,
    };
  } catch (error) {
    console.error("Failed to fetch public key:", error);
    throw new Error("Failed to fetch RSA public key from server");
  }
}
