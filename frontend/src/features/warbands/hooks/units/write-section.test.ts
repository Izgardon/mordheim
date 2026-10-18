/**
 * A section Save's writes (`writeSection`): the warband header, then one batch that carries the
 * roster changes, the queued purchases and the stash takes (decision 1, BUG-07, BUG-108),
 * asserted as the requests the server sees.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { writeSection, type SectionWrite } from "./write-section";
import { heroKind, mapHeroToForm } from "@/features/warbands/units/kinds/hero";
import { henchmenKind, mapHenchmenGroupToForm } from "@/features/warbands/units/kinds/henchmen";
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
const dagger = makeItem({ id: 102, name: "Dagger", cost: 2 });

/** A queued purchase as the acquire dialog builds it (one Rope for Aldric, 5 gc). */
const purchase = (overrides: Partial<PendingPurchase> = {}): PendingPurchase => {
  const entry = {
    unitType: "heroes" as const,
    unitId: "11",
    itemId: 120,
    itemName: "Rope",
    quantity: 1,
    unitPrice: 5,
    isBuying: true,
    ...overrides,
  };
  return {
    ...entry,
    line: overrides.line ?? {
      item_id: entry.itemId,
      quantity: entry.quantity,
      price: entry.unitPrice,
      availability_id: null,
      is_buying: entry.isBuying,
    },
  };
};

type BatchBody = {
  create?: { items: { id: number }[] }[];
  update?: { id: number; items: { id: number }[]; updated_at?: string }[];
  purchases?: Record<string, unknown>[];
  stash_takes?: Record<string, unknown>[];
};
const heroBatch = () => fakeApi.bodyOf("POST /warbands/9/heroes/batch/") as BatchBody;
const itemIds = (items: { id: number }[] = []) => items.map((item) => item.id);

/** A hero Save: Aldric renamed with the Rope he bought on his form; Otto queued with a Dagger. */
const heroSave = (overrides: Partial<SectionWrite<"hero">> = {}): SectionWrite<"hero"> => {
  const aldric = { ...mapHeroToForm(hero), name: "Aldric", items: [...hero.items, rope] };
  const recruit = {
    ...mapHeroToForm(makeVeteranHero({ is_leader: false, items: [] })),
    id: undefined,
    draftKey: "draft-heroes-7",
    name: "Otto",
    items: [dagger],
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
});

describe("writeSection: one batch for the whole Save (decision 1)", () => {
  it("PATCHes the warband header, then sends one batch with the purchases in it", async () => {
    const result = await writeSection(heroKind, heroSave());

    expect(fakeApi.calls()).toEqual(["PATCH /warbands/9/", "POST /warbands/9/heroes/batch/"]);
    expect(fakeApi.bodyOf("PATCH /warbands/9/")).toEqual({
      name: "The Grey Wolves",
      faction: "Mercenaries",
    });
    expect(heroBatch().purchases).toEqual([
      { unit_id: 11, item_id: 120, quantity: 1, price: 5, availability_id: null, is_buying: true },
      {
        create_index: 0,
        item_id: 102,
        quantity: 1,
        price: 2,
        availability_id: null,
        is_buying: true,
      },
    ]);
    expect(result).toMatchObject({ summary: { gold: 120 }, warnings: [], movedItems: true });
    expect(result.updatedWarband).toMatchObject({ name: "The Grey Wolves" });
  });

  it("sends the bought copy as a purchase, not in the hero's items, with no trade or log after (BUG-07)", async () => {
    await writeSection(heroKind, heroSave({ createForms: [], header: undefined }));

    const body = heroBatch();
    expect(body.update?.[0].id).toBe(11);
    // The server appends the Rope when it charges for it, in the same transaction.
    expect(itemIds(body.update?.[0].items)).toEqual([101, 102, 102, 103]);
    expect(body.purchases?.[0]).toMatchObject({ unit_id: 11, item_id: 120, price: 5 });
    expect(fakeApi.calls()).toEqual(["POST /warbands/9/heroes/batch/"]);
  });

  it("leaves a queued recruit's bought copy out of his create body too", async () => {
    await writeSection(heroKind, heroSave({ header: undefined }));

    expect(itemIds(heroBatch().create?.[0].items)).toEqual([]);
  });

  it("takes out only the bought copies: daggers the hero already had stay", async () => {
    const aldric = { ...mapHeroToForm(hero), items: [...hero.items, dagger, dagger] };
    await writeSection(heroKind, {
      warbandId: 9,
      forms: [aldric],
      createForms: [],
      updateForms: [aldric],
      dismissIds: [],
      purchases: [purchase({ itemId: 102, itemName: "Dagger", quantity: 2, unitPrice: 2 })],
    });

    expect(itemIds(heroBatch().update?.[0].items)).toEqual([101, 102, 102, 103]);
    expect(heroBatch().purchases).toEqual([expect.objectContaining({ item_id: 102, quantity: 2 })]);
  });

  it("sends the queued quantity, after a copy was taken off the form", async () => {
    const line = { item_id: 120, quantity: 3, price: 5, availability_id: 7, is_buying: true };
    await writeSection(
      heroKind,
      heroSave({ createForms: [], header: undefined, purchases: [purchase({ quantity: 2, line })] })
    );

    expect(heroBatch().purchases).toEqual([
      { unit_id: 11, item_id: 120, quantity: 2, price: 5, availability_id: 7, is_buying: true },
    ]);
  });

  it("sends each updated unit's version from when the edit began, so a unit changed since is refused", async () => {
    await writeSection(
      heroKind,
      heroSave({ header: undefined, versions: new Map([[11, "2026-10-18T09:41:02.123456Z"]]) })
    );

    expect(heroBatch().update?.[0]).toMatchObject({
      id: 11,
      updated_at: "2026-10-18T09:41:02.123456Z",
    });
    expect(heroBatch().create?.[0]).not.toHaveProperty("updated_at");
  });

  it("sends a gift alone as a batch with only the purchase", async () => {
    await writeSection(heroKind, {
      warbandId: 9,
      forms: [mapHeroToForm(hero)],
      createForms: [],
      updateForms: [],
      dismissIds: [],
      purchases: [purchase({ isBuying: false, reason: "Found it" })],
    });

    expect(Object.keys(heroBatch())).toEqual(["purchases"]);
  });

  it("sends no batch when nothing changed", async () => {
    const result = await writeSection(heroKind, {
      warbandId: 9,
      forms: [mapHeroToForm(hero)],
      createForms: [],
      updateForms: [],
      dismissIds: [],
      purchases: [],
    });

    expect(fakeApi.calls()).toEqual([]);
    expect(result).toMatchObject({ units: null, summary: null, movedItems: false });
  });

  it("hands back the batch's warnings", async () => {
    const warning = { code: "gold_negative", message: "The warband is at -3 gc.", gold: -3 };
    fakeApi.on("POST /warbands/9/heroes/batch/", {
      units: [hero],
      summary: { gold: -3 },
      warnings: [warning],
    });

    const result = await writeSection(heroKind, heroSave({ header: undefined }));

    expect(result.warnings).toEqual([warning]);
  });
});

describe("writeSection: henchmen stash picks (BUG-108)", () => {
  it("takes the stash picks in the batch, with no DELETE after it", async () => {
    const result = await writeSection(henchmenKind, henchmenSave());

    expect(fakeApi.calls()).toEqual(["POST /warbands/9/henchmen-groups/batch/"]);
    const body = fakeApi.bodyOf("POST /warbands/9/henchmen-groups/batch/") as BatchBody;
    expect(body.stash_takes).toEqual([{ unit_id: 21, item_id: 104, quantity: 1 }]);
    expect(body.purchases).toEqual([expect.objectContaining({ unit_id: 21, item_id: 120 })]);
    // Neither the Club from the stash nor the bought Rope is in the list: the server adds both.
    expect(itemIds(body.update?.[0].items)).toEqual([104, 104, 104, 102, 102, 102]);
    expect(result.movedItems).toBe(true);
  });
});

describe("writeSection: a failure", () => {
  it("sends no batch when the header PATCH fails", async () => {
    fakeApi.fail("PATCH /warbands/9/", new Error("Name taken"));

    await expect(writeSection(heroKind, heroSave())).rejects.toThrow("Name taken");

    expect(fakeApi.calls()).toEqual(["PATCH /warbands/9/"]);
  });

  it("sends nothing after a refused batch", async () => {
    fakeApi.fail("POST /warbands/9/henchmen-groups/batch/", new Error("Group not found"));

    await expect(writeSection(henchmenKind, henchmenSave())).rejects.toThrow("Group not found");

    expect(fakeApi.calls()).toEqual(["POST /warbands/9/henchmen-groups/batch/"]);
  });
});
