import styled from "styled-components";
import { Flex } from "../Flex";

const IconWrapper = styled.div`
  width: min-content;
  height: min-content;
  & * {
    color: ${({ theme }) => theme.colors.primary.primary};
  }
`

const FlexStyled = styled(Flex)`
  grid-column: 2;
`

export { IconWrapper, FlexStyled }