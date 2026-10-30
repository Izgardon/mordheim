import { lazy, Suspense } from "react";

// routing
import { Navigate, Outlet, type RouteObject } from "react-router-dom";

// components
import ScrollToTop from "../../components/ScrollToTop";
import RouteError from "../../components/errors/RouteError";
import { LoadingScreen } from "../../components/ui/loading-screen";
import RebuildingPage from "./RebuildingPage";

// Route modules load on demand, so the entry chunk carries only the shell (PERF-17).
const ProtectedLayout = lazy(() => import("./ProtectedLayout"));
const NotFound = lazy(() => import("./NotFound"));
const Landing = lazy(() => import("../../features/auth/routes/Landing"));
const ResetPassword = lazy(() => import("../../features/auth/routes/ResetPassword"));
const Account = lazy(() => import("../../features/auth/routes/Account"));
const CampaignLayout = lazy(() => import("../../features/campaigns/routes/CampaignLayout"));
const Campaigns = lazy(() => import("../../features/campaigns/routes/Campaigns"));
const Warband = lazy(() => import("../../features/warbands/routes/Warband"));
const Aftermath = lazy(() => import("../../features/battles/routes/Aftermath"));

/** The campaign pages still to rebuild: placeholders until their redesign step. */
const CAMPAIGN_PAGES: { path?: string; title: string; step: string }[] = [
  { title: "Overview", step: "step 5" },
  { path: "encampments", title: "Encampment", step: "step 7" },
  { path: "items", title: "Wargear", step: "step 7" },
  { path: "skills", title: "Skills", step: "step 7" },
  { path: "spells", title: "Spells", step: "step 7" },
  { path: "bestiary", title: "Bestiary", step: "step 7" },
  { path: "hired-swords", title: "Hired swords", step: "step 7" },
  { path: "dramatis-personae", title: "Dramatis personae", step: "step 7" },
  { path: "rules", title: "Rules", step: "step 7" },
  { path: "house-rules", title: "House rules", step: "step 7" },
  { path: "settings", title: "Settings", step: "step 7" },
  { path: "battles/:battleId/*", title: "Battle", step: "step 6" },
];

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
    errorElement: <RouteError />,
    children: [
      {
        path: "/",
        element: <Landing />,
      },
      {
        path: "/reset-password",
        element: <ResetPassword />,
      },
      {
        // Signed-in routes share one auth gate and one realtime provider.
        element: <ProtectedLayout />,
        children: [
          {
            path: "/campaigns",
            element: <Campaigns />,
          },
          {
            path: "/account",
            element: <Account />,
          },
          {
            path: "/campaigns/:id",
            element: <CampaignLayout />,
            children: [
              {
                // A page that throws is replaced in place; the campaign shell stays usable.
                errorElement: <RouteError variant="inline" />,
                children: [
                  { path: "warband", element: <Warband /> },
                  { path: "warbands/:warbandId", element: <Warband /> },
                  // The Aftermath (next step 3); the rest of a battle waits for step 6.
                  { path: "battles/:battleId/postbattle", element: <Aftermath /> },
                  // Locations is a panel of the warband page now (next step 2).
                  {
                    path: "locations",
                    element: <Navigate to="../warband?panel=locations" replace />,
                  },
                  ...CAMPAIGN_PAGES.map(({ path, title, step }) =>
                    path
                      ? { path, element: <RebuildingPage title={title} step={step} /> }
                      : { index: true, element: <RebuildingPage title={title} step={step} /> }
                  ),
                ],
              },
            ],
          },
        ],
      },
      {
        path: "*",
        element: <NotFound />,
      },
    ],
  },
];
