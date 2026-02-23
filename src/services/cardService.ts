import axios from 'axios';
import type { CreateCardBackendRequest, UpdateCardRequest, ApiResponse, PageResponse, CreateCardRequestDTO, CardRequestDTO, CardRequestDetailDTO } from '../types/card';

const API_BASE_URL = 'http://localhost:8090/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor for error handling
// Backend returns 200 OK for all responses with a success flag
api.interceptors.response.use(
  (response) => {
    // Check if response has success flag (all API responses should have this)
    if (response.data && typeof response.data.success === 'boolean') {
      // If success is false, treat as error even though HTTP status is 200
      if (!response.data.success) {
        return Promise.reject({
          response: response,
          isApiError: true,
          message: response.data.message || 'Operation failed'
        });
      }
    }
    return response;
  },
  (error) => {
    // Network error or request setup error (no response from server)
    if (!error.response) {
      if (import.meta.env.DEV) {
        console.error('Network/Request Error:', error.message);
      }
    }
    // For all errors, return rejected promise so calling code can handle them
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
  
  getAllCardsPaginated: async (page: number = 0, size: number = 10, status?: string, search?: string) => {
    const params = new URLSearchParams({
      page: page.toString(),
      size: size.toString(),
    });
    
    if (status && status !== 'ALL') {
      params.append('status', status);
    }
    
    if (search && search.trim() !== '') {
      params.append('search', search.trim());
    }
    
    const response = await api.get<ApiResponse<PageResponse<CardDTO>>>(`/cards/paginated?${params.toString()}`);
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
  
  getAllCardRequestsPaginated: async (page: number = 0, size: number = 10, status?: string, search?: string) => {
    const params = new URLSearchParams({
      page: page.toString(),
      size: size.toString(),
    });
    
    if (status && status !== 'ALL') {
      params.append('status', status);
    }
    
    if (search && search.trim() !== '') {
      params.append('search', search.trim());
    }
    
    const response = await api.get<ApiResponse<PageResponse<CardRequestDTO>>>(`/card-requests/paginated?${params.toString()}`);
    return response.data;
  },
  
  getPendingRequestsWithDetails: async () => {
    const response = await api.get<ApiResponse<CardRequestDetailDTO[]>>('/card-requests/pending/details');
    return response.data;
  },
  
  getPendingRequestsWithDetailsPaginated: async (page: number = 0, size: number = 10) => {
    const response = await api.get<ApiResponse<PageResponse<CardRequestDetailDTO>>>(`/card-requests/pending/details/paginated?page=${page}&size=${size}`);
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
