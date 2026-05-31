import apiClient from './client';

export const paymentsApi = {
  getAll: (params?: Record<string, unknown>) => apiClient.get('/payments', { params }),
  getById: (id: string) => apiClient.get(`/payments/${id}`),
  refund: (id: string, amount?: number, reason?: string) =>
    apiClient.post(`/payments/${id}/refund`, { amount, reason }),
  getStats: (params?: Record<string, unknown>) => apiClient.get('/payments/stats', { params }),
  getRevenueChart: (params?: Record<string, unknown>) =>
    apiClient.get('/payments/revenue-chart', { params }),
  exportCsv: (params?: Record<string, unknown>) =>
    apiClient.get('/payments/export', { params, responseType: 'blob' }),
  getSettlements: (params?: Record<string, unknown>) =>
    apiClient.get('/payments/settlements', { params }),
};
