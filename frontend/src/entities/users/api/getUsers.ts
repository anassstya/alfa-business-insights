import { apiClient } from "@/shared";
import type { DemoUser } from "../model";

const getUsers = async () => {
  const { data } = await apiClient.get<{users: Array<DemoUser>}>('/v1/demo/users')

  return data.users
}

export { getUsers }