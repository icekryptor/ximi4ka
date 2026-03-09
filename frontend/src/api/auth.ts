import { apiClient } from './client';

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export const authApi = {
  login(data: LoginRequest): Promise<AuthResponse> {
    return apiClient.post<AuthResponse>('/auth/login', data).then((r) => r.data);
  },

  register(data: RegisterRequest): Promise<AuthResponse> {
    return apiClient.post<AuthResponse>('/auth/register', data).then((r) => r.data);
  },

  me(): Promise<User> {
    return apiClient.get<User>('/auth/me').then((r) => r.data);
  },
};
