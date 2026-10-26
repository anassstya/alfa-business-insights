import styled, { css } from "styled-components";
import { BREAKPOINTS, Card } from "@/shared";
import type { AnalysisOutcome } from "@/entities/job";

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

const Badges = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`

const OUTCOME_COLORS: Record<AnalysisOutcome, { background: string, color: string }> = {
  ok: { background: '#E6F6EC', color: '#0B7A3E' },
  partial: { background: '#FFF3DC', color: '#9A5B00' },
  no_relevant_evidence: { background: '#F2F3F5', color: '#2B2F36' },
  failed: { background: '#FDECEA', color: '#C4231A' },
};

const OutcomeBadge = styled.div<{ $outcome: AnalysisOutcome }>`
  display: inline-flex;
  padding: 2px 10px;
  border-radius: 100px;
  font-size: 12px;
  line-height: 18px;
  font-weight: 600;
  background-color: ${({ $outcome }) => OUTCOME_COLORS[$outcome]?.background ?? '#F2F3F5'};
  color: ${({ $outcome }) => OUTCOME_COLORS[$outcome]?.color ?? '#2B2F36'};
`

const MutedBadge = styled.div`
  display: inline-flex;
  padding: 2px 10px;
  border-radius: 100px;
  font-size: 12px;
  line-height: 18px;
  font-weight: 600;
  background-color: ${({ theme }) => theme.colors.secondary.sectionBg};
  color: ${({ theme }) => theme.colors.primary.additionalText};
`

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

const Meta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  font-size: 14px;
  line-height: 20px;
  color: ${({ theme }) => theme.colors.secondary.textSecondary};

  & b {
    font-weight: 600;
    color: ${({ theme }) => theme.colors.primary.text};
  }
`

const Warnings = styled.ul`
  margin: 0;
  padding: 12px 16px 12px 32px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 20px;
  background-color: #FFF3DC;
  color: #6B4000;
`

/* ---------- инсайт ---------- */

const InsightHeader = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 14px;
`

const Rank = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  font-size: 15px;
  font-weight: 700;
  background-color: ${({ theme }) => theme.colors.primary.primary};
  color: ${({ theme }) => theme.colors.secondary.cardBg};
`

const InsightTitle = styled.h3`
  margin: 4px 0 0;
  font-size: 19px;
  line-height: 26px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.primary.text};
`

const BodyText = styled.div`
  font-size: 15px;
  line-height: 22px;
  white-space: pre-line;
  color: ${({ theme }) => theme.colors.primary.additionalText};
`

const Columns = styled.div<{ $count?: number }>`
  display: grid;
  grid-template-columns: repeat(${({ $count = 2 }) => $count}, minmax(0, 1fr));
  gap: 12px;

  @media ${BREAKPOINTS.belowDesktop} {
    grid-template-columns: minmax(0, 1fr);
  }
`

const Block = styled.div<{ $tone?: 'neutral' | 'risk' | 'opportunity' | 'action' }>`
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 16px;
  border-radius: 14px;

  ${({ theme, $tone = 'neutral' }) => {
    switch ($tone) {
      case 'risk':
        return css`background-color: #FDECEA;`;
      case 'opportunity':
        return css`background-color: #E6F6EC;`;
      case 'action':
        return css`background-color: #EAF1FD;`;
      default:
        return css`background-color: ${theme.colors.secondary.sectionBg};`;
    }
  }}
`

const BlockTitle = styled.div`
  font-size: 13px;
  line-height: 18px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .3px;
  color: ${({ theme }) => theme.colors.primary.additionalText};
`

const List = styled.ul`
  margin: 0;
  padding-left: 18px;
  font-size: 15px;
  line-height: 22px;
  color: ${({ theme }) => theme.colors.primary.text};

  & > li + li {
    margin-top: 4px;
  }
`

/** Цепочка влияния: шаги через стрелку, переносятся на узких экранах */
const Chain = styled.ol`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;

  & > li {
    padding: 6px 12px;
    border-radius: 100px;
    font-size: 14px;
    line-height: 20px;
    background-color: ${({ theme }) => theme.colors.secondary.sectionBg};
    color: ${({ theme }) => theme.colors.primary.text};
  }

  /* стрелка — между «таблетками», а не внутри шага */
  & > li + li {
    position: relative;
    margin-left: 18px;
  }

  & > li + li::before {
    content: '→';
    position: absolute;
    left: -19px;
    color: ${({ theme }) => theme.colors.secondary.textSecondary};
  }
`

const SmallText = styled.div`
  font-size: 14px;
  line-height: 20px;
  color: ${({ theme }) => theme.colors.secondary.textSecondary};

  & b {
    font-weight: 600;
    color: ${({ theme }) => theme.colors.primary.additionalText};
  }
`

const SourceLinks = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
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

/* ---------- источники ---------- */

const EvidenceList = styled.div`
  display: flex;
  flex-direction: column;
`

const EvidenceItem = styled.article`
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px 0;

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

const EvidenceTitle = styled.div`
  font-size: 15px;
  line-height: 22px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.primary.text};
`

const Excerpt = styled.div`
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 14px;
  line-height: 20px;
  color: ${({ theme }) => theme.colors.primary.additionalText};
`

export {
  ReportRoot, Section, SectionHeader, SectionTitle, SectionCount, Badges, OutcomeBadge, MutedBadge, SummaryTitle,
  Meta, Warnings, InsightHeader, Rank, InsightTitle, BodyText, Columns, Block, BlockTitle, List, Chain, SmallText,
  SourceLinks, ExternalLink, EvidenceList, EvidenceItem, EvidenceTitle, Excerpt,
};
