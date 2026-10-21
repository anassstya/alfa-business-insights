import { createContext, useContext } from "react";
import type { RoleId } from "./roles";

const RoleContext = createContext<Array<{role: RoleId, label: string}> | undefined>(undefined)

const useRoleContext = () => {
  const context = useContext(RoleContext)

  if (!context){
    throw new Error("Нельзя использовать контекст за провайдером")
  }

  return context;
}

export { RoleContext, useRoleContext }