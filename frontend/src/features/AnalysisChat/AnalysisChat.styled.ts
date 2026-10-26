import styled, { keyframes } from "styled-components";

const ChatRoot = styled.section`
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  border-radius: 24px;
  overflow: hidden;
  background-color: ${({ theme }) => theme.colors.secondary.cardBg};
`

const ChatHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 18px 20px 14px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.secondary.sectionBg};
`

const ChatTitle = styled.h3`
  margin: 0;
  font-size: 17px;
  line-height: 24px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.primary.text};
`

const ChatSubtitle = styled.div`
  font-size: 13px;
  line-height: 18px;
  color: ${({ theme }) => theme.colors.secondary.textSecondary};
`

const Messages = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px 20px;
  overscroll-behavior: contain;
`

const RetryButton = styled.button`
  display: block;
  margin-top: 6px;
  padding: 0;
  border: none;
  background: none;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.primary.primary};

  &:hover {
    color: ${({ theme }) => theme.colors.primary.hover};
  }
`

const blink = keyframes`
  0%, 80%, 100% { opacity: .25; transform: translateY(0); }
  40% { opacity: 1; transform: translateY(-2px); }
`

/** «Печатает…» — три точки, пока ждём ответ ассистента */
const Typing = styled.div`
  align-self: flex-start;
  display: flex;
  gap: 4px;
  padding: 14px 16px;
  border-radius: 16px 16px 16px 4px;
  background-color: ${({ theme }) => theme.colors.secondary.sectionBg};

  & > i {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: ${({ theme }) => theme.colors.secondary.textSecondary};
    animation: ${blink} 1.2s ease-in-out infinite;
  }

  & > i:nth-child(2) { animation-delay: .15s; }
  & > i:nth-child(3) { animation-delay: .3s; }
`

const Empty = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: auto 0;
`

const EmptyText = styled.div`
  font-size: 14px;
  line-height: 20px;
  color: ${({ theme }) => theme.colors.secondary.textSecondary};
`

const Suggestions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`

const Composer = styled.div`
  padding: 12px 16px 16px;
  border-top: 1px solid ${({ theme }) => theme.colors.secondary.sectionBg};
`

export {
  ChatRoot, ChatHeader, ChatTitle, ChatSubtitle, Messages, RetryButton, Typing, Empty, EmptyText,
  Suggestions, Composer,
};
