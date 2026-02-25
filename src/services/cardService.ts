import axios from 'axios';
import type { CreateCardBackendRequest, UpdateCardRequest, ApiResponse, PageResponse, CreateCardRequestDTO, CardRequestDTO, CardRequestDetailDTO } from '../types/card';
import { encryptRequest, decryptResponse, isEncryptedResponse } from './encryptionService';

const API_BASE_URL = 'http://localhost:8090/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor for error handling and automatic decryption
api.interceptors.response.use(
  async (response) => {
    // Check if response is encrypted
    if (response.data && isEncryptedResponse(response.data)) {
      try {
        // Automatically decrypt encrypted responses
        const decrypted = await decryptResponse(response.data);
        response.data = decrypted;
      } catch (error) {
        console.error('Failed to decrypt response:', error);
        return Promise.reject({
          response: response,
          isDecryptionError: true,
          message: 'Failed to decrypt response'
        });
      }
    }

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
  cardNumber?: string; // Plain card number (optional, only included when needed)
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
    // Use encrypted endpoint for all card creation
    const encrypted = await encryptRequest(cardData, 'CREATE_CARD');
    const response = await api.post<ApiResponse<CardDTO>>('/cards', encrypted);
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
    // Encrypt update request
    const encrypted = await encryptRequest(updateData, 'UPDATE_CARD');
    const response = await api.put<ApiResponse<CardDTO>>('/cards', encrypted);
    return response.data;
  },
  
  getAllCards: async () => {
    // Use encrypted POST endpoint instead of GET
    const encrypted = await encryptRequest({}, 'GET_ALL_CARDS');
    const response = await api.post<ApiResponse<CardDTO[]>>('/cards/query/all', encrypted);
    return response.data;
  },
  
  getAllCardsPaginated: async (page: number = 0, size: number = 10, status?: string, search?: string) => {
    // Use encrypted POST endpoint with query parameters in body
    const queryRequest = {
      page,
      size,
      status: status && status !== 'ALL' ? status : undefined,
      search: search && search.trim() !== '' ? search.trim() : undefined,
    };
    
    const encrypted = await encryptRequest(queryRequest, 'GET_CARDS_PAGINATED');
    const response = await api.post<ApiResponse<PageResponse<CardDTO>>>('/cards/query/paginated', encrypted);
    return response.data;
  },
  
  getCardsByStatus: async (status: string) => {
    const response = await api.get<ApiResponse<CardDTO[]>>(`/cards/status/${status}`);
    return response.data;
  },

  /**
   * View plain card number with admin password verification
   */
  viewPlainCardNumber: async (cardId: string, adminPassword: string) => {
    // Encrypt the request payload
    const requestData = { cardId, adminPassword };
    const encrypted = await encryptRequest(requestData, 'VIEW_PLAIN_CARD_NUMBER');
    
    const response = await api.post<ApiResponse<{
      cardId: string;
      plainCardNumber: string;
      maskedCardNumber: string;
    }>>('/cards/view-plain-number', encrypted);
    return response.data;
  },
};

export const cardRequestService = {
  createCardRequest: async (requestData: CreateCardRequestDTO) => {
    // Encrypt card request creation
    const encrypted = await encryptRequest(requestData, 'CREATE_CARD_REQUEST');
    const response = await api.post<ApiResponse<CardRequestDTO>>('/card-requests', encrypted);
    return response.data;
  },
  
  getAllCardRequests: async () => {
    // Use encrypted POST endpoint
    const encrypted = await encryptRequest({}, 'GET_ALL_CARD_REQUESTS');
    const response = await api.post<ApiResponse<CardRequestDTO[]>>('/card-requests/query/all', encrypted);
    return response.data;
  },
  
  getAllCardRequestsPaginated: async (page: number = 0, size: number = 10, status?: string, search?: string) => {
    // Use encrypted POST endpoint with query parameters in body
    const queryRequest = {
      page,
      size,
      status: status && status !== 'ALL' ? status : undefined,
      search: search && search.trim() !== '' ? search.trim() : undefined,
    };
    
    const encrypted = await encryptRequest(queryRequest, 'GET_CARD_REQUESTS_PAGINATED');
    const response = await api.post<ApiResponse<PageResponse<CardRequestDTO>>>('/card-requests/query/paginated', encrypted);
    return response.data;
  },
  
  getPendingRequestsWithDetails: async () => {
    const response = await api.get<ApiResponse<CardRequestDetailDTO[]>>('/card-requests/pending/details');
    return response.data;
  },
  
  getPendingRequestsWithDetailsPaginated: async (page: number = 0, size: number = 10, status: string = 'PEND') => {
    // Use encrypted POST endpoint
    const queryRequest = {
      page,
      size,
      status,
    };
    
    const encrypted = await encryptRequest(queryRequest, 'GET_PENDING_REQUESTS_WITH_DETAILS');
    const response = await api.post<ApiResponse<PageResponse<CardRequestDetailDTO>>>('/card-requests/query/pending/details', encrypted);
    return response.data;
  },
  
  approveRequest: async (requestId: number, approvedUser: string) => {
    // Encrypt approval request
    const encrypted = await encryptRequest({ approvedUser }, 'APPROVE_REQUEST');
    const response = await api.put<ApiResponse<CardRequestDetailDTO>>(
      `/card-requests/${requestId}/approve/details`,
      encrypted
    );
    return response.data;
  },
  
  rejectRequest: async (requestId: number, approvedUser: string) => {
    // Encrypt rejection request
    const encrypted = await encryptRequest({ approvedUser }, 'REJECT_REQUEST');
    const response = await api.put<ApiResponse<CardRequestDetailDTO>>(
      `/card-requests/${requestId}/reject/details`,
      encrypted
    );
    return response.data;
  },
};
