import styled, { css } from "styled-components";

interface StyledButtonProps {
  variant?: 'primary' | 'secondary'
  borderSize? : 'S' | 'M' | 'L'
}

const borderVariants = (borderSize: StyledButtonProps['borderSize']) => {
  switch(borderSize){
    case 'L':
      return css`
        border-radius: 24px;
      `
    case 'M':
      return css`
        border-radius: 16px;
      `
    case 'S':
      return css`
        border-radius: 8px;
      `
  }
}

const BaseButton = styled.button<StyledButtonProps>`
  ${( { theme, variant = 'primary', borderSize = 'M' }) => {
    const baseStyles = css`
      background-color: ${theme.colors.primary.primary};
      color: ${theme.colors.primary.background};
      outline: none;
      border: none;
      padding: 16px 8px;
      font-size: 16px;
      line-height: 1;
      font-weight: 600;

      display: flex;
      flex-wrap: nowrap;
      align-items: center;
      gap: 8px;

      &:hover {
        background-color: ${theme.colors.primary.hover};
      }
    `;

    const variantStyled = variant === 'primary' ?  css`
      background-color: ${theme.colors.primary.primary};
    ` : css`
      background-color: ${theme.colors.primary.secondary};
      color: ${theme.colors.primary.text};

      &:hover {
        background-color: ${theme.colors.secondary.border};
      }
    `;

    const borderStyles = borderVariants(borderSize)

    return [baseStyles, variantStyled, borderStyles]
  }}
`

export { BaseButton, type StyledButtonProps };
