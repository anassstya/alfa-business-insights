import { useMemo, useState, type PropsWithChildren } from "react";
import { type RoleId } from "@/entities/role";
import { SessionContext } from "./SessionContext";

interface StoredSession {
  companyId: number | null;
  role: RoleId | null;
  userId?: number;
}

const SessionProvider = ({ children }: PropsWithChildren) => {
  const [session, setSession] = useState<StoredSession>({ role: null, companyId: null, userId: undefined});

  const value = useMemo(() => ({
    ...session,
    setCompanyId: (companyId: number | null) => setSession(prev => ({ ...prev, companyId })),
    setRole: (role: RoleId) => setSession(prev => ({ ...prev, role })),
    setUserId: (userId: number) => setSession(prev => ({ ...prev, userId }))
  }), [session])

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  )
}

export { SessionProvider };
