import { useState, type PropsWithChildren } from "react";
import type { RoleId } from "./roles";
import { RoleContext } from "./RoleContext";

const RoleProvider = ({roles, children}: { roles: Array<{role: RoleId, label: string}>} & PropsWithChildren) => {
  const [currentRoles, setRoles] = useState(() => roles);

  return (
    <RoleContext.Provider value={currentRoles}>
      {children}
    </RoleContext.Provider>
  )
}

export { RoleProvider }