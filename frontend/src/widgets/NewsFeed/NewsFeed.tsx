import { DEFAULT_DATE_FILTER, NewsDateFilter, type DateFilterValue } from "@/features"
import { Card } from "@/shared"
import {  FeedRoot } from "./NewsFeed.styled"
import { Content } from "./Content"
import { useState } from "react"

const NewsFeed = () => {
  const [dateFilter, setDateFilter] = useState<DateFilterValue>(DEFAULT_DATE_FILTER);

  return (
    <FeedRoot>
      <Card>
        <NewsDateFilter value={dateFilter} onChange={setDateFilter} />
      </Card>
      <Content dateFilter={dateFilter} setDateFilter={setDateFilter} />
    </FeedRoot>
  )
}

export { NewsFeed };
