import styled, { keyframes } from "styled-components";

const shimmer = keyframes`
  0% { opacity: 1; }
  50% { opacity: .45; }
  100% { opacity: 1; }
`

const Skeleton = styled.div<{ $width?: string, $height?: string, $radius?: string }>`
  width: ${({ $width = '100%' }) => $width};
  height: ${({ $height = '16px' }) => $height};
  border-radius: ${({ $radius = '8px' }) => $radius};
  background-color: ${({ theme }) => theme.colors.secondary.sectionBg};
  animation: ${shimmer} 1.4s ease-in-out infinite;
`

export { Skeleton };
