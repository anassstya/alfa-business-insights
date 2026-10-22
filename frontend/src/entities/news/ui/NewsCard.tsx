import { Badge, Card, Flex, formatTime, Skeleton, Title } from "@/shared";
import ArrowIcon from '@/shared/icons/arrow-right.svg?react'
import type { NewsItem } from "../model/types";
import { Dot, Footer, Meta, NewsCardRoot, ReadLink, Source, Summary, Tags } from "./NewsCard.styled";

const NewsCard = ({ news }: { news: NewsItem }) => {
  const publishedAt = new Date(news.published_at);

  return (
    <NewsCardRoot>
      <Meta>
        {news.importance === 'high' && <Badge $variant="accent">Важно</Badge>}
        <Source>{news.source}</Source>
        <Dot />
        <time dateTime={news.published_at}>{formatTime(publishedAt)}</time>
      </Meta>
      <Title.H4>{news.title}</Title.H4>
      <Summary>{news.summary}</Summary>
      <Footer>
        <Tags>
          {news.tags.map(tag => <Badge key={tag}>{tag}</Badge>)}
        </Tags>
        <ReadLink href={news.url} target="_blank" rel="noopener noreferrer">
          Читать
          <ArrowIcon />
        </ReadLink>
      </Footer>
    </NewsCardRoot>
  )
}

const NewsCardSkeleton = () => (
  <Card>
    <Flex direction="column" gap="12px">
      <Skeleton $width="30%" $height="14px" />
      <Skeleton $width="85%" $height="24px" />
      <Skeleton $height="16px" />
      <Skeleton $width="70%" $height="16px" />
      <Flex gap="6px">
        <Skeleton $width="72px" $height="22px" $radius="100px" />
        <Skeleton $width="96px" $height="22px" $radius="100px" />
      </Flex>
    </Flex>
  </Card>
)

export { NewsCard, NewsCardSkeleton };
