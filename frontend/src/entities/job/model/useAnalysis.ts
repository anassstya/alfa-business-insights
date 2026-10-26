import { useEffect, useState } from "react"
import { analysisJobEvents } from "../api"
import type { AnalysisJob } from "./types"

interface ConnectionState {
  /** была ошибка соединения */
  isError: boolean;
  /** браузер больше не переподключается */
  isClosed: boolean;
}

const INITIAL_CONNECTION: ConnectionState = { isError: false, isClosed: false };

/**
 * Живое состояние задачи анализа по SSE: последнее пришедшее AnalysisJob.
 * Без jobId не подключается; при смене jobId старое соединение закрывается.
 */
const useAnalysis = (jobId?: string) => {
  const [job, setJob] = useState<AnalysisJob>()
  const [connection, setConnection] = useState<ConnectionState>(INITIAL_CONNECTION)

  // задача сменилась (новый запуск или другая сессия) — данные прошлой задачи ей не принадлежат
  const [currentJobId, setCurrentJobId] = useState(jobId)
  if (jobId !== currentJobId) {
    setCurrentJobId(jobId)
    setJob(undefined)
    setConnection(INITIAL_CONNECTION)
  }

  useEffect(() => {
    if (!jobId) return;

    return analysisJobEvents(jobId, {
      onUpdate: (next) => {
        setJob(next)
        setConnection(INITIAL_CONNECTION)
      },
      onError: (_event, closed) => setConnection({ isError: true, isClosed: closed }),
    })
  }, [jobId])

  return {
    job,
    isConnectionError: connection.isError,
    isConnectionClosed: connection.isClosed,
  }
}

export { useAnalysis };
