import { MainLogo } from "@/shared"
import { SelectOrganization, SelectRole } from "@/features"
import { Context, HeaderInner, HeaderStyled } from "./Header.styled"

const Header = () => {
  return (
    <HeaderStyled>
      <HeaderInner>
        <MainLogo />
        <Context>
          <SelectOrganization />
          <SelectRole />
        </Context>
      </HeaderInner>
    </HeaderStyled>
  )
}

export { Header }
