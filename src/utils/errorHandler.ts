import { AxiosError } from 'axios';
import type { ApiResponse } from '../types/card';

/**
 * Error type with custom properties
 */
interface CustomError {
  isApiError?: boolean;
  response?: {
    data?: unknown;
  };
  code?: string;
  message?: string;
}

/**
 * Extract error message from backend API response
 * Backend returns 200 OK for all responses with success flag
 */
function extractBackendMessage(error: AxiosError | CustomError): string {
  // Check if this is an API error from our interceptor
  if ('isApiError' in error && error.isApiError && error.response?.data) {
    const apiResponse = error.response.data as ApiResponse<unknown>;
    
    // Get message from ApiResponse
    let message = apiResponse.message || 'An error occurred';
    
    // If data contains field-level validation errors (object with error messages)
    if (apiResponse.data && typeof apiResponse.data === 'object' && !Array.isArray(apiResponse.data)) {
      const fieldErrors = Object.entries(apiResponse.data)
        .map(([field, msg]) => `${field}: ${msg}`)
        .join(', ');
      if (fieldErrors) {
        message = `${message}\n${fieldErrors}`;
      }
    }
    
    return message;
  }
  
  // Handle axios errors (network errors, timeouts, etc.)
  if (error.response) {
    // Server responded but not with our API structure
    const data = error.response.data as Record<string, unknown>;
    return (typeof data?.message === 'string' ? data.message : null) || 'An error occurred';
  }
  
  // Network or request setup error
  if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
    return 'Network error. Please check your internet connection and ensure the server is running.';
  }
  
  if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
    return 'Request timeout. The server is taking too long to respond. Please try again.';
  }
  
  return error.message || 'An unexpected error occurred.';
}

/**
 * Extract user-friendly error message from any error
 */
export function getErrorMessage(error: unknown): string {
  // Check if this is our custom API error from the interceptor
  if (typeof error === 'object' && error !== null && 'isApiError' in error) {
    return extractBackendMessage(error as CustomError);
  }
  
  // Check if this is an AxiosError
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
 * API errors (isApiError: true) are not logged since they're visible in Network tab
 * Only logs unexpected errors (network issues, unknown errors)
 */
export function logError(error: unknown, context?: string): void {
  if (import.meta.env.DEV) {
    // Check if this is an API error from our backend
    const isApiError = typeof error === 'object' && error !== null && 'isApiError' in error;
    
    if (isApiError) {
      // API errors are already visible in Network tab - no need to log
      return;
    }
    
    // For network errors or unexpected errors, log the full error
    console.group(`❌ ${context || 'Error'}`);
    console.error(error);
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
