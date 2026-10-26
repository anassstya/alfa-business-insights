import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  AnalysisStageLoader, ChatMessageItem, useAnalysisResult, useChatMessages, useSendChatMessage,
} from "@/entities/job";
import { Button, SubmitField, Title } from "@/shared";
import { AnalysisPreview } from "./AnalysisPreview";
import {
  ChatRoot, ErrorText, Footer, Hint, Messages, Panel, PanelHeader, PanelTitle, StateCard, StateIcon, StateText,
} from "./Chat.styled";

interface ChatProps {
  /** выбранная сессия анализа; без неё чат пустой и поле заблокировано */
  jobId?: string;
  /** анализ идёт (от подключения к SSE до финального события) — чтобы родитель заблокировал запуск */
  onRunningChange?(running: boolean): void;
  /** «Запустить заново», если анализ не удался */
  onRestart?(): void;
}

/**
 * Чат по сессии анализа. Вся работа с SSE — здесь: подписка на события задачи по jobId,
 * кэширование результата, лоадер по этапам, ошибка и превью готового анализа.
 * Ниже — сообщения сессии (ассистент слева, пользователь справа) и поле для вопросов;
 * чат открывается только после завершения анализа.
 * Состояние привязано к jobId: при смене сессии виджет нужно пересоздавать (key={jobId}).
 */
const Chat = ({ jobId, onRunningChange, onRestart }: ChatProps) => {
  const navigate = useNavigate();
  const listRef = useRef<HTMLDivElement>(null);
  // состояние задачи: из кэша, иначе по SSE (event: update с AnalysisJob, сразу после подключения)
  const { result, status, stage, isLoading, isError, error } = useAnalysisResult(jobId);
  const isRunning = !!jobId && isLoading;

  useEffect(() => {
    onRunningChange?.(isRunning);

    // чат убрали (выбрали «Новый отчёт» или другую сессию) — за этой задачей он больше не следит,
    // иначе родитель так и считал бы, что анализ идёт, и держал бы форму запуска заблокированной
    return () => onRunningChange?.(false);
  }, [isRunning, onRunningChange])

  /** Чат доступен только по завершённому анализу (result есть только у completed) */
  const chatJobId = result ? jobId : undefined;
  // сообщения сессии: история с сервера, затем новые — по chat/events; до завершения анализа не грузим
  const chat = useChatMessages(chatJobId);
  const messages = chat.data ?? [];
  // отправка — мутация POST chat/messages
  const send = useSendChatMessage(chatJobId);
  const canAsk = !!chatJobId && chat.isSuccess;

  const getLockedHint = () => {
    if (!jobId) return 'Запустите анализ или выберите сессию в «Мои отчёты»';
    if (isError) return 'Чат недоступен: анализ не удался';
    if (!result) return 'Чат станет доступен после завершения анализа';
    return null;
  }
  const lockedHint = getLockedHint();

  // новые сообщения всегда в зоне видимости
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages.length, send.isError])

  const ask = (text: string) => {
    const content = text.trim();
    if (!canAsk || !content || send.isPending) return;

    send.mutate(content);
  }

  const renderAnalysisState = () => {
    if (isRunning) return <AnalysisStageLoader status={status} stage={stage} />;

    if (jobId && isError) {
      return (
        <StateCard>
          <StateIcon aria-hidden>⚠️</StateIcon>
          <Title.H5>Анализ не удался</Title.H5>
          <StateText>{error ?? 'Не получилось получить результат. Запустите анализ заново.'}</StateText>
          {onRestart && <Button variant="secondary" borderSize="S" onClick={onRestart}>Запустить заново</Button>}
        </StateCard>
      );
    }

    if (jobId && result) {
      return <AnalysisPreview result={result} onOpen={() => navigate(`/insights/analysis/${jobId}`)} />;
    }

    return null;
  }

  return (
    <ChatRoot aria-label="Чат по анализу">
      {renderAnalysisState()}

      <Panel>
        <PanelHeader>
          <PanelTitle>Вопросы по анализу</PanelTitle>
        </PanelHeader>

        <Messages ref={listRef} role="log" aria-live="polite">
          {lockedHint && <Hint>{lockedHint}</Hint>}
          {chat.isPending && chatJobId && <Hint>Загружаем сообщения…</Hint>}
          {chat.isError && <ErrorText role="alert">Не удалось загрузить сообщения сессии</ErrorText>}
          {canAsk && messages.length === 0 && <Hint>Задайте вопрос по результатам анализа</Hint>}
          {messages.map(message => <ChatMessageItem key={message.id} message={message} />)}
          {send.isError && <ErrorText role="alert">Не удалось отправить сообщение. Попробуйте ещё раз.</ErrorText>}
        </Messages>

        <Footer>
          <SubmitField
            placeholder={chatJobId ? 'Спросите про анализ' : 'Чат станет доступен после анализа'}
            submitLabel="Отправить сообщение"
            isLoading={send.isPending}
            disabled={!canAsk}
            clearOnSubmit
            maxLength={1000}
            onSubmit={ask}
          />
        </Footer>
      </Panel>
    </ChatRoot>
  )
}

export { Chat, type ChatProps };
