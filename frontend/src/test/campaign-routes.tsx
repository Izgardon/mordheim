/**
 * The campaign pages as the app mounts them: RealtimeProvider above `CampaignLayout` (as
 * ProtectedLayout does), with the overview, encampments and settings routes, a stand-in Skills
 * page to leave the overview for, and the campaigns list as a stand-in. Mock in the test file:
 * `@/lib/api-client` (fake-api), `@/lib/realtime/client` (fake-realtime), `use-auth`,
 * `use-media-query` and `CampaignDiceRollerMenu`.
 */
import type { QueryClient } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import { AppToaster } from "@/components/ui/toaster";
import CampaignLayout from "@/features/campaigns/routes/CampaignLayout";
import CampaignOverview from "@/features/campaigns/routes/CampaignOverview";
import CampaignSettings from "@/features/campaigns/routes/CampaignSettings";
import Encampments from "@/features/campaigns/routes/Encampments";
import { RealtimeProvider } from "@/features/realtime/components/RealtimeProvider";
import { AppStoreProvider, useAppStore } from "@/stores/app-store";
import { TestDiceProvider } from "./dice";
import { renderWithQueryClient } from "./query-test-utils";

/** Shows the current path and query, so a test can see where a page sent the user. */
function CurrentPath() {
  const { pathname, search } = useLocation();
  return <output aria-label="Current path">{`${pathname}${search}`}</output>;
}

/**
 * A page to leave the overview for. It shows the store's `campaignStarted`, the copy that gates
 * the warband pages' XP bar (`useExperienceBar`), so a test can compare it with the overview.
 */
function SkillsStandIn() {
  const { campaignStarted } = useAppStore();
  return (
    <>
      <p>Skills page</p>
      <p>XP tracking: {campaignStarted ? "on" : "off"}</p>
    </>
  );
}

export function renderCampaignRoute(
  path: string,
  { queryClient }: { queryClient?: QueryClient } = {}
) {
  return renderWithQueryClient(
    <AppStoreProvider>
      <TestDiceProvider>
        <MemoryRouter initialEntries={[path]}>
          <RealtimeProvider>
            <CurrentPath />
            <Routes>
              <Route path="/campaigns" element={<p>Campaigns page</p>} />
              <Route path="/campaigns/:id" element={<CampaignLayout />}>
                <Route index element={<CampaignOverview />} />
                <Route path="skills" element={<SkillsStandIn />} />
                <Route path="encampments" element={<Encampments />} />
                <Route path="settings" element={<CampaignSettings />} />
              </Route>
            </Routes>
          </RealtimeProvider>
        </MemoryRouter>
        <AppToaster />
      </TestDiceProvider>
    </AppStoreProvider>,
    { queryClient }
  );
}
