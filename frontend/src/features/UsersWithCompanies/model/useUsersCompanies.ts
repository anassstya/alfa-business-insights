import { getCompaniesByUserId, type Company } from "@/entities";
import { getUsers, type DemoUser } from "@/entities/users";
import { useQuery } from "@tanstack/react-query";

interface UserWithCompanies {
  user: DemoUser;
  companies: Company[];
}

/**
 * GET /api/v1/demo/users + GET /api/v1/demo/users/{id}/companies для каждого пользователя.
 * FIXME(openapi): в API нет эндпоинта, отдающего пользователей сразу с компаниями, —
 * получается N+1 запрос (пока демопользователей трое, это терпимо).
 */
const useUsersCompanies = () =>
  useQuery({
    queryKey: ['users', 'companies'],
    queryFn: async ({ signal }): Promise<UserWithCompanies[]> => {
      const users = await getUsers(signal);

      return Promise.all(users.map(async user => ({
        user,
        companies: await getCompaniesByUserId(user.id, signal),
      })));
    }
  })

export { useUsersCompanies, type UserWithCompanies }
