import { createGlobalStyle, type DefaultTheme } from "styled-components";

const themeLight: DefaultTheme = {
  colors: {
      primary: {
        primary: '#EE3124',
        secondary: '#F2F3F5',
        hover: '#C4231A',
        background: '#FDECEA',
        text: '#0F1A24',
        additionalText: '#2B2F36',
      },
      secondary: {
        textSecondary: '#7F8792',
        border: '#DADFE5',
        sectionBg: '#F2F3F5',
        cardBg: '#FFFFFF',
      },
      utility: {
        success: '#0FA958',
        warning: '#F5A623',
        info: '#2C7BE5',
        error: '#b3122A',
      }
    }
}

const GlobalStyle = createGlobalStyle`
  * {
    font-family: "NotoSans", system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  }
  input, h1, h2, h3, h4, h5, p, span {
    color: ${({theme}) => theme.colors.primary.text};
  }
`;

export { themeLight, GlobalStyle }