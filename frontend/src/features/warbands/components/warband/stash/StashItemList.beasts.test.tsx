/**
 * Beasts in the stash (the bestiary rewrite, step 4): a mount or a pet there has no switch (only
 * the unit holding it switches it on, so the row says to move it first), and a creature has a
 * recruit button. The stash reads the warband on screen from its cached sheet; `apiRequest` is
 * answered by a fake server.
 */
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import StashItemList from "./StashItemList";
import { ShownWarbandProvider } from "../shown-warband-context";
import { AppToaster } from "@/components/ui/toaster";
import { queryKeys } from "@/lib/query-keys";
import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { makeStashItem } from "@/test/warband-fixtures";

import type { WarbandSheet } from "@/features/warbands/types/warband-sheet";
import type { HenchmenGroup, WarbandItemSummary } from "@/features/warbands/types/warband-types";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

vi.mock("@/stores/app-store", () => ({
  useAppStore: () => ({ warband: null, diceColor: "#2e8555" }),
}));

const WARBAND = 9;
const sheetKey = queryKeys.campaign.warbandSheet(7, WARBAND);

const stashWarhorse = makeStashItem({
  id: 140,
  name: "Warhorse",
  cost: 80,
  beast_kind: "mount",
});
const stashRaven = makeStashItem({ id: 141, name: "Raven", cost: 60, beast_kind: "pet" });
const rope = makeStashItem({ id: 120, name: "Rope", cost: 5, beast_kind: null });

const sheetWith = (groups: HenchmenGroup[] = []): WarbandSheet => ({
  warband: {
    id: WARBAND,
    name: "The Black Wolves",
    faction: "Mercenaries",
    campaign_id: 7,
    user_id: 1,
    created_at: "",
    updated_at: "",
  },
  summary: { gold: 500, rating: 99, heroes: [], hirelings: [], henchmen_groups: groups },
  capabilities: {
    edit: true,
    level_up: true,
    manage_items: true,
    edit_backstory: true,
    delete: true,
    edit_catalogue: true,
    trade: true,
  },
  heroes: [],
  henchmen_groups: groups,
  hirelings: [],
});

const renderStash = (
  items: WarbandItemSummary[],
  { canEdit = true, groups = [] as HenchmenGroup[] } = {}
) => {
  const utils = renderWithQueryClient(
    <ShownWarbandProvider campaignId={7} warbandId={WARBAND}>
      <AppToaster />
      <StashItemList items={items} warbandId={WARBAND} canEdit={canEdit} inSheet />
    </ShownWarbandProvider>,
    {}
  );
  utils.queryClient.setQueryData(sheetKey, sheetWith(groups));
  return utils;
};

beforeEach(() => {
  fakeApi.reset();
});

describe("stash rows: mounts and pets", () => {
  it("gives a stash mount or pet no switch, and says to move it to a unit first", () => {
    renderStash([stashWarhorse, stashRaven, rope]);

    expect(screen.getByText("Move it to a unit to ride it")).toBeInTheDocument();
    expect(screen.getByText("Move it to a unit to keep it as a pet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Warhorse: / })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Raven: / })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Actions for Warhorse" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Actions for Rope" })).toBeInTheDocument();
  });
});
