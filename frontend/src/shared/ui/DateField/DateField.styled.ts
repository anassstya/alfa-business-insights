import styled, { css } from "styled-components"

const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  padding: 6px 12px;
  border-radius: 12px;
  border: 1px solid transparent;
  cursor: text;

  ${({ theme }) => css`
    background-color: ${theme.colors.secondary.sectionBg};

    &:focus-within {
      background-color: ${theme.colors.secondary.cardBg};
      border-color: ${theme.colors.primary.text};
    }
  `}
`

const FieldCaption = styled.span`
  font-size: 12px;
  line-height: 16px;
  color: ${({ theme }) => theme.colors.secondary.textSecondary};
`

const FieldInput = styled.input`
  border: none;
  outline: none;
  padding: 0;
  background: transparent;
  font-size: 15px;
  line-height: 20px;
  font-weight: 600;
  min-width: 0;
`

export { Field, FieldCaption, FieldInput }
