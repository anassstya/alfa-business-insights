import type { ReactNode } from "react";
import { Badge } from "@/shared";
import ArrowIcon from '@/shared/icons/arrow-right.svg?react'
import type { AnalysisResult, AnalysisSource } from "@/entities/job";
import {
  BodyText, ExternalLink, Item, ItemFooter, ItemList, ItemMeta, ItemText, ItemTitle, LEVEL_LABEL, LevelBadge,
  Metric, MetricDelta, MetricLabel, MetricsGrid, MetricValue, ReportRoot, Section, SectionCount, SectionHeader,
  SectionTitle, SENTIMENT, Step, StepBody, StepNumber, SummaryTitle, Tags, TREND_ARROW, TwoColumns,
} from "./AnalysisReport.styled";

const dateFormatter = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

const formatDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : dateFormatter.format(date);
}

const ReportSection = ({ title, count, children }: { title: string, count?: number, children: ReactNode }) => (
  <Section>
    <SectionHeader>
      <SectionTitle>{title}</SectionTitle>
      {count !== undefined && <SectionCount>{count}</SectionCount>}
    </SectionHeader>
    {children}
  </Section>
)

const SourceLink = ({ source }: { source: AnalysisSource }) => (
  <ExternalLink href={source.url} target="_blank" rel="noopener noreferrer">
    Источник
    <ArrowIcon width={16} height={16} />
  </ExternalLink>
)

/**
 * Полный отчёт по результату анализа: сводка, метрики, инсайты, риски и возможности,
 * рекомендации и источники. Пустые блоки не показываются.
 */
const AnalysisReport = ({ result }: { result: AnalysisResult }) => {
  const metrics = result.metrics ?? [];
  const insights = result.insights ?? [];
  const risks = result.risks ?? [];
  const opportunities = result.opportunities ?? [];
  const recommendations = result.recommendations ?? [];
  const sources = result.sources ?? [];
  const sentiment = result.summary.sentiment ? SENTIMENT[result.summary.sentiment] : null;

  return (
    <ReportRoot>
      <Section aria-label="Сводка">
        {sentiment && <div><LevelBadge $level={sentiment.level}>{sentiment.label}</LevelBadge></div>}
        <SummaryTitle>{result.summary.title}</SummaryTitle>
        <BodyText>{result.summary.text}</BodyText>
      </Section>

      {metrics.length > 0 && (
        <ReportSection title="Ключевые показатели">
          <MetricsGrid>
            {metrics.map(metric => (
              <Metric key={metric.label}>
                <MetricLabel>{metric.label}</MetricLabel>
                <MetricValue>{metric.value}</MetricValue>
                {metric.delta && (
                  <MetricDelta $trend={metric.trend}>
                    {metric.trend && `${TREND_ARROW[metric.trend]} `}{metric.delta}
                  </MetricDelta>
                )}
              </Metric>
            ))}
          </MetricsGrid>
        </ReportSection>
      )}

      {insights.length > 0 && (
        <ReportSection title="Инсайты" count={insights.length}>
          <ItemList>
            {insights.map(insight => (
              <Item key={insight.id}>
                <ItemMeta>
                  <LevelBadge $level={insight.importance}>{LEVEL_LABEL[insight.importance]} приоритет</LevelBadge>
                  {insight.source?.source && <div>{insight.source.source}</div>}
                  {formatDate(insight.source?.published_at) && <div>· {formatDate(insight.source?.published_at)}</div>}
                </ItemMeta>
                <ItemTitle>{insight.title}</ItemTitle>
                <ItemText>{insight.text}</ItemText>
                {((insight.tags?.length ?? 0) > 0 || insight.source) && (
                  <ItemFooter>
                    <Tags>{insight.tags?.map(tag => <Badge key={tag}>{tag}</Badge>)}</Tags>
                    {insight.source && <SourceLink source={insight.source} />}
                  </ItemFooter>
                )}
              </Item>
            ))}
          </ItemList>
        </ReportSection>
      )}

      {(risks.length > 0 || opportunities.length > 0) && (
        <TwoColumns>
          {risks.length > 0 && (
            <ReportSection title="Риски" count={risks.length}>
              <ItemList>
                {risks.map(risk => (
                  <Item key={risk.title}>
                    <ItemMeta><LevelBadge $level={risk.level}>{LEVEL_LABEL[risk.level]} риск</LevelBadge></ItemMeta>
                    <ItemTitle>{risk.title}</ItemTitle>
                    <ItemText>{risk.text}</ItemText>
                  </Item>
                ))}
              </ItemList>
            </ReportSection>
          )}
          {opportunities.length > 0 && (
            <ReportSection title="Возможности" count={opportunities.length}>
              <ItemList>
                {opportunities.map(opportunity => (
                  <Item key={opportunity.title}>
                    <ItemTitle>{opportunity.title}</ItemTitle>
                    <ItemText>{opportunity.text}</ItemText>
                  </Item>
                ))}
              </ItemList>
            </ReportSection>
          )}
        </TwoColumns>
      )}

      {recommendations.length > 0 && (
        <ReportSection title="Что сделать" count={recommendations.length}>
          <ItemList as="ol" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {recommendations.map((recommendation, index) => (
              <Item as="li" key={recommendation.title}>
                <Step>
                  <StepNumber aria-hidden>{index + 1}</StepNumber>
                  <StepBody>
                    <ItemMeta>
                      <LevelBadge $level={recommendation.priority}>{LEVEL_LABEL[recommendation.priority]} приоритет</LevelBadge>
                    </ItemMeta>
                    <ItemTitle>{recommendation.title}</ItemTitle>
                    <ItemText>{recommendation.text}</ItemText>
                  </StepBody>
                </Step>
              </Item>
            ))}
          </ItemList>
        </ReportSection>
      )}

      {sources.length > 0 && (
        <ReportSection title="Источники" count={sources.length}>
          <ItemList>
            {sources.map(source => (
              <Item key={source.url}>
                <ItemMeta>
                  {source.source && <div>{source.source}</div>}
                  {formatDate(source.published_at) && <div>· {formatDate(source.published_at)}</div>}
                </ItemMeta>
                <ExternalLink href={source.url} target="_blank" rel="noopener noreferrer">
                  {source.title}
                </ExternalLink>
              </Item>
            ))}
          </ItemList>
        </ReportSection>
      )}
    </ReportRoot>
  )
}

export { AnalysisReport };
