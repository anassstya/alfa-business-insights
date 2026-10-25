import styled, { css } from "styled-components";
import { BREAKPOINTS, Card } from "@/shared";
import type { Level, Sentiment, Trend } from "@/entities/job";

const ReportRoot = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
`

const Section = styled(Card).attrs({ as: 'section' })`
  display: flex;
  flex-direction: column;
  gap: 16px;
`

const SectionHeader = styled.div`
  display: flex;
  align-items: baseline;
  gap: 8px;
`

const SectionTitle = styled.h3`
  margin: 0;
  font-size: 20px;
  line-height: 26px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.primary.text};
`

const SectionCount = styled.div`
  font-size: 15px;
  color: ${({ theme }) => theme.colors.secondary.textSecondary};
`

/* ---------- метки уровня / тональности ---------- */

const LEVEL_LABEL: Record<Level, string> = { high: 'Высокий', medium: 'Средний', low: 'Низкий' };

const levelColors = (level: Level) => {
  switch (level) {
    case 'high':
      return css`background-color: #FDECEA; color: #C4231A;`;
    case 'medium':
      return css`background-color: #FFF3DC; color: #9A5B00;`;
    default:
      return css`background-color: #E6F6EC; color: #0B7A3E;`;
  }
}

const LevelBadge = styled.div<{ $level: Level }>`
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  padding: 2px 10px;
  border-radius: 100px;
  font-size: 12px;
  line-height: 18px;
  font-weight: 600;
  ${({ $level }) => levelColors($level)}
`

const SENTIMENT: Record<Sentiment, { label: string, level: Level }> = {
  positive: { label: 'Позитивный фон', level: 'low' },
  neutral: { label: 'Нейтральный фон', level: 'medium' },
  negative: { label: 'Негативный фон', level: 'high' },
};

/* ---------- сводка ---------- */

const SummaryTitle = styled.h2`
  margin: 0;
  font-size: 26px;
  line-height: 32px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.primary.text};

  @media ${BREAKPOINTS.phone} {
    font-size: 21px;
    line-height: 27px;
  }
`

const BodyText = styled.div`
  font-size: 16px;
  line-height: 24px;
  white-space: pre-line;
  color: ${({ theme }) => theme.colors.primary.additionalText};
`

/* ---------- метрики ---------- */

const MetricsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
`

const Metric = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 16px;
  border-radius: 16px;
  border: 1px solid ${({ theme }) => theme.colors.secondary.sectionBg};
`

const MetricLabel = styled.div`
  font-size: 13px;
  line-height: 18px;
  color: ${({ theme }) => theme.colors.secondary.textSecondary};
`

const MetricValue = styled.div`
  font-size: 22px;
  line-height: 28px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.primary.text};
`

const TREND_ARROW: Record<Trend, string> = { up: '↑', down: '↓', flat: '→' };

const MetricDelta = styled.div<{ $trend?: Trend | null }>`
  font-size: 13px;
  line-height: 18px;
  font-weight: 500;
  color: ${({ theme, $trend }) => $trend === 'up'
    ? theme.colors.utility.success
    : $trend === 'down' ? theme.colors.utility.error : theme.colors.secondary.textSecondary};
`

/* ---------- списки: инсайты, риски, рекомендации, источники ---------- */

const ItemList = styled.div`
  display: flex;
  flex-direction: column;
`

const Item = styled.article`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px 0;

  &:first-child {
    padding-top: 0;
  }

  &:last-child {
    padding-bottom: 0;
  }

  & + & {
    border-top: 1px solid ${({ theme }) => theme.colors.secondary.sectionBg};
  }
`

const ItemMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  line-height: 18px;
  color: ${({ theme }) => theme.colors.secondary.textSecondary};
`

const ItemTitle = styled.div`
  font-size: 17px;
  line-height: 24px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.primary.text};
`

const ItemText = styled.div`
  font-size: 15px;
  line-height: 22px;
  white-space: pre-line;
  color: ${({ theme }) => theme.colors.primary.additionalText};
`

const ItemFooter = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`

const Tags = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`

const ExternalLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  color: ${({ theme }) => theme.colors.primary.primary};

  &:hover {
    color: ${({ theme }) => theme.colors.primary.hover};
  }
`

const TwoColumns = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  align-items: start;

  @media ${BREAKPOINTS.belowDesktop} {
    grid-template-columns: minmax(0, 1fr);
  }
`

const Step = styled.div`
  display: flex;
  gap: 14px;
`

const StepNumber = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  font-size: 14px;
  font-weight: 700;
  background-color: ${({ theme }) => theme.colors.primary.primary};
  color: ${({ theme }) => theme.colors.secondary.cardBg};
`

const StepBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
`

export {
  ReportRoot, Section, SectionHeader, SectionTitle, SectionCount, LEVEL_LABEL, LevelBadge, SENTIMENT,
  SummaryTitle, BodyText, MetricsGrid, Metric, MetricLabel, MetricValue, TREND_ARROW, MetricDelta,
  ItemList, Item, ItemMeta, ItemTitle, ItemText, ItemFooter, Tags, ExternalLink, TwoColumns,
  Step, StepNumber, StepBody,
};
