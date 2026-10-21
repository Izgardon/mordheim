import type { ReactNode } from "react";

// routing
import { Navigate, useLocation } from "react-router-dom";

// hooks
import { useAuth } from "../features/auth/hooks/use-auth";
import { signInRedirectState } from "../features/auth/utils/sign-in-redirect";
import { ConnectionErrorScreen } from "./ui/connection-error-screen";
import { LoadingScreen } from "./ui/loading-screen";

type ProtectedRouteProps = {
  children: ReactNode;
};

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { token, user, isReady, connectionError, retryConnection, sessionEnd } = useAuth();
  const location = useLocation();

  if (!isReady) {
    return <LoadingScreen />;
  }

  if (!token) {
    // Sign-in comes back to this page, and says why when the session ended (AUTH-UX-02).
    return <Navigate to="/" replace state={signInRedirectState(location, sessionEnd)} />;
  }

  if (!user && connectionError) {
    return <ConnectionErrorScreen message={connectionError} onRetry={retryConnection} />;
  }

  return children;
}
