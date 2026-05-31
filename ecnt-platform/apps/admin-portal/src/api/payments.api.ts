import apiClient from './client';

export interface PaymentFilters {
  search?: string;
  status?: string;
  method?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export const paymentsApi = {
  getAll: (params?: PaymentFilters) => apiClient.get('/payments', { params }),
  getById: (id: string) => apiClient.get(`/payments/${id}`),
  refund: (id: string, amount?: number, reason?: string) =>
    apiClient.post(`/payments/${id}/refund`, { amount, reason }),
  getStats: (params?: { startDate?: string; endDate?: string }) =>
    apiClient.get('/payments/stats', { params }),
  getRevenueChart: (params?: { startDate?: string; endDate?: string; groupBy?: string }) =>
    apiClient.get('/payments/revenue-chart', { params }),
  exportCsv: (params?: PaymentFilters) =>
    apiClient.get('/payments/export', { params, responseType: 'blob' }),
  getSettlements: (params?: Record<string, unknown>) =>
    apiClient.get('/payments/settlements', { params }),
};
