import axios from 'axios';
import type { CreateCardBackendRequest, UpdateCardRequest, ApiResponse, CreateCardRequestDTO, CardRequestDTO, CardRequestDetailDTO } from '../types/card';

const API_BASE_URL = 'http://localhost:8090/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Suppress console errors for expected API errors (4xx, 5xx)
    // The error will still be caught by the calling code's catch block
    
    // Don't log expected API errors to console - they're handled in the UI
    // Only log unexpected errors (network issues, etc.)
    if (!error.response) {
      // Network error or request setup error
      if (import.meta.env.DEV) {
        console.error('Network/Request Error:', error.message);
      }
    }
    // For all errors (including API errors), return rejected promise
    // so the calling code can handle them
    return Promise.reject(error);
  }
);

export interface CardDTO {
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

export const cardService = {
  createCard: async (cardData: CreateCardBackendRequest) => {
    const response = await api.post<ApiResponse<CardDTO>>('/cards', cardData);
    return response.data;
  },

  createCardEncrypted: async (encryptedData: string, encryptionKey: string) => {
    console.log('Creating card with encrypted data:', { encryptedData, encryptionKey });
    const response = await api.post<ApiResponse<CardDTO>>('/cards/encrypted', {
      encryptedData,
      encryptionKey,
      payloadType: 'CREATE_CARD'
    });
    return response.data;
  },

  /**
   * Create card with secure RSA + AES hybrid encryption
   * @param sessionId Session ID from public key request
   * @param encryptedData AES-encrypted payload data
   * @param encryptedKey RSA-encrypted AES key
   * @returns API response with created card
   */
  createCardSecure: async (sessionId: string, encryptedData: string, encryptedKey: string) => {
    const response = await api.post<ApiResponse<CardDTO>>('/cards/secure', {
      sessionId,
      encryptedData,
      encryptedKey,
      payloadType: 'CREATE_CARD'
    });
    return response.data;
  },
  
  updateCard: async (updateData: UpdateCardRequest) => {
    const response = await api.put<ApiResponse<CardDTO>>('/cards', updateData);
    return response.data;
  },
  
  getAllCards: async () => {
    const response = await api.get<ApiResponse<CardDTO[]>>('/cards');
    return response.data;
  },
  
  getCardsByStatus: async (status: string) => {
    const response = await api.get<ApiResponse<CardDTO[]>>(`/cards/status/${status}`);
    return response.data;
  },
};

export const cardRequestService = {
  createCardRequest: async (requestData: CreateCardRequestDTO) => {
    const response = await api.post<ApiResponse<CardRequestDTO>>('/card-requests', requestData);
    return response.data;
  },
  
  getAllCardRequests: async () => {
    const response = await api.get<ApiResponse<CardRequestDTO[]>>('/card-requests');
    return response.data;
  },
  
  getPendingRequestsWithDetails: async () => {
    const response = await api.get<ApiResponse<CardRequestDetailDTO[]>>('/card-requests/pending/details');
    return response.data;
  },
  
  approveRequest: async (requestId: number) => {
    const response = await api.put<ApiResponse<CardRequestDetailDTO>>(`/card-requests/${requestId}/approve/details`);
    return response.data;
  },
  
  rejectRequest: async (requestId: number) => {
    const response = await api.put<ApiResponse<CardRequestDetailDTO>>(`/card-requests/${requestId}/reject/details`);
    return response.data;
  },
};
