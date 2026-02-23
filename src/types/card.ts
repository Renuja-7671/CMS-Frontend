// Frontend form data
export interface CreateCardRequest {
  cardNumber: string;
  expiryDate: string;
  cardStatus: string;
  creditLimit: number;
  cashLimit: number;
  availableCreditLimit: number;
  availableCashLimit: number;
}

// Backend API payload (only fields backend accepts)
export interface CreateCardBackendRequest {
  cardNumber: string;
  expiryDate: string;
  creditLimit: number;
  cashLimit: number;
  lastUpdatedUser: string;
}

// Update card request for backend
export interface UpdateCardRequest {
  displayCardNumber: string;
  encryptionKey: string;
  expiryDate: string;
  creditLimit: number;
  cashLimit: number;
  availableCreditLimit: number;
  availableCashLimit: number;
  lastUpdatedUser: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

// Pagination types
export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface PageRequest {
  page: number;
  size: number;
  sortBy?: string;
  sortDirection?: string;
}

// Card Request types
export interface CreateCardRequestDTO {
  displayCardNumber: string;
  encryptionKey: string;
  requestType: 'ACTI' | 'CDCL';  // ACTI = Activation, CDCL = Card Close (Deactivation)
  reason?: string;
  requestedUser: string;  // Username of the user creating the request
}

export interface CardRequestDTO {
  requestId: number;
  displayCardNumber: string;
  encryptionKey: string;
  requestType: string;
  requestTypeDescription: string;
  requestStatus: string;
  requestStatusDescription: string;
  reason?: string;
  requestedAt: string;
  processedAt?: string;
}

// Card Request with full card details for confirmation page
export interface CardRequestDetailDTO {
  // Request Information
  requestId: number;
  requestType: string;
  requestTypeDescription: string;
  requestStatus: string;
  requestStatusDescription: string;
  reason?: string;
  requestedAt: string;
  processedAt?: string;
  
  // Card Information
  displayCardNumber: string;
  encryptionKey: string;
  expiryDate: string;
  cardStatus: string;
  cardStatusDescription: string;
  creditLimit: number;
  cashLimit: number;
  availableCreditLimit: number;
  availableCashLimit: number;
  usedCreditLimit: number;
  usedCashLimit: number;
  lastUpdateTime: string;
}
