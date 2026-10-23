import { Fragment } from "react";
import { ACCOUNT, TASKS } from "../model/data";
import { CloseIcon, ListIcon, PlusIcon } from "./icons";
import {
  Approved, Balance, BalancePanel, CardArt, CardChip, Counter, Currencies, CurrencyDot, Footer,
  FooterTab, Grid, Hexagon, HexagonPerson, MoreCurrencies, Offer, OfferAmount, OfferClose, OfferIcon,
  Overdraft, OverviewRoot, Panel, PanelTitle, PromoPanel, PromoText, Spacer, Task, TaskList, Tile,
  TileIcon, Tiles, TileSubtitle, TileTitle,
} from "./Overview.styled";

const Overview = () => (
  <OverviewRoot>
    <Grid>
      <BalancePanel>
        <Balance>{ACCOUNT.balance}</Balance>
        <Overdraft>
          <div aria-hidden>↳</div>
          {ACCOUNT.overdraft}
        </Overdraft>
        <Currencies>
          {ACCOUNT.currencies.map((currency, index) => (
            <Fragment key={currency}>
              {index > 0 && <CurrencyDot />}
              <div>{currency}</div>
            </Fragment>
          ))}
          <CurrencyDot />
          <MoreCurrencies>+{ACCOUNT.moreCurrencies}</MoreCurrencies>
        </Currencies>

        <Spacer />

        <Offer>
          <OfferIcon><PlusIcon /></OfferIcon>
          Переводите себе бесплатно
          <OfferAmount>5 000 000 ₽</OfferAmount>
          <Approved>Одобрено</Approved>
          <OfferClose><CloseIcon /></OfferClose>
        </Offer>

        <Tiles>
          <Tile>
            <TileIcon><ListIcon /></TileIcon>
            <div>
              <TileTitle>Счета</TileTitle>
              <TileSubtitle>8 в рублях, 2 в валюте</TileSubtitle>
            </div>
          </Tile>
          <Tile>
            <TileIcon><PlusIcon /></TileIcon>
            <TileTitle>Заказать<br />бизнес-карту</TileTitle>
          </Tile>
        </Tiles>
      </BalancePanel>

      <Panel>
        <PanelTitle>Дела в работе</PanelTitle>
        <TaskList>
          {TASKS.map(({ label, count, tone }) => (
            <Task key={label} $tone={tone}>
              {label}
              <Counter $tone={tone}>{count}</Counter>
            </Task>
          ))}
        </TaskList>
      </Panel>

      <PromoPanel>
        <PanelTitle>Умная карта для всех</PanelTitle>
        <PromoText>Кэшбэк, бонусы и удобные платежи</PromoText>
        <CardArt aria-hidden><CardChip /></CardArt>
        <Hexagon aria-hidden><HexagonPerson /></Hexagon>
      </PromoPanel>
    </Grid>

    <Footer>
      <FooterTab>Реквизиты</FooterTab>
      <FooterTab>Тариф</FooterTab>
    </Footer>
  </OverviewRoot>
)

export { Overview };
