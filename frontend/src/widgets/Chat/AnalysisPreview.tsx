import styled from "styled-components";
import { getOutcomeLabel, type AnalysisOutcome, type AnalysisResult } from "@/entities/job";
import { Button, Card } from "@/shared";
import ArrowIcon from '@/shared/icons/arrow-right.svg?react'

const PreviewCard = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: 12px;
`

const Badges = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
`

const OUTCOME_COLOR: Record<AnalysisOutcome, string> = {
  ok: '#0B7A3E',
  partial: '#9A5B00',
  no_relevant_evidence: '#7F8792',
  failed: '#C4231A',
};

const Eyebrow = styled.div<{ $outcome: AnalysisOutcome }>`
  font-size: 13px;
  line-height: 18px;
  font-weight: 600;
  color: ${({ $outcome }) => OUTCOME_COLOR[$outcome] ?? '#7F8792'};
`

const DemoBadge = styled.div`
  padding: 0 8px;
  border-radius: 100px;
  font-size: 12px;
  line-height: 18px;
  font-weight: 600;
  background-color: ${({ theme }) => theme.colors.secondary.sectionBg};
  color: ${({ theme }) => theme.colors.primary.additionalText};
`

const PreviewTitle = styled.h3`
  margin: 0;
  font-size: 22px;
  line-height: 28px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.primary.text};
`

/** Превью — только начало главного вывода, полный отчёт на странице деталей */
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

const TopInsights = styled.ol`
  margin: 0;
  padding-left: 20px;
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
  const insights = [...(result.insights ?? [])].sort((a, b) => a.rank - b.rank);
  const top = insights[0];
  const risks = insights.reduce((sum, insight) => sum + (insight.risks?.length ?? 0), 0);
  const actions = insights.reduce((sum, insight) => sum + (insight.suggested_actions?.length ?? 0), 0);
  const sources = result.evidence?.length ?? 0;

  return (
    <PreviewCard>
      <Badges>
        <Eyebrow $outcome={result.outcome}>{getOutcomeLabel(result.outcome)}</Eyebrow>
        {result.mode === 'fixture' && <DemoBadge>Демо-данные</DemoBadge>}
      </Badges>

      <PreviewTitle>{top ? top.event : getOutcomeLabel(result.outcome)}</PreviewTitle>
      {top && <PreviewText>{top.ai_interpretation || top.company_relevance}</PreviewText>}

      <Counters>
        <span><b>{plural(insights.length, { one: 'вывод', few: 'вывода', many: 'выводов' })}</b></span>
        <span><b>{plural(risks, { one: 'риск', few: 'риска', many: 'рисков' })}</b></span>
        <span><b>{plural(actions, { one: 'действие', few: 'действия', many: 'действий' })}</b></span>
        <span><b>{plural(sources, { one: 'источник', few: 'источника', many: 'источников' })}</b></span>
      </Counters>

      {insights.length > 1 && (
        <TopInsights start={2}>
          {insights.slice(1, 3).map(insight => <li key={insight.insight_id}>{insight.event}</li>)}
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
