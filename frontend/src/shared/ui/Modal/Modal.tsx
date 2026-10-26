import type { PropsWithChildren } from "react";
import { createPortal } from "react-dom";
import { CloseButton, Content, ModalStyled, Overlay } from "./Modal.styled";
import { Title } from "../Typography";
import CrossIcon from '@/shared/icons/cross-icon.svg?react'

interface Props extends PropsWithChildren{
  header: string;
  width?: number;
  onClose?(): void;
  opened?: boolean;
  preventSimpleClose?: boolean
}

const Modal = ({ header, width, children, onClose, opened, preventSimpleClose = false }: Props) => {
  if (!opened) {
    return null;
  }
  
  return (
    createPortal(
      <>
        <Overlay onClick={preventSimpleClose ? undefined : onClose}/>
        <ModalStyled width={width}>
          {onClose && <CloseButton onClick={onClose}><CrossIcon width="16px" height="24px" /></CloseButton>}
            <Title.H2>{header}</Title.H2>
            <Content>{children}</Content>
        </ModalStyled>
      </>,
      document.querySelector('#portal')!
    )
  )
}

export { Modal };
