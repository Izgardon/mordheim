// routing
import { Navigate, type RouteObject } from "react-router-dom";

// components
import ProtectedRoute from "../../components/ProtectedRoute";

// other
import Landing from "../../features/auth/routes/Landing";
import ForgotPassword from "../../features/auth/routes/ForgotPassword";
import ResetPassword from "../../features/auth/routes/ResetPassword";
import CampaignLayout from "../../features/campaigns/routes/CampaignLayout";
import CampaignOverview from "../../features/campaigns/routes/CampaignOverview";
import HouseRules from "../../features/rules/routes/HouseRules";
import Rules from "../../features/rules/routes/Rules";
import CampaignSettings from "../../features/campaigns/routes/CampaignSettings";
import Campaigns from "../../features/campaigns/routes/Campaigns";
import PlaceholderPage from "../../features/campaigns/routes/PlaceholderPage";
import Items from "../../features/items/routes/Items";
import Skills from "../../features/skills/routes/Skills";
import Spells from "../../features/spells/routes/Spells";
import Warband from "../../features/warbands/routes/Warband";
import BattlePrebattle from "../../features/battles/routes/BattlePrebattle";
import BattleActive from "../../features/battles/routes/BattleActive";
import BattlePostbattle from "../../features/battles/routes/BattlePostbattle";

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <Landing />,
  },
  {
    path: "/forgot-password",
    element: <ForgotPassword />,
  },
  {
    path: "/reset-password",
    element: <ResetPassword />,
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
      { path: "warband", element: <Warband /> },
      { path: "warbands/:warbandId", element: <Warband /> },
      { path: "warbands", element: <PlaceholderPage title="Warbands" /> },
      { path: "skills", element: <Skills /> },
      { path: "spells", element: <Spells /> },
      { path: "items", element: <Items /> },
      { path: "rules", element: <Rules /> },
      { path: "house-rules", element: <HouseRules /> },
      { path: "settings", element: <CampaignSettings /> },
      { path: "battles/:battleId/prebattle", element: <BattlePrebattle /> },
      { path: "battles/:battleId/active", element: <BattleActive /> },
      { path: "battles/:battleId/postbattle", element: <BattlePostbattle /> },
    ],
  },
  {
    path: "*",
    element: <Navigate to="/campaigns" replace />,
  },
];


