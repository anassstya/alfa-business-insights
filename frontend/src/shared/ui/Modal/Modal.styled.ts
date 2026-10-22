import styled, { css } from "styled-components";

const Overlay = styled.div`
  position: absolute;
  width: 100%;
  height: 100%;
  overflow: hidden;
  top: 0;
  z-index: 11;
  background-color: #000;
  opacity: 0.3;
`

const ModalStyled = styled.div<{ width?: number }>`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background-color: #fff;
  z-index:12;
  border-radius: 16px;
  padding: 16px;

  ${({ width = 300, theme }) => css`
    width: ${width}px;
    & > h2 {
      border-bottom: 1px solid ${theme.colors.secondary.border};
    }
  `}
`

const Content=  styled.div`
  margin-top: 16px;
`

const CloseButton = styled.button`
  position: absolute;
  top: 8px;
  right: 8px;
  background-color: transparent;
  border: none;
  outline: none;
  width: 16px;
  height: 16px;
  padding: 0;
`

export { Overlay, ModalStyled, Content, CloseButton }