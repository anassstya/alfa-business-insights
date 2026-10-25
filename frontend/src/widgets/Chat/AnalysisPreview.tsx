import styled from "styled-components";
import type { AnalysisResult } from "@/entities/job";
import { Button, Card } from "@/shared";
import ArrowIcon from '@/shared/icons/arrow-right.svg?react'

const PreviewCard = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: 12px;
`

const Eyebrow = styled.div`
  font-size: 13px;
  line-height: 18px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.utility.success};
`

const PreviewTitle = styled.h3`
  margin: 0;
  font-size: 22px;
  line-height: 28px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.primary.text};
`

/** Превью — только начало сводки, полный текст на странице деталей */
const PreviewText = styled.div`
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 15px;
  line-height: 22px;
  color: ${({ theme }) => theme.colors.primary.additionalText};
`

const Counters = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  font-size: 14px;
  color: ${({ theme }) => theme.colors.secondary.textSecondary};

  & b {
    color: ${({ theme }) => theme.colors.primary.text};
  }
`

const TopInsights = styled.ul`
  margin: 0;
  padding-left: 18px;
  font-size: 15px;
  line-height: 22px;
  color: ${({ theme }) => theme.colors.primary.text};
`

const Actions = styled.div`
  display: flex;

  & > button {
    padding: 14px 20px;
    cursor: pointer;
  }

  & svg {
    width: 18px;
    height: 18px;
  }
`

const pluralRules = new Intl.PluralRules('ru-RU');

const plural = (count: number, forms: Record<'one' | 'few' | 'many', string>) =>
  `${count} ${forms[pluralRules.select(count) as 'one' | 'few' | 'many'] ?? forms.many}`;

/** Короткая карточка готового анализа в ленте с переходом на полную аналитику */
const AnalysisPreview = ({ result, onOpen }: { result: AnalysisResult, onOpen(): void }) => {
  const insights = result.insights ?? [];
  const risks = result.risks ?? [];
  const recommendations = result.recommendations ?? [];

  return (
    <PreviewCard>
      <Eyebrow>Анализ готов</Eyebrow>
      <PreviewTitle>{result.summary.title}</PreviewTitle>
      <PreviewText>{result.summary.text}</PreviewText>

      <Counters>
        <span><b>{plural(insights.length, { one: 'инсайт', few: 'инсайта', many: 'инсайтов' })}</b></span>
        <span><b>{plural(risks.length, { one: 'риск', few: 'риска', many: 'рисков' })}</b></span>
        <span><b>{plural(recommendations.length, { one: 'рекомендация', few: 'рекомендации', many: 'рекомендаций' })}</b></span>
      </Counters>

      {insights.length > 0 && (
        <TopInsights>
          {insights.slice(0, 3).map(insight => <li key={insight.id}>{insight.title}</li>)}
        </TopInsights>
      )}

      <Actions>
        <Button type="button" borderSize="M" icon={<ArrowIcon />} rightIcon onClick={onOpen}>
          Открыть полную аналитику
        </Button>
      </Actions>
    </PreviewCard>
  )
}

export { AnalysisPreview };
