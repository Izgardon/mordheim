import type { PropsWithChildren } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

// api
import { fetchMe, loginAccount, registerAccount } from "../api/auth-api";
import { isSessionExpiredError, SERVER_UNAVAILABLE_MESSAGE } from "../../../lib/api-client";
import { disconnectRealtime } from "../../../lib/realtime/client";
import { AuthContext, type AuthContextValue } from "./auth-context";

// utils
import { clearToken, getToken, setStoredUser, setTokens } from "../../../utils/storage";
import { fetchProfileWithRetry } from "../utils/fetch-profile";
import { cachedUserFor, getTokenUserId } from "../utils/token-user";

// types
import type { AuthTokens, AuthUser, LoginCredentials, RegisterPayload } from "../types/auth-types";

export { useAuthContext } from "./auth-context";

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  // A reload renders at once from the user cached beside the tokens and checks /auth/me behind
  // it; a session stored without one waits for /auth/me (PERF-50).
  const [boot] = useState(() => {
    const storedToken = getToken();
    return { token: storedToken, user: cachedUserFor(storedToken) };
  });
  const [token, setTokenState] = useState(boot.token);
  const [user, setUserState] = useState(boot.user);
  const [isReady, setIsReady] = useState(!boot.token || boot.user !== null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  // The latest token and user, for the storage listener: this tab's own writes (sign-in, a
  // refresh) notify at once, before React has re-rendered with the new values (PERF-50).
  const latest = useRef({ token: boot.token, user: boot.user });

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
        if (getToken()) {
          setStoredUser(loadedProfile);
        }
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

  // The cached user shown at boot, checked behind it: an outage keeps it (the page's own reads
  // say the server is down), and a refused session ends here.
  const revalidateUser = useCallback(
    async (accessToken: string, cached: AuthUser) => {
      const isStillSignedIn = () => latest.current.user?.id === cached.id;
      try {
        const profile = await fetchMe(accessToken);
        if (isStillSignedIn() && profile.id === cached.id) {
          setStoredUser(profile);
          if (JSON.stringify(profile) !== JSON.stringify(latest.current.user)) {
            setUser(profile);
          }
        }
      } catch (error) {
        if (isSessionExpiredError(error) && isStillSignedIn()) {
          clearToken();
        }
      }
    },
    [setUser]
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
    const { token: currentToken, user: currentUser } = latest.current;
    setSessionToken(resolvedToken);
    if (resolvedToken) {
      // A refreshed token for this account (from this tab or another): swap it and keep the app
      // mounted, since re-hydrating flips isReady and unmounts everything (BUG-21). Before the
      // profile has loaded too, so a reload with an expired token loads it once (BUG-158).
      const accountId = currentUser
        ? String(currentUser.id)
        : currentToken && getTokenUserId(currentToken);
      const tokenUserId = getTokenUserId(resolvedToken);
      if (tokenUserId !== null && tokenUserId === accountId) {
        return;
      }
      if (currentUser) {
        // Another account signed in (in another tab): drop the previous user's cached data
        // and the socket authorised as them.
        queryClient.clear();
        disconnectRealtime();
      }
      const cached = cachedUserFor(resolvedToken);
      if (cached) {
        // Signed in in another tab, which cached the user beside the tokens.
        setUser(cached);
        setConnectionError(null);
        setIsReady(true);
        return;
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

  useEffect(() => {
    if (boot.token && boot.user) {
      void revalidateUser(boot.token, boot.user);
    } else if (boot.token) {
      hydrateUser(boot.token).catch(() => {});
    }
  }, [boot, hydrateUser, revalidateUser]);

  // Sign-in and sign-up store the session in one write, which the listener above then skips:
  // the user comes with the answer, so nothing reads /auth/me again (PERF-50).
  const startSession = useCallback(
    (tokens: AuthTokens, profile: AuthUser) => {
      setSessionToken(tokens.access);
      setUser(profile);
      setConnectionError(null);
      setIsReady(true);
      setTokens({ access: tokens.access, refresh: tokens.refresh, user: profile });
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
