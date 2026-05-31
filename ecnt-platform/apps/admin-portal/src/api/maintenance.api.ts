import apiClient from './client';

export interface MaintenanceFilters {
  search?: string;
  status?: string;
  priority?: string;
  stationId?: string;
  assignedTo?: string;
  page?: number;
  limit?: number;
}

export const maintenanceApi = {
  getAll: (params?: MaintenanceFilters) => apiClient.get('/maintenance', { params }),
  getById: (id: string) => apiClient.get(`/maintenance/${id}`),
  create: (data: Record<string, unknown>) => apiClient.post('/maintenance', data),
  update: (id: string, data: Record<string, unknown>) => apiClient.put(`/maintenance/${id}`, data),
  close: (id: string, resolution: string) =>
    apiClient.post(`/maintenance/${id}/close`, { resolution }),
  assign: (id: string, technicianId: string) =>
    apiClient.post(`/maintenance/${id}/assign`, { technicianId }),
  addNote: (id: string, note: string) =>
    apiClient.post(`/maintenance/${id}/notes`, { note }),
  getStats: () => apiClient.get('/maintenance/stats'),
  getOpenTickets: () => apiClient.get('/maintenance?status=open&limit=10'),
};
