import { NewsCard, NewsCardSkeleton, useCompanyAnalysis, useSession, type NewsItem } from "@/entities"
import { type ReactNode } from "react"
import { Button, Card, formatDayLabel, Title, toIsoDate } from "@/shared"
import { DayGroup, DayLabel, LoadMore, StateIcon, StateMessage, StateText, Summary } from "./NewsFeed.styled"
import { useAnalysis } from "@/entities/job";

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

const Content = () => {
  const { companyId, role, userId } = useSession();

  const { data: jobId, isPending, isError, refetch } = useCompanyAnalysis({ companyId: companyId ?? undefined, role: role ?? undefined, demoUserId: userId});
  const { isError: isAnalysisError, isFail, isConnect } = useAnalysis(jobId)
  if (companyId === null || role === null) {
      return (
        <FeedState
          icon="🏢"
          title="Выберите организацию и роль"
          text="Подберём новости по отрасли и региону вашей компании с учётом вашей роли."
        />
      )
    }

    if (isPending || isConnect) {
      return Array.from({ length: 3 }, (_, i) => <NewsCardSkeleton key={i} />);
    }

    if (isError || isAnalysisError || isFail) {
      return (
        <FeedState
          icon="⚠️"
          title="Не удалось загрузить новости"
          text="Проверьте соединение и попробуйте ещё раз."
          action={<Button variant="secondary" borderSize="S" onClick={() => refetch()}>Повторить</Button>}
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