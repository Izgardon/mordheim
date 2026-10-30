import { lazy, Suspense } from "react";

// routing
import { Outlet, type RouteObject } from "react-router-dom";

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

const LATER = "a later step";

/** The campaign pages: placeholders until their redesign step rebuilds them. */
const CAMPAIGN_PAGES: { path?: string; title: string; step: string }[] = [
  { title: "Overview", step: LATER },
  { path: "warband", title: "Warband", step: "step 2" },
  { path: "warbands/:warbandId", title: "Warband", step: "step 2" },
  { path: "encampments", title: "Encampment", step: LATER },
  { path: "locations", title: "Locations", step: "step 2" },
  { path: "items", title: "Wargear", step: LATER },
  { path: "skills", title: "Skills", step: LATER },
  { path: "spells", title: "Spells", step: LATER },
  { path: "bestiary", title: "Bestiary", step: LATER },
  { path: "hired-swords", title: "Hired swords", step: LATER },
  { path: "dramatis-personae", title: "Dramatis personae", step: LATER },
  { path: "rules", title: "Rules", step: LATER },
  { path: "house-rules", title: "House rules", step: LATER },
  { path: "settings", title: "Settings", step: LATER },
  { path: "battles/:battleId/*", title: "Battle", step: LATER },
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
                children: CAMPAIGN_PAGES.map(({ path, title, step }) =>
                  path
                    ? { path, element: <RebuildingPage title={title} step={step} /> }
                    : { index: true, element: <RebuildingPage title={title} step={step} /> }
                ),
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
