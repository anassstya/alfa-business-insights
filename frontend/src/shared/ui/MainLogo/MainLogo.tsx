import AlphaIcon from '@/shared/icons/alpha.svg?react'
import { FlexStyled, IconWrapper } from "./MainLogo.styled"

const MainLogo = () => {
  return (
    <FlexStyled gap="8px">
      <IconWrapper>
        <AlphaIcon />
      </IconWrapper>
    </FlexStyled>
  )
}

export { MainLogo };
