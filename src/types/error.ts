/**
 * Backend error response structure
 */
export interface BackendErrorResponse {
  timestamp: string;
  status: number;
  error: string;
  message: string;
  validationErrors?: Record<string, string>;
}
