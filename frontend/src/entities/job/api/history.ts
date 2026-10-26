import { apiClient } from "@/shared";
import type { AnalysisJobsResponse } from "../model/types";

const getDemoUserAnalysisJobs = async (userId: number, signal?: AbortSignal) => {
  const { data } = await apiClient.get<AnalysisJobsResponse>(`/api/v1/demo/users/${userId}/analysis/jobs`, { signal });

  return data.jobs;
}

export { getDemoUserAnalysisJobs };
