import styled from "styled-components";

/** Текст только для скринридеров: в вёрстке не виден, но читается вспомогательными технологиями */
const VisuallyHidden = styled.span`
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
`

export { VisuallyHidden };
