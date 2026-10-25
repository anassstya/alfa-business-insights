import styled from "styled-components";
import { Card } from "@/shared";

const ChatRoot = styled.section`
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
`

const ProgressText = styled.div`
  padding: 0 4px;
  font-size: 14px;
  line-height: 20px;
  color: ${({ theme }) => theme.colors.secondary.textSecondary};
`

const StateCard = styled(Card)`
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

/** Панель чата: история сообщений и поле ввода внизу */
const Panel = styled.div`
  display: flex;
  flex-direction: column;
  border-radius: 24px;
  background-color: ${({ theme }) => theme.colors.secondary.cardBg};
`

const PanelHeader = styled.div`
  padding: 18px 20px 0;
`

const PanelTitle = styled.h3`
  margin: 0;
  font-size: 17px;
  line-height: 24px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.primary.text};
`

const Messages = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 72px;
  max-height: 480px;
  overflow-y: auto;
  padding: 12px 20px;
`

const Hint = styled.div`
  font-size: 14px;
  line-height: 20px;
  color: ${({ theme }) => theme.colors.secondary.textSecondary};
`

const ErrorText = styled.div`
  font-size: 14px;
  line-height: 20px;
  color: ${({ theme }) => theme.colors.utility.error};
`

const Footer = styled.div`
  padding: 12px 16px 16px;
  border-top: 1px solid ${({ theme }) => theme.colors.secondary.sectionBg};
`

export {
  ChatRoot, ProgressText, StateCard, StateIcon, StateText, Panel, PanelHeader, PanelTitle, Messages, Hint,
  ErrorText, Footer,
};
