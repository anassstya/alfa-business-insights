import type { PaginationParams } from "@/shared";

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

interface CompanyDetails extends Omit<Company, 'cl_type'> {
  cl_type: 'CLIENT';
}

type CompaniesParams = PaginationParams;

interface CompaniesResponse {
  companies: Company[];
  total: number;
  limit: number;
  offset: number;
}


interface UserCompaniesResponse {
  companies: Company[];
}

const COMPANIES_MAX_LIMIT = 100;
const COMPANIES_PAGE_SIZE = 50;

interface CompanyAnalyticsBody {
  demo_user_id?: number,
  role: string;
  goal?: string;
}

interface CompanyAnalyticsResponse {
  job_id: string;
}

export { COMPANIES_MAX_LIMIT, COMPANIES_PAGE_SIZE };
export type { Company, CompanyDetails, CompaniesParams, CompaniesResponse, UserCompaniesResponse, CompanyAnalyticsResponse, CompanyAnalyticsBody };
