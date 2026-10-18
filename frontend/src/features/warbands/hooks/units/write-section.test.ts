/**
 * Characterisation of a section Save's writes (`writeSection`) before pass 2 moves purchases
 * into the batch: the warband header, then one batch, then the follow-up steps (the kind's stash
 * removals, then the purchases' trades and logs), asserted as the requests the server sees.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { writeSection, type SectionWrite } from "./write-section";
import { heroKind, mapHeroToForm } from "@/features/warbands/units/kinds/hero";
import { henchmenKind, mapHenchmenGroupToForm } from "@/features/warbands/units/kinds/henchmen";
import { describeFollowUps, runFollowUps } from "@/features/warbands/utils/follow-ups";
import { fakeApi } from "@/test/fake-api";
import { makeItem, makeVeteranHenchmenGroup, makeVeteranHero } from "@/test/warband-fixtures";

import type { PendingPurchase } from "@/features/warbands/utils/pending-purchases";
import type { Warband } from "@/features/warbands/types/warband-types";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

const warband: Warband = {
  id: 9,
  name: "The Black Wolves",
  faction: "Mercenaries",
  campaign_id: 1,
  user_id: 7,
  created_at: "",
  updated_at: "",
};

const hero = makeVeteranHero();
const group = makeVeteranHenchmenGroup();
const rope = makeItem({ id: 120, name: "Rope", cost: 5 });

const purchase = (overrides: Partial<PendingPurchase> = {}): PendingPurchase => ({
  unitType: "heroes",
  unitId: "11",
  itemId: 120,
  itemName: "Rope",
  quantity: 1,
  unitPrice: 5,
  isBuying: true,
  ...overrides,
});

/** A hero Save: Aldric renamed with the Rope he bought on his form, and a queued recruit. */
const heroSave = (overrides: Partial<SectionWrite<"hero">> = {}): SectionWrite<"hero"> => {
  const aldric = { ...mapHeroToForm(hero), name: "Aldric", items: [...hero.items, rope] };
  const recruit = {
    ...mapHeroToForm(makeVeteranHero({ is_leader: false, items: [] })),
    id: undefined,
    draftKey: "draft-heroes-7",
    name: "Otto",
  };
  return {
    warbandId: 9,
    forms: [aldric, recruit],
    createForms: [recruit],
    updateForms: [aldric],
    dismissIds: [],
    purchases: [
      purchase(),
      purchase({ unitId: "draft-heroes-7", itemId: 102, itemName: "Dagger", unitPrice: 2 }),
    ],
    header: { warband, name: "The Grey Wolves", faction: "Mercenaries" },
    ...overrides,
  };
};

/** A henchmen Save: Blade Four joins Black Knives with a Club from the stash; a Rope is bought. */
const henchmenSave = (): SectionWrite<"henchmen_group"> => {
  const form = mapHenchmenGroupToForm(group);
  const withRecruit = {
    ...form,
    items: [...form.items, rope],
    henchmen: [
      ...form.henchmen,
      {
        id: 0,
        name: "Blade Four",
        kills: 0,
        dead: false,
        cost: 25,
        itemChoices: [{ itemId: 104, action: "stash" as const }],
      },
    ],
  };
  return {
    warbandId: 9,
    forms: [withRecruit],
    createForms: [],
    updateForms: [withRecruit],
    dismissIds: [],
    purchases: [purchase({ unitType: "henchmen", unitId: "21" })],
  };
};

beforeEach(() => {
  fakeApi.reset();
  fakeApi.on("PATCH /warbands/9/", (body: unknown) => ({ ...warband, ...(body as object) }));
  fakeApi.on("POST /warbands/9/heroes/batch/", { units: [hero], summary: { gold: 120 } });
  fakeApi.on("POST /warbands/9/henchmen-groups/batch/", { units: [group], summary: { gold: 95 } });
  fakeApi.on("DELETE /warbands/9/items/104/", undefined);
  let nextTradeId = 500;
  fakeApi.on("POST /warbands/9/trades/", () => ({ id: (nextTradeId += 1) }));
  fakeApi.on("POST /warbands/9/logs/", { id: 800 });
});

describe("writeSection: order of a Save's requests", () => {
  it("PATCHes the warband header, sends one batch, and leaves the purchases as steps for later", async () => {
    const result = await writeSection(heroKind, heroSave());

    expect(fakeApi.calls()).toEqual(["PATCH /warbands/9/", "POST /warbands/9/heroes/batch/"]);
    expect(fakeApi.bodyOf("PATCH /warbands/9/")).toEqual({
      name: "The Grey Wolves",
      faction: "Mercenaries",
    });
    expect(result.summary).toEqual({ gold: 120 });
    expect(result.updatedWarband).toMatchObject({ name: "The Grey Wolves" });
    expect(describeFollowUps(result.followUps)).toBe(
      'the trade record "Equipped Aldric and Otto (2 items, 7 gc)", buying Rope (5 gc), ' +
        "the loadout log for Rope (Aldric), buying Dagger (2 gc), the loadout log for Dagger (Otto)"
    );
  });

  it("runs the purchase steps one request at a time, each trade under the group header", async () => {
    const result = await writeSection(heroKind, heroSave());
    fakeApi.clearRequests();

    await runFollowUps(result.followUps);

    expect(fakeApi.requests()).toEqual([
      {
        method: "POST",
        path: "/warbands/9/trades/",
        body: {
          action: "Group",
          description: "Equipped Aldric and Otto (2 items, 7 gc)",
          price: 0,
        },
      },
      {
        method: "POST",
        path: "/warbands/9/trades/",
        body: { action: "Bought", description: "Rope", price: 5, parent_id: 501 },
      },
      {
        method: "POST",
        path: "/warbands/9/logs/",
        body: {
          feature: "loadout",
          entry_type: "hero_item",
          payload: { hero: "Aldric", item: "Rope", price: 5 },
        },
      },
      {
        method: "POST",
        path: "/warbands/9/trades/",
        body: { action: "Bought", description: "Dagger", price: 2, parent_id: 501 },
      },
      {
        method: "POST",
        path: "/warbands/9/logs/",
        body: {
          feature: "loadout",
          entry_type: "hero_item",
          payload: { hero: "Otto", item: "Dagger", price: 2 },
        },
      },
    ]);
  });

  it("saves the bought copy inside the batch and charges for it only in a later step (BUG-07, pinned; flips in PR C)", async () => {
    fakeApi.fail("POST /warbands/9/trades/", new Error("Server error"));
    const result = await writeSection(
      heroKind,
      heroSave({ createForms: [], purchases: [purchase()], header: undefined })
    );

    const update = (
      fakeApi.bodyOf("POST /warbands/9/heroes/batch/") as {
        update: { id: number; items: { id: number }[] }[];
      }
    ).update[0];
    expect(update.id).toBe(11);
    expect(update.items.map((item) => item.id)).toEqual([101, 102, 102, 103, 120]);

    const outcome = await runFollowUps(result.followUps);

    // The Rope is on the hero; its trade and log are still to do.
    expect(outcome.error).toEqual(new Error("Server error"));
    expect(describeFollowUps(outcome.remaining)).toBe(
      "buying Rope (5 gc), the loadout log for Rope (Aldric)"
    );
    expect(fakeApi.countOf("POST /warbands/9/logs/")).toBe(0);
  });

  it("names a purchase whose unit has no form after the kind (Unknown Hero)", async () => {
    const result = await writeSection(
      heroKind,
      heroSave({ purchases: [purchase({ unitId: "99" })], header: undefined })
    );

    expect(describeFollowUps(result.followUps)).toBe(
      "buying Rope (5 gc), the loadout log for Rope (Unknown Hero)"
    );
  });

  it("sends no batch when no unit changed, but still returns the purchase steps", async () => {
    const result = await writeSection(heroKind, {
      warbandId: 9,
      forms: [mapHeroToForm(hero)],
      createForms: [],
      updateForms: [],
      dismissIds: [],
      purchases: [purchase({ isBuying: false, reason: "Found it" })],
    });

    expect(fakeApi.calls()).toEqual([]);
    expect(result.units).toBeNull();
    expect(result.summary).toBeNull();
    expect(describeFollowUps(result.followUps)).toBe("the loadout log for Rope (Aldric the Bold)");
  });
});

describe("writeSection: a failure midway", () => {
  it("sends no batch when the header PATCH fails", async () => {
    fakeApi.fail("PATCH /warbands/9/", new Error("Name taken"));

    await expect(writeSection(heroKind, heroSave())).rejects.toThrow("Name taken");

    expect(fakeApi.calls()).toEqual(["PATCH /warbands/9/"]);
  });

  it("sends nothing after a refused batch: no stash removal, trade or log", async () => {
    fakeApi.fail("POST /warbands/9/henchmen-groups/batch/", new Error("Group not found"));

    await expect(writeSection(henchmenKind, henchmenSave())).rejects.toThrow("Group not found");

    expect(fakeApi.calls()).toEqual(["POST /warbands/9/henchmen-groups/batch/"]);
  });

  it("takes stash items out before the purchases, one request each", async () => {
    const result = await writeSection(henchmenKind, henchmenSave());
    fakeApi.clearRequests();

    await runFollowUps(result.followUps);

    expect(fakeApi.calls()).toEqual([
      "DELETE /warbands/9/items/104/",
      "POST /warbands/9/trades/",
      "POST /warbands/9/logs/",
    ]);
    expect(fakeApi.bodyOf("DELETE /warbands/9/items/104/")).toEqual({ quantity: 1 });
    expect(fakeApi.bodyOf("POST /warbands/9/logs/")).toMatchObject({
      entry_type: "henchmen_item",
      payload: { hero: "Black Knives", item: "Rope", price: 5 },
    });
  });

  it("holds back the purchases while a stash removal fails (BUG-108)", async () => {
    fakeApi.fail("DELETE /warbands/9/items/104/", new Error("Server error"));
    const result = await writeSection(henchmenKind, henchmenSave());
    fakeApi.clearRequests();

    const outcome = await runFollowUps(result.followUps);

    expect(fakeApi.calls()).toEqual(["DELETE /warbands/9/items/104/"]);
    expect(describeFollowUps(outcome.remaining)).toBe(
      "taking Club x 1 from the stash, buying Rope (5 gc), the loadout log for Rope (Black Knives)"
    );
  });
});
