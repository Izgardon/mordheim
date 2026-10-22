import type { PropsWithChildren } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

// api
import { loginAccount, registerAccount } from "../api/auth-api";
import { SERVER_UNAVAILABLE_MESSAGE } from "../../../lib/api-client";
import { disconnectRealtime } from "../../../lib/realtime/client";
import { session, useSession, type SessionChange } from "../../../lib/session";
import { AuthContext, type AuthContextValue } from "./auth-context";

// utils
import { loadSessionProfile, revalidateSessionUser } from "../utils/fetch-profile";

// types
import type { LoginCredentials, RegisterPayload } from "../types/auth-types";

export { useAuthContext } from "./auth-context";

/**
 * Puts the session (`lib/session.ts`) in context, and does what the app must when it changes:
 * drop the previous user's cached data and socket, and load a profile the session lacks.
 */
export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  // A reload renders at once from the user cached beside the tokens and checks /auth/me behind
  // it; a session stored without one waits for /auth/me (PERF-50).
  const [boot] = useState(session.boot);
  const { status, token, user, ended } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Shared devices: nothing cached for one user may reach the next one (BUG-22).
  const dropUserData = useCallback(() => {
    queryClient.clear();
    disconnectRealtime();
  }, [queryClient]);

  const handleChange = useCallback(
    (change: SessionChange) => {
      if (change.kind === "refreshed") {
        return;
      }
      if (change.kind === "ended" || change.previousUser) {
        dropUserData();
      }
      if (change.kind === "switched" && change.needsProfile) {
        loadSessionProfile(change.token).catch(() => {});
      }
    },
    [dropUserData]
  );

  useEffect(() => {
    const stopListening = session.onChange(handleChange);
    session.sync();
    return stopListening;
  }, [handleChange]);

  useEffect(() => {
    if (boot.token && boot.user) {
      void revalidateSessionUser(boot.token, boot.user);
    } else if (boot.token) {
      loadSessionProfile(boot.token).catch(() => {});
    }
  }, [boot]);

  const retryConnection = useCallback(() => {
    const storedToken = session.accessToken();
    if (storedToken) {
      loadSessionProfile(storedToken).catch(() => {});
    }
  }, []);

  // Sign-in and sign-up store the session in one write: the user comes with the answer, so
  // nothing reads /auth/me (PERF-50).
  const signIn = useCallback(async (credentials: LoginCredentials) => {
    setIsSubmitting(true);
    try {
      const data = await loginAccount(credentials);
      session.start(data, data.user);
      return data;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const signUp = useCallback(async (payload: RegisterPayload) => {
    setIsSubmitting(true);
    try {
      const data = await registerAccount(payload);
      session.start(data, data.user);
      return data;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const signOut = useCallback(() => {
    session.signOut();
    dropUserData();
  }, [dropUserData]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      token,
      user,
      isReady: status !== "booting",
      isSubmitting,
      connectionError: status === "offline" ? SERVER_UNAVAILABLE_MESSAGE : null,
      sessionEnd: ended,
      retryConnection,
      signIn,
      signUp,
      signOut,
    }),
    [status, token, user, isSubmitting, ended, retryConnection, signIn, signUp, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
