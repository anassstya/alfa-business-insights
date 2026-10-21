import { createContext } from "react";
import type { RoleId } from "@/entities/role";

interface SessionContextValue {
  companyId: number | null;
  role: RoleId | null;
  setCompanyId(id: number | null): void;
  setRole(role: RoleId): void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export { SessionContext, type SessionContextValue };
