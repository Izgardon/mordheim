import type { PropsWithChildren } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

// api
import { fetchMe, loginAccount, registerAccount } from "../api/auth-api";
import { isSessionExpiredError, SERVER_UNAVAILABLE_MESSAGE } from "../../../lib/api-client";
import { disconnectRealtime } from "../../../lib/realtime/client";

// utils
import { clearToken, getToken, setRefreshToken, setToken } from "../../../utils/storage";
import { getTokenUserId } from "../utils/token-user";

// types
import type {
  AuthResponse,
  AuthTokens,
  AuthUser,
  LoginCredentials,
  RegisterPayload,
} from "../types/auth-types";

type AuthContextValue = {
  token: string | null;
  user: AuthUser | null;
  isReady: boolean;
  isSubmitting: boolean;
  /** Set when the profile couldn't be loaded because the server was unreachable; the session is kept. */
  connectionError: string | null;
  retryConnection: () => void;
  signIn: (credentials: LoginCredentials) => Promise<AuthTokens>;
  signUp: (payload: RegisterPayload) => Promise<AuthResponse>;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// Back-off between profile retries while the server is unreachable (e.g. mid-deploy).
export const PROFILE_RETRY_DELAYS_MS = [1000, 2000, 4000];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchProfileWithRetry(accessToken: string) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fetchMe(accessToken);
    } catch (error) {
      if (isSessionExpiredError(error) || attempt >= PROFILE_RETRY_DELAYS_MS.length) {
        throw error;
      }
      await wait(PROFILE_RETRY_DELAYS_MS[attempt]);
    }
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [token, setTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isReady, setIsReady] = useState(() => !getToken());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const hydrateUser = useCallback(async (accessToken: string, profile?: AuthUser) => {
    if (!accessToken) {
      setUser(null);
      setIsReady(true);
      return;
    }

    setIsReady(false);
    setConnectionError(null);

    if (profile) {
      setUser(profile);
      setIsReady(true);
      return;
    }

    try {
      const loadedProfile = await fetchProfileWithRetry(accessToken);
      setUser(loadedProfile);
      setIsReady(true);
    } catch (error) {
      if (isSessionExpiredError(error)) {
        clearToken();
        setTokenState(null);
      } else {
        // An outage isn't a logout: keep the tokens so the user can retry.
        setConnectionError(SERVER_UNAVAILABLE_MESSAGE);
      }
      setUser(null);
      setIsReady(true);
      throw error;
    }
  }, []);

  const retryConnection = useCallback(() => {
    const currentToken = getToken();
    if (currentToken) {
      hydrateUser(currentToken).catch(() => {});
    }
  }, [hydrateUser]);

  const syncToken = useCallback(
    (nextToken?: string | null) => {
      const resolvedToken = nextToken ?? getToken();
      if (resolvedToken === token) {
        return;
      }
      setTokenState(resolvedToken);
      if (resolvedToken) {
        // A refreshed token for the signed-in user (from this tab or another): swap it and keep
        // the app mounted. Re-hydrating flips isReady and unmounts everything (BUG-21).
        if (user && getTokenUserId(resolvedToken) === String(user.id)) {
          return;
        }
        if (user) {
          // Another account signed in (in another tab): drop the previous user's cached data
          // and the socket authorised as them.
          queryClient.clear();
          disconnectRealtime();
        }
        hydrateUser(resolvedToken).catch(() => {});
      } else {
        // Signed out elsewhere, or the session expired: the next user must not see this one's data.
        queryClient.clear();
        disconnectRealtime();
        setUser(null);
        setIsReady(true);
      }
    },
    [hydrateUser, queryClient, token, user]
  );

  useEffect(() => {
    syncToken();
    const handleStorage = () => syncToken();
    window.addEventListener("storage", handleStorage);
    window.addEventListener("auth:tokens-changed", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("auth:tokens-changed", handleStorage);
    };
  }, [syncToken]);

  const signIn = useCallback(
    async (credentials: LoginCredentials) => {
      setIsSubmitting(true);
      try {
        const data = await loginAccount(credentials);
        setToken(data.access);
        setRefreshToken(data.refresh);
        setTokenState(data.access);
        await hydrateUser(data.access);
        return data;
      } finally {
        setIsSubmitting(false);
      }
    },
    [hydrateUser]
  );

  const signUp = useCallback(
    async (payload: RegisterPayload) => {
      setIsSubmitting(true);
      try {
        const data = await registerAccount(payload);
        setToken(data.access);
        setRefreshToken(data.refresh);
        setTokenState(data.access);
        await hydrateUser(data.access, data.user);
        return data;
      } finally {
        setIsSubmitting(false);
      }
    },
    [hydrateUser]
  );

  const signOut = useCallback(() => {
    clearToken();
    setTokenState(null);
    setUser(null);
    setConnectionError(null);
    setIsReady(true);
    // Shared devices: nothing cached for this user may reach the next one (BUG-22).
    queryClient.clear();
    disconnectRealtime();
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      isReady,
      isSubmitting,
      connectionError,
      retryConnection,
      signIn,
      signUp,
      signOut,
    }),
    [token, user, isReady, isSubmitting, connectionError, retryConnection, signIn, signUp, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
