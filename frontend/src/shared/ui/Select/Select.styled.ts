import styled, { css } from "styled-components";

const SelectRoot = styled.div<{ $fullWidth?: boolean }>`
  position: relative;
  min-width: 0;
  width: ${({ $fullWidth }) => $fullWidth ? '100%' : 'auto'};
`

const Trigger = styled.button<{ $open: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 52px;
  padding: 6px 12px 6px 16px;
  border-radius: 12px;
  border: 1px solid transparent;
  text-align: left;
  cursor: pointer;
  transition: background-color .15s ease, border-color .15s ease;

  ${({ theme, $open }) => css`
    background-color: ${theme.colors.secondary.sectionBg};
    color: ${theme.colors.primary.text};

    &:hover {
      background-color: ${theme.colors.secondary.border};
    }

    &:focus-visible {
      outline: none;
      border-color: ${theme.colors.primary.text};
    }

    &:disabled {
      cursor: default;
      opacity: .6;
    }

    ${$open && css`
      background-color: ${theme.colors.secondary.cardBg};
      border-color: ${theme.colors.secondary.border};
    `}
  `}
`

const TriggerText = styled.span`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
`

const Caption = styled.span`
  font-size: 12px;
  line-height: 16px;
  color: ${({ theme }) => theme.colors.secondary.textSecondary};
`

const Value = styled.span<{ $placeholder?: boolean }>`
  font-size: 15px;
  line-height: 20px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: ${({ theme, $placeholder }) => $placeholder ? theme.colors.secondary.textSecondary : theme.colors.primary.text};
`

const Chevron = styled.span<{ $open: boolean }>`
  display: flex;
  flex-shrink: 0;
  transition: transform .2s ease;
  transform: rotate(${({ $open }) => $open ? '180deg' : '0'});

  & svg {
    width: 20px;
    height: 20px;
  }
`

const Popover = styled.ul`
  position: absolute;
  z-index: 20;
  top: calc(100% + 6px);
  left: 0;
  min-width: 100%;
  max-width: min(420px, calc(100vw - 32px));
  max-height: 320px;
  overflow-y: auto;
  margin: 0;
  padding: 8px;
  list-style: none;
  border-radius: 16px;
  box-sizing: border-box;

  ${({ theme }) => css`
    background-color: ${theme.colors.secondary.cardBg};
    box-shadow: 0 8px 32px ${theme.colors.primary.text}26, 0 0 1px ${theme.colors.primary.text}40;
  `}
`

const Option = styled.li<{ $active: boolean, $highlighted: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  cursor: pointer;

  ${({ theme, $highlighted }) => $highlighted && css`
    background-color: ${theme.colors.secondary.sectionBg};
  `}

  & > svg {
    flex-shrink: 0;
    width: 18px;
    height: 18px;
    color: ${({ theme }) => theme.colors.primary.primary};
    visibility: ${({ $active }) => $active ? 'visible' : 'hidden'};
  }
`

const OptionText = styled.span`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
`

const OptionLabel = styled.span`
  font-size: 15px;
  line-height: 20px;
`

const OptionDescription = styled.span`
  font-size: 13px;
  line-height: 18px;
  color: ${({ theme }) => theme.colors.secondary.textSecondary};
`

/** Последняя строка списка: при её появлении в видимой области подгружается следующая порция */
const LoadMoreRow = styled.li`
  padding: 10px 12px;
  font-size: 14px;
  text-align: center;
  color: ${({ theme }) => theme.colors.secondary.textSecondary};
`

const PopoverMessage = styled.li`
  padding: 12px;
  font-size: 14px;
  color: ${({ theme }) => theme.colors.secondary.textSecondary};
`

export {
  SelectRoot, Trigger, TriggerText, Caption, Value, Chevron,
  Popover, Option, OptionText, OptionLabel, OptionDescription, PopoverMessage, LoadMoreRow,
};
