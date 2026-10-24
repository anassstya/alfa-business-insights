import { apiClient, type PaginatedResponse } from "@/shared";
import type { NewsItem, NewsParams } from "../model/types";

/**
 * GET /api/v1/news
 *
 * FIXME(openapi): эндпоинта нет ни в backend/api/openapi.yaml, ни на backend — запрос
 * вернёт 404. Контракт предварительный, его нужно согласовать и внести в спецификацию:
 *   query: company_id, role (код из /api/v1/roles), date_from, date_to (YYYY-MM-DD), limit, offset
 *   200:   { items: NewsItem[], total: number }
 */
const getNews = async (params: NewsParams, signal?: AbortSignal) => {
  const { data } = await apiClient.get<PaginatedResponse<NewsItem>>('/api/v1/news', { params, signal });

  return data;
}

export { getNews };
