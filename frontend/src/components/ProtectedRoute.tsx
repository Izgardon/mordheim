import type { ReactNode } from "react";

// routing
import { Navigate } from "react-router-dom";

// hooks
import { useAuth } from "../features/auth/hooks/use-auth";
import { useNotifications } from "../features/realtime/hooks/useNotifications";
import { LoadingScreen } from "./ui/loading-screen";

type ProtectedRouteProps = {
  children: ReactNode;
};

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { token, isReady } = useAuth();
  useNotifications();

  if (!isReady) {
    return <LoadingScreen />;
  }

  if (!token) {
    return <Navigate to="/" replace />;
  }

  return children;
}




