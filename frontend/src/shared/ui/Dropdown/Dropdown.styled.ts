import styled, { css } from "styled-components";

const StyledOptionsContainer = styled.div<{ width?: number, top?: number, left?: number }>`
  position: absolute;
  display: flex;
  flex-direction: column;
  border-radius: 16px;
  gap: 4px;

  ${({ width = 0, top = 0, left = 0, theme }) => css`
    width: ${width}px;
    top: ${top}px;
    left: ${left}px;
    background-color: ${theme.colors.secondary.cardBg};
    box-shadow: ${theme.colors.primary.text}20 4px 2px 5px;
  `}
`

const OptionStyled = styled.div<{ active?: boolean }>`
  display: flex;
  gap: 8px;
  padding: 4px;
  border-radius: 16px;

  ${({theme, active}) => {
    const activeStyles = css`
      background-color: ${theme.colors.primary.background};
    `
    return active ? [activeStyles] : []
  }}
`

export { StyledOptionsContainer, OptionStyled };