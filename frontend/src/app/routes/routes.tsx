import type { RouteObject } from "react-router-dom";

import ProtectedRoute from "../../components/ProtectedRoute";
import Landing from "../../features/auth/routes/Landing";
import Campaigns from "../../features/campaigns/routes/Campaigns";
import NotFound from "./NotFound";

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <Landing />,
  },
  {
    path: "/campaigns",
    element: (
      <ProtectedRoute>
        <Campaigns />
      </ProtectedRoute>
    ),
  },
  {
    path: "*",
    element: <NotFound />,
  },
];
