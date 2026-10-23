import { useQuery } from "@tanstack/react-query";
import { getUsers } from "../api";

const useDemoUsers = () => useQuery({
  queryKey: ['demoUsers'],
  queryFn: getUsers
})

export { useDemoUsers }
