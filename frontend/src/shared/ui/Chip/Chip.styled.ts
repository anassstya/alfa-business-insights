import styled, { css } from "styled-components";

const Chip = styled.button<{ $active?: boolean }>`
  flex-shrink: 0;
  padding: 8px 16px;
  border-radius: 100px;
  border: none;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color .15s ease, color .15s ease;

  ${({ theme, $active }) => $active ? css`
    background-color: ${theme.colors.primary.text};
    color: ${theme.colors.secondary.cardBg};
  ` : css`
    background-color: ${theme.colors.secondary.sectionBg};
    color: ${theme.colors.primary.text};

    &:hover {
      background-color: ${theme.colors.secondary.border};
    }
  `}

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.primary.primary};
    outline-offset: 2px;
  }
`

const Badge = styled.span<{ $variant?: 'neutral' | 'accent' }>`
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: 100px;
  font-size: 12px;
  line-height: 18px;
  font-weight: 500;

  ${({ theme, $variant = 'neutral' }) => $variant === 'accent' ? css`
    background-color: ${theme.colors.primary.background};
    color: ${theme.colors.primary.hover};
  ` : css`
    background-color: ${theme.colors.secondary.sectionBg};
    color: ${theme.colors.primary.additionalText};
  `}
`

export { Chip, Badge };
