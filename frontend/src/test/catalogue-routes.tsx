/**
 * The catalogue pages as the app mounts them: RealtimeProvider above `CampaignLayout`, with
 * Wargear, Skills, Spells, Bestiary, Hired Swords and Dramatis Personae, a stand-in warband page that opens the
 * hero's New skill and New spell dialogs (they read the same cached lists), and a stand-in battle
 * page with the prebattle Load from Bestiary picker open. Mock in the test
 * file: `@/lib/api-client` (fake-api), `@/lib/realtime/client` (fake-realtime), `use-auth`,
 * `use-media-query` and `CampaignDiceRollerMenu`.
 */
import type { QueryClient } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";

import { AppToaster } from "@/components/ui/toaster";
import BestiaryPicker from "@/features/bestiary/components/BestiaryPicker";
import Bestiary from "@/features/bestiary/routes/Bestiary";
import CampaignLayout from "@/features/campaigns/routes/CampaignLayout";
import DramatisPersonae from "@/features/hirelings/routes/DramatisPersonae";
import HiredSwords from "@/features/hirelings/routes/HiredSwords";
import Items from "@/features/items/routes/Items";
import { RealtimeProvider } from "@/features/realtime/components/RealtimeProvider";
import NewSkillDialog from "@/features/skills/components/NewSkillDialog";
import Skills from "@/features/skills/routes/Skills";
import NewSpellDialog from "@/features/spells/components/NewSpellDialog";
import Spells from "@/features/spells/routes/Spells";
import { AppStoreProvider } from "@/stores/app-store";
import { OWNER } from "./campaign-fixtures";
import { TestDiceProvider } from "./dice";
import { renderWithQueryClient } from "./query-test-utils";
import { makeVeteranHero } from "./warband-fixtures";

/** Shows the current path and query, so a test can see where a page sent the user. */
function CurrentPath() {
  const { pathname, search } = useLocation();
  return <output aria-label="Current path">{`${pathname}${search}`}</output>;
}

/** The browser's own Back button: one step back in the router's history. */
function BrowserBack() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(-1)}>
      Browser back
    </button>
  );
}

/** Stands in for the warband page: a hero's New skill and New spell dialogs, both open. */
function WarbandDialogsStandIn() {
  const hero = makeVeteranHero({ warband_id: OWNER.warband!.id });
  return (
    <>
      <p>Warband page</p>
      <NewSkillDialog hero={hero} warbandId={hero.warband_id} open onOpenChange={() => undefined} />
      <NewSpellDialog hero={hero} warbandId={hero.warband_id} open onOpenChange={() => undefined} />
    </>
  );
}

/** Stands in for a battle page: the prebattle Load from Bestiary picker, open. */
function BestiaryPickerStandIn() {
  return <BestiaryPicker campaignId={1} onSelect={() => undefined} onClose={() => undefined} />;
}

export function renderCatalogueRoute(
  path: string,
  { queryClient }: { queryClient?: QueryClient } = {}
) {
  return renderWithQueryClient(
    <AppStoreProvider>
      <TestDiceProvider>
        <MemoryRouter initialEntries={[path]}>
          <RealtimeProvider>
            <CurrentPath />
            <BrowserBack />
            <Routes>
              <Route path="/campaigns/:id" element={<CampaignLayout />}>
                <Route index element={<p>Overview page</p>} />
                <Route path="items" element={<Items />} />
                <Route path="skills" element={<Skills />} />
                <Route path="spells" element={<Spells />} />
                <Route path="bestiary" element={<Bestiary />} />
                <Route path="hired-swords" element={<HiredSwords />} />
                <Route path="dramatis-personae" element={<DramatisPersonae />} />
                <Route path="warband" element={<WarbandDialogsStandIn />} />
                <Route path="bestiary-picker" element={<BestiaryPickerStandIn />} />
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
