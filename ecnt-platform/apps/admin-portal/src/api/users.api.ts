import apiClient from './client';

export const usersApi = {
  getAll: (params?: Record<string, unknown>) => apiClient.get('/users', { params }),
  getById: (id: string) => apiClient.get(`/users/${id}`),
  update: (id: string, data: Record<string, unknown>) => apiClient.put(`/users/${id}`, data),
  suspend: (id: string, reason: string) => apiClient.post(`/users/${id}/suspend`, { reason }),
  activate: (id: string) => apiClient.post(`/users/${id}/activate`),
  delete: (id: string) => apiClient.delete(`/users/${id}`),
  getSessions: (id: string, params?: Record<string, unknown>) =>
    apiClient.get(`/users/${id}/sessions`, { params }),
  getPayments: (id: string, params?: Record<string, unknown>) =>
    apiClient.get(`/users/${id}/payments`, { params }),
  getStats: (id: string) => apiClient.get(`/users/${id}/stats`),
  exportCsv: (params?: Record<string, unknown>) =>
    apiClient.get('/users/export', { params, responseType: 'blob' }),
  adjustWallet: (id: string, amount: number, reason: string) =>
    apiClient.post(`/users/${id}/wallet/adjust`, { amount, reason }),
};
