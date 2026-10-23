/**
 * A mount or a pet in a unit's items is switched on for that unit from the button beside its menu
 * (the bestiary rewrite, step 4): one request, whose answer (the unit and the summary) goes into
 * the cached sheet. Item rows split a unit's copies into the ones switched on and the spares. The
 * card reads its unit from the cached sheet, and `apiRequest` is answered by a fake server.
 */
import { screen, waitFor } from "@testing-library/react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import UnitListBlocks from "./UnitListBlocks";
import { ShownWarbandProvider } from "../warband/shown-warband-context";
import { AppToaster } from "@/components/ui/toaster";
import { henchmenKind } from "@/features/warbands/units/kinds/henchmen";
import { heroKind } from "@/features/warbands/units/kinds/hero";
import { queryKeys } from "@/lib/query-keys";
import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";
import {
  makeItem,
  makeVeteranHenchmenGroup,
  makeVeteranHero,
  sword,
} from "@/test/warband-fixtures";

import type { Item } from "@/features/items/types/item-types";
import type { WarbandSheet } from "@/features/warbands/types/warband-sheet";
import type { HenchmenGroup, WarbandHero } from "@/features/warbands/types/warband-types";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

vi.mock("@/stores/app-store", () => ({
  useAppStore: () => ({ warband: null, diceColor: "#2e8555" }),
}));

const WARBAND = 9;
const sheetKey = queryKeys.campaign.warbandSheet(7, WARBAND);

const copy = (name: string, overrides: Partial<Item>) =>
  makeItem({ name, type: "Animal", cost: 80, companion: false, ...overrides });
const warhorse = (rowId: number, companion = false) =>
  copy("Warhorse", { id: 140, subtype: "Mount", beast_kind: "mount", row_id: rowId, companion });
const raven = (rowId: number, companion = false) =>
  copy("Raven", { id: 141, subtype: "Pet", beast_kind: "pet", row_id: rowId, companion });
const swordRow = { ...sword, row_id: 3, companion: false, beast_kind: null };

const mountOf = (rowId: number) => ({
  item_row_id: rowId,
  item_id: 140,
  name: "Warhorse",
  movement: 8,
  rating_bonus: 5,
  has_profile: true,
  stats: null,
});

const aldric = makeVeteranHero({ items: [warhorse(1), raven(2), swordRow] });

const sheetOf = (heroes: WarbandHero[], groups: HenchmenGroup[] = []): WarbandSheet => ({
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

function CachedHero({ canEdit }: { canEdit: boolean }) {
  const sheet = useQuery<WarbandSheet>({
    queryKey: sheetKey,
    queryFn: () => new Promise<never>(() => undefined),
    staleTime: Infinity,
  });
  const unit = sheet.data?.heroes[0];
  if (!sheet.data || !unit) return null;
  return (
    <>
      <p>Rating: {sheet.data.summary.rating}</p>
      <UnitListBlocks kind={heroKind} unit={unit} warbandId={WARBAND} canEdit={canEdit} />
    </>
  );
}

const renderHero = (hero: WarbandHero, canEdit = true) => {
  const utils = renderWithQueryClient(
    <ShownWarbandProvider campaignId={7} warbandId={WARBAND}>
      <AppToaster />
      <CachedHero canEdit={canEdit} />
    </ShownWarbandProvider>,
    {}
  );
  utils.queryClient.setQueryData(sheetKey, sheetOf([hero]));
  return utils;
};

const heroInCache = (queryClient: ReturnType<typeof renderHero>["queryClient"]) =>
  queryClient.getQueryData<WarbandSheet>(sheetKey)?.heroes[0];

const switchOf = (name: string) => screen.findByRole("button", { name: new RegExp(`^${name}: `) });

beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.releasePointerCapture = vi.fn();
});

beforeEach(() => {
  toast.dismiss();
  fakeApi.reset();
});

describe("item rows: the companion switch", () => {
  it("puts a switch beside a mount's and a pet's menu, saying what it does; other items keep just the menu", async () => {
    renderHero(aldric);

    const ride = await switchOf("Warhorse");
    expect(ride).toHaveAccessibleName("Warhorse: Ride it");
    expect(ride).toHaveAttribute("title", "Ride it");
    expect(ride).toHaveAttribute("aria-pressed", "false");
    const pet = await switchOf("Raven");
    expect(pet).toHaveAccessibleName("Raven: Keep as pet");
    expect(screen.getByRole("button", { name: "Actions for Warhorse" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Actions for Sword" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Sword: / })).not.toBeInTheDocument();
  });

  it("switches a mount on in one request and writes the answer's unit and rating to the sheet", async () => {
    const user = setupUser();
    const riding = { ...aldric, items: [warhorse(1, true), raven(2), swordRow] };
    fakeApi.on(`POST /warbands/${WARBAND}/heroes/11/items/1/companion/`, {
      unit: { ...riding, mount: mountOf(1), effective_stats: { movement: 8, armour_save: 4 } },
      summary: { gold: 500, rating: 104 },
      warnings: [],
    });
    const { queryClient } = renderHero(aldric);

    await user.click(await switchOf("Warhorse"));

    await waitFor(() => expect(screen.getByText("Rating: 104")).toBeInTheDocument());
    expect(fakeApi.calls()).toEqual([`POST /warbands/${WARBAND}/heroes/11/items/1/companion/`]);
    expect(fakeApi.bodyOf(`POST /warbands/${WARBAND}/heroes/11/items/1/companion/`)).toEqual({
      on: true,
    });
    expect(heroInCache(queryClient)?.mount?.item_row_id).toBe(1);
    const off = await switchOf("Warhorse");
    expect(off).toHaveAccessibleName("Warhorse: Switch off");
    expect(off).toHaveAttribute("aria-pressed", "true");
  });

  it("splits a ridden copy from a spare one, and switching off names the ridden copy's row", async () => {
    const user = setupUser();
    const twoHorses = { ...aldric, items: [warhorse(1, true), warhorse(4)] };
    fakeApi.on(`POST /warbands/${WARBAND}/heroes/11/items/1/companion/`, {
      unit: { ...twoHorses, items: [warhorse(1), warhorse(4)], mount: null },
      summary: { gold: 500, rating: 99 },
      warnings: [],
    });
    renderHero(twoHorses);

    expect(await screen.findByRole("button", { name: "Warhorse: Switch off" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Warhorse: Ride it" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Warhorse: Switch off" }));

    await waitFor(() =>
      expect(fakeApi.bodyOf(`POST /warbands/${WARBAND}/heroes/11/items/1/companion/`)).toEqual({
        on: false,
      })
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "Warhorse x 2" })).toBeVisible());
  });

  it("shows the answer's warnings (warn, never block)", async () => {
    const user = setupUser();
    const twoHorses = { ...aldric, items: [warhorse(1, true), warhorse(4)] };
    const message = "Aldric the Bold has 2 mounts switched on; a rider rides one.";
    fakeApi.on(`POST /warbands/${WARBAND}/heroes/11/items/4/companion/`, {
      unit: { ...twoHorses, items: [warhorse(1, true), warhorse(4, true)] },
      summary: { gold: 500, rating: 104 },
      warnings: [{ code: "two_mounts", message, mounts: 2 }],
    });
    renderHero(twoHorses);

    await user.click(await screen.findByRole("button", { name: "Warhorse: Ride it" }));

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Warhorse x 2: Switch off" })).toBeVisible();
  });

  it("offers no switch to a member who can't manage the warband's items", async () => {
    renderHero(aldric, false);

    expect(await screen.findByRole("button", { name: "Warhorse" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Warhorse: / })).not.toBeInTheDocument();
  });
});

describe("item rows: a henchmen group's mounts", () => {
  function CachedGroup() {
    const sheet = useQuery<WarbandSheet>({
      queryKey: sheetKey,
      queryFn: () => new Promise<never>(() => undefined),
      staleTime: Infinity,
    });
    const unit = sheet.data?.henchmen_groups[0];
    if (!unit) return null;
    return <UnitListBlocks kind={henchmenKind} unit={unit} warbandId={WARBAND} canEdit />;
  }

  it("counts a split item's copies together against the members, and switches one copy on at a time", async () => {
    const user = setupUser();
    const riders = makeVeteranHenchmenGroup({
      items: [warhorse(7, true), warhorse(8, true), warhorse(9)],
    });
    fakeApi.on(`POST /warbands/${WARBAND}/henchmen-groups/21/items/9/companion/`, {
      unit: { ...riders, items: [warhorse(7, true), warhorse(8, true), warhorse(9, true)] },
      summary: { gold: 500, rating: 120 },
      warnings: [],
    });
    const utils = renderWithQueryClient(
      <ShownWarbandProvider campaignId={7} warbandId={WARBAND}>
        <AppToaster />
        <CachedGroup />
      </ShownWarbandProvider>,
      {}
    );
    utils.queryClient.setQueryData(sheetKey, sheetOf([], [riders]));
    await user.click(await screen.findByRole("button", { name: "Equipment" }));

    const ridden = screen.getByRole("button", { name: "Warhorse x 2" }).parentElement!;
    expect(ridden).not.toHaveClass("unit-list-entry--alert");
    await user.click(screen.getByRole("button", { name: "Warhorse: Ride it" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Warhorse x 3: Switch off" })).toBeVisible()
    );
    expect(fakeApi.calls()).toEqual([
      `POST /warbands/${WARBAND}/henchmen-groups/21/items/9/companion/`,
    ]);
  });
});
