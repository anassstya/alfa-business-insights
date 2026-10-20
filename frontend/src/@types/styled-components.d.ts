import 'styled-components'

declare module 'styled-components' {
  export interface DefaultTheme {
    colors: {
      primary: {
        primary: string;
        secondary: string;
        hover: string;
        background: string;
        text: string;
        additionalText: string;
      };
      secondary: {
        textSecondary: string;
        border: string;
        sectionBg: string;
        cardBg: string;
      };
      utility: {
        success: string;
        warning: string;
        info: string;
        error: string;
      }
    }
  }
}
