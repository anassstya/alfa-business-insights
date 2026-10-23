import styled, { css } from "styled-components";
import { ALFA } from "../AlfaMainPage.styled";

const SummaryRoot = styled.section`
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-top: 8px;
`

const TabsRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
`

const Tabs = styled.div`
  display: flex;
  gap: 26px;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
`

const Tab = styled.div<{ $active?: boolean }>`
  flex-shrink: 0;
  font-size: 20px;
  line-height: 28px;
  font-weight: ${({ $active }) => $active ? 700 : 500};
  color: ${({ $active }) => $active ? ALFA.text : ALFA.textTertiary};
  white-space: nowrap;

  @media (max-width: 639px) {
    font-size: 17px;
  }
`

const ViewControls = styled.div`
  display: flex;
  align-items: center;
  gap: 18px;
  flex-shrink: 0;
  color: ${ALFA.text};
`

const Segmented = styled.div`
  display: flex;
  padding: 3px;
  border-radius: 10px;
  background-color: ${ALFA.control};
`

const Segment = styled.div<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 26px;
  border-radius: 8px;

  & svg {
    width: 18px;
    height: 18px;
  }

  ${({ $active }) => $active ? css`
    background-color: ${ALFA.surface};
    box-shadow: 0 1px 3px rgba(15, 26, 36, .12);
  ` : css`
    color: ${ALFA.textSecondary};
  `}
`

const Widgets = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, .5fr) auto;
  align-items: start;
  gap: 20px;

  @media (max-width: 1279px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: 639px) {
    grid-template-columns: minmax(0, 1fr);
  }
`

const WidgetCard = styled.div`
  padding: 20px 22px;
  border-radius: 20px;
  background-color: ${ALFA.surface};
`

const WidgetHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-size: 15px;
  line-height: 20px;
  font-weight: 700;

  & > svg {
    width: 16px;
    height: 16px;
    margin-left: auto;
  }
`

const HeaderCounter = styled.div`
  min-width: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background-color: ${ALFA.pageBg};
  font-size: 11px;
  line-height: 18px;
  font-weight: 600;
  text-align: center;
`

const RequestItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 0 12px;

  & + & {
    border-top: 1px solid ${ALFA.divider};
  }
`

const RequestProduct = styled.div`
  font-size: 13px;
  line-height: 18px;
  font-weight: 600;
`

const RequestRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`

const RequestAmount = styled.div`
  font-size: 14px;
  line-height: 20px;
`

const StatusBadge = styled.div`
  padding: 2px 7px;
  border-radius: 6px;
  background-color: ${ALFA.blueLight};
  color: ${ALFA.blue};
  font-size: 10px;
  line-height: 14px;
  font-weight: 700;
  letter-spacing: .3px;
  text-transform: uppercase;
`

const RequestMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  line-height: 16px;
  color: ${ALFA.textSecondary};
`

const RiskBody = styled.div`
  position: relative;
  display: flex;
  justify-content: center;
  padding-top: 12px;

  & > svg {
    width: 100%;
    max-width: 210px;
    height: auto;
  }
`

const RiskCenter = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  text-align: center;

  & > svg {
    color: ${ALFA.green};
  }
`

const RiskTitle = styled.div`
  font-size: 15px;
  line-height: 20px;
  font-weight: 700;
`

const RiskCaption = styled.div`
  font-size: 11px;
  line-height: 14px;
  color: ${ALFA.textSecondary};
`

const Stories = styled.div`
  display: flex;
  gap: 10px;

  @media (max-width: 1279px) {
    grid-column: 1 / -1;
  }
`

/** Карточка-сторис с красной рамкой «непросмотрено» */
const Story = styled.div<{ $variant: 'money' | 'summit' }>`
  position: relative;
  overflow: hidden;
  width: 112px;
  height: 168px;
  padding: 10px;
  border-radius: 16px;
  border: 3px solid ${ALFA.red};
  box-shadow: inset 0 0 0 2px #fff;
  color: #fff;
  font-size: 12px;
  line-height: 15px;
  font-weight: 700;

  ${({ $variant }) => $variant === 'money' ? css`
    background:
      radial-gradient(circle at 55% 64%, #D7D9DD 0 14%, #7E828A 15% 20%, transparent 21%),
      radial-gradient(circle at 55% 64%, rgba(239, 49, 36, .55), transparent 45%),
      linear-gradient(180deg, #1C1C1F 0%, #2C2C30 100%);
  ` : css`
    background: #0B0B0D;
  `}
`

const SummitTitle = styled.div`
  position: absolute;
  left: 4px;
  top: 6px;
  color: ${ALFA.red};
  font-size: 30px;
  line-height: 28px;
  font-weight: 900;
  letter-spacing: -1px;
  text-transform: uppercase;
  transform: rotate(-4deg);
`

const ChatBubble = styled.div`
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background-color: ${ALFA.surface};
  color: ${ALFA.text};
  box-shadow: 0 4px 16px rgba(15, 26, 36, .18);
`

const ChatBadge = styled.div`
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 18px;
  height: 18px;
  border-radius: 9px;
  border: 2px solid ${ALFA.pageBg};
  background-color: ${ALFA.red};
  color: #fff;
  font-size: 10px;
  line-height: 14px;
  font-weight: 700;
  text-align: center;
`

export {
  SummaryRoot, TabsRow, Tabs, Tab, ViewControls, Segmented, Segment, Widgets, WidgetCard,
  WidgetHeader, HeaderCounter, RequestItem, RequestProduct, RequestRow, RequestAmount, StatusBadge,
  RequestMeta, RiskBody, RiskCenter, RiskTitle, RiskCaption, Stories, Story, SummitTitle,
  ChatBubble, ChatBadge,
};
