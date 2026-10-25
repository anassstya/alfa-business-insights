import { useCallback, useEffect, useMemo, useState } from "react"
import { analysisJobEvents, JOB_EVENTS } from "../api"

const useAnalysis = <TConnect, TProgress, TComplete, TFail>(job?: string) => {
  const [connectData, setConnectData] = useState<TConnect>()
  const [progressData, setProgressData] = useState<TProgress>()
  const [completeData, setCompleteData] = useState<TComplete>()
  const [failData, setFailData] = useState<TFail>()
  const [closed, setClosed] = useState(false)
  const [isConnect, setIsConnect] = useState(false)
  const [isProgress, setIsProgress] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [isFail, setIsFail] = useState(false)
  const [isError, setIsError] = useState(false)

  // задача сменилась (новый запуск или другая сессия) — данные прошлой задачи ей не принадлежат
  const [currentJob, setCurrentJob] = useState(job)
  if (job !== currentJob) {
    setCurrentJob(job)
    setConnectData(undefined)
    setProgressData(undefined)
    setCompleteData(undefined)
    setFailData(undefined)
    setClosed(false)
    setIsConnect(false)
    setIsProgress(false)
    setIsComplete(false)
    setIsFail(false)
    setIsError(false)
  }

  const onConnect = useCallback((data: TConnect) => {
    setConnectData(data)
    setIsConnect(!!data)
  }, [])
  const onProgress = useCallback((data: TProgress) => {
    setProgressData(data)
    setIsProgress(!!data)
    setIsConnect(false)
  }, [])
  const onComplete = useCallback((data: TComplete) => {
    setCompleteData(data)
    setIsComplete(!!data)
    setIsProgress(false)
    setIsConnect(false)
  }, [])
  const onFail = useCallback((data: TFail) => {
    setFailData(data)
    setIsFail(!!data)
    setIsComplete(false)
    setIsProgress(false)
    setIsConnect(false)
  }, [])
  const onError = useCallback((_event: Event, closed: boolean) => {
    setClosed(closed);
    setIsError(true)
    setIsFail(false)
    setIsComplete(false)
    setIsProgress(false)
    setIsConnect(false)
  }, [])

  useEffect(() => {
    const close = job ? analysisJobEvents(job, { onConnect, onProgress, onComplete, onFail, onError }) : () => {}

    return close
  }, [job, onComplete, onConnect, onError, onFail, onProgress])

  const status = useMemo(() => {
    if (isConnect) return JOB_EVENTS.connected
    if (isProgress) return JOB_EVENTS.progress
    if (isComplete) return JOB_EVENTS.completed
    if (isFail) return JOB_EVENTS.failed
    if (isError) return JOB_EVENTS.error
  }, [isComplete, isConnect, isError, isFail, isProgress])

  return {
    connectData,
    progressData,
    completeData,
    failData,
    closed,
    isConnect,
    isProgress,
    isComplete,
    isFail,
    isError,
    status
  }
}

export { useAnalysis };
