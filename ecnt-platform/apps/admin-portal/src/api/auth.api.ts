import apiClient from './client';

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    roles: string[];
  };
}

export const authApi = {
  login: (credentials: LoginCredentials): Promise<LoginResponse> =>
    apiClient.post('/auth/admin/login', credentials),

  logout: (): Promise<void> =>
    apiClient.post('/auth/logout'),

  refreshToken: (): Promise<{ token: string }> =>
    apiClient.post('/auth/refresh'),

  getProfile: () =>
    apiClient.get('/auth/profile'),

  updateProfile: (data: Partial<{ firstName: string; lastName: string; avatar: string }>) =>
    apiClient.put('/auth/profile', data),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    apiClient.put('/auth/change-password', data),

  forgotPassword: (email: string): Promise<void> =>
    apiClient.post('/auth/forgot-password', { email }),

  resetPassword: (token: string, newPassword: string): Promise<void> =>
    apiClient.post('/auth/reset-password', { token, newPassword }),
};
