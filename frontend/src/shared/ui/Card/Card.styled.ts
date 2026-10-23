import styled from "styled-components";
import { BREAKPOINTS } from "@/shared/lib/breakpoints";

const Card = styled.div`
  background-color: ${({ theme }) => theme.colors.secondary.cardBg};
  border-radius: 24px;
  padding: 24px;
  box-sizing: border-box;

  @media ${BREAKPOINTS.phone} {
    border-radius: 20px;
    padding: 16px;
  }
`

export { Card };
