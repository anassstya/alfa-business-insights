/** Элемент `users[]` в ответе GET /api/v1/demo/users */
interface DemoUser {
  id: number,
  synthetic_f: string,
  first_name: string,
  last_name: string
}

/** Ответ GET /api/v1/demo/users */
interface DemoUsersResponse {
  users: DemoUser[]
}

export type { DemoUser, DemoUsersResponse }
