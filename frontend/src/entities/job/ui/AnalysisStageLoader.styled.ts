import styled, { css, keyframes } from "styled-components";
import { Card } from "@/shared";

type StepState = 'done' | 'current' | 'pending';

const spin = keyframes`
  to { transform: rotate(360deg); }
`

const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(238, 49, 36, .35); }
  70% { box-shadow: 0 0 0 8px rgba(238, 49, 36, 0); }
  100% { box-shadow: 0 0 0 0 rgba(238, 49, 36, 0); }
`

const LoaderRoot = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: 16px;
`

const LoaderHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`

const Spinner = styled.div`
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 3px solid ${({ theme }) => theme.colors.secondary.sectionBg};
  border-top-color: ${({ theme }) => theme.colors.primary.primary};
  animation: ${spin} .9s linear infinite;

  @media (prefers-reduced-motion: reduce) {
    animation-duration: 3s;
  }
`

const LoaderTitle = styled.div`
  font-size: 17px;
  line-height: 24px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.primary.text};
`

const LoaderSubtitle = styled.div`
  font-size: 14px;
  line-height: 20px;
  color: ${({ theme }) => theme.colors.secondary.textSecondary};
`

const ProgressTrack = styled.div`
  height: 4px;
  border-radius: 2px;
  overflow: hidden;
  background-color: ${({ theme }) => theme.colors.secondary.sectionBg};
`

const ProgressBar = styled.div<{ $value: number }>`
  width: ${({ $value }) => `${Math.round($value * 100)}%`};
  height: 100%;
  border-radius: 2px;
  background-color: ${({ theme }) => theme.colors.primary.primary};
  transition: width .4s ease;
`

const Steps = styled.ol`
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
`

const Step = styled.li<{ $state: StepState }>`
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  line-height: 20px;
  transition: color .2s ease;

  ${({ theme, $state }) => {
    switch ($state) {
      case 'done':
        return css`color: ${theme.colors.primary.additionalText};`;
      case 'current':
        return css`
          font-weight: 600;
          color: ${theme.colors.primary.text};
        `;
      default:
        return css`color: ${theme.colors.secondary.textSecondary};`;
    }
  }}
`

const StepMarker = styled.span<{ $state: StepState }>`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  border-radius: 50%;

  & svg {
    width: 12px;
    height: 12px;
  }

  ${({ theme, $state }) => {
    switch ($state) {
      case 'done':
        return css`
          background-color: ${theme.colors.utility.success};
          color: ${theme.colors.secondary.cardBg};
        `;
      case 'current':
        return css`
          border: 2px solid ${theme.colors.primary.primary};
          background-color: ${theme.colors.secondary.cardBg};
          animation: ${pulse} 1.6s ease-out infinite;

          &::after {
            content: '';
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background-color: ${theme.colors.primary.primary};
          }
        `;
      default:
        return css`border: 2px solid ${theme.colors.secondary.border};`;
    }
  }}
`

export {
  LoaderRoot, LoaderHeader, Spinner, LoaderTitle, LoaderSubtitle, ProgressTrack, ProgressBar, Steps, Step, StepMarker,
  type StepState,
};
