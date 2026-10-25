import AlphaIcon from '@/shared/icons/alpha.svg?react'
import { MENU } from "../model/data";
import { GearIcon, ProcurementIcon, RequestsIcon, ServicesIcon } from "./icons";
import { Badge, Bottom, Divider, Item, Logo, LogoMark, RoundIcon, SidebarRoot } from "./Sidebar.styled";
import { useNavigate } from 'react-router-dom';

const Sidebar = () => {
  const navigate = useNavigate();
  return (
  <SidebarRoot>
    <Logo>
      <LogoMark><AlphaIcon /></LogoMark>
      Альфа-Бизнес
    </Logo>

    <Item $large>
      <ServicesIcon />
      Все сервисы
    </Item>

    <Divider />

    {MENU.map(({ label, icon: Icon, badge }) => (
      <Item key={label}>
        <Icon />
        {label}
        {badge && <Badge>{badge}</Badge>}
      </Item>
    ))}

    <Item onClick={() => navigate('/insights')}>
      <RequestsIcon />
      Новостная аналитика
    </Item>

    <Divider />

    <Item>
      <RoundIcon><ProcurementIcon /></RoundIcon>
      Госзакупки
    </Item>

    <Bottom>
      <GearIcon />
      Настроить меню
    </Bottom>
  </SidebarRoot>
)}

export { Sidebar };
