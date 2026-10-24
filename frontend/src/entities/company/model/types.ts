import type { PaginationParams } from "@/shared";

/**
 * Компания — элемент `companies[]` в GET /api/v1/companies
 * и GET /api/v1/demo/users/{id}/companies (схемы в openapi.yaml совпадают).
 * Обязательны только id и synthetic_u, остальные поля nullable.
 */
interface Company {
  id: number;
  synthetic_u: string;
  city: string | null;
  region: string | null;
  revenue_company: number | null;
  mainokved_name: string | null;
  mainokved_code: string | null;
  org_type: string | null;
  okfs_name: string | null;
  company_age_years_gradation: string | null;
  eco_mark_label: string | null;
  amount_workers_fns_gradation: string | null;
  cl_type: string | null;
}

/** Query-параметры GET /api/v1/companies: limit 1..100 (по умолчанию 20), offset ≥ 0 */
type CompaniesParams = PaginationParams;

/** Ответ GET /api/v1/companies */
interface CompaniesResponse {
  companies: Company[];
  total: number;
  limit: number;
  offset: number;
}

/** Ответ GET /api/v1/demo/users/{id}/companies */
interface UserCompaniesResponse {
  companies: Company[];
}

/** Максимальный `limit` для GET /api/v1/companies — больше backend отвечает 400 */
const COMPANIES_MAX_LIMIT = 100;

/** Размер страницы при ленивой подгрузке компаний (не больше COMPANIES_MAX_LIMIT) */
const COMPANIES_PAGE_SIZE = 50;

export { COMPANIES_MAX_LIMIT, COMPANIES_PAGE_SIZE };
export type { Company, CompaniesParams, CompaniesResponse, UserCompaniesResponse };
