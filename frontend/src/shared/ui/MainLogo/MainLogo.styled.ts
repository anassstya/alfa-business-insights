import styled from "styled-components";
import { Flex } from "../Flex";

const IconWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  flex-shrink: 0;
  background-color: ${({ theme }) => theme.colors.primary.primary};

  & svg {
    width: 18px;
    height: 26px;
    color: ${({ theme }) => theme.colors.secondary.cardBg};
  }
`

const FlexStyled = styled(Flex)`
  flex-shrink: 0;
`

const Wordmark = styled.span`
  display: flex;
  flex-direction: column;
  line-height: 1.1;
`

const WordmarkTitle = styled.span`
  font-size: 18px;
  font-weight: 700;
  white-space: nowrap;
`

const WordmarkSubtitle = styled.span`
  font-size: 12px;
  white-space: nowrap;
  color: ${({ theme }) => theme.colors.secondary.textSecondary};
`

export { IconWrapper, FlexStyled, Wordmark, WordmarkTitle, WordmarkSubtitle }
