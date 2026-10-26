import styled from "styled-components";

const FeedRoot = styled.section`
position: relative;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
`

const Summary = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 4px;
  font-size: 14px;
  color: ${({ theme }) => theme.colors.secondary.textSecondary};
`

const DayGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`

const DayLabel = styled.h3`
  margin: 8px 0 0;
  padding: 0 4px;
  font-size: 15px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.secondary.textSecondary};
`

const StateMessage = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 32px 16px;
  text-align: center;
`

const StateIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  font-size: 26px;
  background-color: ${({ theme }) => theme.colors.secondary.sectionBg};
`

const StateText = styled.p`
  margin: 0;
  max-width: 420px;
  font-size: 15px;
  line-height: 22px;
  color: ${({ theme }) => theme.colors.secondary.textSecondary};
`

const LoadMore = styled.div`
  display: flex;
  justify-content: center;

  & > button {
    width: 100%;
    justify-content: center;
    padding: 16px 32px;
    cursor: pointer;
    background-color: ${({ theme }) => theme.colors.secondary.cardBg};
  }

  & > button:hover:not(:disabled) {
    background-color: ${({ theme }) => theme.colors.secondary.border};
  }

  & > button:disabled {
    cursor: default;
    opacity: .6;
  }
`

const Purpose = styled.div`
  width: 100%;
`

export { FeedRoot, Summary, DayGroup, DayLabel, StateMessage, StateIcon, StateText, LoadMore, Purpose };
