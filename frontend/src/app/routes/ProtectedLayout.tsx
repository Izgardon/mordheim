import { Suspense } from "react";
import { Outlet } from "react-router-dom";

import ProtectedRoute from "@/components/ProtectedRoute";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { RealtimeProvider } from "@/features/realtime/components/RealtimeProvider";

/**
 * One layout above every signed-in route, so moving between the campaigns list and a campaign
 * keeps the auth gate and the realtime subscriptions mounted instead of rebuilding them.
 */
export default function ProtectedLayout() {
  return (
    <ProtectedRoute>
      <RealtimeProvider>
        <Suspense fallback={<LoadingScreen />}>
          <Outlet />
        </Suspense>
      </RealtimeProvider>
    </ProtectedRoute>
  );
}
