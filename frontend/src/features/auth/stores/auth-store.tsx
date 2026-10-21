import type { PropsWithChildren } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";

// api
import { fetchMe, loginAccount, registerAccount } from "../api/auth-api";
import { isSessionExpiredError, SERVER_UNAVAILABLE_MESSAGE } from "../../../lib/api-client";
import { disconnectRealtime } from "../../../lib/realtime/client";

// utils
import { clearToken, getToken, setTokens } from "../../../utils/storage";
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
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [isReady, setIsReady] = useState(() => !getToken());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  // The latest token and user, for the storage listener: this tab's own writes (sign-in, a
  // refresh) notify at once, before React has re-rendered with the new values (PERF-50).
  const latest = useRef<{ token: string | null; user: AuthUser | null }>({
    token: null,
    user: null,
  });

  const setSessionToken = useCallback((nextToken: string | null) => {
    latest.current.token = nextToken;
    setTokenState(nextToken);
  }, []);

  const setUser = useCallback((nextUser: AuthUser | null) => {
    latest.current.user = nextUser;
    setUserState(nextUser);
  }, []);

  const hydrateUser = useCallback(
    async (accessToken: string) => {
      setIsReady(false);
      setConnectionError(null);

      try {
        const loadedProfile = await fetchProfileWithRetry(accessToken);
        setUser(loadedProfile);
        setIsReady(true);
      } catch (error) {
        if (isSessionExpiredError(error)) {
          clearToken();
          setSessionToken(null);
        } else {
          // An outage isn't a logout: keep the tokens so the user can retry.
          setConnectionError(SERVER_UNAVAILABLE_MESSAGE);
        }
        setUser(null);
        setIsReady(true);
        throw error;
      }
    },
    [setSessionToken, setUser]
  );

  const retryConnection = useCallback(() => {
    const currentToken = getToken();
    if (currentToken) {
      hydrateUser(currentToken).catch(() => {});
    }
  }, [hydrateUser]);

  const syncToken = useCallback(() => {
    const resolvedToken = getToken();
    if (resolvedToken === latest.current.token) {
      return;
    }
    const currentUser = latest.current.user;
    setSessionToken(resolvedToken);
    if (resolvedToken) {
      // A refreshed token for the signed-in user (from this tab or another): swap it and keep
      // the app mounted. Re-hydrating flips isReady and unmounts everything (BUG-21).
      if (currentUser && getTokenUserId(resolvedToken) === String(currentUser.id)) {
        return;
      }
      if (currentUser) {
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
  }, [hydrateUser, queryClient, setSessionToken, setUser]);

  useEffect(() => {
    syncToken();
    window.addEventListener("storage", syncToken);
    window.addEventListener("auth:tokens-changed", syncToken);
    return () => {
      window.removeEventListener("storage", syncToken);
      window.removeEventListener("auth:tokens-changed", syncToken);
    };
  }, [syncToken]);

  // Sign-in and sign-up store the session in one write, which the listener above then skips:
  // the user comes with the answer, so nothing reads /auth/me again (PERF-50).
  const startSession = useCallback(
    (tokens: AuthTokens, profile: AuthUser) => {
      setSessionToken(tokens.access);
      setUser(profile);
      setConnectionError(null);
      setIsReady(true);
      setTokens({ access: tokens.access, refresh: tokens.refresh });
    },
    [setSessionToken, setUser]
  );

  const signIn = useCallback(
    async (credentials: LoginCredentials) => {
      setIsSubmitting(true);
      try {
        const data = await loginAccount(credentials);
        // Login sends the user from the server's pass 6 PR A on; before that, one profile read.
        startSession(data, data.user ?? (await fetchMe(data.access)));
        return data;
      } finally {
        setIsSubmitting(false);
      }
    },
    [startSession]
  );

  const signUp = useCallback(
    async (payload: RegisterPayload) => {
      setIsSubmitting(true);
      try {
        const data = await registerAccount(payload);
        startSession(data, data.user);
        return data;
      } finally {
        setIsSubmitting(false);
      }
    },
    [startSession]
  );

  const signOut = useCallback(() => {
    clearToken();
    setSessionToken(null);
    setUser(null);
    setConnectionError(null);
    setIsReady(true);
    // Shared devices: nothing cached for this user may reach the next one (BUG-22).
    queryClient.clear();
    disconnectRealtime();
  }, [queryClient, setSessionToken, setUser]);

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
