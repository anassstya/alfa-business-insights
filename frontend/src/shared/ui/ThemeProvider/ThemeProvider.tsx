import { GlobalStyle, themeLight } from "@/shared/lib"
import type { PropsWithChildren } from "react"
import { ThemeProvider as BaseThemeProvider } from "styled-components"

const ThemeProvider = ({ children }: PropsWithChildren) => {
  return (
    <BaseThemeProvider theme={themeLight}>
      <GlobalStyle />
      {children}
    </BaseThemeProvider>
  )
}

export { ThemeProvider };
