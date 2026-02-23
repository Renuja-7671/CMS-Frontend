import axios from 'axios';
import type { UserDTO, ApiResponse } from '../types/user';

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

/**
 * Get all active users (for dropdown selection)
 */
export const getActiveUsers = async (): Promise<UserDTO[]> => {
  try {
    const response = await api.get<ApiResponse<UserDTO[]>>('/users/status/ACT');
    return response.data.data;
  } catch (error: any) {
    console.error('Error fetching active users:', error);
    throw error;
  }
};

/**
 * Get all users
 */
export const getAllUsers = async (): Promise<UserDTO[]> => {
  try {
    const response = await api.get<ApiResponse<UserDTO[]>>('/users');
    return response.data.data;
  } catch (error: any) {
    console.error('Error fetching users:', error);
    throw error;
  }
};

/**
 * Get user by username
 */
export const getUserByUserName = async (userName: string): Promise<UserDTO> => {
  try {
    const response = await api.get<ApiResponse<UserDTO>>(`/users/${userName}`);
    return response.data.data;
  } catch (error: any) {
    console.error(`Error fetching user ${userName}:`, error);
    throw error;
  }
};
