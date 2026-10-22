import styled from "styled-components";
import { BREAKPOINTS, Container } from "@/shared";

const MainPageStyled = styled(Container).attrs({ as: 'main' })`
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding-top: 32px;
  padding-bottom: 48px;

  @media ${BREAKPOINTS.phone} {
    gap: 16px;
    padding-top: 20px;
    padding-bottom: 32px;
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

const HeroSubtitle = styled.p`
  margin: 0;
  font-size: 16px;
  line-height: 24px;
  color: ${({ theme }) => theme.colors.secondary.textSecondary};

  & b {
    font-weight: 600;
    color: ${({ theme }) => theme.colors.primary.text};
  }
`

const Content = styled.div<{ $withAside: boolean }>`
  display: grid;
  grid-template-columns: ${({ $withAside }) => $withAside ? 'minmax(0, 1fr) 340px' : 'minmax(0, 1fr)'};
  align-items: start;
  gap: 24px;

  @media ${BREAKPOINTS.belowDesktop} {
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
  }
`

const Aside = styled.aside`
  position: sticky;
  top: 100px;

  @media ${BREAKPOINTS.belowDesktop} {
    position: static;
    order: -1;
  }
`

export { MainPageStyled, Hero, HeroSubtitle, Content, Aside };
