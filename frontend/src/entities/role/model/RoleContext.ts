import { createContext, useContext } from "react";

const RoleContext = createContext<Array<{code: string, full_name: string}> | undefined>(undefined)

const useRoleContext = () => {
  const context = useContext(RoleContext)

  if (!context){
    throw new Error("Нельзя использовать контекст за провайдером")
  }

  return context;
}

export { RoleContext, useRoleContext }