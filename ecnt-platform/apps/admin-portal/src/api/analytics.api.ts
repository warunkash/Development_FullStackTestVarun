import apiClient from './client';

export interface AnalyticsParams {
  startDate?: string;
  endDate?: string;
  stationId?: string;
  groupBy?: 'day' | 'week' | 'month';
}

export const analyticsApi = {
  getDashboard: () => apiClient.get('/analytics/dashboard'),
  getRevenue: (params?: AnalyticsParams) => apiClient.get('/analytics/revenue', { params }),
  getEnergy: (params?: AnalyticsParams) => apiClient.get('/analytics/energy', { params }),
  getUtilization: (params?: AnalyticsParams) => apiClient.get('/analytics/utilization', { params }),
  getSessions: (params?: AnalyticsParams) => apiClient.get('/analytics/sessions', { params }),
  getCarbonSavings: (params?: AnalyticsParams) => apiClient.get('/analytics/carbon', { params }),
  getStationPerformance: (params?: AnalyticsParams) =>
    apiClient.get('/analytics/stations/performance', { params }),
  getUserActivity: (params?: AnalyticsParams) =>
    apiClient.get('/analytics/users/activity', { params }),
  exportReport: (params?: AnalyticsParams & { format?: 'pdf' | 'csv' | 'excel' }) =>
    apiClient.get('/analytics/export', { params, responseType: 'blob' }),
};
