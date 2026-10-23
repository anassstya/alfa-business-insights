import axios from "axios";

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

interface PaginatedResponse<T> {
  items: T[];
  total: number;
}

interface PaginationParams {
  limit?: number;
  offset?: number;
}

export { apiClient, type PaginatedResponse, type PaginationParams };
