import { AxiosError } from 'axios';
import type { BackendErrorResponse } from '../types/error';

/**
 * Extract error message from backend error response
 */
function extractBackendMessage(error: AxiosError): string {
  const response = error.response?.data as BackendErrorResponse | undefined;
  
  if (!response) {
    // Network or request setup error
    if (error.code === 'ERR_NETWORK' || error.message.includes('Network Error')) {
      return 'Network error. Please check your internet connection and ensure the server is running.';
    }
    
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      return 'Request timeout. The server is taking too long to respond. Please try again.';
    }
    
    return error.message || 'An unexpected error occurred.';
  }

  // Get message from backend ErrorResponse
  let message = response.message || 'An error occurred';
  
  // If validation errors exist, append them
  if (response.validationErrors && Object.keys(response.validationErrors).length > 0) {
    const fieldErrors = Object.entries(response.validationErrors)
      .map(([field, msg]) => `${field}: ${msg}`)
      .join(', ');
    message = `${message}. ${fieldErrors}`;
  }

  return message;
}

/**
 * Extract user-friendly error message from any error
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    return extractBackendMessage(error);
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unexpected error occurred. Please try again.';
}

/**
 * Log error to console in development mode only
 */
export function logError(error: unknown, context?: string): void {
  if (import.meta.env.DEV) {
    console.group(`❌ ${context || 'Error'}`);
    console.groupEnd();
  }
}

/**
 * Handle API error with user-friendly message and optional logging
 */
export function handleApiError(error: unknown, context?: string): string {
  logError(error, context);
  return getErrorMessage(error);
}
