import styled from "styled-components";

const ALFA = {
  pageBg: '#F3F4F5',
  surface: '#FFFFFF',
  text: '#0F1A24',
  textSecondary: '#7F8792',
  textTertiary: '#A1A6AE',
  icon: '#4D5560',
  divider: '#DCDFE3',
  red: '#EF3124',
  green: '#0CC44D',
  blue: '#2A77EF',
  blueLight: '#E3EEFF',
  control: '#E7E8EA',
};

const PageRoot = styled.div`
  display: grid;
  grid-template-columns: 216px minmax(0, 1fr);
  min-height: 100vh;
  background-color: ${ALFA.pageBg};
  color: ${ALFA.text};
  cursor: default;
  -webkit-font-smoothing: antialiased;

  & * {
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    box-sizing: border-box;
  }

  @media (max-width: 1023px) {
    grid-template-columns: minmax(0, 1fr);
  }
`

const Main = styled.main`
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-width: 0;
  max-width: 1320px;
  padding: 12px 40px 64px 24px;

  @media (max-width: 1023px) {
    padding: 12px 24px 48px;
  }

  @media (max-width: 639px) {
    padding: 12px 16px 40px;
  }
`

export { ALFA, PageRoot, Main };
