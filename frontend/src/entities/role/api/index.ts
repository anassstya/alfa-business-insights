import { apiClient } from "@/shared"

const getRole = async () => {
  const { data } = await apiClient.get<{roles: Array<{code: string, full_name: string}>}>('/v1/roles')

  return data.roles
}

export { getRole }