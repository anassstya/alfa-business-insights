import styled, { css } from "styled-components";

const MenuRoot = styled.div`
  position: relative;
  flex-shrink: 0;
`

const Trigger = styled.button<{ $open: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 12px 0 16px;
  border-radius: 12px;
  border: 1px solid transparent;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color .15s ease;

  ${({ theme, $open }) => css`
    background-color: ${$open ? theme.colors.secondary.border : theme.colors.secondary.sectionBg};
    color: ${theme.colors.primary.text};

    &:hover {
      background-color: ${theme.colors.secondary.border};
    }

    &:focus-visible {
      outline: none;
      border-color: ${theme.colors.primary.text};
    }
  `}

  & svg {
    width: 18px;
    height: 18px;
    transition: transform .2s ease;
    transform: rotate(${({ $open }) => $open ? '180deg' : '0'});
  }
`

const Count = styled.span`
  min-width: 20px;
  padding: 0 6px;
  border-radius: 10px;
  font-size: 12px;
  line-height: 20px;
  text-align: center;
  background-color: ${({ theme }) => theme.colors.primary.text};
  color: ${({ theme }) => theme.colors.secondary.cardBg};
`

const Popover = styled.div`
  position: absolute;
  z-index: 20;
  top: calc(100% + 6px);
  right: 0;
  display: flex;
  flex-direction: column;
  /* меню прижато к правому краю кнопки, а она внутри карточки с отступами — оставляем запас слева */
  width: min(360px, calc(100vw - 64px));
  max-height: 400px;
  padding: 8px;
  border-radius: 16px;
  box-sizing: border-box;

  ${({ theme }) => css`
    background-color: ${theme.colors.secondary.cardBg};
    box-shadow: 0 8px 32px ${theme.colors.primary.text}26, 0 0 1px ${theme.colors.primary.text}40;
  `}
`

const List = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
  overflow-y: auto;
`

const NewButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 12px;
  margin-bottom: 4px;
  border: none;
  border-radius: 10px;
  background: none;
  font-size: 15px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.primary.primary};

  &:hover {
    background-color: ${({ theme }) => theme.colors.secondary.sectionBg};
  }
`

const Item = styled.li<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 4px;
  border-radius: 10px;

  ${({ theme, $active }) => $active && css`
    background-color: ${theme.colors.primary.background};
  `}

  &:hover {
    background-color: ${({ theme, $active }) => $active ? theme.colors.primary.background : theme.colors.secondary.sectionBg};
  }
`

const ItemButton = styled.button`
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
  padding: 10px 12px;
  border: none;
  background: none;
  text-align: left;
  cursor: pointer;
`

const ItemTitle = styled.span`
  font-size: 15px;
  line-height: 20px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: ${({ theme }) => theme.colors.primary.text};
`

const ItemMeta = styled.span`
  font-size: 13px;
  line-height: 18px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: ${({ theme }) => theme.colors.secondary.textSecondary};
`

const RemoveButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  margin-right: 4px;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: none;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.secondary.textSecondary};

  &:hover {
    background-color: ${({ theme }) => theme.colors.secondary.border};
    color: ${({ theme }) => theme.colors.primary.text};
  }

  & svg {
    width: 12px;
    height: 12px;
  }
`

const EmptyText = styled.div`
  padding: 12px;
  font-size: 14px;
  color: ${({ theme }) => theme.colors.secondary.textSecondary};
`

export {
  MenuRoot, Trigger, Count, Popover, List, NewButton, Item, ItemButton, ItemTitle, ItemMeta, RemoveButton,
  EmptyText,
};
