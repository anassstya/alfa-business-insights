import { useInfiniteQuery, useQuery, useQueryClient, type InfiniteData, type QueryClient } from "@tanstack/react-query";
import { getCompanies, getCompanyById, getCompaniesByUserId, getCompanyAnalysis } from "../api/companyApi";
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
 * GET /api/v1/companies/{companyID}.
 * Пока ответ не пришёл, показываем компанию из уже загруженных списков (placeholderData),
 * чтобы подпись в селекте и карточка не мигали скелетоном.
 */
const useCompany = (id: number | null) => {
  const queryClient = useQueryClient();

  return useQuery<Company>({
    queryKey: companyKeys.detail(id ?? 0),
    queryFn: ({ signal }) => getCompanyById(id!, signal),
    placeholderData: () => (id === null ? undefined : findCachedCompany(queryClient, id)),
    enabled: id !== null,
    staleTime: 1000 * 60 * 5,
  })
}

/**
 * POST /api/v1/companies/{companyID}/analysis через useQuery: каждый вызов создаёт задачу на backend,
 * поэтому запрос выполняется один раз на набор параметров и никогда не повторяется сам —
 * ни при фокусе окна, ни при переподключении сети, ни при повторном монтировании, ни при ошибке.
 * Новая задача — только при смене companyId / role / demoUserId или через refetch().
 */
const useCompanyAnalysis = ({ companyId, role, demoUserId }: {companyId?: number, role?: string, demoUserId?: number}) => useQuery({
  queryKey: ['job', role, demoUserId, companyId],
  queryFn: () => getCompanyAnalysis(companyId!, { role: role!, demo_user_id: demoUserId!}),
  enabled: !!companyId && !!role && !!demoUserId,
  staleTime: 1000 * 60 * 60,
  gcTime: Infinity,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  refetchOnMount: false,
  retry: false,
})

export { companyKeys, useInfiniteCompanies, useCompany, useUserCompanies, useCompanyAnalysis };
