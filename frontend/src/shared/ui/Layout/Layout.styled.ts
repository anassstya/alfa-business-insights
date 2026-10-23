import styled from "styled-components";
import { BREAKPOINTS } from "@/shared/lib/breakpoints";

const Layout = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: ${({ theme }) => theme.colors.secondary.sectionBg};
`

const Container = styled.div`
  width: 100%;
  max-width: 1232px;
  margin: 0 auto;
  padding: 0 32px;
  box-sizing: border-box;

  @media ${BREAKPOINTS.phone} {
    padding: 0 16px;
  }
`

export { Layout, Container };
