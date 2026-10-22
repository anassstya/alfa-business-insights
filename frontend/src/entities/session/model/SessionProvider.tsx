import { useMemo, useState, type PropsWithChildren } from "react";
import { type RoleId } from "@/entities/role";
import { SessionContext } from "./SessionContext";

interface StoredSession {
  companyId: number | null;
  role: RoleId | null;
}

const SessionProvider = ({ children }: PropsWithChildren) => {
  const [session, setSession] = useState<StoredSession>({ role: null, companyId: null});

  const value = useMemo(() => ({
    ...session,
    setCompanyId: (companyId: number | null) => setSession(prev => ({ ...prev, companyId })),
    setRole: (role: RoleId) => setSession(prev => ({ ...prev, role })),
  }), [session])

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  )
}

export { SessionProvider };
