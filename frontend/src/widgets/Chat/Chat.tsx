import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAnalysisResult, useChatMessages, useSendChatMessage } from "@/entities/job";
import { Button, SubmitField, Title } from "@/shared";
import { AnalysisPreview } from "./AnalysisPreview";
import { InsightsSkeleton } from "./InsightsSkeleton";
import {
  ChatRoot, ErrorText, Footer, Hint, Messages, Panel, PanelHeader, PanelTitle, ProgressText, StateCard, StateIcon,
  StateText,
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
 * кэширование результата, прогресс, ошибка и превью готового анализа.
 * Внизу — поле для вопросов по результату. Сообщения хранятся в состоянии виджета,
 * их отрисовка (шаблон сообщений) пока не сделана.
 * Состояние привязано к jobId: при смене сессии виджет нужно пересоздавать (key={jobId}).
 */
const Chat = ({ jobId, onRunningChange, onRestart }: ChatProps) => {
  const navigate = useNavigate();
  // результат: из кэша, иначе по SSE (сервер сразу присылает текущий статус задачи)
  const { result, isLoading, isError, error, progress } = useAnalysisResult(jobId);
  const isRunning = !!jobId && isLoading;

  useEffect(() => {
    onRunningChange?.(isRunning);

    // чат убрали (выбрали «Новый отчёт» или другую сессию) — за этой задачей он больше не следит,
    // иначе родитель так и считал бы, что анализ идёт, и держал бы форму запуска заблокированной
    return () => onRunningChange?.(false);
  }, [isRunning, onRunningChange])

  // сообщения сессии: история с сервера, затем новые — по chat/events
  const chat = useChatMessages(jobId);
  const messages = chat.data ?? [];
  // отправка — мутация POST chat/messages
  const send = useSendChatMessage(jobId);
  /**
   * Писать можно, как только загружена история сессии: backend принимает сообщения
   * независимо от статуса анализа (а SSE анализа пока шлёт события в другом формате — см. итог).
   */
  const canAsk = !!jobId && chat.isSuccess;

  const ask = (text: string) => {
    const content = text.trim();
    if (!canAsk || !content || send.isPending) return;

    send.mutate(content);
  }

  const renderAnalysisState = () => {
    if (isRunning) {
      return (
        <>
          {progress?.message && (
            <ProgressText>
              {progress.message}{progress.progress !== undefined && ` · ${progress.progress}%`}
            </ProgressText>
          )}
          <InsightsSkeleton />
        </>
      );
    }

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

        <Messages role="log" aria-live="polite" data-count={messages.length}>
          {/* TODO: шаблон сообщений — messages (ChatMessage: id, role, content, created_at) пока не отрисовываются */}
          {!jobId && <Hint>Запустите анализ или выберите сессию в «Мои отчёты»</Hint>}
          {chat.isPending && jobId && <Hint>Загружаем сообщения…</Hint>}
          {chat.isError && <ErrorText role="alert">Не удалось загрузить сообщения сессии</ErrorText>}
          {canAsk && messages.length === 0 && <Hint>Задайте вопрос по результатам анализа</Hint>}
          {send.isError && <ErrorText role="alert">Не удалось отправить сообщение. Попробуйте ещё раз.</ErrorText>}
        </Messages>

        <Footer>
          <SubmitField
            placeholder="Спросите про анализ"
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
