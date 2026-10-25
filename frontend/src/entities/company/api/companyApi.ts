import { apiClient } from "@/shared";
import type {
  CompaniesParams, CompaniesResponse, CompanyAnalyticsBody, CompanyAnalyticsResponse, CompanyDetails,
  UserCompaniesResponse,
} from "../model/types";

/** GET /api/v1/companies */
const getCompanies = async (params: CompaniesParams = {}, signal?: AbortSignal) => {
  const { data } = await apiClient.get<CompaniesResponse>('/api/v1/companies', { params, signal });

  return data;
}

/** GET /api/v1/companies/{companyID} — 404, если компания не найдена или не клиент */
const getCompanyById = async (companyId: number, signal?: AbortSignal) => {
  const { data } = await apiClient.get<CompanyDetails>(`/api/v1/companies/${companyId}`, { signal });

  return data;
}

/** GET /api/v1/demo/users/{id}/companies */
const getCompaniesByUserId = async (id: number, signal?: AbortSignal) => {
  const { data } = await apiClient.get<UserCompaniesResponse>(`/api/v1/demo/users/${id}/companies`, { signal });

  return data.companies;
}

/** POST /api/v1/companies/{companyID}/analysis → 202 { job_id } */
const getCompanyAnalysis = async (companyId: number, body: CompanyAnalyticsBody) => {
  const { data } = await apiClient.post<CompanyAnalyticsResponse>(`/api/v1/companies/${companyId}/analysis`, body);

  return data.job_id
}

export { getCompanies, getCompanyById, getCompaniesByUserId, getCompanyAnalysis };
