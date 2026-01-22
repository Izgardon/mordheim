import type { RouteObject } from "react-router-dom";

import ProtectedRoute from "../../components/ProtectedRoute";
import Landing from "../../features/auth/routes/Landing";
import CampaignLayout from "../../features/campaigns/routes/CampaignLayout";
import CampaignOverview from "../../features/campaigns/routes/CampaignOverview";
import CampaignSettings from "../../features/campaigns/routes/CampaignSettings";
import Items from "../../features/items/routes/Items";
import CampaignWarband from "../../features/warbands/routes/CampaignWarband";
import Skills from "../../features/skills/routes/Skills";
import Campaigns from "../../features/campaigns/routes/Campaigns";
import PlaceholderPage from "../../features/campaigns/routes/PlaceholderPage";
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
    path: "/campaigns/:id",
    element: (
      <ProtectedRoute>
        <CampaignLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <CampaignOverview /> },
      { path: "warband", element: <CampaignWarband /> },
      { path: "warbands", element: <PlaceholderPage title="Warbands" /> },
      { path: "skills", element: <Skills /> },
      { path: "items", element: <Items /> },
      { path: "settings", element: <CampaignSettings /> },
    ],
  },
  {
    path: "*",
    element: <NotFound />,
  },
];
