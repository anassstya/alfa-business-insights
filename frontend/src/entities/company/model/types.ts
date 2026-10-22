import type { PaginationParams } from "@/shared";

interface CompanyShort {
  id: number;
  synthetic_u: string;
  industry_name: string;
  city: string;
  region: string;
}

interface CompanyDetails extends CompanyShort {
  org_type: string;
  industry_code: string;
  company_age_years_gradation: string;
  amount_workers_fns_gradation: string;
  revenue_company: number;
  cl_type: string;
}

interface CompaniesParams extends PaginationParams {
  city?: string;
  region?: string;
  industry?: string;
}

export type { CompanyShort, CompanyDetails, CompaniesParams };
