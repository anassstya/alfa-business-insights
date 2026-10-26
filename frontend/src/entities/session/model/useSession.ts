import { useContext } from "react";
import { SessionContext } from "./SessionContext";

const useSession = () => {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error('useSession должен использоваться внутри SessionProvider');
  }

  return context;
}

export { useSession };
