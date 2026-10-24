import axios from "axios";

/**
 * baseURL — адрес сервера из openapi.yaml (`servers: http://localhost:8080`),
 * пути запросов пишем целиком, как в спецификации: `/api/v1/...`.
 * Пустой VITE_API_URL — запросы идут на текущий origin (в dev их проксирует vite).
 */
const apiClient = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL ?? ''}`,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * FIXME(openapi): формат `{ items, total }` — только предполагаемый контракт /api/v1/news.
 * Реальные списочные эндпоинты отдают массив под своим ключом (`companies`, `users`, `roles`)
 * и `{ total, limit, offset }` — новости стоит согласовать с backend в том же стиле.
 */
interface PaginatedResponse<T> {
  items: T[];
  total: number;
}

interface PaginationParams {
  limit?: number;
  offset?: number;
}

export { apiClient, type PaginatedResponse, type PaginationParams };
