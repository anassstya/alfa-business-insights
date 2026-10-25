import { apiClient } from "@/shared";
import type {
  CompaniesParams, CompaniesResponse, CompanyAnalyticsBody, CompanyAnalyticsResponse, CompanyDetails,
  UserCompaniesResponse,
} from "../model/types";

const getCompanies = async (params: CompaniesParams = {}, signal?: AbortSignal) => {
  const { data } = await apiClient.get<CompaniesResponse>('/api/v1/companies', { params, signal });

  return data;
}

const getCompanyById = async (companyId: number, signal?: AbortSignal) => {
  const { data } = await apiClient.get<CompanyDetails>(`/api/v1/companies/${companyId}`, { signal });

  return data;
}

const getCompaniesByUserId = async (id: number, signal?: AbortSignal) => {
  const { data } = await apiClient.get<UserCompaniesResponse>(`/api/v1/demo/users/${id}/companies`, { signal });

  return data.companies;
}

const getCompanyAnalysis = async (companyId: number, body: CompanyAnalyticsBody) => {
  const { data } = await apiClient.post<CompanyAnalyticsResponse>(`/api/v1/companies/${companyId}/analysis`, body);

  return data.job_id
}

export { getCompanies, getCompanyById, getCompaniesByUserId, getCompanyAnalysis };
