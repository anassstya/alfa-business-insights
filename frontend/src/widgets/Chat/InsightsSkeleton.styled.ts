import styled from "styled-components";
import { BREAKPOINTS, Card } from "@/shared";

const SkeletonRoot = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`

const SkeletonCard = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: 12px;
`

const Row = styled.div<{ $gap?: number, $justify?: string }>`
  display: flex;
  align-items: center;
  gap: ${({ $gap = 8 }) => $gap}px;
  justify-content: ${({ $justify = 'flex-start' }) => $justify};
`

const Metrics = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 4px;

  @media ${BREAKPOINTS.phone} {
    grid-template-columns: repeat(2, minmax(0, 1fr));

    & > :last-child {
      display: none;
    }
  }
`

const Metric = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px;
  border-radius: 16px;
  border: 1px solid ${({ theme }) => theme.colors.secondary.sectionBg};
`

const SectionLabel = styled.div`
  margin-top: 8px;
  padding: 0 4px;

  & > * {
    background-color: ${({ theme }) => theme.colors.secondary.border};
  }
`

export { SkeletonRoot, SkeletonCard, Row, Metrics, Metric, SectionLabel };
