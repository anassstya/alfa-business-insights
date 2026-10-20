import styled, {  type CSSProperties } from "styled-components";

const Flex = styled.div<{
  align?: CSSProperties['alignItems'], 
  justify?: CSSProperties['justifyContent'], 
  direction?: CSSProperties['flexDirection'],
  gap?: CSSProperties['gap']
}>(({ align, justify, direction, gap }) => ({
  display: 'flex',
  alignItems: align,
  justifyContent: justify,
  flexDirection: direction,
  gap: gap,
}))

export { Flex };
