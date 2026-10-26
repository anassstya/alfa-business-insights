const analysisKeys = {
  all: ['analysis'] as const,
  /** задача анализа (AnalysisJob): GET jobs/{jobID}, пока она не завершена — обновления по SSE */
  job: (jobId: string) => [...analysisKeys.all, 'job', jobId] as const,
  history: (userId: number) => [...analysisKeys.all, 'history', userId] as const,
  chat: (jobId: string) => [...analysisKeys.all, 'chat', jobId] as const,
}

export { analysisKeys };
