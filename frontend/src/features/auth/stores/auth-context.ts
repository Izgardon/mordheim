import { createContext, useContext } from "react";

// types
import type {
  AuthResponse,
  AuthTokens,
  AuthUser,
  LoginCredentials,
  RegisterPayload,
} from "../types/auth-types";

/** How the last session ended: by Log out, or under the user (refused by the server, or another tab). */
export type SessionEnd = "signed-out" | "ended";

export type AuthContextValue = {
  token: string | null;
  user: AuthUser | null;
  isReady: boolean;
  isSubmitting: boolean;
  /** Set when the profile couldn't be loaded because the server was unreachable; the session is kept. */
  connectionError: string | null;
  /** Null until a session ends in this visit; the gate tells the sign-in card why (AUTH-UX-02). */
  sessionEnd: SessionEnd | null;
  retryConnection: () => void;
  signIn: (credentials: LoginCredentials) => Promise<AuthTokens>;
  signUp: (payload: RegisterPayload) => Promise<AuthResponse>;
  signOut: () => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
