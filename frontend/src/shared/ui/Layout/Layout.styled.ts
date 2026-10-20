import styled from "styled-components";

const Layout = styled.div`
  width: 100vw;
  height: 100vh;
  display: grid;

  grid-template-columns: 1fr 3fr 1fr;
  grid-template-rows: 1fr 12fr;

  row-gap: 16px;

  grid-template-areas: 
  "header header header"
  "aside1 main aside2";
`

export { Layout };
