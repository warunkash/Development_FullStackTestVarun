import apiClient from './client';

export const sessionsApi = {
  getAll: (params?: Record<string, unknown>) => apiClient.get('/sessions', { params }),
  getById: (id: string) => apiClient.get(`/sessions/${id}`),
  getActive: () => apiClient.get('/sessions/active'),
  stop: (id: string) => apiClient.post(`/sessions/${id}/stop`),
  exportCsv: (params?: Record<string, unknown>) =>
    apiClient.get('/sessions/export', { params, responseType: 'blob' }),
  getStats: (params?: Record<string, unknown>) => apiClient.get('/sessions/stats', { params }),
  getHeatmap: (params?: Record<string, unknown>) =>
    apiClient.get('/sessions/heatmap', { params }),
};
