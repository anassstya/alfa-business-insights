import { useQuery } from "@tanstack/react-query";
import { getUsers } from "../api";

const useDemoUsers = () => useQuery({
  queryKey: ['demoUsers'],
  queryFn: ({ signal }) => getUsers(signal)
})

export { useDemoUsers }
