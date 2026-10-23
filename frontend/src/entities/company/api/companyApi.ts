import { apiClient, type PaginatedResponse } from "@/shared";
import type { CompaniesParams, CompanyDetails, CompanyShort } from "../model/types";

const getCompanies = async (params: CompaniesParams = {}, signal?: AbortSignal) => {
  const { data } = await apiClient.get<PaginatedResponse<CompanyShort>>('/v1/companies', { params, signal });

  return data;
}

const getCompanyById = async (id: number, signal?: AbortSignal) => {
  const { data } = await apiClient.get<CompanyDetails>(`/v1/companies/${id}`, { signal });

  return data;
}

export { getCompanies, getCompanyById };
