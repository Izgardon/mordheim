import { lazy, Suspense } from "react";

// routing
import { Navigate, Outlet, type RouteObject } from "react-router-dom";

// components
import ProtectedRoute from "../../components/ProtectedRoute";
import ScrollToTop from "../../components/ScrollToTop";
import { LoadingScreen } from "../../components/ui/loading-screen";

// Route modules load on demand, so the entry chunk carries only the shell (PERF-17).
const Landing = lazy(() => import("../../features/auth/routes/Landing"));
const ForgotPassword = lazy(() => import("../../features/auth/routes/ForgotPassword"));
const ResetPassword = lazy(() => import("../../features/auth/routes/ResetPassword"));
const CampaignLayout = lazy(() => import("../../features/campaigns/routes/CampaignLayout"));
const Encampments = lazy(() => import("../../features/campaigns/routes/Encampments"));
const CampaignOverview = lazy(() => import("../../features/campaigns/routes/CampaignOverview"));
const Locations = lazy(() => import("../../features/campaigns/routes/Locations"));
const HouseRules = lazy(() => import("../../features/rules/routes/HouseRules"));
const Rules = lazy(() => import("../../features/rules/routes/Rules"));
const CampaignSettings = lazy(() => import("../../features/campaigns/routes/CampaignSettings"));
const Campaigns = lazy(() => import("../../features/campaigns/routes/Campaigns"));
const PlaceholderPage = lazy(() => import("../../features/campaigns/routes/PlaceholderPage"));
const Items = lazy(() => import("../../features/items/routes/Items"));
const Skills = lazy(() => import("../../features/skills/routes/Skills"));
const Spells = lazy(() => import("../../features/spells/routes/Spells"));
const Warband = lazy(() => import("../../features/warbands/routes/Warband"));
const BattleLayout = lazy(() => import("../../features/battles/routes/BattleLayout"));
const BattlePrebattle = lazy(() => import("../../features/battles/routes/BattlePrebattle"));
const BattleActive = lazy(() => import("../../features/battles/routes/BattleActive"));
const BattlePostbattle = lazy(() => import("../../features/battles/routes/BattlePostbattle"));
const Bestiary = lazy(() => import("../../features/bestiary/routes/Bestiary"));
const HiredSwords = lazy(() => import("../../features/bestiary/routes/HiredSwords"));

function RootLayout() {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<LoadingScreen />}>
        <Outlet />
      </Suspense>
    </>
  );
}

export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    children: [
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
          { path: "bestiary", element: <Bestiary /> },
          { path: "hired-swords", element: <HiredSwords /> },
          { path: "locations", element: <Locations /> },
          { path: "encampments", element: <Encampments /> },
          { path: "rules", element: <Rules /> },
          { path: "house-rules", element: <HouseRules /> },
          { path: "settings", element: <CampaignSettings /> },
          {
            path: "battles/:battleId",
            element: <BattleLayout />,
            children: [
              { path: "prebattle", element: <BattlePrebattle /> },
              { path: "active", element: <BattleActive /> },
              { path: "postbattle", element: <BattlePostbattle /> },
            ],
          },
        ],
      },
      {
        path: "*",
        element: <Navigate to="/" replace />,
      },
    ],
  },
];
