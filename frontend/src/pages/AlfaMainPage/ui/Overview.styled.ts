import styled, { css } from "styled-components";
import { ALFA } from "../AlfaMainPage.styled";
import type { TaskTone } from "../model/data";

const WHITE_60 = 'rgba(255, 255, 255, .6)';
const WHITE_45 = 'rgba(255, 255, 255, .45)';

/** Тёмный блок с балансом — фон с красным свечением, как в Альфа-Бизнес Онлайн */
const OverviewRoot = styled.section`
  position: relative;
  overflow: hidden;
  padding: 12px 12px 0;
  border-radius: 24px;
  color: #fff;
  background:
    radial-gradient(55% 70% at 38% 18%, rgba(150, 18, 18, .38), transparent 70%),
    radial-gradient(35% 60% at 72% 30%, rgba(130, 18, 18, .28), transparent 70%),
    #0B0B0D;

  @media (max-width: 639px) {
    margin: 0 -8px;
    border-radius: 20px;
  }
`

const Grid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1.65fr) minmax(0, .9fr) minmax(0, .9fr);
  gap: 12px;

  @media (max-width: 1279px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));

    & > :first-child {
      grid-column: 1 / -1;
    }
  }

  @media (max-width: 639px) {
    grid-template-columns: minmax(0, 1fr);
  }
`

const Panel = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 304px;
  padding: 20px;
  border-radius: 18px;
  background: linear-gradient(160deg, rgba(255, 255, 255, .07), rgba(255, 255, 255, .03));
`

const BalancePanel = styled(Panel)`
  background: linear-gradient(105deg, rgba(22, 22, 25, .95) 0%, rgba(22, 22, 25, .8) 45%, rgba(70, 12, 12, .55) 100%);
`

const Balance = styled.div`
  font-size: 32px;
  line-height: 40px;
  font-weight: 700;
  letter-spacing: -.5px;

  @media (max-width: 639px) {
    font-size: 24px;
    line-height: 32px;
  }
`

const Overdraft = styled.div`
  display: flex;
  gap: 6px;
  margin-top: 4px;
  font-size: 14px;
  line-height: 20px;
  color: ${WHITE_45};
`

const Currencies = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  margin-top: 14px;
  font-size: 15px;
  line-height: 20px;
  font-weight: 500;
`

const CurrencyDot = styled.div`
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background-color: ${WHITE_45};
`

const MoreCurrencies = styled.div`
  padding: 1px 7px;
  border-radius: 10px;
  background-color: rgba(255, 255, 255, .14);
  font-size: 12px;
  line-height: 18px;
`

const Spacer = styled.div`
  flex: 1;
  min-height: 24px;
`

const Offer = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, .1);
  font-size: 14px;
  line-height: 20px;
  color: ${WHITE_60};
`

const OfferIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background-color: ${ALFA.green};
  color: #fff;

  & svg {
    width: 12px;
    height: 12px;
    stroke-width: 3;
  }
`

const OfferAmount = styled.div`
  font-weight: 600;
  color: #fff;
`

const Approved = styled.div`
  padding: 1px 6px;
  border-radius: 6px;
  background-color: ${ALFA.green};
  color: #04310F;
  font-size: 9px;
  line-height: 14px;
  font-weight: 800;
  letter-spacing: .3px;
  text-transform: uppercase;
`

const OfferClose = styled.div`
  display: flex;
  margin-left: auto;
  color: ${WHITE_60};

  & svg {
    width: 16px;
    height: 16px;
  }
`

const Tiles = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  padding-top: 18px;

  @media (max-width: 639px) {
    grid-template-columns: minmax(0, 1fr);
  }
`

const Tile = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
`

const TileIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background-color: rgba(255, 255, 255, .08);
`

const TileTitle = styled.div`
  font-size: 14px;
  line-height: 18px;
`

const TileSubtitle = styled.div`
  margin-top: 2px;
  font-size: 12px;
  line-height: 16px;
  color: ${WHITE_45};
`

const PanelTitle = styled.div`
  margin-bottom: 18px;
  font-size: 15px;
  line-height: 20px;
  font-weight: 600;
`

const TaskList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 15px;
`

const Task = styled.div<{ $tone: TaskTone }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 14px;
  line-height: 20px;
  color: ${({ $tone }) => $tone === 'muted' ? 'rgba(255, 255, 255, .3)' : '#fff'};
`

const Counter = styled.div<{ $tone: TaskTone }>`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  font-size: 10px;
  font-weight: 700;

  ${({ $tone }) => {
    switch ($tone) {
      case 'accent':
        return css`background-color: ${ALFA.red}; color: #fff;`;
      case 'muted':
        return css`background-color: rgba(255, 255, 255, .06); color: rgba(255, 255, 255, .3);`;
      default:
        return css`background-color: rgba(255, 255, 255, .14); color: #fff;`;
    }
  }}
`

const PromoPanel = styled(Panel)`
  overflow: hidden;
  background:
    radial-gradient(70% 45% at 70% 100%, rgba(239, 49, 36, .45), transparent 70%),
    linear-gradient(165deg, #2B2B2F 0%, #1A1A1D 55%, #241012 100%);

  @media (max-width: 639px) {
    min-height: 260px;
  }
`

const PromoText = styled.div`
  position: relative;
  z-index: 1;
  max-width: 190px;
  margin-top: -10px;
  font-size: 12px;
  line-height: 16px;
  color: rgba(255, 255, 255, .7);
`

/** Иллюстрация «умной карты»: наклонённая металлическая карта с красным торцом и шестигранный бейдж */
const CardArt = styled.div`
  position: absolute;
  right: -28px;
  bottom: 44px;
  width: 210px;
  height: 128px;
  border-radius: 14px;
  background: linear-gradient(135deg, #E4E6EA 0%, #A4A7AE 45%, #D3D5DA 70%, #8E9198 100%);
  transform: rotate(-14deg) skewX(-16deg);
  box-shadow:
    -2px 0 0 #5CF28A,
    0 16px 0 #C8161C,
    0 34px 40px rgba(239, 49, 36, .5);

  &::after {
    content: '1010 0  1010 0';
    position: absolute;
    left: 56px;
    bottom: 14px;
    font-family: 'Courier New', monospace !important;
    font-size: 12px;
    letter-spacing: 2px;
    white-space: pre;
    color: #4BD873;
  }
`

const CardChip = styled.div`
  position: absolute;
  top: 24px;
  right: 22px;
  width: 26px;
  height: 20px;
  border-radius: 4px;
  background: repeating-linear-gradient(0deg, #C9CBD0 0 4px, #EDEEF0 4px 6px);
`

const Hexagon = styled.div`
  position: absolute;
  left: 28px;
  bottom: 118px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 68px;
  height: 74px;
  clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%);
  background: linear-gradient(150deg, #F2F3F5 0%, #9EA2A9 55%, #6C7078 100%);
  transform: rotate(-14deg);
`

const HexagonPerson = styled.div`
  position: relative;
  width: 26px;
  height: 30px;

  &::before,
  &::after {
    content: '';
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(180deg, #FFFFFF, #C7C9CE);
    box-shadow: 0 2px 3px rgba(0, 0, 0, .25);
  }

  &::before {
    top: 0;
    width: 13px;
    height: 13px;
    border-radius: 50%;
  }

  &::after {
    bottom: 0;
    width: 24px;
    height: 13px;
    border-radius: 12px 12px 4px 4px;
  }
`

const Footer = styled.div`
  display: flex;
  gap: 8px;
  padding: 2px 12px;
`

const FooterTab = styled.div`
  padding: 14px 12px;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
`

export {
  OverviewRoot, Grid, BalancePanel, Balance, Overdraft, Currencies, CurrencyDot, MoreCurrencies,
  Spacer, Offer, OfferIcon, OfferAmount, Approved, OfferClose, Tiles, Tile, TileIcon, TileTitle,
  TileSubtitle, Panel, PanelTitle, TaskList, Task, Counter, PromoPanel, PromoText, CardArt, CardChip,
  Hexagon, HexagonPerson, Footer, FooterTab,
};
