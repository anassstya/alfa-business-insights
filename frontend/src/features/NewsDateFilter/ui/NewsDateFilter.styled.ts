import styled from "styled-components";
import { BREAKPOINTS } from "@/shared";

const FilterRoot = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`

const FilterHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`

const FilterLabel = styled.span`
  font-size: 15px;
  font-weight: 600;
`

const ResetButton = styled.button`
  border: none;
  background: none;
  padding: 0;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.primary.primary};

  &:hover {
    color: ${({ theme }) => theme.colors.primary.hover};
  }
`

const Presets = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;

  @media ${BREAKPOINTS.phone} {
    flex-wrap: nowrap;
    overflow-x: auto;
    margin: 0 -16px;
    padding: 0 16px;
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }
  }
`

const CustomRange = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 200px));
  gap: 8px;

  @media ${BREAKPOINTS.phone} {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`

export { FilterRoot, FilterHeader, FilterLabel, ResetButton, Presets, CustomRange };
