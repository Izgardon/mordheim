/**
 * Members of a creature group going back to its item (the bestiary rewrite, step 4): the group's
 * expanded tiles offer "Back to item" to editors, for a group recruited from a beast only. The
 * dialog takes a number of members (the newest) or the ones ticked; their copies go to the stash
 * and the last members take the group with them, which the dialog says plainly. One request,
 * whose answer goes into the cached sheet and stash. `apiRequest` is answered by a fake server.
 */
import { screen, waitFor, within } from "@testing-library/react";
import { useQuery } from "@tanstack/react-query";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ShownWarbandProvider } from "../../warband/shown-warband-context";
import { AppToaster } from "@/components/ui/toaster";
import { henchmenKind } from "@/features/warbands/units/kinds/henchmen";
import { queryKeys } from "@/lib/query-keys";
import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";
import { makeStashItem, makeVeteranHenchmenGroup } from "@/test/warband-fixtures";

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
const BACK = `POST /warbands/${WARBAND}/henchmen-groups/25/back-to-item/`;
const sheetKey = queryKeys.campaign.warbandSheet(7, WARBAND);
const stashKey = queryKeys.campaign.warbandStash(7, WARBAND);

const kennel = makeVeteranHenchmenGroup({
  id: 25,
  name: "Kennel",
  unit_type: "Wardogs",
  source_beast_id: 3,
  beast_kind: "creature",
  items: [],
  henchmen: [
    { id: 71, name: "", kills: 0, dead: false },
    { id: 72, name: "Fang", kills: 2, dead: false },
  ],
});
const thugs = makeVeteranHenchmenGroup();
const dogsRow = makeStashItem({ id: 142, name: "Wardogs", cost: 30, beast_kind: "creature" });

const sheetWith = (groups: HenchmenGroup[]): WarbandSheet => ({
  warband: {
    id: WARBAND,
    name: "The Black Wolves",
    faction: "Mercenaries",
    campaign_id: 7,
    user_id: 1,
    created_at: "",
    updated_at: "",
  },
  summary: { gold: 500, rating: 99, heroes: [], hirelings: [], henchmen_groups: [] },
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

const Tiles = henchmenKind.slots.ExpandedTiles;

function CachedTiles({ groupId, canEdit }: { groupId: number; canEdit: boolean }) {
  const sheet = useQuery<WarbandSheet>({
    queryKey: sheetKey,
    queryFn: () => new Promise<never>(() => undefined),
    staleTime: Infinity,
  });
  const group = sheet.data?.henchmen_groups.find((entry) => entry.id === groupId);
  if (!sheet.data) return null;
  if (!group) return <p>No group</p>;
  return (
    <Tiles
      unit={group}
      warbandId={WARBAND}
      layout="default"
      canEdit={canEdit}
      onUnitUpdated={() => undefined}
    />
  );
}

const renderTiles = (group: HenchmenGroup, canEdit = true) => {
  const utils = renderWithQueryClient(
    <ShownWarbandProvider campaignId={7} warbandId={WARBAND}>
      <AppToaster />
      <CachedTiles groupId={group.id} canEdit={canEdit} />
    </ShownWarbandProvider>,
    {}
  );
  utils.queryClient.setQueryData(sheetKey, sheetWith([kennel, thugs]));
  utils.queryClient.setQueryData<WarbandItemSummary[]>(stashKey, []);
  return utils;
};

beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.releasePointerCapture = vi.fn();
});

beforeEach(() => {
  fakeApi.reset();
});

describe("back to item", () => {
  it("is offered to editors on a group recruited from a beast", async () => {
    renderTiles(kennel);
    expect(await screen.findByRole("button", { name: "Back to item" })).toBeInTheDocument();
  });

  it("is not offered on a group that wasn't recruited from a beast, or to a viewer", async () => {
    const { unmount } = renderTiles(thugs);
    expect(await screen.findByText("Reinforce Cost")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Back to item" })).not.toBeInTheDocument();
    unmount();

    renderTiles(kennel, false);
    expect(await screen.findByText("Reinforce Cost")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Back to item" })).not.toBeInTheDocument();
  });

  it("sends a number of members back in one request and writes the group and the stash row", async () => {
    const user = setupUser();
    fakeApi.on(BACK, {
      group: { ...kennel, henchmen: [kennel.henchmen[0]] },
      stash_items: [dogsRow],
      summary: { gold: 500, rating: 94 },
    });
    const { queryClient } = renderTiles(kennel);

    await user.click(await screen.findByRole("button", { name: "Back to item" }));
    const dialog = screen.getByRole("dialog", { name: "Back to item: Kennel" });
    expect(within(dialog).getByRole("spinbutton", { name: "How many" })).toHaveValue(1);
    expect(within(dialog).queryByText(/disbanded/)).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Back to item" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(fakeApi.calls()).toEqual([BACK]);
    expect(fakeApi.bodyOf(BACK)).toEqual({ count: 1 });
    const sheet = queryClient.getQueryData<WarbandSheet>(sheetKey);
    expect(sheet?.henchmen_groups.find((group) => group.id === 25)?.henchmen).toHaveLength(1);
    expect(sheet?.summary.rating).toBe(94);
    expect(queryClient.getQueryData<WarbandItemSummary[]>(stashKey)).toEqual([dogsRow]);
  });

  it("sends the members ticked, and says the group goes when all of them do", async () => {
    const user = setupUser();
    fakeApi.on(BACK, {
      group: null,
      stash_items: [{ ...dogsRow, quantity: 2 }],
      summary: { gold: 500, rating: 89 },
    });
    const { queryClient } = renderTiles(kennel);

    await user.click(await screen.findByRole("button", { name: "Back to item" }));
    const dialog = screen.getByRole("dialog", { name: "Back to item: Kennel" });
    await user.click(within(dialog).getByRole("radio", { name: "Choose members" }));
    await user.click(within(dialog).getByRole("checkbox", { name: "Fang (2 kills)" }));
    expect(within(dialog).queryByText(/disbanded/)).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("checkbox", { name: "Member 1" }));
    expect(
      within(dialog).getByText("The group is disbanded; what it carries goes to the stash.")
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Back to item" }));

    expect(await screen.findByText("No group")).toBeInTheDocument();
    expect(fakeApi.bodyOf(BACK)).toEqual({ member_ids: [71, 72] });
    expect(
      queryClient.getQueryData<WarbandSheet>(sheetKey)?.henchmen_groups.map((group) => group.id)
    ).toEqual([21]);
  });
});
