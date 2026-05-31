import apiClient from './client';

export interface StationFilters {
  search?: string;
  status?: string;
  city?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CreateStationData {
  name: string;
  code: string;
  address: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  operatorName: string;
  operatorPhone: string;
  amenities: string[];
  openingHours: string;
  franchiseId?: string;
}

export const stationsApi = {
  getAll: (params?: StationFilters) => apiClient.get('/stations', { params }),
  getById: (id: string) => apiClient.get(`/stations/${id}`),
  create: (data: CreateStationData) => apiClient.post('/stations', data),
  update: (id: string, data: Partial<CreateStationData>) => apiClient.put(`/stations/${id}`, data),
  delete: (id: string) => apiClient.delete(`/stations/${id}`),
  getStats: (id: string, params?: { startDate?: string; endDate?: string }) =>
    apiClient.get(`/stations/${id}/stats`, { params }),
  getNearby: (lat: number, lng: number, radius: number) =>
    apiClient.get('/stations/nearby', { params: { lat, lng, radius } }),
  updateStatus: (id: string, status: string) =>
    apiClient.put(`/stations/${id}/status`, { status }),
  exportCsv: (params?: StationFilters) =>
    apiClient.get('/stations/export', { params, responseType: 'blob' }),
  getDashboardStats: () => apiClient.get('/stations/dashboard-stats'),
};
