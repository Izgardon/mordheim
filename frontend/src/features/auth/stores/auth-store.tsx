import type { PropsWithChildren } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { fetchMe, loginAccount, registerAccount } from "../api/auth-api";
import type { AuthResponse, AuthTokens, AuthUser, LoginCredentials, RegisterPayload } from "../types/auth-types";
import { clearToken, getToken, setToken } from "../../../utils/storage";

type AuthContextValue = {
  token: string | null;
  user: AuthUser | null;
  isReady: boolean;
  isSubmitting: boolean;
  signIn: (credentials: LoginCredentials) => Promise<AuthTokens>;
  signUp: (payload: RegisterPayload) => Promise<AuthResponse>;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [token, setTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hydrateUser = useCallback(async (accessToken: string, profile?: AuthUser) => {
    if (!accessToken) {
      setUser(null);
      setIsReady(true);
      return;
    }

    setIsReady(false);

    if (profile) {
      setUser(profile);
      setIsReady(true);
      return;
    }

    try {
      const loadedProfile = await fetchMe(accessToken);
      setUser(loadedProfile);
      setIsReady(true);
    } catch (error) {
      clearToken();
      setTokenState(null);
      setUser(null);
      setIsReady(true);
      throw error;
    }
  }, []);

  useEffect(() => {
    const storedToken = getToken();
    if (storedToken) {
      setTokenState(storedToken);
      hydrateUser(storedToken).catch(() => {});
    } else {
      setIsReady(true);
    }
  }, [hydrateUser]);

  const signIn = useCallback(
    async (credentials: LoginCredentials) => {
      setIsSubmitting(true);
      try {
        const data = await loginAccount(credentials);
        setToken(data.access);
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
    setIsReady(true);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      isReady,
      isSubmitting,
      signIn,
      signUp,
      signOut,
    }),
    [token, user, isReady, isSubmitting, signIn, signUp, signOut]
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
