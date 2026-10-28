import { Suspense } from "react";
import { Outlet } from "react-router-dom";

import ProtectedRoute from "@/components/ProtectedRoute";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { DisplayNamePrompt } from "@/features/auth/components/DisplayNamePrompt";
import { RealtimeProvider } from "@/features/realtime/components/RealtimeProvider";

/**
 * One layout above every signed-in route, so moving between the campaigns list and a campaign
 * keeps the auth gate and the realtime subscriptions mounted instead of rebuilding them. A user
 * without a display name is asked for one over whichever page they land on (AUTH-NEW-06).
 */
export default function ProtectedLayout() {
  return (
    <ProtectedRoute>
      <RealtimeProvider>
        <Suspense fallback={<LoadingScreen />}>
          <Outlet />
        </Suspense>
        <DisplayNamePrompt />
      </RealtimeProvider>
    </ProtectedRoute>
  );
}
