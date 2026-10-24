import { useInfiniteQuery, useQuery, useQueryClient, type InfiniteData, type QueryClient } from "@tanstack/react-query";
import { getCompanies, getCompaniesByUserId } from "../api/companyApi";
import { COMPANIES_PAGE_SIZE, type CompaniesResponse, type Company } from "./types";

const companyKeys = {
  all: ['companies'] as const,
  infinite: (pageSize: number) => [...companyKeys.all, 'infinite', { pageSize }] as const,
  byUser: (userId: number) => [...companyKeys.all, 'byUser', userId] as const,
  detail: (id: number) => [...companyKeys.all, 'detail', id] as const,
}

/**
 * GET /api/v1/companies постранично: offset следующей страницы считается из ответа
 * (`offset + companies.length`), пока не дойдём до `total`.
 */
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

type CachedCompanies = InfiniteData<CompaniesResponse> | Company[] | Company;

/** Достаёт массив компаний из любого закэшированного значения: страниц общего списка или списка пользователя */
const toCompanies = (data: CachedCompanies | undefined): Company[] => {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if ('pages' in data) return data.pages.flatMap(page => page.companies);

  return [];
}

/** Ищет компанию во всех закэшированных списках: подгруженных страницах общего и списках пользователей */
const findCachedCompany = (queryClient: QueryClient, id: number) => {
  const cached = queryClient.getQueriesData<CachedCompanies>({ queryKey: companyKeys.all });

  for (const [, data] of cached) {
    const company = toCompanies(data).find(item => item.id === id);

    if (company) return company;
  }

  return undefined;
}

/**
 * FIXME(openapi): эндпоинта GET /api/v1/companies/{id} нет ни в спецификации, ни на backend.
 * Пока берём компанию из уже загруженных списков — выбрать её можно только из них,
 * но после перезагрузки страницы без списков в кэше карточка покажет ошибку.
 * Когда эндпоинт появится, queryFn нужно заменить на запрос.
 */
const useCompany = (id: number | null) => {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: companyKeys.detail(id ?? 0),
    queryFn: () => {
      const company = findCachedCompany(queryClient, id!);

      if (!company) {
        throw new Error(`Компания ${id} не найдена в загруженных списках`);
      }

      return company;
    },
    enabled: id !== null,
    staleTime: 1000 * 60 * 5,
  })
}

export { companyKeys, useInfiniteCompanies, useCompany, useUserCompanies };
