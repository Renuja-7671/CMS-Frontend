/**
 * Utility functions for file downloads and report generation
 */

/**
 * Download a blob as a file
 * @param blob - The blob to download
 * @param fileName - The name for the downloaded file
 */
export const downloadBlob = (blob: Blob, fileName: string): void => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Clean up the URL object
  window.URL.revokeObjectURL(url);
};

/**
 * Generate a filename with timestamp
 * @param baseName - Base name for the file (e.g., 'card-report')
 * @param extension - File extension (e.g., 'pdf', 'csv')
 * @returns Formatted filename with timestamp
 */
export const generateFileName = (baseName: string, extension: string): string => {
  const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return `${baseName}-${timestamp}.${extension}`;
};

/**
 * Generate a filename with full timestamp including time
 * @param baseName - Base name for the file
 * @param extension - File extension
 * @returns Formatted filename with full timestamp
 */
export const generateFileNameWithTime = (baseName: string, extension: string): string => {
  const now = new Date();
  const date = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const time = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
  return `${baseName}-${date}-${time}.${extension}`;
};

/**
 * Format file size in human-readable format
 * @param bytes - File size in bytes
 * @returns Formatted string (e.g., "1.5 MB")
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

/**
 * Validate file blob before download
 * @param blob - The blob to validate
 * @param expectedType - Expected MIME type (optional)
 * @returns true if valid, false otherwise
 */
export const validateBlob = (blob: Blob, expectedType?: string): boolean => {
  if (!blob || blob.size === 0) {
    return false;
  }
  
  if (expectedType && !blob.type.includes(expectedType)) {
    return false;
  }
  
  return true;
};

/**
 * Get file extension from MIME type
 * @param mimeType - MIME type string
 * @returns File extension
 */
export const getExtensionFromMimeType = (mimeType: string): string => {
  const mimeMap: Record<string, string> = {
    'application/pdf': 'pdf',
    'text/csv': 'csv',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/json': 'json',
    'text/plain': 'txt',
  };
  
  return mimeMap[mimeType] || 'bin';
};

/**
 * Open blob in new tab (for preview)
 * @param blob - The blob to open
 */
export const openBlobInNewTab = (blob: Blob): void => {
  const url = window.URL.createObjectURL(blob);
  window.open(url, '_blank');
  
  // Note: URL will be revoked when the tab is closed
  // We can't revoke it immediately as the new tab needs it
};

/**
 * Check if browser supports file downloads
 * @returns true if supported
 */
export const supportsDownload = (): boolean => {
  const link = document.createElement('a');
  return typeof link.download !== 'undefined';
};

/**
 * Create a printable version from blob (for PDFs)
 * @param blob - PDF blob
 */
export const printBlob = (blob: Blob): void => {
  const url = window.URL.createObjectURL(blob);
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = url;
  
  document.body.appendChild(iframe);
  
  iframe.onload = () => {
    iframe.contentWindow?.print();
    
    // Clean up after a delay
    setTimeout(() => {
      document.body.removeChild(iframe);
      window.URL.revokeObjectURL(url);
    }, 1000);
  };
};

/**
 * Convert blob to base64 string
 * @param blob - The blob to convert
 * @returns Promise resolving to base64 string
 */
export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert blob to base64'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/**
 * Save blob to local storage (as base64)
 * Note: Use with caution - localStorage has size limits (~5MB)
 * @param key - Storage key
 * @param blob - Blob to store
 */
export const saveBlobToLocalStorage = async (key: string, blob: Blob): Promise<void> => {
  const base64 = await blobToBase64(blob);
  localStorage.setItem(key, base64);
};

/**
 * Retrieve blob from local storage
 * @param key - Storage key
 * @returns Blob or null if not found
 */
export const getBlobFromLocalStorage = (key: string): Blob | null => {
  const base64 = localStorage.getItem(key);
  if (!base64) return null;
  
  const byteString = atob(base64.split(',')[1]);
  const mimeString = base64.split(',')[0].split(':')[1].split(';')[0];
  
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  
  return new Blob([ab], { type: mimeString });
};
