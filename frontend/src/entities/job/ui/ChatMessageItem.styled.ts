import styled, { css } from "styled-components";
import type { ChatMessage } from "../model/types";

/** Пузырь чата: ассистент — слева, пользователь — справа */
const ChatBubble = styled.div<{ $author: ChatMessage['role'], $error?: boolean, $pending?: boolean }>`
  max-width: 85%;
  padding: 10px 14px;
  font-size: 15px;
  line-height: 21px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  /* ещё не подтверждено backend — чуть бледнее */
  opacity: ${({ $pending }) => $pending ? .6 : 1};

  ${({ theme, $author, $error }) => $author === 'user' ? css`
    align-self: flex-end;
    border-radius: 16px 16px 4px 16px;
    background-color: ${theme.colors.primary.text};
    color: ${theme.colors.secondary.cardBg};
  ` : css`
    align-self: flex-start;
    border-radius: 16px 16px 16px 4px;
    background-color: ${$error ? theme.colors.primary.background : theme.colors.secondary.sectionBg};
    color: ${$error ? theme.colors.primary.hover : theme.colors.primary.text};
  `}
`

export { ChatBubble };
