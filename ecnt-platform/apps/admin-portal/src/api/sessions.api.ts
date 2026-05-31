import apiClient from './client';

export interface SessionFilters {
  search?: string;
  status?: string;
  stationId?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export const sessionsApi = {
  getAll: (params?: SessionFilters) => apiClient.get('/sessions', { params }),
  getById: (id: string) => apiClient.get(`/sessions/${id}`),
  getActive: () => apiClient.get('/sessions/active'),
  stop: (id: string) => apiClient.post(`/sessions/${id}/stop`),
  exportCsv: (params?: SessionFilters) =>
    apiClient.get('/sessions/export', { params, responseType: 'blob' }),
  getStats: (params?: { startDate?: string; endDate?: string; stationId?: string }) =>
    apiClient.get('/sessions/stats', { params }),
  getHeatmap: (params?: { startDate?: string; endDate?: string; stationId?: string }) =>
    apiClient.get('/sessions/heatmap', { params }),
};
