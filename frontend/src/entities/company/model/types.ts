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

/**
 * Ответ GET /api/v1/companies/{companyID} — та же схема, что в списках,
 * но cl_type обязателен и всегда 'CLIENT' (не-клиентов backend отдаёт как 404).
 */
interface CompanyDetails extends Omit<Company, 'cl_type'> {
  cl_type: 'CLIENT';
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

interface CompanyAnalyticsBody {
  demo_user_id: number,
  role: string
}

/** Ответ 202 POST /api/v1/companies/{companyID}/analysis */
interface CompanyAnalyticsResponse {
  /** uuid задачи — по нему подписываемся на SSE /api/v1/analysis/jobs/{jobID}/events */
  job_id: string;
}

export { COMPANIES_MAX_LIMIT, COMPANIES_PAGE_SIZE };
export type { Company, CompanyDetails, CompaniesParams, CompaniesResponse, UserCompaniesResponse, CompanyAnalyticsResponse, CompanyAnalyticsBody };
