import type { ReactNode } from "react";

// routing
import { Navigate } from "react-router-dom";

// hooks
import { useAuth } from "../features/auth/hooks/use-auth";
import { useNotifications } from "../features/realtime/hooks/useNotifications";
import { ConnectionErrorScreen } from "./ui/connection-error-screen";
import { LoadingScreen } from "./ui/loading-screen";

type ProtectedRouteProps = {
  children: ReactNode;
};

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { token, user, isReady, connectionError, retryConnection } = useAuth();
  useNotifications();

  if (!isReady) {
    return <LoadingScreen />;
  }

  if (!token) {
    return <Navigate to="/" replace />;
  }

  if (!user && connectionError) {
    return <ConnectionErrorScreen message={connectionError} onRetry={retryConnection} />;
  }

  return children;
}
