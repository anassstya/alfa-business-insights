import { apiClient, type PaginatedResponse } from "@/shared";
import type { NewsItem, NewsParams } from "../model/types";

/**
 * GET /api/v1/news
 *
 * Эндпоинта ещё нет в backend/api/openapi.yaml — контракт предварительный,
 * оформлен по аналогии с /api/v1/companies:
 *   query: company_id, role, date_from, date_to (YYYY-MM-DD), limit, offset
 *   200:   { items: NewsItem[], total: number }
 */
const getNews = async (params: NewsParams, signal?: AbortSignal) => {
  const { data } = await apiClient.get<PaginatedResponse<NewsItem>>('/v1/news', { params, signal });

  return data;
}

export { getNews };
