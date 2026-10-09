"use client";

import { createContext, useContext } from "react";
import { useSession } from "next-auth/react";

/**
 * The user the server resolved for this request (NextAuth session or the
 * HttpOnly access_token cookie). Agents sign in through the cookie flow, so
 * `useSession()` can be empty for them even though they are logged in.
 */
interface ServerUser {
  signedIn: boolean;
  role: string | null;
}

const ServerUserContext = createContext<ServerUser>({ signedIn: false, role: null });

export function ServerUserProvider({
  signedIn,
  role = null,
  children,
}: {
  signedIn: boolean;
  role?: string | null;
  children: React.ReactNode;
}) {
  return (
    <ServerUserContext.Provider value={{ signedIn, role }}>
      {children}
    </ServerUserContext.Provider>
  );
}

/** Truthy when the visitor is logged in by either auth mechanism. */
export function useSignedIn(): boolean {
  const { data: session } = useSession();
  const server = useContext(ServerUserContext);
  return !!session || server.signedIn;
}

/** True when the server resolved the signed-in user as a Sales Partner (agent). */
export function useIsAgent(): boolean {
  return useContext(ServerUserContext).role?.toLowerCase() === "agent";
}
