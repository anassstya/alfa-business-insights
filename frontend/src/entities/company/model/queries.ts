import { useQuery } from "@tanstack/react-query";
import { getCompanies, getCompanyById } from "../api/companyApi";
import type { CompaniesParams } from "./types";

const companyKeys = {
  all: ['companies'] as const,
  list: (params: CompaniesParams) => [...companyKeys.all, 'list', params] as const,
  detail: (id: number) => [...companyKeys.all, 'detail', id] as const,
}

const useCompanies = (params: CompaniesParams = {}) => useQuery({
  queryKey: companyKeys.list(params),
  queryFn: ({ signal }) => getCompanies(params, signal),
  staleTime: 1000 * 60 * 5,
})

const useCompany = (id: number | null) => useQuery({
  queryKey: companyKeys.detail(id ?? 0),
  queryFn: ({ signal }) => getCompanyById(id!, signal),
  enabled: id !== null,
  staleTime: 1000 * 60 * 5,
})

export { companyKeys, useCompanies, useCompany };
