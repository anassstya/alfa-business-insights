import { createContext } from "react";

interface SessionContextValue {
  companyId: number | null;
  role: string | null;
  userId?: number;
  setCompanyId(id: number | null): void;
  setRole(role: string): void;
  setUserId(userId: number): void
}

const SessionContext = createContext<SessionContextValue | null>(null);

export { SessionContext, type SessionContextValue };
