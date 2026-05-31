import apiClient from './client';

export interface FleetFilters {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export const fleetApi = {
  getAll: (params?: FleetFilters) => apiClient.get('/fleet', { params }),
  getById: (id: string) => apiClient.get(`/fleet/${id}`),
  create: (data: Record<string, unknown>) => apiClient.post('/fleet', data),
  update: (id: string, data: Record<string, unknown>) => apiClient.put(`/fleet/${id}`, data),
  delete: (id: string) => apiClient.delete(`/fleet/${id}`),
  getVehicles: (id: string) => apiClient.get(`/fleet/${id}/vehicles`),
  addVehicle: (id: string, data: Record<string, unknown>) =>
    apiClient.post(`/fleet/${id}/vehicles`, data),
  removeVehicle: (fleetId: string, vehicleId: string) =>
    apiClient.delete(`/fleet/${fleetId}/vehicles/${vehicleId}`),
  getDrivers: (id: string) => apiClient.get(`/fleet/${id}/drivers`),
  getStats: (id: string, params?: Record<string, unknown>) =>
    apiClient.get(`/fleet/${id}/stats`, { params }),
  getBilling: (id: string, params?: Record<string, unknown>) =>
    apiClient.get(`/fleet/${id}/billing`, { params }),
  updateBillingPlan: (id: string, planData: Record<string, unknown>) =>
    apiClient.put(`/fleet/${id}/billing-plan`, planData),
};
