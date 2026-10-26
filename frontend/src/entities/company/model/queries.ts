import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { getCompanies, getCompanyById, getCompaniesByUserId, getCompanyAnalysis } from "../api/companyApi";
import { COMPANIES_PAGE_SIZE, type Company } from "./types";

const companyKeys = {
  all: ['companies'] as const,
  infinite: (pageSize: number) => [...companyKeys.all, 'infinite', { pageSize }] as const,
  byUser: (userId: number) => [...companyKeys.all, 'byUser', userId] as const,
  detail: (id: number) => [...companyKeys.all, 'detail', id] as const,
}

const useInfiniteCompanies = (pageSize = COMPANIES_PAGE_SIZE) => useInfiniteQuery({
  queryKey: companyKeys.infinite(pageSize),
  queryFn: ({ pageParam, signal }) => getCompanies({ limit: pageSize, offset: pageParam }, signal),
  initialPageParam: 0,
  getNextPageParam: (lastPage) => {
    const nextOffset = lastPage.offset + lastPage.companies.length;

    return lastPage.companies.length > 0 && nextOffset < lastPage.total ? nextOffset : undefined;
  },
  select: (data) => ({
    companies: data.pages.flatMap(page => page.companies),
    total: data.pages.at(-1)?.total ?? 0,
  }),
  staleTime: 1000 * 60 * 5,
})

const useUserCompanies = (userId?: number) => useQuery({
  queryKey: companyKeys.byUser(userId ?? 0),
  queryFn: ({ signal }) => getCompaniesByUserId(userId!, signal),
  enabled: !!userId,
  staleTime: 1000 * 60 * 5,
})

const useCompany = (id: number | null) => {
  return useQuery<Company>({
    queryKey: companyKeys.detail(id ?? 0),
    queryFn: ({ signal }) => getCompanyById(id!, signal),
    enabled: id !== null,
    staleTime: 1000 * 60 * 5,
  })
}

interface CompanyAnalysisParams {
  companyId: number;
  role: string;
  demoUserId?: number;
  goal?: string;
}

const useStartCompanyAnalysis = () => useMutation({
  mutationFn: ({ companyId, role, demoUserId, goal }: CompanyAnalysisParams) =>
    getCompanyAnalysis(companyId, { role, demo_user_id: demoUserId, goal: goal || undefined }),
})

export {
  companyKeys, useInfiniteCompanies, useCompany, useUserCompanies, useStartCompanyAnalysis,
  type CompanyAnalysisParams,
};
