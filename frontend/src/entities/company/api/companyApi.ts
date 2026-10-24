import { apiClient } from "@/shared";
import type { CompaniesParams, CompaniesResponse, UserCompaniesResponse } from "../model/types";

/** GET /api/v1/companies */
const getCompanies = async (params: CompaniesParams = {}, signal?: AbortSignal) => {
  const { data } = await apiClient.get<CompaniesResponse>('/api/v1/companies', { params, signal });

  return data;
}

// FIXME(openapi): GET /api/v1/companies/{id} убран из спецификации и не реализован на backend —
// getCompanyById удалён, карточка компании берёт данные из уже загруженных списков (см. useCompany).

/** GET /api/v1/demo/users/{id}/companies */
const getCompaniesByUserId = async (id: number, signal?: AbortSignal) => {
  const { data } = await apiClient.get<UserCompaniesResponse>(`/api/v1/demo/users/${id}/companies`, { signal });

  return data.companies;
}

export { getCompanies, getCompaniesByUserId };
