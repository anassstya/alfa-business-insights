import { BellIcon, MailIcon, PanelIcon } from "./icons";
import {
  Avatar, Company, CompanyLogo, CompanyName, CompanyPerson, CompanyText,
  IconSlot, Profile, Separator, TopbarRoot,
} from "./Topbar.styled";

const Topbar = () => (
  <TopbarRoot>
    <IconSlot><MailIcon /></IconSlot>
    <IconSlot><BellIcon /></IconSlot>

    <Company>
      <CompanyLogo>N</CompanyLogo>
      <CompanyText>
        <CompanyName>ООО «Город Нагатино»</CompanyName>
        <CompanyPerson>Набоков И.Д.</CompanyPerson>
      </CompanyText>
    </Company>

    <Profile>
      <Avatar />
      Альфа Босс
    </Profile>

    <Separator />
    <IconSlot><PanelIcon /></IconSlot>
  </TopbarRoot>
)

export { Topbar };
