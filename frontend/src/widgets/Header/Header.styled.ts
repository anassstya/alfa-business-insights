import styled from "styled-components";
import { BREAKPOINTS } from "@/shared";

const HeaderStyled = styled.header`
  position: sticky;
  top: 0;
  z-index: 10;
  background-color: ${({ theme }) => theme.colors.secondary.cardBg};
  border-bottom: 1px solid ${({ theme }) => theme.colors.secondary.border};

  @media ${BREAKPOINTS.phone} {
    position: static;
  }
`

const HeaderInner = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;

  padding: 12px 32px 12px;

  @media ${BREAKPOINTS.belowDesktop} {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  @media ${BREAKPOINTS.phone} {
    padding: 0 16px;
  }
`

const Context = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 320px) minmax(0, 240px);
  gap: 8px;
  flex: 1;
  justify-content: end;

  @media ${BREAKPOINTS.belowDesktop} {
    grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
  }

  @media ${BREAKPOINTS.phone} {
    grid-template-columns: minmax(0, 1fr);
  }
`

export { HeaderStyled, HeaderInner, Context };
