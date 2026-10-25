import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { sendAnalysisChatMessage, useAnalysisResult, type ChatMessage } from "@/entities/job";
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
  }, [isRunning, onRunningChange])

  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const send = useMutation({
    mutationFn: ({ message, history }: { message: string, history: ChatMessage[] }) =>
      sendAnalysisChatMessage(jobId!, { message, history }),
    onSuccess: (reply) => setMessages(prev => [...prev, { role: 'assistant', content: reply }]),
  });

  const ask = (text: string) => {
    const message = text.trim();
    if (!jobId || !result || !message || send.isPending) return;

    setMessages(prev => [...prev, { role: 'user', content: message }]);
    send.mutate({ message, history: messages });
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

  const canAsk = !!jobId && !!result;

  return (
    <ChatRoot aria-label="Чат по анализу">
      {renderAnalysisState()}

      <Panel>
        <PanelHeader>
          <PanelTitle>Вопросы по анализу</PanelTitle>
        </PanelHeader>

        <Messages role="log" aria-live="polite" data-count={messages.length}>
          {/* TODO: шаблон сообщений — messages ({ role, content }) пока не отрисовываются */}
          {!jobId && <Hint>Запустите анализ или выберите сессию в «Мои отчёты»</Hint>}
          {jobId && !result && !isError && <Hint>Вопросы можно задать, когда анализ завершится</Hint>}
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
