import styled from "styled-components";
import { ALFA } from "../AlfaMainPage.styled";

const TopbarRoot = styled.header`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 20px;
  min-height: 40px;

  @media (max-width: 639px) {
    gap: 12px;
  }
`

const IconSlot = styled.div`
  display: flex;
  color: ${ALFA.icon};

  @media (max-width: 639px) {
    display: none;
  }
`

const Company = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
`

const CompanyLogo = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 9px;
  background-color: #D2F53C;
  color: ${ALFA.text};
  font-size: 18px;
  font-weight: 900;
  letter-spacing: -1px;
`

const CompanyText = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
`

const CompanyName = styled.div`
  font-size: 13px;
  line-height: 17px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

const CompanyPerson = styled.div`
  font-size: 11px;
  line-height: 14px;
  color: ${ALFA.textSecondary};
`

const Profile = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  padding: 3px 14px 3px 3px;
  border-radius: 100px;
  background-color: ${ALFA.text};
  color: #fff;
  font-size: 12px;
  line-height: 16px;
  font-weight: 600;
  white-space: nowrap;
`

const Avatar = styled.div`
  position: relative;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  overflow: hidden;
  background: radial-gradient(circle at 50% 38%, #e9c7ad 0 22%, transparent 23%),
    linear-gradient(180deg, #5b6470 0%, #2a2f36 100%);

  /* плечи в пиджаке */
  &::after {
    content: '';
    position: absolute;
    left: 3px;
    right: 3px;
    bottom: -8px;
    height: 16px;
    border-radius: 50%;
    background: linear-gradient(90deg, #111 0 42%, #f2f2f2 42% 58%, #111 58%);
  }
`

const Separator = styled.div`
  width: 1px;
  height: 24px;
  background-color: ${ALFA.divider};

  @media (max-width: 639px) {
    display: none;
  }
`

export { TopbarRoot, IconSlot, Company, CompanyLogo, CompanyText, CompanyName, CompanyPerson, Profile, Avatar, Separator };
