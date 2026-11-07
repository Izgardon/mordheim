import { lazy, Suspense } from "react";

// routing
import { Outlet, type RouteObject } from "react-router-dom";

// components
import ScrollToTop from "../../components/ScrollToTop";
import RouteError from "../../components/errors/RouteError";
import { BootScreen } from "../../components/ui/loading-screen";

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
const BoonsBanes = lazy(() => import("../../features/special/routes/BoonsBanes"));
const Bestiary = lazy(() => import("../../features/bestiary/routes/Bestiary"));
const HirelingCatalogue = lazy(() => import("../../features/hirelings/routes/HirelingCatalogue"));
const Rules = lazy(() => import("../../features/rules/routes/Rules"));
const WarbandTemplates = lazy(
  () => import("../../features/warband-templates/routes/WarbandTemplates")
);
const HouseRules = lazy(() => import("../../features/rules/routes/HouseRules"));
const CampaignRules = lazy(() => import("../../features/rules/routes/CampaignRules"));
const SearchEverything = lazy(() => import("../../features/search/routes/SearchEverything"));
const CampaignSettings = lazy(() => import("../../features/campaigns/routes/CampaignSettings"));
const Encampments = lazy(() => import("../../features/campaigns/routes/Encampments"));
const Locations = lazy(() => import("../../features/campaigns/routes/Locations"));

function RootLayout() {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<BootScreen />}>
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
                  // The overview and the Battles page.
                  { index: true, element: <Overview /> },
                  { path: "battles", element: <Battles /> },
                  { path: "warband", element: <Warband /> },
                  { path: "warbands/:warbandId", element: <Warband /> },
                  // The Aftermath.
                  { path: "battles/:battleId/postbattle", element: <Aftermath /> },
                  // The invitation, the pre-battle and the battle: the layout sends
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
                  // The reference pages and Search everything.
                  { path: "items", element: <Wargear /> },
                  { path: "skills", element: <Skills /> },
                  { path: "spells", element: <Spells /> },
                  { path: "boons-banes", element: <BoonsBanes /> },
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
                  { path: "warband-templates", element: <WarbandTemplates /> },
                  { path: "house-rules", element: <HouseRules /> },
                  { path: "campaign-rules", element: <CampaignRules /> },
                  { path: "search", element: <SearchEverything /> },
                  // Where the locations are edited; the warband page's panel only reads them.
                  { path: "locations", element: <Locations /> },
                  { path: "encampments", element: <Encampments /> },
                  { path: "settings", element: <CampaignSettings /> },
                  // Account inside the campaign's shell, so the rail or bottom nav stays.
                  { path: "account", element: <Account inCampaign /> },
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
