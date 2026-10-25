import styled, { css, keyframes } from "styled-components";

const BORDER_WIDTH = 2;
const RADIUS = 14;

const spin = keyframes`
  from { transform: translate(-50%, -50%) rotate(0deg); }
  to { transform: translate(-50%, -50%) rotate(360deg); }
`

const FieldRoot = styled.div<{ $loading: boolean, $disabled: boolean }>`
  position: relative;
  isolation: isolate;
  display: flex;
  width: 100%;
  padding: ${BORDER_WIDTH}px;
  border-radius: ${RADIUS}px;
  overflow: hidden;
  box-sizing: border-box;
  transition: background-color .15s ease;

  ${({ theme, $loading, $disabled }) => css`
    background-color: ${theme.colors.secondary.border};

    &:focus-within {
      background-color: ${theme.colors.primary.text};
    }

    ${$disabled && !$loading && css`
      opacity: .6;
    `}

    ${$loading && css`
      background-color: ${theme.colors.primary.background};

      &::before {
        content: '';
        position: absolute;
        z-index: -1;
        top: 50%;
        left: 50%;
        width: calc(100% + 120px);
        aspect-ratio: 1;
        background: conic-gradient(
          from 0deg,
          transparent 0deg 70deg,
          ${theme.colors.primary.primary}40 110deg,
          ${theme.colors.primary.primary} 170deg,
          transparent 180deg 250deg,
          ${theme.colors.primary.primary}40 290deg,
          ${theme.colors.primary.primary} 350deg,
          transparent 360deg
        );
        animation: ${spin} 2s linear infinite;
      }

      @media (prefers-reduced-motion: reduce) {
        background-color: ${theme.colors.primary.primary};

        &::before {
          display: none;
        }
      }
    `}
  `}
`

const FieldInner = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
  padding: 6px 6px 6px 16px;
  border-radius: ${RADIUS - BORDER_WIDTH}px;
  background-color: ${({ theme }) => theme.colors.secondary.cardBg};
`

const FieldInput = styled.input`
  flex: 1;
  min-width: 0;
  height: 36px;
  padding: 0;
  border: none;
  outline: none;
  background: transparent;
  font-size: 15px;
  line-height: 20px;
  color: ${({ theme }) => theme.colors.primary.text};

  &::placeholder {
    color: ${({ theme }) => theme.colors.secondary.textSecondary};
  }

  &:disabled {
    cursor: not-allowed;
  }
`

const SendButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  padding: 0;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: background-color .15s ease, transform .1s ease;

  ${({ theme }) => css`
    background-color: ${theme.colors.primary.primary};
    color: ${theme.colors.secondary.cardBg};

    &:hover:not(:disabled) {
      background-color: ${theme.colors.primary.hover};
    }

    &:active:not(:disabled) {
      transform: scale(.94);
    }

    &:focus-visible {
      outline: 2px solid ${theme.colors.primary.text};
      outline-offset: 2px;
    }

    &:disabled {
      cursor: not-allowed;
      background-color: ${theme.colors.secondary.sectionBg};
      color: ${theme.colors.secondary.textSecondary};
    }
  `}

  & svg {
    width: 20px;
    height: 20px;
  }
`

export { FieldRoot, FieldInner, FieldInput, SendButton };
