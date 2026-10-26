import { useEffect, useRef } from "react";
import { isPendingChatMessage, useChatMessages, useSendChatMessage } from "@/entities/job";
import { Chip, SubmitField, VisuallyHidden } from "@/shared";
import {
  Bubble, ChatHeader, ChatRoot, ChatSubtitle, ChatTitle, Composer, Empty, EmptyText, Messages, RetryButton,
  Suggestions, Typing,
} from "./AnalysisChat.styled";

const SUGGESTIONS = [
  'Какие главные риски для компании?',
  'Что сделать в первую очередь?',
  'Объясни ключевые показатели',
];

interface AnalysisChatProps {
  jobId: string;
  /** чат недоступен, пока нет результата анализа */
  disabled?: boolean;
}

/**
 * Чат с ассистентом по результатам анализа. История — с сервера (GET chat/messages),
 * новые сообщения — по chat/events, отправка — мутация POST chat/messages.
 */
const AnalysisChat = ({ jobId, disabled = false }: AnalysisChatProps) => {
  const listRef = useRef<HTMLDivElement>(null);
  const chat = useChatMessages(jobId);
  const messages = chat.data ?? [];
  const send = useSendChatMessage(jobId);
  const blocked = disabled || !chat.isSuccess;

  // новые сообщения и индикатор отправки всегда в зоне видимости
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages.length, send.isPending, send.isError])

  const ask = (text: string) => {
    const content = text.trim();
    if (!content || send.isPending || blocked) return;

    send.mutate(content);
  }

  /** повтор неотправленного сообщения: при ошибке оно убрано из ленты, отправляем заново */
  const retry = () => {
    if (send.variables) send.mutate(send.variables);
  }

  return (
    <ChatRoot aria-label="Чат по аналитике">
      <ChatHeader>
        <ChatTitle>Ассистент по аналитике</ChatTitle>
        <ChatSubtitle>Ответы основаны на результатах этого анализа. Не является ИИР</ChatSubtitle>
      </ChatHeader>

      <Messages ref={listRef} role="log" aria-live="polite">
        {chat.isPending && <EmptyText>Загружаем сообщения…</EmptyText>}

        {chat.isError && (
          <Bubble $author="assistant" $error role="alert">
            Не удалось загрузить сообщения.
            <RetryButton type="button" onClick={() => chat.refetch()}>Повторить</RetryButton>
          </Bubble>
        )}

        {chat.isSuccess && messages.length === 0 && (
          <Empty>
            <EmptyText>Задайте вопрос по отчёту — например:</EmptyText>
            <Suggestions>
              {SUGGESTIONS.map(suggestion => (
                <Chip key={suggestion} type="button" disabled={blocked} onClick={() => ask(suggestion)}>
                  {suggestion}
                </Chip>
              ))}
            </Suggestions>
          </Empty>
        )}

        {messages.map(message => (
          <Bubble
            key={message.id}
            $author={message.role}
            // ещё не подтверждено backend — чуть бледнее
            style={isPendingChatMessage(message) ? { opacity: .6 } : undefined}
          >
            <VisuallyHidden>{message.role === 'user' ? 'Вы: ' : 'Ассистент: '}</VisuallyHidden>
            {message.content}
          </Bubble>
        ))}

        {send.isPending && (
          <Typing aria-label="Отправляем сообщение">
            <i /><i /><i />
          </Typing>
        )}

        {send.isError && (
          <Bubble $author="assistant" $error role="alert">
            Не удалось отправить сообщение.
            <RetryButton type="button" onClick={retry}>Повторить</RetryButton>
          </Bubble>
        )}
      </Messages>

      <Composer>
        <SubmitField
          placeholder={disabled ? 'Чат станет доступен после анализа' : 'Спросите про аналитику'}
          submitLabel="Отправить сообщение"
          isLoading={send.isPending}
          disabled={blocked}
          clearOnSubmit
          maxLength={1000}
          onSubmit={ask}
        />
      </Composer>
    </ChatRoot>
  )
}

export { AnalysisChat };
