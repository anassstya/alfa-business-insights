import { getCompaniesByUserId, type Company } from "@/entities";
import { getUsers, type DemoUser } from "@/entities/users";
import { useQuery } from "@tanstack/react-query";

interface UserWithCompanies {
  user: DemoUser;
  companies: Company[];
}

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
