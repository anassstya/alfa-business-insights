import styled from "styled-components";
import { BREAKPOINTS } from "@/shared";

const FactList = styled.dl`
  display: grid;
  gap: 16px;
  margin: 20px 0 0;

  @media ${BREAKPOINTS.belowDesktop} {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px 16px;
    margin-top: 16px;
  }
`

const Fact = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;

  & dt {
    font-size: 13px;
    line-height: 18px;
    color: ${({ theme }) => theme.colors.secondary.textSecondary};
  }

  & dd {
    margin: 0;
    font-size: 15px;
    line-height: 20px;
    font-weight: 500;
    color: ${({ theme }) => theme.colors.primary.text};
  }
`

export { FactList, Fact };

const Eyebrow = styled.span`
  font-size: 13px;
  line-height: 18px;
  color: ${({ theme }) => theme.colors.secondary.textSecondary};
`

export { Eyebrow };
