import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { chatEvents, getChatMessages, sendChatMessage } from "../api/chat";
import { analysisJobQuery } from "./analysisResult";
import { analysisKeys } from "./keys";
import type { ChatMessage } from "./types";

/**
 * Сообщение с уже известным id заменяется на месте, новое — дописывается в конец.
 * Не сортируем по created_at: у оптимистичного сообщения время с часов пользователя,
 * и при расхождении с сервером оно уехало бы выше истории. История уже приходит упорядоченной.
 */
const upsertMessages = (current: ChatMessage[] | undefined, incoming: ChatMessage[]) => {
  const result = [...(current ?? [])];

  incoming.forEach(message => {
    const index = result.findIndex(item => item.id === message.id);
    if (index === -1) result.push(message);
    else result[index] = message;
  });

  return result;
}

/**
 * Чат доступен только по завершённому анализу (completed с результатом) —
 * по задаче из GET jobs/{jobID}, которую, пока анализ идёт, обновляет SSE.
 */
const useIsChatAvailable = (jobId: string | undefined) => {
  // тот же запрос задачи, что и у useAnalysisResult: данные общие, повторного GET нет
  const { data: job } = useQuery(analysisJobQuery(jobId));

  return !!jobId && job?.status === 'completed' && !!job.result;
}

/**
 * Сообщения чата сессии: сначала история (GET chat/messages), после её загрузки —
 * подписка на chat/events, новые сообщения дописываются в тот же кэш.
 * До завершения анализа ни история, ни подписка не запрашиваются.
 * При смене jobId или размонтировании подписка закрывается.
 */
const useChatMessages = (jobId: string | undefined) => {
  const queryClient = useQueryClient();
  const isAvailable = useIsChatAvailable(jobId);

  const query = useQuery({
    queryKey: analysisKeys.chat(jobId ?? ''),
    queryFn: ({ signal }) => getChatMessages(jobId!, signal),
    enabled: isAvailable,
    staleTime: Infinity,
  });

  const isHistoryLoaded = query.isSuccess;

  useEffect(() => {
    if (!jobId || !isAvailable || !isHistoryLoaded) return;

    return chatEvents(jobId, {
      onMessage: (message) => {
        queryClient.setQueryData<ChatMessage[]>(analysisKeys.chat(jobId), prev => upsertMessages(prev, [message]));
      },
      // FIXME(openapi): chat/events пока отвечает 503 — без SSE чат работает только на истории
    });
  }, [jobId, isAvailable, isHistoryLoaded, queryClient])

  return query;
}

const TEMP_ID_PREFIX = 'temp-';

/**
 * Отправка сообщения: POST chat/messages как мутация.
 * Сообщение сразу появляется в ленте (оптимистично), после ответа получает id от backend,
 * при ошибке — убирается. Ответ ассистента придёт через chat/events.
 * До завершения анализа отправка отклоняется.
 */
const useSendChatMessage = (jobId: string | undefined) => {
  const queryClient = useQueryClient();
  const isAvailable = useIsChatAvailable(jobId);
  const key = analysisKeys.chat(jobId ?? '');

  return useMutation({
    mutationFn: (content: string) => {
      if (!isAvailable) throw new Error('Чат недоступен, пока анализ не завершён');

      return sendChatMessage(jobId!, content);
    },
    onMutate: async (content) => {
      // отправка всё равно будет отклонена — в ленту ничего не добавляем
      if (!isAvailable) return;

      // не даём загрузке истории перезаписать оптимистичное сообщение
      await queryClient.cancelQueries({ queryKey: key });

      const tempId = `${TEMP_ID_PREFIX}${Date.now()}`;
      const optimistic: ChatMessage = { id: tempId, role: 'user', content, created_at: new Date().toISOString() };
      queryClient.setQueryData<ChatMessage[]>(key, prev => upsertMessages(prev, [optimistic]));

      return { tempId };
    },
    onSuccess: (messageId, _content, context) => {
      queryClient.setQueryData<ChatMessage[]>(key, prev => {
        const list = prev ?? [];

        // SSE уже прислал это сообщение с настоящим id — временное просто убираем
        if (list.some(message => message.id === messageId)) {
          return list.filter(message => message.id !== context?.tempId);
        }

        // иначе временное получает настоящий id на своём месте в ленте
        return list.map(message => message.id === context?.tempId ? { ...message, id: messageId } : message);
      });
    },
    onError: (_error, _content, context) => {
      queryClient.setQueryData<ChatMessage[]>(key, prev => prev?.filter(message => message.id !== context?.tempId));
    },
  });
}

/** Сообщение ещё не подтверждено backend (оптимистичное) */
const isPendingChatMessage = (message: ChatMessage) => message.id.startsWith(TEMP_ID_PREFIX);

export { useIsChatAvailable, useChatMessages, useSendChatMessage, isPendingChatMessage };
