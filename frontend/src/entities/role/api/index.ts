import { apiClient } from "@/shared"
import type { RolesResponse } from "../model/roles"

/** GET /api/v1/roles */
const getRole = async (signal?: AbortSignal) => {
  const { data } = await apiClient.get<RolesResponse>('/api/v1/roles', { signal })

  return data.roles
}

export { getRole }
