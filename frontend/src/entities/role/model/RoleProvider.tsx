import { type PropsWithChildren } from "react";
import { RoleContext } from "./RoleContext";
import { useQuery } from "@tanstack/react-query";
import { getRole } from "../api";

const RoleProvider = ({ children }: PropsWithChildren) => {
  const { data = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: ({ signal }) => getRole(signal),
  })

  return (
    <RoleContext.Provider value={data}>
      {children}
    </RoleContext.Provider>
  )
}

export { RoleProvider }