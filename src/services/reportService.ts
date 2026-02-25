import axios from 'axios';

const API_BASE_URL = 'http://localhost:8090/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface ReportFilters {
  status?: string;
  search?: string;
  expiryDateFrom?: string;
  expiryDateTo?: string;
  creditLimitMin?: number;
  creditLimitMax?: number;
  cashLimitMin?: number;
  cashLimitMax?: number;
}

export interface CardRequestReportFilters {
  status?: string;
  requestType?: string;
  search?: string;
}

export const reportService = {
  /**
   * Download Card Report as PDF
   * @param filters Report filter options
   * @returns Blob containing the PDF file
   */
  downloadCardReportPDF: async (filters?: ReportFilters): Promise<Blob> => {
    // Build query parameters
    const params = new URLSearchParams();
    
    if (filters?.status && filters.status !== 'ALL') {
      params.append('status', filters.status);
    }
    if (filters?.search && filters.search.trim() !== '') {
      params.append('search', filters.search.trim());
    }
    if (filters?.expiryDateFrom) {
      params.append('expiryDateFrom', filters.expiryDateFrom);
    }
    if (filters?.expiryDateTo) {
      params.append('expiryDateTo', filters.expiryDateTo);
    }
    if (filters?.creditLimitMin !== undefined && filters.creditLimitMin !== null) {
      params.append('creditLimitMin', filters.creditLimitMin.toString());
    }
    if (filters?.creditLimitMax !== undefined && filters.creditLimitMax !== null) {
      params.append('creditLimitMax', filters.creditLimitMax.toString());
    }
    if (filters?.cashLimitMin !== undefined && filters.cashLimitMin !== null) {
      params.append('cashLimitMin', filters.cashLimitMin.toString());
    }
    if (filters?.cashLimitMax !== undefined && filters.cashLimitMax !== null) {
      params.append('cashLimitMax', filters.cashLimitMax.toString());
    }

    const response = await api.get('/reports/cards/pdf', {
      params,
      responseType: 'blob',
      headers: {
        'Accept': 'application/pdf',
      },
    });
    return response.data;
  },

  /**
   * Download Card Report as CSV
   * @param filters Report filter options
   * @returns Blob containing the CSV file
   */
  downloadCardReportCSV: async (filters?: ReportFilters): Promise<Blob> => {
    // Build query parameters
    const params = new URLSearchParams();
    
    if (filters?.status && filters.status !== 'ALL') {
      params.append('status', filters.status);
    }
    if (filters?.search && filters.search.trim() !== '') {
      params.append('search', filters.search.trim());
    }
    if (filters?.expiryDateFrom) {
      params.append('expiryDateFrom', filters.expiryDateFrom);
    }
    if (filters?.expiryDateTo) {
      params.append('expiryDateTo', filters.expiryDateTo);
    }
    if (filters?.creditLimitMin !== undefined && filters.creditLimitMin !== null) {
      params.append('creditLimitMin', filters.creditLimitMin.toString());
    }
    if (filters?.creditLimitMax !== undefined && filters.creditLimitMax !== null) {
      params.append('creditLimitMax', filters.creditLimitMax.toString());
    }
    if (filters?.cashLimitMin !== undefined && filters.cashLimitMin !== null) {
      params.append('cashLimitMin', filters.cashLimitMin.toString());
    }
    if (filters?.cashLimitMax !== undefined && filters.cashLimitMax !== null) {
      params.append('cashLimitMax', filters.cashLimitMax.toString());
    }

    const response = await api.get('/reports/cards/csv', {
      params,
      responseType: 'blob',
      headers: {
        'Accept': 'text/csv',
      },
    });
    return response.data;
  },

  /**
   * Download Card Request Report as PDF
   * @param filters Report filter options
   * @returns Blob containing the PDF file
   */
  downloadCardRequestReportPDF: async (filters?: CardRequestReportFilters): Promise<Blob> => {
    // Build query parameters
    const params = new URLSearchParams();
    
    if (filters?.status && filters.status !== 'ALL') {
      params.append('status', filters.status);
    }
    if (filters?.requestType && filters.requestType !== 'ALL') {
      params.append('requestType', filters.requestType);
    }
    if (filters?.search && filters.search.trim() !== '') {
      params.append('search', filters.search.trim());
    }

    const response = await api.get('/reports/card-requests/pdf', {
      params,
      responseType: 'blob',
      headers: {
        'Accept': 'application/pdf',
      },
    });
    return response.data;
  },

  /**
   * Download Card Request Report as CSV
   * @param filters Report filter options
   * @returns Blob containing the CSV file
   */
  downloadCardRequestReportCSV: async (filters?: CardRequestReportFilters): Promise<Blob> => {
    // Build query parameters
    const params = new URLSearchParams();
    
    if (filters?.status && filters.status !== 'ALL') {
      params.append('status', filters.status);
    }
    if (filters?.requestType && filters.requestType !== 'ALL') {
      params.append('requestType', filters.requestType);
    }
    if (filters?.search && filters.search.trim() !== '') {
      params.append('search', filters.search.trim());
    }

    const response = await api.get('/reports/card-requests/csv', {
      params,
      responseType: 'blob',
      headers: {
        'Accept': 'text/csv',
      },
    });
    return response.data;
  },
};

