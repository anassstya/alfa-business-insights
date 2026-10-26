import styled from "styled-components";
import { BREAKPOINTS, Container } from "@/shared";

/** На всю ширину шапки — чату нужно место сбоку */
const PageRoot = styled(Container).attrs({ as: 'main' })`
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 1440px;
  padding-top: 24px;
  padding-bottom: 48px;

  @media ${BREAKPOINTS.phone} {
    gap: 16px;
    padding-top: 16px;
    padding-bottom: 32px;
  }
`

const BackLink = styled.button`
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0;
  border: none;
  background: none;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.secondary.textSecondary};

  &:hover {
    color: ${({ theme }) => theme.colors.primary.text};
  }

  & svg {
    width: 16px;
    height: 16px;
    transform: rotate(180deg);
  }
`

const Hero = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;

  @media ${BREAKPOINTS.phone} {
    & h2 {
      font-size: 26px;
    }
  }
`

const MetaLine = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  font-size: 15px;
  line-height: 22px;
  color: ${({ theme }) => theme.colors.secondary.textSecondary};

  & b {
    font-weight: 600;
    color: ${({ theme }) => theme.colors.primary.text};
  }
`

const Layout = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 400px;
  align-items: start;
  gap: 24px;

  @media (max-width: 1279px) {
    grid-template-columns: minmax(0, 1fr) 340px;
  }

  @media ${BREAKPOINTS.belowDesktop} {
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
  }
`

const MainColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-width: 0;

  @media ${BREAKPOINTS.phone} {
    gap: 16px;
  }
`

/** Чат прилипает к экрану под шапкой (~77px + отступ) и занимает всю оставшуюся высоту */
const ChatAside = styled.aside`
  position: sticky;
  top: 96px;
  height: calc(100vh - 120px);
  min-height: 480px;

  @media ${BREAKPOINTS.belowDesktop} {
    position: static;
    height: 600px;
  }
`

export { PageRoot, BackLink, Hero, MetaLine, Layout, MainColumn, ChatAside };
