import styled, { css } from "styled-components";

/**
 * Обёртка повторяет триггер Select один в один (высота, радиус, фон, hover и фокус),
 * чтобы поле ввода и селекты в одном ряду выглядели как один набор контролов.
 */
const FieldLabel = styled.label<{ $fullWidth?: boolean, $disabled?: boolean }>`
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
  width: ${({ $fullWidth }) => $fullWidth ? '100%' : 'auto'};
  min-height: 52px;
  padding: 6px 16px;
  border-radius: 12px;
  border: 1px solid transparent;
  box-sizing: border-box;
  cursor: text;
  transition: background-color .15s ease, border-color .15s ease;

  ${({ theme, $disabled }) => css`
    background-color: ${theme.colors.secondary.sectionBg};

    &:hover {
      background-color: ${theme.colors.secondary.border};
    }

    &:focus-within {
      background-color: ${theme.colors.secondary.cardBg};
      border-color: ${theme.colors.primary.text};
    }

    ${$disabled && css`
      cursor: default;
      opacity: .6;

      &:hover {
        background-color: ${theme.colors.secondary.sectionBg};
      }
    `}
  `}
`

const FieldCaption = styled.span`
  font-size: 12px;
  line-height: 16px;
  color: ${({ theme }) => theme.colors.secondary.textSecondary};
`

const FieldInput = styled.input`
  width: 100%;
  min-width: 0;
  padding: 0;
  border: none;
  outline: none;
  background: transparent;
  font-size: 15px;
  line-height: 20px;
  font-weight: 600;
  text-overflow: ellipsis;
  color: ${({ theme }) => theme.colors.primary.text};

  &::placeholder {
    color: ${({ theme }) => theme.colors.secondary.textSecondary};
  }

  &:disabled {
    cursor: default;
  }
`

export { FieldLabel, FieldCaption, FieldInput };
