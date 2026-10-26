/**
 * Buying a beast (the bestiary rewrite, step 4): a mount or pet bought for a unit can be switched
 * on straight away (`companion: true`, ticked by default), and a creature bought for the stash can
 * be recruited straight away into a group of the same beast or a new one (`recruit`), or kept as
 * items. An unsold beast says so and the server's warning shows. Buy again and roster edit mode
 * follow the same rules. The real dialog runs down to `apiRequest`, answered by a fake server.
 */
import { screen, waitFor, within } from "@testing-library/react";
import { useState, type ComponentProps } from "react";
import { useQuery, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import AcquireItemDialog from "./AcquireItemDialog";
import { ShownWarbandProvider } from "@/features/warbands/components/warband/shown-warband-context";
import { queryKeys } from "@/lib/query-keys";
import { AppToaster } from "@/components/ui/toaster";
import { TestDiceProvider } from "@/test/dice";
import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";
import { makeItem, makeVeteranHenchmenGroup, makeVeteranHero } from "@/test/warband-fixtures";

import type { Item } from "@/features/items/types/item-types";
import type { WarbandSheet } from "@/features/warbands/types/warband-sheet";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

vi.mock("@/stores/app-store", () => ({
  useAppStore: () => ({ warband: null, diceColor: "#2e8555" }),
}));

const PURCHASE = "POST /warbands/9/purchases/";
const sheetKey = queryKeys.campaign.warbandSheet(7, 9);
const hero = makeVeteranHero();
const thugs = makeVeteranHenchmenGroup();
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

const beast = (id: number, name: string, kind: "mount" | "pet" | "creature") => ({
  id,
  name,
  kind,
  has_profile: kind !== "pet",
  movement: 8,
  weapon_skill: 3,
  ballistic_skill: 0,
  strength: 3,
  toughness: 3,
  wounds: 1,
  initiative: 3,
  attacks: 1,
  leadership: 5,
  armour_save: null,
  specials: [],
});
const animal = (id: number, name: string, kind: "mount" | "pet" | "creature", cost: number) =>
  makeItem({
    id,
    name,
    type: "Animal",
    cost: null,
    listed: true,
    availabilities: [{ id: id * 10, cost, rarity: 2, restrictions: [] }],
    bestiary_entry: beast(kind === "creature" ? 3 : id, name, kind),
  });
const warhorse = animal(140, "Warhorse", "mount", 80);
const raven = animal(141, "Raven", "pet", 60);
const wardogs = animal(142, "Wardogs", "creature", 25);

/** The page's sheet: the warband merged with its summary (gold and unit rows). */
function SheetObserver() {
  useQuery({
    queryKey: sheetKey,
    queryFn: () => new Promise<never>(() => undefined),
    initialData: {
      warband: {
        id: 9,
        name: "The Black Wolves",
        faction: "Mercenaries",
        campaign_id: 7,
        user_id: 1,
        created_at: "",
        updated_at: "",
      },
      summary: {
        gold: 500,
        heroes: [{ id: 11, warband_id: 9, name: hero.name, unit_type: "Captain", xp: 7 }],
        hirelings: [],
        henchmen_groups: [{ id: 21, warband_id: 9, name: thugs.name, unit_type: "Thugs", xp: 4 }],
      },
      capabilities: {},
      heroes: [{ ...hero, items: [] }],
      henchmen_groups: [kennel],
      hirelings: [],
    } as unknown as WarbandSheet,
    staleTime: Infinity,
  });
  return null;
}

type DialogProps = Partial<ComponentProps<typeof AcquireItemDialog>> & { item: Item };

function OpenDialog({ onClosed, ...props }: DialogProps & { onClosed: () => void }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <AcquireItemDialog
      open
      trigger={null}
      onOpenChange={(next) => {
        if (!next) {
          setOpen(false);
          onClosed();
        }
      }}
      {...props}
    />
  );
}

const renderDialog = (props: DialogProps) => {
  const onClosed = vi.fn();
  const utils = renderWithQueryClient(
    <TestDiceProvider>
      <AppToaster />
      <ShownWarbandProvider campaignId={7} warbandId={9}>
        <SheetObserver />
        <OpenDialog onClosed={onClosed} {...props} />
      </ShownWarbandProvider>
    </TestDiceProvider>
  );
  return { ...utils, onClosed };
};

const buyButton = () => screen.getByRole("button", { name: /^(Buy|Give|Buying\.\.\.)$/ });
const clickBuy = async (user: ReturnType<typeof setupUser>) => {
  await waitFor(() => expect(buyButton()).toBeEnabled());
  await user.click(buyButton());
};

const answer = (overrides: Record<string, unknown>) => ({
  target_id: null,
  updated_at: null,
  items: null,
  mount: null,
  pets: [],
  effective_stats: null,
  group: null,
  stash_item: null,
  trade: null,
  summary: { gold: 420, rating: 104 },
  warnings: [],
  ...overrides,
});

const sheetOf = (queryClient: QueryClient) => queryClient.getQueryData<WarbandSheet>(sheetKey);

beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.releasePointerCapture = vi.fn();
});

beforeEach(() => {
  toast.dismiss();
  fakeApi.reset();
  fakeApi.on("GET /warbands/9/henchmen-groups/", [thugs, kennel]);
  fakeApi.on("GET /warbands/9/heroes/", [{ ...hero, items: undefined }]);
});

describe("buying a mount or a pet for a unit", () => {
  it("switches a mount on straight away (ticked by default) and keeps the answer's mount", async () => {
    const user = setupUser();
    const mount = { item_row_id: 5, item_id: 140, name: "Warhorse", movement: 8, rating_bonus: 5 };
    fakeApi.on(
      PURCHASE,
      answer({
        target_type: "hero",
        target_id: 11,
        items: [{ ...warhorse, row_id: 5, companion: true, beast_kind: "mount", cost: 80 }],
        mount: { ...mount, has_profile: true, stats: null },
        effective_stats: { movement: 8, armour_save: 4 },
      })
    );
    const { queryClient } = renderDialog({
      item: warhorse,
      presetUnitType: "heroes",
      presetUnitId: 11,
      disableUnitSelection: true,
    });

    const rides = await screen.findByRole("checkbox", {
      name: "Aldric the Bold rides it straight away",
    });
    expect(rides).toBeChecked();
    await clickBuy(user);

    await waitFor(() => expect(fakeApi.countOf(PURCHASE)).toBe(1));
    expect(fakeApi.bodyOf(PURCHASE)).toEqual({
      item_id: 140,
      quantity: 1,
      price: 80,
      availability_id: 1400,
      is_buying: true,
      companion: true,
      target_type: "hero",
      target_id: 11,
    });
    await waitFor(() => expect(sheetOf(queryClient)?.heroes[0].mount?.item_row_id).toBe(5));
    expect(sheetOf(queryClient)?.heroes[0].effective_stats).toEqual({
      movement: 8,
      armour_save: 4,
    });
  });

  it("sends no companion when unticked, and words a pet's box for keeping it", async () => {
    const user = setupUser();
    fakeApi.on(PURCHASE, answer({ target_type: "hero", target_id: 11, items: [] }));
    renderDialog({ item: raven, presetUnitType: "heroes", presetUnitId: 11 });

    const keep = await screen.findByRole("checkbox", { name: "Keep as Aldric the Bold's pet" });
    await user.click(keep);
    await clickBuy(user);

    await waitFor(() => expect(fakeApi.countOf(PURCHASE)).toBe(1));
    expect(fakeApi.bodyOf(PURCHASE)).not.toHaveProperty("companion");
  });

  it("offers nothing extra for a mount bought for the stash", async () => {
    renderDialog({ item: warhorse, presetUnitType: "stash" });

    await waitFor(() => expect(buyButton()).toBeEnabled());
    expect(screen.queryByRole("checkbox", { name: /straight away/ })).not.toBeInTheDocument();
  });

  it("buys again for the unit holding it with the same box, at the current price", async () => {
    const user = setupUser();
    fakeApi.on(PURCHASE, answer({ target_type: "hero", target_id: 11, items: [] }));
    renderDialog({
      item: warhorse,
      variant: "buy-again",
      presetUnitType: "heroes",
      presetUnitId: 11,
      disableUnitSelection: true,
    });

    await screen.findByRole("checkbox", { name: "Aldric the Bold rides it straight away" });
    await clickBuy(user);

    await waitFor(() => expect(fakeApi.countOf(PURCHASE)).toBe(1));
    expect(fakeApi.bodyOf(PURCHASE)).toEqual({
      item_id: 140,
      quantity: 1,
      is_buying: true,
      companion: true,
      target_type: "hero",
      target_id: 11,
    });
  });

  it("queues the switch with the purchase in roster edit mode", async () => {
    const user = setupUser();
    const onPendingPurchaseAdd = vi.fn();
    renderDialog({
      item: warhorse,
      presetUnitType: "heroes",
      presetUnitId: 11,
      disableUnitSelection: true,
      variant: "unit-edit",
      deferCommit: true,
      onPendingPurchaseAdd,
      pendingPurchaseUnitId: 11,
    });

    await screen.findByRole("checkbox", { name: "Aldric the Bold rides it straight away" });
    await clickBuy(user);

    await waitFor(() => expect(onPendingPurchaseAdd).toHaveBeenCalledTimes(1));
    expect(onPendingPurchaseAdd.mock.calls[0][0].line).toEqual({
      item_id: 140,
      quantity: 1,
      price: 80,
      availability_id: 1400,
      is_buying: true,
      companion: true,
    });
    expect(fakeApi.countOf(PURCHASE)).toBe(0);
  });
});

describe("buying a creature for the stash", () => {
  it("recruits it straight away into a group of the same beast, chosen first", async () => {
    const user = setupUser();
    const joined = { ...kennel, henchmen: [member(71), member(72), member(73)] };
    fakeApi.on(PURCHASE, answer({ target_type: "stash", group: joined }));
    const { queryClient } = renderDialog({ item: wardogs, presetUnitType: "stash" });

    const join = await screen.findByRole("radio", { name: /Join Kennel/ });
    expect(join).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByRole("radio", { name: /Black Knives/ })).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /New group/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Keep as items/ })).toBeInTheDocument();
    await clickBuy(user);

    await waitFor(() => expect(fakeApi.countOf(PURCHASE)).toBe(1));
    expect(fakeApi.bodyOf(PURCHASE)).toMatchObject({
      target_type: "stash",
      recruit: { group_id: 25 },
    });
    await waitFor(() =>
      expect(sheetOf(queryClient)?.henchmen_groups.find((g) => g.id === 25)?.henchmen).toHaveLength(
        3
      )
    );
  });

  it("forms a new named group, or keeps the copies as items", async () => {
    const user = setupUser();
    fakeApi.on(PURCHASE, answer({ target_type: "stash", group: { ...kennel, id: 27 } }));
    const first = renderDialog({ item: wardogs, presetUnitType: "stash" });

    await user.click(await screen.findByRole("radio", { name: /New group/ }));
    await user.type(screen.getByRole("textbox", { name: "Group name" }), "Pack");
    await clickBuy(user);
    await waitFor(() => expect(fakeApi.countOf(PURCHASE)).toBe(1));
    expect(fakeApi.bodyOf(PURCHASE)).toMatchObject({ recruit: { new: { name: "Pack" } } });
    first.unmount();

    fakeApi.on(
      PURCHASE,
      answer({ target_type: "stash", stash_item: { id: 142, name: "Wardogs" } })
    );
    renderDialog({ item: wardogs, presetUnitType: "stash" });
    await user.click(await screen.findByRole("radio", { name: /Keep as items/ }));
    await clickBuy(user);
    await waitFor(() => expect(fakeApi.countOf(PURCHASE)).toBe(2));
    expect(fakeApi.bodyOf(PURCHASE)).not.toHaveProperty("recruit");
  });

  it("offers no recruit for a creature bought for a unit", async () => {
    renderDialog({ item: wardogs, presetUnitType: "heroes", presetUnitId: 11 });

    await waitFor(() => expect(buyButton()).toBeEnabled());
    expect(screen.queryByRole("radio", { name: /Keep as items/ })).not.toBeInTheDocument();
  });
});

describe("an unsold beast", () => {
  it("says it isn't sold, and shows the server's warning once bought", async () => {
    const user = setupUser();
    const message = "Wild Dog isn't sold in this campaign's shop; it was bought anyway.";
    fakeApi.on(
      PURCHASE,
      answer({
        target_type: "stash",
        stash_item: { id: 143, name: "Wild Dog" },
        warnings: [{ code: "unlisted_beast", message, item_id: 143 }],
      })
    );
    const wildDog = {
      ...animal(143, "Wild Dog", "creature", 10),
      listed: false,
      bestiary_entry: beast(9, "Wild Dog", "creature"),
    };
    renderDialog({ item: wildDog, presetUnitType: "stash" });

    expect(
      await screen.findByText("Wild Dog isn't sold in this campaign's shop; you can still buy it.")
    ).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /Keep as items/ }));
    await clickBuy(user);

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(within(document.body).queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("buys again at the price shown when it has no current price (no availability)", async () => {
    // Was: Buy again sent no price, and the server, with none to charge, refused it (400).
    const user = setupUser();
    fakeApi.on(PURCHASE, answer({ target_type: "hero", target_id: 11, items: [] }));
    const wildDog = {
      ...animal(143, "Wild Dog", "creature", 10),
      listed: false,
      availabilities: [],
      bestiary_entry: beast(9, "Wild Dog", "creature"),
    };
    renderDialog({
      item: wildDog,
      variant: "buy-again",
      currentPrice: null,
      presetUnitType: "heroes",
      presetUnitId: 11,
      disableUnitSelection: true,
    });

    await clickBuy(user);

    await waitFor(() => expect(fakeApi.countOf(PURCHASE)).toBe(1));
    expect(fakeApi.bodyOf(PURCHASE)).toEqual({
      item_id: 143,
      quantity: 1,
      price: 0,
      availability_id: null,
      is_buying: true,
      target_type: "hero",
      target_id: 11,
    });
  });
});
