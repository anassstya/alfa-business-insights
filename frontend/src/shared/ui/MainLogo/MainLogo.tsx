import AlphaIcon from '@/shared/icons/alpha.svg?react'
import { FlexStyled, IconWrapper, Wordmark, WordmarkSubtitle, WordmarkTitle } from "./MainLogo.styled"

const MainLogo = () => {
  return (
    <FlexStyled gap="12px" align="center">
      <IconWrapper>
        <AlphaIcon />
      </IconWrapper>
      <Wordmark>
        <WordmarkTitle>Альфа-Бизнес</WordmarkTitle>
        <WordmarkSubtitle>Новостная аналитика</WordmarkSubtitle>
      </Wordmark>
    </FlexStyled>
  )
}

export { MainLogo };
