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
const Overview = lazy(() => import("../../features/campaigns/routes/Overview"));
const Battles = lazy(() => import("../../features/campaigns/routes/Battles"));
const BattleLayout = lazy(() => import("../../features/battles/routes/BattleLayout"));
const BattlePrebattle = lazy(() => import("../../features/battles/routes/BattlePrebattle"));
const BattleActive = lazy(() => import("../../features/battles/routes/BattleActive"));
const Wargear = lazy(() => import("../../features/items/routes/Wargear"));
const Skills = lazy(() => import("../../features/skills/routes/Skills"));
const Spells = lazy(() => import("../../features/spells/routes/Spells"));
const Bestiary = lazy(() => import("../../features/bestiary/routes/Bestiary"));
const HirelingCatalogue = lazy(() => import("../../features/hirelings/routes/HirelingCatalogue"));
const Rules = lazy(() => import("../../features/rules/routes/Rules"));
const HouseRules = lazy(() => import("../../features/rules/routes/HouseRules"));
const SearchEverything = lazy(() => import("../../features/search/routes/SearchEverything"));

/** The campaign pages still to rebuild: placeholders until their redesign step. */
const CAMPAIGN_PAGES: { path: string; title: string; step: string }[] = [
  { path: "encampments", title: "Encampment", step: "step 7" },
  { path: "settings", title: "Settings", step: "step 7" },
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
                  // The overview and the Battles page (next step 5).
                  { index: true, element: <Overview /> },
                  { path: "battles", element: <Battles /> },
                  { path: "warband", element: <Warband /> },
                  { path: "warbands/:warbandId", element: <Warband /> },
                  // The Aftermath (next step 3).
                  { path: "battles/:battleId/postbattle", element: <Aftermath /> },
                  // The invitation, the pre-battle and the battle (next step 6): the layout sends
                  // each player to the page for his status; the bare battle URL only redirects.
                  {
                    path: "battles/:battleId",
                    element: <BattleLayout />,
                    children: [
                      { index: true, element: null },
                      { path: "prebattle", element: <BattlePrebattle /> },
                      { path: "active", element: <BattleActive /> },
                      { path: "*", element: null },
                    ],
                  },
                  // The reference pages and Search everything (next step 7a).
                  { path: "items", element: <Wargear /> },
                  { path: "skills", element: <Skills /> },
                  { path: "spells", element: <Spells /> },
                  { path: "bestiary", element: <Bestiary /> },
                  {
                    path: "hired-swords",
                    element: <HirelingCatalogue key="hired-swords" kind="hired-swords" />,
                  },
                  {
                    path: "dramatis-personae",
                    element: <HirelingCatalogue key="dramatis-personae" kind="dramatis-personae" />,
                  },
                  { path: "rules", element: <Rules /> },
                  { path: "house-rules", element: <HouseRules /> },
                  { path: "search", element: <SearchEverything /> },
                  // Locations is a panel of the warband page now (next step 2).
                  {
                    path: "locations",
                    element: <Navigate to="../warband?panel=locations" replace />,
                  },
                  ...CAMPAIGN_PAGES.map(({ path, title, step }) => ({
                    path,
                    element: <RebuildingPage title={title} step={step} />,
                  })),
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
