import { useMemo } from "react";
import {
  getOutcomeLabel, getSourceKindLabel, type AnalysisResult, type EvidenceRecord, type Insight,
} from "@/entities/job";
import {
  Badges, Block, BlockTitle, BodyText, Chain, Columns, EvidenceItem, EvidenceList, EvidenceTitle, Excerpt,
  ExternalLink, InsightHeader, InsightTitle, List, Meta, MutedBadge, OutcomeBadge, Rank, ReportRoot, Section,
  SectionCount, SectionHeader, SectionTitle, SmallText, SourceLinks, SummaryTitle, Warnings,
} from "./AnalysisReport.styled";

const dateFormatter = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
const pluralRules = new Intl.PluralRules('ru-RU');
const INSIGHT_WORDS: Record<string, string> = { one: 'вывод', few: 'вывода', many: 'выводов' };

const formatDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : dateFormatter.format(date);
}

const EMPTY_TEXT: Partial<Record<AnalysisResult['outcome'], string>> = {
  no_relevant_evidence: 'За выбранный период не нашлось новостей, которые заметно влияют на компанию.',
  failed: 'ML не смог сформировать выводы по этой компании.',
};

const evidenceMeta = (evidence: EvidenceRecord) =>
  [evidence.publisher, formatDate(evidence.published_at), getSourceKindLabel(evidence.source_kind)]
    .filter(Boolean)
    .join(' · ');

const ListBlock = ({ title, items, tone }: { title: string, items?: string[], tone: 'risk' | 'opportunity' | 'action' }) =>
  items && items.length > 0 ? (
    <Block $tone={tone}>
      <BlockTitle>{title}</BlockTitle>
      <List>{items.map(item => <li key={item}>{item}</li>)}</List>
    </Block>
  ) : null

const InsightCard = ({ insight, evidenceById }: { insight: Insight, evidenceById: Map<string, EvidenceRecord> }) => {
  const sources = insight.evidence_refs
    .map(id => evidenceById.get(id))
    .filter((evidence): evidence is EvidenceRecord => !!evidence);
  const listBlocks = [insight.risks, insight.opportunities, insight.suggested_actions].filter(items => items?.length).length;
  const bankView = insight.bank_view?.status === 'available' && insight.bank_view.text ? insight.bank_view : null;

  return (
    <Section aria-label={insight.event}>
      <InsightHeader>
        <Rank aria-label={`Вывод ${insight.rank}`}>{insight.rank}</Rank>
        <InsightTitle>{insight.event}</InsightTitle>
      </InsightHeader>

      {insight.ai_interpretation && <BodyText>{insight.ai_interpretation}</BodyText>}

      <Columns>
        <Block>
          <BlockTitle>Для компании</BlockTitle>
          <BodyText>{insight.company_relevance}</BodyText>
        </Block>
        <Block>
          <BlockTitle>Для вашей роли</BlockTitle>
          <BodyText>{insight.role_relevance}</BodyText>
        </Block>
      </Columns>

      {insight.impact_chain.length > 0 && (
        <div>
          <BlockTitle style={{ marginBottom: 8 }}>Как это влияет</BlockTitle>
          <Chain>{insight.impact_chain.map(step => <li key={step}>{step}</li>)}</Chain>
        </div>
      )}

      {listBlocks > 0 && (
        <Columns $count={listBlocks}>
          <ListBlock title="Риски" items={insight.risks} tone="risk" />
          <ListBlock title="Возможности" items={insight.opportunities} tone="opportunity" />
          <ListBlock title="Что сделать" items={insight.suggested_actions} tone="action" />
        </Columns>
      )}

      {bankView && (
        <Block>
          <BlockTitle>Позиция банка{formatDate(bankView.report_at) && ` · ${formatDate(bankView.report_at)}`}</BlockTitle>
          <BodyText>{bankView.text}</BodyText>
        </Block>
      )}

      {insight.uncertainty && <SmallText><b>Неопределённость:</b> {insight.uncertainty}</SmallText>}
      {insight.assumptions && insight.assumptions.length > 0 && (
        <SmallText><b>Допущения:</b> {insight.assumptions.join('; ')}</SmallText>
      )}

      {sources.length > 0 && (
        <SourceLinks>
          {sources.map(source => source.url ? (
            <ExternalLink key={source.evidence_id} href={source.url} target="_blank" rel="noopener noreferrer">
              {source.publisher ?? source.title} ↗
            </ExternalLink>
          ) : (
            <SmallText key={source.evidence_id}>{source.publisher ?? source.title}</SmallText>
          ))}
        </SourceLinks>
      )}
    </Section>
  )
}

/**
 * Полный отчёт по AnalysisResult (схема ML v1 из openapi.yaml): исход анализа, выводы
 * по порядку важности (rank) и источники, на которые они опираются.
 */
const AnalysisReport = ({ result }: { result: AnalysisResult }) => {
  const insights = useMemo(() => [...(result.insights ?? [])].sort((a, b) => a.rank - b.rank), [result.insights]);
  const evidenceById = useMemo(
    () => new Map((result.evidence ?? []).map(item => [item.evidence_id, item])),
    [result.evidence],
  );
  const evidence = result.evidence ?? [];
  const warnings = result.warnings ?? [];

  return (
    <ReportRoot>
      <Section aria-label="Итоги анализа">
        <Badges>
          <OutcomeBadge $outcome={result.outcome}>{getOutcomeLabel(result.outcome)}</OutcomeBadge>
          {/* fixture — демонстрационный сценарий, не реальные новости */}
          {result.mode === 'fixture' && <MutedBadge>Демо-данные</MutedBadge>}
        </Badges>
        <SummaryTitle>
          {insights.length > 0 ? `${insights.length} ${INSIGHT_WORDS[pluralRules.select(insights.length)] ?? 'выводов'} по компании` : 'Выводов нет'}
        </SummaryTitle>
        <Meta>
          {formatDate(result.as_of) && <span>Данные на <b>{formatDate(result.as_of)}</b></span>}
          {result.goal && <span>Цель: <b>{result.goal}</b></span>}
          {evidence.length > 0 && <span>Источников: <b>{evidence.length}</b></span>}
        </Meta>
        {insights.length === 0 && EMPTY_TEXT[result.outcome] && <BodyText>{EMPTY_TEXT[result.outcome]}</BodyText>}
        {warnings.length > 0 && <Warnings>{warnings.map(warning => <li key={warning}>{warning}</li>)}</Warnings>}
      </Section>

      {insights.map(insight => (
        <InsightCard key={insight.insight_id} insight={insight} evidenceById={evidenceById} />
      ))}

      {evidence.length > 0 && (
        <Section aria-label="Источники">
          <SectionHeader>
            <SectionTitle>Источники</SectionTitle>
            <SectionCount>{evidence.length}</SectionCount>
          </SectionHeader>
          <EvidenceList>
            {evidence.map(item => (
              <EvidenceItem key={item.evidence_id}>
                <SmallText>{evidenceMeta(item)}</SmallText>
                {item.url ? (
                  <ExternalLink href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</ExternalLink>
                ) : (
                  <EvidenceTitle>{item.title}</EvidenceTitle>
                )}
                {item.excerpt && <Excerpt>{item.excerpt}</Excerpt>}
              </EvidenceItem>
            ))}
          </EvidenceList>
        </Section>
      )}
    </ReportRoot>
  )
}

export { AnalysisReport };
