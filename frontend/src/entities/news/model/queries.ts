import { useInfiniteQuery } from "@tanstack/react-query";
import { getNews } from "../api/newsApi";
import type { NewsParams } from "./types";

const NEWS_PAGE_SIZE = 10;

type NewsQueryParams = Omit<NewsParams, 'limit' | 'offset'>;

const newsKeys = {
  all: ['news'] as const,
  list: (params: NewsQueryParams) => [...newsKeys.all, 'list', params] as const,
}

const useNewsInfinite = (params: NewsQueryParams | null) => useInfiniteQuery({
  queryKey: newsKeys.list(params ?? { company_id: 0, role: '' }),
  queryFn: ({ pageParam, signal }) => getNews({ ...params!, limit: NEWS_PAGE_SIZE, offset: pageParam }, signal),
  initialPageParam: 0,
  getNextPageParam: (lastPage, pages) => {
    const loaded = pages.reduce((acc, page) => acc + page.items.length, 0);

    return loaded < lastPage.total ? loaded : undefined;
  },
  select: (data) => ({
    items: data.pages.flatMap(page => page.items),
    total: data.pages.at(-1)?.total ?? 0,
  }),
  enabled: params !== null,
})

export { newsKeys, useNewsInfinite, NEWS_PAGE_SIZE, type NewsQueryParams };
