/**
 * Characterisation of a unit card's item menu (Sell, Move, Buy again) before pass 2's fixes:
 * the requests each action sends, what the page's cache holds afterwards, and where Move
 * targets and Buy again come from. The real menu hook and dialogs run; the card reads its unit
 * from the cached sheet as the page does, and `apiRequest` is answered by a fake server.
 */
import { screen, waitFor, within } from "@testing-library/react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import UnitListBlocks from "./UnitListBlocks";
import { heroKind } from "@/features/warbands/units/kinds/hero";
import { queryKeys } from "@/lib/query-keys";
import { TestDiceProvider } from "@/test/dice";
import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { getFieldNear } from "@/test/roster-queries";
import { chooseOption, selectNear } from "@/test/select-option";
import { setupUser } from "@/test/user-event";
import {
  dagger,
  lightArmour,
  makeItem,
  makeStashItem,
  makeVeteranHenchmenGroup,
  makeVeteranHero,
  sword,
} from "@/test/warband-fixtures";

import type { WarbandSheet } from "@/features/warbands/types/warband-sheet";
import type { WarbandHero, WarbandItemSummary } from "@/features/warbands/types/warband-types";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

const store = vi.hoisted(() => ({ warband: null as unknown }));
vi.mock("@/stores/app-store", () => ({
  useAppStore: () => ({ warband: store.warband, diceColor: "#2e8555" }),
}));

const MY_WARBAND = 9;
const THEIR_WARBAND = 12;

const aldric = makeVeteranHero();
const zorn = makeVeteranHero({ id: 41, warband_id: THEIR_WARBAND, name: "Zorn" });
const kurt = makeVeteranHero({ id: 42, warband_id: THEIR_WARBAND, name: "Kurt", is_leader: false });
const myGroup = makeVeteranHenchmenGroup();

/** The app store's warband: always the signed-in player's own, summary rows without items. */
const myStoreWarband = {
  id: MY_WARBAND,
  name: "The Black Wolves",
  faction: "Mercenaries",
  campaign_id: 7,
  user_id: 1,
  created_at: "",
  updated_at: "",
  gold: 500,
  resources: [],
  heroes: [{ id: 11, warband_id: MY_WARBAND, name: aldric.name, unit_type: "Captain", xp: 7 }],
  hired_swords: [],
};

const sheetKey = (warbandId: number) => queryKeys.campaign.warbandSheet(7, warbandId);
const stashKey = (warbandId: number) => queryKeys.campaign.warbandStash(7, warbandId);

const sheetOf = (warbandId: number, heroes: WarbandHero[]): WarbandSheet => ({
  warband: { ...myStoreWarband, id: warbandId, heroes: undefined, hired_swords: undefined },
  summary: { gold: 500, rating: 99 },
  capabilities: {
    edit: true,
    level_up: true,
    manage_items: true,
    edit_backstory: true,
    delete: true,
    add_custom: true,
  },
  heroes,
  henchmen_groups: warbandId === MY_WARBAND ? [myGroup] : [],
  hired_swords: [],
});

/** A hero card's loadout, fed from the cached sheet and written back to it, as on the page. */
function HeroLoadout({ warbandId, heroId }: { warbandId: number; heroId: number }) {
  const queryClient = useQueryClient();
  const sheet = useQuery<WarbandSheet>({
    queryKey: sheetKey(warbandId),
    queryFn: () => new Promise<never>(() => undefined),
    staleTime: Infinity,
  });
  const unit = sheet.data?.heroes.find((hero) => hero.id === heroId);
  if (!sheet.data || !unit) return null;
  return (
    <TestDiceProvider>
      <p>Header gold: {sheet.data.summary.gold}</p>
      <UnitListBlocks
        kind={heroKind}
        unit={unit}
        warbandId={warbandId}
        canEdit
        onUnitUpdated={(updated) =>
          queryClient.setQueryData<WarbandSheet>(
            sheetKey(warbandId),
            (current: WarbandSheet | undefined) =>
              current && {
                ...current,
                heroes: current.heroes.map((hero) => (hero.id === updated.id ? updated : hero)),
              }
          )
        }
      />
    </TestDiceProvider>
  );
}

const renderCard = (warbandId: number, hero: WarbandHero, heroes: WarbandHero[] = [hero]) => {
  const utils = renderWithQueryClient(<HeroLoadout warbandId={warbandId} heroId={hero.id} />, {});
  utils.queryClient.setQueryData(sheetKey(warbandId), sheetOf(warbandId, heroes));
  utils.queryClient.setQueryData<WarbandItemSummary[]>(stashKey(warbandId), [
    makeStashItem({ id: 120, name: "Rope", cost: 5, quantity: 1 }),
  ]);
  return utils;
};

type User = ReturnType<typeof setupUser>;

/** The entry's menu button: the row's other button, which has no accessible name. */
const menuButtonOf = async (label: string) => {
  const row = (await screen.findByRole("button", { name: label })).parentElement as HTMLElement;
  const menu = within(row)
    .getAllByRole("button")
    .find((button) => !button.textContent?.trim());
  if (!menu) throw new Error(`No menu next to "${label}"`);
  return menu;
};

const openMenu = async (user: User, label: string, action: string) => {
  await user.click(await menuButtonOf(label));
  await user.click(screen.getByRole("button", { name: action }));
};

const heroIn = (queryClient: QueryClient, warbandId: number, heroId: number) =>
  queryClient
    .getQueryData<WarbandSheet>(sheetKey(warbandId))
    ?.heroes.find((hero) => hero.id === heroId);

/** Aldric after one dagger left him. */
const aldricWithOneDagger = { ...aldric, items: [sword, dagger, lightArmour] };

beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.releasePointerCapture = vi.fn();
});

beforeEach(() => {
  vi.restoreAllMocks();
  fakeApi.reset();
  store.warband = myStoreWarband;
  fakeApi.on(`GET /warbands/${MY_WARBAND}/henchmen-groups/`, [myGroup]);
});

describe("unit item menu: Sell", () => {
  it("sells one copy in one request and writes the answer's unit and summary to the sheet", async () => {
    const user = setupUser();
    fakeApi.on(`POST /warbands/${MY_WARBAND}/item-sales/`, {
      summary: { gold: 501, rating: 99 },
      source: aldricWithOneDagger,
      target: null,
      stash_item: null,
      removed_stash_item_id: null,
    });
    const { queryClient } = renderCard(MY_WARBAND, aldric);

    await openMenu(user, "Dagger x 2", "Sell");
    const dialog = screen.getByRole("dialog", { name: "Sell Dagger" });
    expect(within(dialog).getByText("2 gc")).toBeInTheDocument();
    expect(getFieldNear("Quantity", dialog)).toHaveDisplayValue("1");
    expect(getFieldNear("Sell Price", dialog)).toHaveDisplayValue("1");
    await user.click(within(dialog).getByRole("button", { name: "Sell" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(fakeApi.calls()).toEqual([`POST /warbands/${MY_WARBAND}/item-sales/`]);
    expect(fakeApi.bodyOf(`POST /warbands/${MY_WARBAND}/item-sales/`)).toEqual({
      source_type: "hero",
      source_id: 11,
      item_id: 102,
      quantity: 1,
      price: 1,
    });
    expect(screen.getByRole("button", { name: "Dagger" })).toBeInTheDocument();
    expect(screen.getByText("Header gold: 501")).toBeInTheDocument();
    expect(heroIn(queryClient, MY_WARBAND, 11)?.items).toEqual(aldricWithOneDagger.items);
  });
});

describe("unit item menu: Move", () => {
  it("moves a copy to the stash, GETting henchmen groups first, and merges the answer's stash row (ECON-PERF-08, pinned; flips in PR A)", async () => {
    const user = setupUser();
    const daggerRow = makeStashItem({ id: 102, name: "Dagger", cost: 2, quantity: 1 });
    fakeApi.on(`POST /warbands/${MY_WARBAND}/item-transfers/`, {
      summary: { gold: 500, rating: 99 },
      source: aldricWithOneDagger,
      target: daggerRow,
      stash_item: daggerRow,
      removed_stash_item_id: null,
    });
    const { queryClient } = renderCard(MY_WARBAND, aldric);

    await openMenu(user, "Dagger x 2", "Move");
    const dialog = screen.getByRole("dialog", { name: "Move Dagger" });
    await chooseOption(user, selectNear("Unit Type", dialog), "Warband Stash");
    await user.click(within(dialog).getByRole("button", { name: "Move" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(fakeApi.calls()).toEqual([
      `GET /warbands/${MY_WARBAND}/henchmen-groups/`,
      `POST /warbands/${MY_WARBAND}/item-transfers/`,
    ]);
    expect(fakeApi.bodyOf(`POST /warbands/${MY_WARBAND}/item-transfers/`)).toEqual({
      source_type: "hero",
      source_id: 11,
      target_type: "stash",
      target_id: null,
      item_id: 102,
      quantity: 1,
    });
    expect(heroIn(queryClient, MY_WARBAND, 11)?.items).toEqual(aldricWithOneDagger.items);
    expect(
      queryClient.getQueryData<WarbandItemSummary[]>(stashKey(MY_WARBAND))?.map((row) => row.name)
    ).toEqual(["Rope", "Dagger"]);
  });

  it("moves a copy to a henchmen group from the groups it GETs when Move opens (ECON-PERF-08, pinned; flips in PR A)", async () => {
    const user = setupUser();
    const armedGroup = { ...myGroup, items: [...myGroup.items, dagger] };
    fakeApi.on(`POST /warbands/${MY_WARBAND}/item-transfers/`, {
      summary: { gold: 500, rating: 99 },
      source: aldricWithOneDagger,
      target: armedGroup,
      stash_item: null,
      removed_stash_item_id: null,
    });
    const { queryClient } = renderCard(MY_WARBAND, aldric);

    await openMenu(user, "Dagger x 2", "Move");
    const dialog = screen.getByRole("dialog", { name: "Move Dagger" });
    await chooseOption(user, selectNear("Unit Type", dialog), "Henchmen");
    await chooseOption(user, selectNear("Henchmen Group", dialog), "Black Knives - Thugs");
    await user.click(within(dialog).getByRole("button", { name: "Move" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(fakeApi.bodyOf(`POST /warbands/${MY_WARBAND}/item-transfers/`)).toMatchObject({
      target_type: "henchmen_group",
      target_id: 21,
    });
    expect(
      queryClient.getQueryData<WarbandSheet>(sheetKey(MY_WARBAND))?.henchmen_groups[0].items
    ).toHaveLength(7);
  });

  it("offers your own warband's units as Move targets on another player's hero (BUG-107, pinned; flips in PR A)", async () => {
    const user = setupUser();
    renderCard(THEIR_WARBAND, zorn, [zorn, kurt]);

    await openMenu(user, "Dagger x 2", "Move");
    const dialog = screen.getByRole("dialog", { name: "Move Dagger" });
    await chooseOption(user, selectNear("Unit Type", dialog), "Heroes");
    await user.click(selectNear("Hero", dialog));

    expect(fakeApi.calls()).toEqual([`GET /warbands/${MY_WARBAND}/henchmen-groups/`]);
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Aldric the Bold - Captain",
    ]);
  });
});

describe("unit item menu: Buy again", () => {
  const daggerItem = makeItem({
    id: 102,
    name: "Dagger",
    cost: null,
    availabilities: [{ id: 4, cost: 2, rarity: 2, restrictions: [] }],
  });

  beforeEach(() => {
    fakeApi.on("GET /items/102/", daggerItem);
    fakeApi.on(`GET /warbands/${MY_WARBAND}/heroes/`, [aldric]);
    fakeApi.on(`GET /warbands/${MY_WARBAND}/trades/`, [
      { id: 1, action: "Starting gold", price: 500, children: [] },
    ]);
  });

  it("buys another copy for the hero in nine requests and writes the PATCH's answer to the card (ECON-PERF-01, pinned; flips in PR B)", async () => {
    const user = setupUser();
    const rearmed = { ...aldric, items: [...aldric.items, { ...dagger }] };
    fakeApi.on(`GET /warbands/${MY_WARBAND}/heroes/11/`, aldric);
    fakeApi.on(`PATCH /warbands/${MY_WARBAND}/heroes/11/`, rearmed);
    fakeApi.on(`POST /warbands/${MY_WARBAND}/trades/`, { id: 900 });
    fakeApi.on(`POST /warbands/${MY_WARBAND}/logs/`, { id: 800 });
    fakeApi.on(`GET /warbands/${MY_WARBAND}/summary/`, { gold: 498, rating: 99 });
    renderCard(MY_WARBAND, aldric);

    await openMenu(user, "Dagger x 2", "Buy again");
    const dialog = await screen.findByRole("dialog", { name: "Acquire item" });
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Buy" })).toBeEnabled());
    await user.click(within(dialog).getByRole("button", { name: "Buy" }));

    expect(await screen.findByRole("button", { name: "Dagger x 3" })).toBeInTheDocument();
    expect(await screen.findByText("Header gold: 498")).toBeInTheDocument();
    expect(fakeApi.calls()).toEqual([
      "GET /items/102/",
      `GET /warbands/${MY_WARBAND}/henchmen-groups/`,
      `GET /warbands/${MY_WARBAND}/heroes/`,
      `GET /warbands/${MY_WARBAND}/trades/`,
      `GET /warbands/${MY_WARBAND}/heroes/11/`,
      `PATCH /warbands/${MY_WARBAND}/heroes/11/`,
      `POST /warbands/${MY_WARBAND}/trades/`,
      `POST /warbands/${MY_WARBAND}/logs/`,
      `GET /warbands/${MY_WARBAND}/summary/`,
    ]);
  });

  it("does nothing on another player's hero: it looks him up in your own warband (BUG-107, pinned; flips in PR A)", async () => {
    const user = setupUser();
    renderCard(THEIR_WARBAND, zorn, [zorn, kurt]);

    await openMenu(user, "Dagger x 2", "Buy again");
    const dialog = await screen.findByRole("dialog", { name: "Acquire item" });
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Buy" })).toBeEnabled());
    await user.click(within(dialog).getByRole("button", { name: "Buy" }));

    // Gold came from your own ledger; the Buy click sent nothing and the dialog stays.
    expect(fakeApi.calls()).toEqual([
      "GET /items/102/",
      `GET /warbands/${MY_WARBAND}/henchmen-groups/`,
      `GET /warbands/${MY_WARBAND}/heroes/`,
      `GET /warbands/${MY_WARBAND}/trades/`,
    ]);
    expect(screen.getByRole("dialog", { name: "Acquire item" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Buy" })).toBeEnabled();
  });
});
