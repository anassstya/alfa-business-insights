import { apiClient } from "@/shared";
import type { AnalysisJobsResponse } from "../model/types";

/**
 * GET /api/v1/demo/users/{id}/analysis/jobs — история анализов демопользователя
 * (от новых к старым; анализы без demo_user_id сюда не попадают).
 */
const getDemoUserAnalysisJobs = async (userId: number, signal?: AbortSignal) => {
  const { data } = await apiClient.get<AnalysisJobsResponse>(`/api/v1/demo/users/${userId}/analysis/jobs`, { signal });

  return data.jobs;
}

export { getDemoUserAnalysisJobs };
