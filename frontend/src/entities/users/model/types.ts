interface DemoUser {
  id: number,
  synthetic_f: string,
  first_name: string,
  last_name: string
}

interface DemoUsersResponse {
  users: DemoUser[]
}

export type { DemoUser, DemoUsersResponse }
