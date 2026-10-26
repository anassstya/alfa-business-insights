import { apiClient } from "@/shared";
import type { DemoUsersResponse } from "../model";

const getUsers = async (signal?: AbortSignal) => {
  const { data } = await apiClient.get<DemoUsersResponse>('/api/v1/demo/users', { signal })

  return data.users
}

export { getUsers }
