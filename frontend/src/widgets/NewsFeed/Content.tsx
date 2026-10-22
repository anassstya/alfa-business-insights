import { NewsCard, NewsCardSkeleton, useNewsInfinite, useSession, type NewsItem } from "@/entities"
import { useMemo, type ReactNode } from "react"
import { Button, Card, formatDayLabel, Title, toIsoDate } from "@/shared"
import { DayGroup, DayLabel, LoadMore, StateIcon, StateMessage, StateText, Summary } from "./NewsFeed.styled"
import { DEFAULT_DATE_FILTER, toNewsFilters, type DateFilterValue } from "@/features";

const pluralRules = new Intl.PluralRules('ru-RU');
const NEWS_WORDS: Record<string, string> = { one: 'новость', few: 'новости', many: 'новостей', other: 'новости' };

const groupByDay = (items: NewsItem[]) => {
  const groups = new Map<string, NewsItem[]>();

  items.forEach(item => {
    const key = toIsoDate(new Date(item.published_at));
    groups.set(key, [...(groups.get(key) ?? []), item]);
  });

  return [...groups.entries()];
}

const FeedState = ({ icon, title, text, action }: { icon: string, title: string, text?: string, action?: ReactNode }) => (
  <Card>
    <StateMessage>
      <StateIcon aria-hidden>{icon}</StateIcon>
      <Title.H5>{title}</Title.H5>
      {text && <StateText>{text}</StateText>}
      {action}
    </StateMessage>
  </Card>
)

interface Props {
  dateFilter: DateFilterValue
  setDateFilter(dateFilter: DateFilterValue): void
}

const Content = ({ dateFilter, setDateFilter }: Props) => {
  const { companyId, role } = useSession();
  const params = useMemo(
    () => companyId === null || role === null ? null : { company_id: companyId, role, ...toNewsFilters(dateFilter) },
    [companyId, role, dateFilter],
  );

  const { data, isPending, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useNewsInfinite(params);
  if (companyId === null) {
      return (
        <FeedState
          icon="🏢"
          title="Выберите организацию"
          text="Подберём новости по отрасли и региону вашей компании с учётом вашей роли."
        />
      )
    }

    if (isPending) {
      return Array.from({ length: 3 }, (_, i) => <NewsCardSkeleton key={i} />);
    }

    if (isError) {
      return (
        <FeedState
          icon="⚠️"
          title="Не удалось загрузить новости"
          text="Проверьте соединение и попробуйте ещё раз."
          action={<Button variant="secondary" borderSize="S" onClick={() => refetch()}>Повторить</Button>}
        />
      )
    }

    if (data.items.length === 0) {
      return (
        <FeedState
          icon="🗞️"
          title="Новостей не найдено"
          text="За выбранный период ничего нет — попробуйте расширить диапазон дат."
          action={<Button variant="secondary" borderSize="S" onClick={() => setDateFilter(DEFAULT_DATE_FILTER)}>Показать за всё время</Button>}
        />
      )
    }

    return (
      <>
        <Summary>
          <span>Найдено {data.total} {NEWS_WORDS[pluralRules.select(data.total)]}</span>
        </Summary>

        {groupByDay(data.items).map(([day, items]) => (
          <DayGroup key={day}>
            <DayLabel>{formatDayLabel(new Date(items[0].published_at))}</DayLabel>
            {items.map(news => <NewsCard key={news.id} news={news} />)}
          </DayGroup>
        ))}

        {hasNextPage && (
          <LoadMore>
            <Button variant="secondary" borderSize="M" disabled={isFetchingNextPage} onClick={() => fetchNextPage()}>
              {isFetchingNextPage ? 'Загружаем…' : 'Показать ещё'}
            </Button>
          </LoadMore>
        )}
      </>
    )
}

export { Content }