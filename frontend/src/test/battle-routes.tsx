/**
 * The battle pages as the app mounts them: `BattleLayout` with the prebattle, active and postbattle
 * routes under a campaign, plus stand-ins for the pages they navigate to. Mock in the test file:
 * `@/lib/api-client` (fake-api), `@/lib/realtime/client` (fake-realtime), `use-auth`,
 * `use-media-query` and `CampaignDiceRollerMenu`.
 */
import type { QueryClient } from "@tanstack/react-query";
import { MemoryRouter, Outlet, Route, Routes, useLocation } from "react-router-dom";

import BattleActive from "@/features/battles/routes/BattleActive";
import BattleLayout from "@/features/battles/routes/BattleLayout";
import BattlePostbattle from "@/features/battles/routes/BattlePostbattle";
import BattlePrebattle from "@/features/battles/routes/BattlePrebattle";
import type { CampaignLayoutContext } from "@/features/campaigns/routes/CampaignLayout";
import type { CampaignSummary } from "@/features/campaigns/types/campaign-types";
import { AppStoreProvider } from "@/stores/app-store";
import { BATTLE_ID, CAMPAIGN_ID } from "./battle-fixtures";
import { TestDiceProvider } from "./dice";
import { renderWithQueryClient } from "./query-test-utils";

// jsdom doesn't scroll (it logs "Not implemented"); the battle pages scroll to the top on mount.
window.scrollTo = (() => undefined) as typeof window.scrollTo;

const campaign = {
  id: CAMPAIGN_ID,
  name: "Shards of the Comet",
  hero_death_roll: "d66",
} as unknown as CampaignSummary;

function CampaignShell({ overrides }: { overrides?: Partial<CampaignSummary> }) {
  const context: CampaignLayoutContext = { campaign: { ...campaign, ...overrides } };
  return <Outlet context={context} />;
}

/** Shows the current path, so a test can see where a page sent the user. */
function CurrentPath() {
  return <output aria-label="Current path">{useLocation().pathname}</output>;
}

export type BattlePhase = "prebattle" | "active" | "postbattle";

export const phasePath = (phase: BattlePhase) =>
  `/campaigns/${CAMPAIGN_ID}/battles/${BATTLE_ID}/${phase}`;

export function renderBattleRoute(
  phase: BattlePhase,
  {
    queryClient,
    campaign: campaignOverrides,
  }: { queryClient?: QueryClient; campaign?: Partial<CampaignSummary> } = {}
) {
  return renderWithQueryClient(
    <AppStoreProvider>
      <TestDiceProvider>
        <MemoryRouter initialEntries={[phasePath(phase)]}>
          <CurrentPath />
          <Routes>
            <Route path="/campaigns/:id" element={<CampaignShell overrides={campaignOverrides} />}>
              <Route index element={<p>Campaign overview</p>} />
              <Route path="warband" element={<p>Warband page</p>} />
              <Route path="battles/:battleId" element={<BattleLayout />}>
                <Route path="prebattle" element={<BattlePrebattle />} />
                <Route path="active" element={<BattleActive />} />
                <Route path="postbattle" element={<BattlePostbattle />} />
              </Route>
            </Route>
          </Routes>
        </MemoryRouter>
      </TestDiceProvider>
    </AppStoreProvider>,
    { queryClient }
  );
}
