import { createContext, useContext } from "react";
import type { Role } from "./roles";

const RoleContext = createContext<Role[] | undefined>(undefined)

const useRoleContext = () => {
  const context = useContext(RoleContext)

  if (!context){
    throw new Error("Нельзя использовать контекст за провайдером")
  }

  return context;
}

export { RoleContext, useRoleContext }