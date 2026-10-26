import { ALFA } from "../AlfaMainPage.styled";
import { REQUESTS, SUMMARY_TABS } from "../model/data";
import { ChatIcon, ChevronRightIcon, CupIcon, EyeIcon, EyeOffIcon, GearIcon } from "./icons";
import {
  ChatBadge, ChatBubble, HeaderCounter, RequestAmount, RequestItem, RequestMeta, RequestProduct,
  RequestRow, RiskBody, RiskCaption, RiskCenter, RiskTitle, Segment, Segmented, StatusBadge, Stories,
  Story, SummaryRoot, SummitTitle, Tab, Tabs, TabsRow, ViewControls, WidgetCard, WidgetHeader, Widgets,
} from "./Summary.styled";

const ProgressRing = ({ step, steps }: { step: number, steps: number }) => {
  const circumference = 2 * Math.PI * 6;

  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
      <circle cx="8" cy="8" r="6" fill="none" stroke={ALFA.divider} strokeWidth="2" />
      <circle
        cx="8"
        cy="8"
        r="6"
        fill="none"
        stroke={ALFA.green}
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={`${circumference * step / steps} ${circumference}`}
        transform="rotate(-90 8 8)"
      />
    </svg>
  )
}

const RiskGauge = () => {
  const ticks = Array.from({ length: 13 }, (_, i) => Math.PI - (Math.PI * i) / 12);

  return (
    <svg viewBox="0 0 220 120" aria-hidden>
      <path d="M20 110 A90 90 0 0 1 200 110" fill="none" stroke={ALFA.control} strokeWidth="2" />
      {ticks.map(angle => (
        <line
          key={angle}
          x1={110 + 84 * Math.cos(angle)}
          y1={110 - 84 * Math.sin(angle)}
          x2={110 + 79 * Math.cos(angle)}
          y2={110 - 79 * Math.sin(angle)}
          stroke={ALFA.divider}
          strokeWidth="2"
          strokeLinecap="round"
        />
      ))}
      <path d="M20 110 A90 90 0 0 1 46 46" fill="none" stroke={ALFA.green} strokeWidth="6" strokeLinecap="round" />
      <circle cx="46" cy="46" r="5" fill={ALFA.surface} stroke={ALFA.green} strokeWidth="3" />
    </svg>
  )
}

const Summary = () => (
  <SummaryRoot>
    <TabsRow>
      <Tabs>
        {SUMMARY_TABS.map((tab, index) => <Tab key={tab} $active={index === 0}>{tab}</Tab>)}
      </Tabs>
      <ViewControls>
        <Segmented>
          <Segment $active><EyeIcon /></Segment>
          <Segment><EyeOffIcon /></Segment>
        </Segmented>
        <GearIcon />
      </ViewControls>
    </TabsRow>

    <Widgets>
      <WidgetCard>
        <WidgetHeader>
          Активные заявки
          <HeaderCounter>9</HeaderCounter>
          <ChevronRightIcon />
        </WidgetHeader>
        {REQUESTS.map(({ product, amount, date, status, step, steps }) => (
          <RequestItem key={product}>
            <RequestProduct>{product}</RequestProduct>
            <RequestRow>
              <RequestAmount>{amount}</RequestAmount>
              <StatusBadge>{status}</StatusBadge>
            </RequestRow>
            <RequestRow>
              <RequestMeta>{date}</RequestMeta>
              <RequestMeta>
                {step} из {steps}
                <ProgressRing step={step} steps={steps} />
              </RequestMeta>
            </RequestRow>
          </RequestItem>
        ))}
      </WidgetCard>

      <WidgetCard>
        <WidgetHeader>
          Индикатор риска
          <ChevronRightIcon />
        </WidgetHeader>
        <RiskBody>
          <RiskGauge />
          <RiskCenter>
            <CupIcon />
            <RiskTitle>Низкий риск</RiskTitle>
            <RiskCaption>Действия компаний</RiskCaption>
          </RiskCenter>
        </RiskBody>
      </WidgetCard>

      <Stories>
        <Story $variant="money">Как получить деньги на бизнес</Story>
        <Story $variant="summit"><SummitTitle>Альфа-саммит</SummitTitle></Story>
      </Stories>
    </Widgets>

    <ChatBubble aria-hidden>
      <ChatIcon />
      <ChatBadge>1</ChatBadge>
    </ChatBubble>
  </SummaryRoot>
)

export { Summary };
