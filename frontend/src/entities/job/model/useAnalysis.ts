import { useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { analysisJobEvents } from "../api"
import { analysisKeys } from "./keys"
import type { AnalysisJob } from "./types"

interface ConnectionState {
  /** была ошибка соединения */
  isError: boolean;
  /** браузер больше не переподключается */
  isClosed: boolean;
}

const INITIAL_CONNECTION: ConnectionState = { isError: false, isClosed: false };

/**
 * Подписка на SSE /events незавершённой задачи: каждое event: update (AnalysisJob)
 * кладётся в кэш запроса задачи (analysisKeys.job). Без jobId не подключается;
 * при смене jobId старое соединение закрывается. Возвращает только состояние соединения.
 */
const useAnalysis = (jobId?: string) => {
  const queryClient = useQueryClient()
  const [connection, setConnection] = useState<ConnectionState>(INITIAL_CONNECTION)

  // задача сменилась (новый запуск, другая сессия или подписка больше не нужна) — ошибки прошлой ей не принадлежат
  const [currentJobId, setCurrentJobId] = useState(jobId)
  if (jobId !== currentJobId) {
    setCurrentJobId(jobId)
    setConnection(INITIAL_CONNECTION)
  }

  useEffect(() => {
    if (!jobId) return;

    return analysisJobEvents(jobId, {
      onUpdate: (next) => {
        queryClient.setQueryData<AnalysisJob>(analysisKeys.job(jobId), next)
        setConnection(INITIAL_CONNECTION)
      },
      onError: (_event, closed) => setConnection({ isError: true, isClosed: closed }),
    })
  }, [jobId, queryClient])

  return {
    isConnectionError: connection.isError,
    isConnectionClosed: connection.isClosed,
  }
}

export { useAnalysis };
