import type { ReactNode } from "react";

// routing
import { Navigate } from "react-router-dom";

// hooks
import { useAuth } from "../features/auth/hooks/use-auth";

type ProtectedRouteProps = {
  children: ReactNode;
};

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { token, isReady } = useAuth();

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Checking the gates...
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/" replace />;
  }

  return children;
}




