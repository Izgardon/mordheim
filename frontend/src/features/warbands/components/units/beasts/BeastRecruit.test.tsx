/**
 * Recruiting a creature into henchmen from its Animal item (the bestiary rewrite, step 4): the
 * paw button on a creature's row, in a unit's items or the stash, opens the recruit dialog. It
 * offers each group recruited from the same beast ("Join Kennel (2 members)") and a new group,
 * with a quantity when there are several copies, and sends one request whose answer goes into
 * the cached sheet and stash. No gold moves. `apiRequest` is answered by a fake server.
 */
import { screen, waitFor, within } from "@testing-library/react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import UnitListBlocks from "../UnitListBlocks";
import StashItemList from "../../warband/stash/StashItemList";
import { ShownWarbandProvider } from "../../warband/shown-warband-context";
import { AppToaster } from "@/components/ui/toaster";
import { ApiError } from "@/lib/api-client";
import { heroKind } from "@/features/warbands/units/kinds/hero";
import { queryKeys } from "@/lib/query-keys";
import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";
import {
  makeItem,
  makeStashItem,
  makeVeteranHenchmenGroup,
  makeVeteranHero,
} from "@/test/warband-fixtures";

import type { WarbandSheet } from "@/features/warbands/types/warband-sheet";
import type {
  HenchmenGroup,
  WarbandHero,
  WarbandItemSummary,
} from "@/features/warbands/types/warband-types";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

vi.mock("@/stores/app-store", () => ({
  useAppStore: () => ({ warband: null, diceColor: "#2e8555" }),
}));

const WARBAND = 9;
const RECRUIT = `POST /warbands/${WARBAND}/beasts/recruit/`;
const sheetKey = queryKeys.campaign.warbandSheet(7, WARBAND);
const stashKey = queryKeys.campaign.warbandStash(7, WARBAND);

/** The catalogue's Wardogs item, with its beast (id 3). */
const wardogsItem = makeItem({
  id: 142,
  name: "Wardogs",
  type: "Animal",
  subtype: "Creature",
  cost: null,
  bestiary_entry: {
    id: 3,
    name: "Wardogs",
    kind: "creature",
    has_profile: true,
    movement: 6,
    weapon_skill: 4,
    ballistic_skill: 0,
    strength: 4,
    toughness: 3,
    wounds: 1,
    initiative: 4,
    attacks: 1,
    leadership: 5,
    armour_save: null,
    specials: [],
  },
});

const member = (id: number) => ({ id, name: "", kills: 0, dead: false });
const kennel = makeVeteranHenchmenGroup({
  id: 25,
  name: "Kennel",
  unit_type: "Wardogs",
  source_beast_id: 3,
  beast_kind: "creature",
  items: [],
  henchmen: [member(71), member(72)],
});
const wolfPack = { ...kennel, id: 26, name: "Wolf Pack", source_beast_id: 4 };
const thugs = makeVeteranHenchmenGroup();

const stashDogs = makeStashItem({
  id: 142,
  name: "Wardogs",
  cost: 30,
  quantity: 3,
  beast_kind: "creature",
});

const sheetWith = (heroes: WarbandHero[], groups: HenchmenGroup[]): WarbandSheet => ({
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
  heroes,
  henchmen_groups: groups,
  hirelings: [],
});

function CachedStash() {
  const stash = useQuery<WarbandItemSummary[]>({
    queryKey: stashKey,
    queryFn: () => new Promise<never>(() => undefined),
    staleTime: Infinity,
  });
  return <StashItemList items={stash.data ?? []} warbandId={WARBAND} canEdit inSheet />;
}

function CachedHero() {
  const sheet = useQuery<WarbandSheet>({
    queryKey: sheetKey,
    queryFn: () => new Promise<never>(() => undefined),
    staleTime: Infinity,
  });
  const unit = sheet.data?.heroes[0];
  if (!unit) return null;
  return <UnitListBlocks kind={heroKind} unit={unit} warbandId={WARBAND} canEdit />;
}

const renderPage = (
  content: "stash" | "hero",
  { heroes = [] as WarbandHero[], groups = [kennel, wolfPack, thugs] } = {}
) => {
  const utils = renderWithQueryClient(
    <ShownWarbandProvider campaignId={7} warbandId={WARBAND}>
      <AppToaster />
      {content === "stash" ? <CachedStash /> : <CachedHero />}
    </ShownWarbandProvider>,
    {}
  );
  utils.queryClient.setQueryData(sheetKey, sheetWith(heroes, groups));
  utils.queryClient.setQueryData(stashKey, [stashDogs]);
  return utils;
};

const groupsInCache = (queryClient: ReturnType<typeof renderPage>["queryClient"]) =>
  queryClient.getQueryData<WarbandSheet>(sheetKey)?.henchmen_groups ?? [];

const recruitAnswer = (overrides: Record<string, unknown>) => ({
  group: { ...kennel, henchmen: [member(71), member(72), member(73), member(74)] },
  source: null,
  stash_item: { ...stashDogs, quantity: 1, costs: [{ cost: 30, quantity: 1 }] },
  removed_stash_item_id: null,
  summary: { gold: 500, rating: 109, unit_count: 8, max_units: 15 },
  warnings: [],
  ...overrides,
});

beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.releasePointerCapture = vi.fn();
});

beforeEach(() => {
  toast.dismiss();
  fakeApi.reset();
  fakeApi.on("GET /items/142/", wardogsItem);
});

describe("recruit from the stash", () => {
  it("offers to join a group of the same beast first, then sends the copies there in one request", async () => {
    const user = setupUser();
    fakeApi.on(RECRUIT, recruitAnswer({}));
    const { queryClient } = renderPage("stash");

    await user.click(
      await screen.findByRole("button", { name: "Wardogs x 3: Recruit as henchmen" })
    );
    const dialog = await screen.findByRole("dialog", { name: "Recruit Wardogs" });
    const join = await within(dialog).findByRole("radio", { name: /Join Kennel/ });
    expect(join).toHaveAttribute("aria-checked", "true");
    expect(join).toHaveTextContent("2 members");
    expect(within(dialog).getByRole("radio", { name: /New group/ })).toBeInTheDocument();
    // Only a group recruited from the same beast can be joined.
    expect(within(dialog).queryByRole("radio", { name: /Wolf Pack/ })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("radio", { name: /Black Knives/ })).not.toBeInTheDocument();
    const quantity = within(dialog).getByRole("spinbutton", { name: "Quantity" });
    await user.clear(quantity);
    await user.type(quantity, "2");
    await user.click(within(dialog).getByRole("button", { name: "Recruit" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(fakeApi.calls()).toEqual(["GET /items/142/", RECRUIT]);
    expect(fakeApi.bodyOf(RECRUIT)).toEqual({
      source: { type: "stash", item_id: 142 },
      quantity: 2,
      target: { group_id: 25 },
    });
    expect(groupsInCache(queryClient).find((group) => group.id === 25)?.henchmen).toHaveLength(4);
    expect(queryClient.getQueryData<WarbandItemSummary[]>(stashKey)?.[0].quantity).toBe(1);
    expect(queryClient.getQueryData<WarbandSheet>(sheetKey)?.summary.rating).toBe(109);
  });

  it("forms a new group, named or by the beast's name, and drops an emptied stash row", async () => {
    const user = setupUser();
    const pack = { ...kennel, id: 27, name: "Pack", henchmen: [member(75)] };
    fakeApi.on(
      RECRUIT,
      recruitAnswer({ group: pack, stash_item: null, removed_stash_item_id: 142 })
    );
    const { queryClient } = renderPage("stash", { groups: [] });

    await user.click(
      await screen.findByRole("button", { name: "Wardogs x 3: Recruit as henchmen" })
    );
    const dialog = await screen.findByRole("dialog", { name: "Recruit Wardogs" });
    const fresh = within(dialog).getByRole("radio", { name: /New group/ });
    expect(fresh).toHaveAttribute("aria-checked", "true");
    await user.type(within(dialog).getByRole("textbox", { name: "Group name" }), "Pack");
    await user.click(within(dialog).getByRole("button", { name: "Recruit" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(fakeApi.bodyOf(RECRUIT)).toEqual({
      source: { type: "stash", item_id: 142 },
      quantity: 1,
      target: { new: { name: "Pack" } },
    });
    expect(groupsInCache(queryClient).map((group) => group.name)).toEqual(["Pack"]);
    expect(queryClient.getQueryData<WarbandItemSummary[]>(stashKey)).toEqual([]);
  });

  it("shows the answer's size warnings, and a refusal in the dialog", async () => {
    const user = setupUser();
    const message = "Kennel has 6 members; its maximum is 5.";
    fakeApi.on(
      RECRUIT,
      recruitAnswer({ warnings: [{ code: "group_over_size", message, members: 6, max_size: 5 }] })
    );
    renderPage("stash");

    await user.click(
      await screen.findByRole("button", { name: "Wardogs x 3: Recruit as henchmen" })
    );
    const dialog = await screen.findByRole("dialog", { name: "Recruit Wardogs" });
    await within(dialog).findByRole("radio", { name: /Join Kennel/ });
    await user.click(within(dialog).getByRole("button", { name: "Recruit" }));
    expect(await screen.findByText(message)).toBeInTheDocument();

    const refusal = "There are fewer than 2 Wardogs to recruit there.";
    fakeApi.fail(
      RECRUIT,
      new ApiError(refusal, 400, { detail: refusal, code: "not_enough", fields: {} })
    );
    // One copy is left in the stash now.
    await user.click(await screen.findByRole("button", { name: "Wardogs: Recruit as henchmen" }));
    const again = await screen.findByRole("dialog", { name: "Recruit Wardogs" });
    await within(again).findByRole("radio", { name: /Join Kennel/ });
    await user.click(within(again).getByRole("button", { name: "Recruit" }));
    expect(await within(again).findByText(refusal)).toBeInTheDocument();
  });
});

describe("recruit from a unit's items", () => {
  it("names the unit as the source, with no quantity for a single copy, and keeps its answer", async () => {
    const user = setupUser();
    const dogs = makeItem({
      id: 142,
      name: "Wardogs",
      type: "Animal",
      beast_kind: "creature",
      row_id: 9,
      companion: false,
    });
    const aldric = makeVeteranHero({ items: [dogs] });
    fakeApi.on(RECRUIT, recruitAnswer({ source: { ...aldric, items: [] }, stash_item: null }));
    const { queryClient } = renderPage("hero", { heroes: [aldric] });

    await user.click(await screen.findByRole("button", { name: "Wardogs: Recruit as henchmen" }));
    const dialog = await screen.findByRole("dialog", { name: "Recruit Wardogs" });
    await within(dialog).findByRole("radio", { name: /Join Kennel/ });
    expect(within(dialog).queryByRole("spinbutton", { name: "Quantity" })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Recruit" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(fakeApi.bodyOf(RECRUIT)).toEqual({
      source: { type: "hero", id: 11, item_id: 142 },
      quantity: 1,
      target: { group_id: 25 },
    });
    expect(queryClient.getQueryData<WarbandSheet>(sheetKey)?.heroes[0].items).toEqual([]);
  });
});
