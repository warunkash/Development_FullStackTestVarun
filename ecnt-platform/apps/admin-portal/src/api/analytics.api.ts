import apiClient from './client';

export const analyticsApi = {
  getDashboard: () => apiClient.get('/analytics/dashboard'),
  getRevenue: (params?: Record<string, unknown>) => apiClient.get('/analytics/revenue', { params }),
  getEnergy: (params?: Record<string, unknown>) => apiClient.get('/analytics/energy', { params }),
  getUtilization: (params?: Record<string, unknown>) =>
    apiClient.get('/analytics/utilization', { params }),
  getSessions: (params?: Record<string, unknown>) =>
    apiClient.get('/analytics/sessions', { params }),
  getCarbonSavings: (params?: Record<string, unknown>) =>
    apiClient.get('/analytics/carbon', { params }),
  getStationPerformance: (params?: Record<string, unknown>) =>
    apiClient.get('/analytics/stations/performance', { params }),
  exportReport: (params?: Record<string, unknown>) =>
    apiClient.get('/analytics/export', { params, responseType: 'blob' }),
};
