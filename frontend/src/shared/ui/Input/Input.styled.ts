import styled, { css } from "styled-components";

const StyledInput = styled.input`
  background-color: transparent;
  border: none;
  outline: none;
  height: max-content;
  width: max-content;
`

const InputBase = styled.div`
  position: relative;
  display: flex;
  width: fit-content;
  padding: 4px;
  height: 24px;
  align-items: center;
  gap: 4px;

  ${( { theme }) => {
    const backgroundStyled = css`
      border: 1px solid ${theme.colors.secondary.border};
      background-color: ${theme.colors.primary.secondary};
      border-radius: 8px;
    `

    return [backgroundStyled]
  }}
`

const StyledClearButton = styled.button`
  background-color: transparent;
  border: none;
  padding: 0;
  width: min-content;
  height: min-content;
  display: flex;
  align-items: center;
  width: 12px;
  color: ${({ theme }) => theme.colors.primary.text};
`

export { StyledInput, InputBase, StyledClearButton };