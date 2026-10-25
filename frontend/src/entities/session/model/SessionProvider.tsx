import { useMemo, useState, type PropsWithChildren } from "react";
import { type RoleId } from "@/entities/role";
import { SessionContext } from "./SessionContext";

interface StoredSession {
  companyId: number | null;
  role: RoleId | null;
  userId?: number;
  purpose?: string;
  activeJobId?: string;
}

const SessionProvider = ({ children }: PropsWithChildren) => {
  const [session, setSession] = useState<StoredSession>({ role: null, companyId: null, userId: undefined, purpose: undefined});

  const value = useMemo(() => ({
    ...session,
    setCompanyId: (companyId: number | null) => setSession(prev => ({ ...prev, companyId })),
    setRole: (role: RoleId) => setSession(prev => ({ ...prev, role })),
    // у каждого демопользователя свой список сессий — чужую активную сессию сбрасываем
    setUserId: (userId: number) => setSession(prev => ({
      ...prev,
      userId,
      activeJobId: prev.userId === userId ? prev.activeJobId : undefined,
    })),
    setPurpose: (purpose: string) => setSession(prev => ({ ...prev, purpose })),
    setActiveJobId: (activeJobId: string | undefined) => setSession(prev => ({ ...prev, activeJobId })),
  }), [session])

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  )
}

export { SessionProvider };
