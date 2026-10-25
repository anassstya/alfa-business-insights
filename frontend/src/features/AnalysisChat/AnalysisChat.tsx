import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { sendAnalysisChatMessage, type ChatMessage } from "@/entities/job";
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

/** Чат с ассистентом по результатам анализа; история живёт только в этой вкладке */
const AnalysisChat = ({ jobId, disabled = false }: AnalysisChatProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [failedMessage, setFailedMessage] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { mutate, isPending } = useMutation({
    mutationFn: ({ message, history }: { message: string, history: ChatMessage[] }) =>
      sendAnalysisChatMessage(jobId, { message, history }),
    onSuccess: (reply) => {
      setFailedMessage(null);
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    },
    onError: (_error, { message }) => setFailedMessage(message),
  });

  // новые сообщения и индикатор «печатает» всегда в зоне видимости
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages.length, isPending, failedMessage])

  const ask = (text: string) => {
    const message = text.trim();
    if (!message || isPending || disabled) return;

    setFailedMessage(null);
    setMessages(prev => [...prev, { role: 'user', content: message }]);
    mutate({ message, history: messages });
  }

  /** повтор последнего вопроса: он уже в ленте, в историю для запроса его не дублируем */
  const retry = () => {
    if (!failedMessage) return;

    const history = messages.slice(0, -1);
    setFailedMessage(null);
    mutate({ message: failedMessage, history });
  }

  return (
    <ChatRoot aria-label="Чат по аналитике">
      <ChatHeader>
        <ChatTitle>Ассистент по аналитике</ChatTitle>
        <ChatSubtitle>Ответы основаны на результатах этого анализа. Не является ИИР</ChatSubtitle>
      </ChatHeader>

      <Messages ref={listRef} role="log" aria-live="polite">
        {messages.length === 0 && !isPending && (
          <Empty>
            <EmptyText>Задайте вопрос по отчёту — например:</EmptyText>
            <Suggestions>
              {SUGGESTIONS.map(suggestion => (
                <Chip key={suggestion} type="button" disabled={disabled} onClick={() => ask(suggestion)}>
                  {suggestion}
                </Chip>
              ))}
            </Suggestions>
          </Empty>
        )}

        {messages.map((message, index) => (
          <Bubble key={index} $author={message.role}>
            <VisuallyHidden>{message.role === 'user' ? 'Вы: ' : 'Ассистент: '}</VisuallyHidden>
            {message.content}
          </Bubble>
        ))}

        {isPending && (
          <Typing aria-label="Ассистент печатает">
            <i /><i /><i />
          </Typing>
        )}

        {failedMessage && (
          <Bubble $author="assistant" $error role="alert">
            Не удалось получить ответ.
            <RetryButton type="button" onClick={retry}>Повторить</RetryButton>
          </Bubble>
        )}
      </Messages>

      <Composer>
        <SubmitField
          placeholder={disabled ? 'Чат станет доступен после анализа' : 'Спросите про аналитику'}
          submitLabel="Отправить сообщение"
          isLoading={isPending}
          disabled={disabled}
          clearOnSubmit
          maxLength={1000}
          onSubmit={ask}
        />
      </Composer>
    </ChatRoot>
  )
}

export { AnalysisChat };
