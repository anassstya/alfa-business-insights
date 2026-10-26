import styled from "styled-components";
import { ALFA } from "../AlfaMainPage.styled";
import { QUICK_ACTIONS } from "../model/data";

const Row = styled.div`
  display: flex;
  gap: 10px;
  overflow-x: auto;
  scrollbar-width: none;

  @media (max-width: 639px) {
    margin: 0 -16px;
    padding: 0 16px;
  }
`

const Action = styled.div<{ $muted?: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
  height: 40px;
  padding: 0 20px;
  border-radius: 12px;
  background-color: ${({ $muted }) => $muted ? ALFA.control : ALFA.surface};
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;

  & > svg {
    color: ${ALFA.text};
  }
`

const QuickActions = () => (
  <Row>
    {QUICK_ACTIONS.map(({ label, icon: Icon }) => (
      <Action key={label}>
        <Icon />
        {label}
      </Action>
    ))}
    <Action $muted>Ещё</Action>
  </Row>
)

export { QuickActions };
