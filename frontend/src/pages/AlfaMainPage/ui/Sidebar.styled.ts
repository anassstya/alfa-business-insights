import styled from "styled-components";
import { ALFA } from "../AlfaMainPage.styled";

const SidebarRoot = styled.aside`
  position: sticky;
  top: 0;
  display: flex;
  flex-direction: column;
  height: 100vh;
  padding: 12px 16px 20px 8px;
  overflow-y: auto;
  scrollbar-width: none;

  @media (max-width: 1023px) {
    display: none;
  }
`

const Logo = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 0 0 0;
  margin-bottom: 30px;
  font-size: 15px;
  font-weight: 700;
  white-space: nowrap;
`

const LogoMark = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 9px;
  background-color: ${ALFA.red};
  color: #fff;

  & svg {
    width: 14px;
    height: 20px;
  }
`

const Item = styled.div<{ $large?: boolean }>`
  display: flex;
  align-items: center;
  gap: 14px;
  padding: ${({ $large }) => $large ? '10px 8px' : '9px 8px'};
  font-size: ${({ $large }) => $large ? 15 : 13}px;
  line-height: 20px;
  font-weight: 500;
  white-space: nowrap;

  & > svg {
    flex-shrink: 0;
    color: ${ALFA.icon};
  }
`

const Badge = styled.div`
  margin-left: auto;
  padding: 2px 7px;
  border-radius: 6px;
  background-color: ${ALFA.blue};
  color: #fff;
  font-size: 9px;
  line-height: 14px;
  font-weight: 700;
  letter-spacing: .3px;
  text-transform: uppercase;
`

const Divider = styled.div`
  height: 1px;
  margin: 10px 8px;
  background-color: ${ALFA.divider};
`

const RoundIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  margin: -3px;
  border-radius: 50%;
  border: 1px solid ${ALFA.divider};
  color: ${ALFA.icon};

  & svg {
    width: 16px;
    height: 16px;
  }
`

const Bottom = styled(Item)`
  margin-top: auto;
  padding-top: 24px;
  color: ${ALFA.textSecondary};

  & > svg {
    color: ${ALFA.textTertiary};
  }
`

export { SidebarRoot, Logo, LogoMark, Item, Badge, Divider, RoundIcon, Bottom };
