import type { PaginationParams } from "@/shared";
import type { RoleId } from "@/entities/role";

type NewsImportance = 'high' | 'medium' | 'low';

interface NewsItem {
  id: number;
  title: string;
  summary: string;
  source: string;
  url: string;
  /** ISO 8601 */
  published_at: string;
  tags: string[];
  importance: NewsImportance;
}

interface NewsFilters {
  date_from?: string;
  date_to?: string;
}

interface NewsParams extends NewsFilters, PaginationParams {
  company_id: number;
  role: RoleId;
}

export type { NewsItem, NewsImportance, NewsFilters, NewsParams };
