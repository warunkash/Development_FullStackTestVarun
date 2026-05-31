import apiClient from './client';

export const chargersApi = {
  getAll: (params?: Record<string, unknown>) => apiClient.get('/chargers', { params }),
  getById: (id: string) => apiClient.get(`/chargers/${id}`),
  getByStation: (stationId: string) => apiClient.get(`/stations/${stationId}/chargers`),
  updateStatus: (id: string, status: string) =>
    apiClient.put(`/chargers/${id}/status`, { status }),
  reset: (id: string) => apiClient.post(`/chargers/${id}/reset`),
  getStats: (id: string, params?: Record<string, unknown>) =>
    apiClient.get(`/chargers/${id}/stats`, { params }),
  update: (id: string, data: Record<string, unknown>) => apiClient.put(`/chargers/${id}`, data),
  getLiveStatus: (ids: string[]) => apiClient.post('/chargers/live-status', { ids }),
};
