// User-related type definitions

export interface UserDTO {
  userName: string;
  status: string;
  name: string;
  description: string;
  createdAt: string;
  lastUpdateTime: string;
}

export interface CreateUserRequest {
  userName: string;
  status: string;
  name: string;
  description?: string;
}

export interface UpdateUserRequest {
  userName: string;
  status?: string;
  name?: string;
  description?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}
