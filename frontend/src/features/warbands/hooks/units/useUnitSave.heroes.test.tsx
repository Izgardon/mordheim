import { act, renderHook as renderBareHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useUnitSave, type UseUnitSaveParams } from "./useUnitSave";
import { mapHeroToForm } from "@/features/warbands/units/kinds/hero";

import type { PendingPurchase } from "@/features/warbands/utils/pending-purchases";
import type {
  HeroFormEntry,
  NewHeroForm,
  Warband,
  WarbandHero,
  WarbandUpdatePayload,
} from "@/features/warbands/types/warband-types";
import { heroKind } from "@/features/warbands/units/kinds/hero";
import { makeVeteranHero } from "@/test/warband-fixtures";
import { createQueryWrapper } from "@/test/query-test-utils";
import {
  answerBatch,
  batchCreates,
  batchDismissals,
  batchUpdate,
  batchUpdates,
} from "@/test/batch-mock";
import { ApiError } from "@/lib/api-client";

/** Save runs as a mutation, so the hook needs a QueryClient. */
const renderHook = <R,>(hook: () => R) => renderBareHook(hook, { wrapper: createQueryWrapper() });

const api = vi.hoisted(() => ({
  batchWarbandHeroes: vi.fn(),
  getWarbandSummary: vi.fn(),
  updateWarband: vi.fn(),
  createWarbandTrade: vi.fn(),
  createWarbandLog: vi.fn(),
}));

vi.mock("@/features/warbands/api/warbands-api", () => api);
vi.mock("@/features/warbands/api/warband-cache", async (importOriginal) => {
  const updateWarbandCache = vi.fn();
  return {
    ...(await importOriginal<typeof import("@/features/warbands/api/warband-cache")>()),
    useWarbandCacheUpdate: () => updateWarbandCache,
  };
});
vi.mock("@/features/warbands/units/unit-api", async () =>
  (await import("@/test/unit-api-mock")).unitApiModuleMock(api)
);

const warband: Warband = {
  id: 9,
  name: "The Black Wolves",
  faction: "Mercenaries",
  campaign_id: 1,
  user_id: 7,
  created_at: "",
  updated_at: "",
};

const emptyNewHero: NewHeroForm = {
  name: "",
  unit_type: "",
  race_id: null,
  race_name: "",
  price: "0",
  xp: "0",
  is_leader: false,
};

const leader = makeVeteranHero();
const champion = makeVeteranHero({
  id: 12,
  name: "Gunther",
  unit_type: "Champion",
  is_leader: false,
  caster: "No",
  spells: [],
  items: [],
});

/** The hero save's inputs as the tests name them; `heroParams` maps them onto useUnitSave. */
type SaveParams = {
  warband: Warband;
  canEdit: boolean;
  warbandForm: WarbandUpdatePayload;
  heroes: WarbandHero[];
  heroForms: HeroFormEntry[];
  removedHeroIds: number[];
  isAddingHeroForm: boolean;
  newHeroForm: NewHeroForm;
  raceQuery: string;
  originalHeroFormsRef: { current: Map<number, string> };
  onSuccess: (updatedWarband: Warband, refreshedHeroes: WarbandHero[]) => void;
  pendingPurchases?: PendingPurchase[];
  onPendingCleared?: () => void;
};

const heroParams = (params: SaveParams): UseUnitSaveParams<"hero"> => ({
  warbandId: params.warband.id,
  canEdit: params.canEdit,
  units: params.heroes,
  forms: params.heroForms,
  removedIds: params.removedHeroIds,
  isAdding: params.isAddingHeroForm,
  newForm: params.newHeroForm,
  raceQuery: params.raceQuery,
  originalFormsRef: params.originalHeroFormsRef,
  warbandHeader: { warband: params.warband, form: params.warbandForm },
  onSuccess: (heroes, updatedWarband) => params.onSuccess(updatedWarband as Warband, heroes),
  pendingPurchases: params.pendingPurchases,
  onPendingCleared: params.onPendingCleared,
});

const snapshotOf = (forms: HeroFormEntry[]) =>
  new Map(forms.filter((form) => form.id).map((form) => [form.id as number, JSON.stringify(form)]));

const renderSave = (overrides: Partial<SaveParams> = {}) => {
  const heroes: WarbandHero[] = overrides.heroes ?? [leader, champion];
  const initialForms = heroes.map(mapHeroToForm);
  const params: SaveParams = {
    warband,
    canEdit: true,
    warbandForm: { name: warband.name, faction: warband.faction },
    heroes,
    heroForms: initialForms,
    removedHeroIds: [],
    isAddingHeroForm: false,
    newHeroForm: emptyNewHero,
    raceQuery: "",
    originalHeroFormsRef: { current: snapshotOf(initialForms) },
    onSuccess: vi.fn(),
    pendingPurchases: [],
    onPendingCleared: vi.fn(),
    ...overrides,
  };
  const hook = renderHook(() => useUnitSave(heroKind, heroParams(params)));
  const save = () =>
    act(async () => {
      await hook.result.current.handleSaveChanges();
    });
  return { ...hook, params, save };
};

/** The update entry for the veteran hero, as `mapHeroToForm → save` builds it. */
const veteranPatchBody = {
  name: "Aldric the Bold",
  unit_type: "Captain",
  race: 1,
  price: 60,
  xp: 7,
  deeds: "Slew the Possessed at the well.",
  is_leader: true,
  trading_action: true,
  armour_save: 5,
  large: false,
  caster: "Wizard",
  half_rate: false,
  available_skills: ["Combat", "Academic"],
  movement: 4,
  weapon_skill: 4,
  ballistic_skill: 4,
  strength: 3,
  toughness: 3,
  wounds: 1,
  initiative: 4,
  attacks: 1,
  leadership: 8,
  items: [
    { id: 101, cost: 10 },
    { id: 102, cost: 2 },
    { id: 102, cost: 2 },
    { id: 103, cost: 20 },
  ],
  skill_ids: [201],
  special_ids: [401],
  spell_ids: [301],
};

describe("useUnitSave: heroes (ROST-TEST-15)", () => {
  const batch = api.batchWarbandHeroes;

  beforeEach(() => {
    vi.clearAllMocks();
    batch.mockImplementation(answerBatch([leader, champion], { gold: 120, rating: 99 }));
    api.getWarbandSummary.mockResolvedValue({ gold: 110, rating: 99 });
    api.createWarbandTrade.mockResolvedValue({ id: 700 });
    api.createWarbandLog.mockResolvedValue({});
  });

  it("sends only the heroes whose form changed, each with the full mapped hero, in one batch", async () => {
    const forms = [leader, champion].map(mapHeroToForm);
    const { save } = renderSave({
      heroForms: [{ ...forms[0], deeds: "Slew the Possessed at the well." }, { ...forms[1] }],
      originalHeroFormsRef: {
        current: snapshotOf([{ ...forms[0], deeds: "old deeds" }, forms[1]]),
      },
    });

    await save();

    expect(batch).toHaveBeenCalledTimes(1);
    expect(batch).toHaveBeenCalledWith(9, { update: [{ id: 11, ...veteranPatchBody }] });
  });

  it("round-trips an untouched hero to the same values it was loaded with", async () => {
    const forms = [leader].map(mapHeroToForm);
    const { save } = renderSave({
      heroes: [leader],
      heroForms: forms,
      originalHeroFormsRef: { current: new Map() },
    });

    await save();

    expect(batchUpdate(batch, 11)).toEqual(veteranPatchBody);
  });

  it("dismisses heroes in the batch and hands back the server's roster and summary", async () => {
    const forms = [leader].map(mapHeroToForm);
    const { save, params } = renderSave({
      heroForms: forms,
      removedHeroIds: [12],
    });

    await save();

    expect(batch).toHaveBeenCalledWith(9, { dismiss: [12] });
    expect(api.getWarbandSummary).not.toHaveBeenCalled();
    expect(params.onSuccess).toHaveBeenCalledWith({ ...warband, gold: 120, rating: 99 }, [leader]);
  });

  it("queues recruits until Save, then creates them in the same batch with level_up 0 (decision 1, BUG-65)", async () => {
    const recruit = {
      ...mapHeroToForm(makeVeteranHero({ is_leader: false, xp: 5 })),
      id: undefined,
      draftKey: "draft-heroes-1",
      name: "Recruit",
    };
    const forms = [mapHeroToForm(leader), recruit];
    batch.mockImplementation(answerBatch([leader], { gold: 120, rating: 99 }));
    const { save, params } = renderSave({ heroes: [leader], heroForms: forms });

    await save();

    expect(batchUpdates(batch)).toEqual([]);
    expect(batchCreates(batch)).toEqual([
      expect.objectContaining({ name: "Recruit", xp: 5, level_up: 0, price: 60 }),
    ]);
    expect(params.onSuccess).toHaveBeenCalledWith({ ...warband, gold: 120, rating: 99 }, [
      leader,
      expect.objectContaining({ id: 900, name: "Recruit" }),
    ]);
  });

  it("commits pending purchases after the batch, recruits' included, then GETs the summary", async () => {
    const order: string[] = [];
    batch.mockImplementation(async (...args: Parameters<ReturnType<typeof answerBatch>>) => {
      order.push("POST batch");
      return answerBatch([leader])(...args);
    });
    api.createWarbandTrade.mockImplementation(async (_w: number, body: { description: string }) => {
      order.push(`POST trade ${body.description}`);
      return { id: 700 };
    });
    api.createWarbandLog.mockImplementation(async (_w: number, body: { payload: object }) => {
      order.push(`POST log ${JSON.stringify(body.payload)}`);
      return {};
    });
    api.getWarbandSummary.mockImplementation(async () => {
      order.push("GET summary");
      return {};
    });
    const purchase = { unitType: "heroes" as const, quantity: 1, isBuying: true };
    const pendingPurchases: PendingPurchase[] = [
      { ...purchase, unitId: "11", itemId: 101, itemName: "Sword", unitPrice: 10 },
      { ...purchase, unitId: "12", itemId: 102, itemName: "Dagger", unitPrice: 2 },
      { ...purchase, unitId: "draft-heroes-7", itemId: 104, itemName: "Club", unitPrice: 3 },
      {
        ...purchase,
        unitType: "henchmen",
        unitId: "21",
        itemId: 104,
        itemName: "Club",
        unitPrice: 3,
      },
    ];
    const forms = [leader].map(mapHeroToForm);
    const recruit = { ...forms[0], id: undefined, draftKey: "draft-heroes-7", name: "Otto" };
    const { save, params } = renderSave({
      heroForms: [
        { ...forms[0], name: "Aldric" },
        { ...recruit, is_leader: false },
      ],
      removedHeroIds: [12],
      pendingPurchases,
    });

    await save();

    expect(order).toEqual([
      "POST batch",
      "POST trade Equipped Aldric (2 items, 13 gc)",
      "POST trade Sword",
      'POST log {"hero":"Aldric","item":"Sword","price":10}',
      "POST trade Club",
      'POST log {"hero":"Otto","item":"Club","price":3}',
      "GET summary",
    ]);
    expect(params.onPendingCleared).toHaveBeenCalledTimes(1);
  });

  it("sends nothing when nothing changed", async () => {
    const { save, params } = renderSave();

    await save();

    expect(batch).not.toHaveBeenCalled();
    expect(api.getWarbandSummary).not.toHaveBeenCalled();
    expect(params.onSuccess).toHaveBeenCalledWith(warband, [leader, champion]);
  });

  it("PATCHes the warband first when its name or faction changed", async () => {
    api.updateWarband.mockResolvedValue({ ...warband, name: "The Grey Wolves" });
    const { save, params } = renderSave({
      warbandForm: { name: " The Grey Wolves ", faction: "Mercenaries" },
    });

    await save();

    expect(api.updateWarband).toHaveBeenCalledWith(9, {
      name: "The Grey Wolves",
      faction: "Mercenaries",
    });
    expect(params.onSuccess).toHaveBeenCalledWith(
      { ...warband, name: "The Grey Wolves" },
      expect.any(Array)
    );
  });

  it("saves with no heroes left and no leader (BUG-64)", async () => {
    const { save, result, params } = renderSave({
      heroes: [leader],
      heroForms: [],
      removedHeroIds: [11],
    });

    await save();

    expect(result.current.saveError).toBe("");
    expect(batchDismissals(batch)).toEqual([11]);
    expect(params.onSuccess).toHaveBeenCalled();
  });

  it("still asks for a leader while heroes are left after dismissing the leader (BUG-64)", async () => {
    const { save, result } = renderSave({
      heroForms: [mapHeroToForm(champion)],
      removedHeroIds: [11],
    });

    await save();

    expect(result.current.saveError).toBe("Select a leader before saving.");
    expect(result.current.hasAttemptedSave).toBe(true);
    expect(batch).not.toHaveBeenCalled();
  });

  it("blocks the save while a hero form is invalid", async () => {
    const forms = [leader, champion].map(mapHeroToForm);
    const { save, result } = renderSave({ heroForms: [{ ...forms[0], name: " " }, forms[1]] });

    await save();

    expect(result.current.saveError).toBe("Fix hero details before saving.");
    expect(result.current.hasAttemptedSave).toBe(true);
    expect(batch).not.toHaveBeenCalled();
  });

  it("blocks the save while the add-hero draft has content", async () => {
    const { save, result } = renderSave({
      isAddingHeroForm: true,
      newHeroForm: { ...emptyNewHero, name: "Half-typed" },
    });

    await save();

    expect(result.current.saveError).toBe(
      "Finish creating the new hero or cancel it before saving."
    );
  });

  it("requires a warband name and faction", async () => {
    const { save, result } = renderSave({ warbandForm: { name: " ", faction: "Mercenaries" } });

    await save();

    expect(result.current.saveError).toBe("Name and faction are required.");
  });

  it("does nothing for a viewer", async () => {
    const { save, params } = renderSave({ canEdit: false, removedHeroIds: [12] });

    await save();

    expect(batch).not.toHaveBeenCalled();
    expect(params.onSuccess).not.toHaveBeenCalled();
  });

  it("leaves level_up alone for a hero the session started with", async () => {
    const forms = [{ ...mapHeroToForm(leader), xp: "9" }];
    const { save } = renderSave({
      heroes: [leader],
      heroForms: forms,
      originalHeroFormsRef: { current: new Map() },
    });

    await save();

    expect(batchUpdate(batch, 11)).not.toHaveProperty("level_up");
  });

  it.each([
    ["5", 5],
    ["0", null],
    ["", null],
    ["5+", null],
  ])(
    "sends armour save %j as %j on PATCH (BUG-87: a number, unlike henchmen and hired swords)",
    async (input, sent) => {
      const form = mapHeroToForm(leader);
      const { save } = renderSave({
        heroes: [leader],
        heroForms: [{ ...form, armour_save: input }],
        originalHeroFormsRef: { current: new Map() },
      });

      await save();

      expect(batchUpdate(batch, 11)?.armour_save).toBe(sent);
    }
  );

  it("puts each refused field on its unit's form and saves nothing (UX-05)", async () => {
    const recruit = { ...mapHeroToForm(champion), id: undefined, draftKey: "draft-heroes-2" };
    const renamed = { ...mapHeroToForm(leader), name: "Aldric" };
    batch.mockRejectedValue(
      new ApiError("Some of the changes are invalid; nothing was saved.", 400, {
        detail: "Some of the changes are invalid; nothing was saved.",
        code: "invalid",
        fields: {
          "create.0.weapon_skill": ["Ensure this value is less than or equal to 10."],
          "update.0.xp": ["Ensure that there are no more than 1 decimal places."],
        },
      })
    );
    const { save, result, params } = renderSave({ heroForms: [renamed, recruit] });

    await save();

    expect(result.current.saveError).toBe("Some of the changes are invalid; nothing was saved.");
    expect(result.current.formErrors.get(recruit)).toEqual([
      "Weapon skill: Ensure this value is less than or equal to 10.",
    ]);
    expect(result.current.formErrors.get(renamed)).toEqual([
      "Xp: Ensure that there are no more than 1 decimal places.",
    ]);
    expect(params.onSuccess).not.toHaveBeenCalled();
  });

  it("shows the error and keeps the session when a write fails", async () => {
    batch.mockRejectedValue(new Error("Hero not found"));
    const forms = [leader].map(mapHeroToForm);
    const { save, result, params } = renderSave({
      heroes: [leader],
      heroForms: [{ ...forms[0], name: "Renamed" }],
      pendingPurchases: [
        {
          unitType: "heroes",
          unitId: "11",
          itemId: 101,
          itemName: "Sword",
          quantity: 1,
          unitPrice: 10,
          isBuying: true,
        },
      ],
    });

    await save();

    expect(result.current.saveError).toBe("Hero not found");
    expect(result.current.isSaving).toBe(false);
    expect(api.createWarbandTrade).not.toHaveBeenCalled();
    expect(params.onSuccess).not.toHaveBeenCalled();
    expect(params.onPendingCleared).not.toHaveBeenCalled();
  });
});
