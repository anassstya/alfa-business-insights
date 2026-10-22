import { createContext } from "react";

interface SessionContextValue {
  companyId: number | null;
  role: string | null;
  setCompanyId(id: number | null): void;
  setRole(role: string): void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export { SessionContext, type SessionContextValue };
