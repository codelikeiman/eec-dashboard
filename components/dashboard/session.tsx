"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { SessionUser } from "@/lib/dashboard/types";

const SessionContext = createContext<SessionUser | null>(null);

export function SessionProvider({ user, children }: { user: SessionUser; children: ReactNode }) {
  return <SessionContext.Provider value={user}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionUser {
  const user = useContext(SessionContext);
  if (!user) throw new Error("useSession must be used inside the dashboard shell");
  return user;
}
