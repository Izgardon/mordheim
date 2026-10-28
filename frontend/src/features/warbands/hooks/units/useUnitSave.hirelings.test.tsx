import { act, renderHook as renderBareHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useUnitSave, type UseUnitSaveParams } from "./useUnitSave";
import { hirelingKind, mapHirelingToForm } from "@/features/warbands/units/kinds/hireling";
import { HIRED_SWORD_TERMS } from "@/features/warbands/units/kinds/hireling-terms";

import type {
  HirelingFormEntry,
  NewHirelingForm,
  WarbandHireling,
} from "@/features/warbands/types/warband-types";
import type { PendingPurchase } from "@/features/warbands/utils/pending-purchases";
import { makeVeteranHireling } from "@/test/warband-fixtures";
import { createQueryWrapper } from "@/test/query-test-utils";
import {
  answerBatch,
  batchCreates,
  batchDismissals,
  batchPurchases,
  batchUpdate,
  batchUpdates,
} from "@/test/batch-mock";

/** Save runs as a mutation, so the hook needs a QueryClient. */
const renderHook = <R,>(hook: () => R) => renderBareHook(hook, { wrapper: createQueryWrapper() });

const apiMocks = vi.hoisted(() => ({
  batchWarbandHirelings: vi.fn(),
  getWarbandSummary: vi.fn(),
  createWarbandLog: vi.fn(),
  createWarbandTrade: vi.fn(),
}));

const eventMocks = vi.hoisted(() => ({
  emitWarbandUpdate: vi.fn(),
}));

vi.mock("@/features/warbands/api/warbands-api", () => apiMocks);
vi.mock("@/features/warbands/units/unit-api", async () =>
  (await import("@/test/unit-api-mock")).unitApiModuleMock(apiMocks)
);
vi.mock("@/features/warbands/api/warband-cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/warbands/api/warband-cache")>()),
  useWarbandCacheUpdate: () => eventMocks.emitWarbandUpdate,
}));

/** The hired sword save's inputs as the tests name them; `hirelingParams` maps them onto useUnitSave. */
type SaveParams = {
  warbandId: number;
  canEdit: boolean;
  currentHirelings: WarbandHireling[];
  hirelingForms: HirelingFormEntry[];
  removedHirelingIds: number[];
  isAddingHirelingForm: boolean;
  newHirelingForm: NewHirelingForm;
  raceQuery: string;
  originalHirelingFormsRef: { current: Map<number, string> };
  onSuccess: (refreshed: WarbandHireling[]) => void;
  pendingPurchases?: PendingPurchase[];
  onPendingCleared?: () => void;
};

const hirelingParams = (params: SaveParams): UseUnitSaveParams<"hireling"> => ({
  warbandId: params.warbandId,
  canEdit: params.canEdit,
  units: params.currentHirelings,
  forms: params.hirelingForms,
  removedIds: params.removedHirelingIds,
  isAdding: params.isAddingHirelingForm,
  newForm: params.newHirelingForm,
  raceQuery: params.raceQuery,
  originalFormsRef: params.originalHirelingFormsRef,
  onSuccess: (refreshed) => params.onSuccess(refreshed),
  pendingPurchases: params.pendingPurchases,
  onPendingCleared: params.onPendingCleared,
});

const baseForm: HirelingFormEntry = {
  ...HIRED_SWORD_TERMS,
  id: 7,
  name: "Ogre Bodyguard",
  unit_type: "Ogre",
  race_id: 2,
  race_name: "Ogre",
  stats: { M: "", WS: "", BS: "", S: "", T: "", W: "", I: "", A: "", Ld: "" },
  xp: "0",
  price: "80",
  upkeep_price: "15",
  rating: "20",
  armour_save: "",
  deeds: "",
  is_leader: false,
  trading_action: false,
  large: true,
  caster: "No",
  half_rate: false,
  blood_pacted: false,
  no_level_ups: false,
  available_skills: { C: false, Sh: false, A: false, St: false, Sp: false, Spc: false },
  items: [],
  skills: [],
  spells: [],
  specials: [],
};

const baseHireling: WarbandHireling = {
  id: 7,
  warband_id: 9,
  name: "Ogre Bodyguard",
  unit_type: "Ogre",
  race_id: 2,
  race_name: "Ogre",
  price: 80,
  hire_cost_expression: null,
  upkeep_price: 15,
  upkeep_cost_expression: null,
  rating: 20,
  xp: 0,
  level_up: 0,
  deeds: "",
  armour_save: null,
  large: true,
  caster: "No",
  half_rate: false,
  no_level_ups: false,
  blood_pacted: false,
  dead: false,
  movement: null,
  weapon_skill: null,
  ballistic_skill: null,
  strength: null,
  toughness: null,
  wounds: null,
  initiative: null,
  attacks: null,
  leadership: null,
  created_at: "2026-04-04T10:00:00Z",
  updated_at: "2026-04-04T10:00:00Z",
  items: [],
  skills: [],
  spells: [],
  specials: [],
};

const blankNewHirelingForm = {
  ...HIRED_SWORD_TERMS,
  name: "",
  unit_type: "",
  race_id: null,
  race_name: "",
  stats: { M: "", WS: "", BS: "", S: "", T: "", W: "", I: "", A: "", Ld: "" },
  price: "0",
  upkeep_price: "0",
  rating: "0",
  xp: "0",
  armour_save: "",
  large: false,
  caster: "No" as const,
  half_rate: false,
  blood_pacted: false,
  available_skills: { C: false, Sh: false, A: false, St: false, Sp: false, Spc: false },
  items: [],
  skills: [],
  spells: [],
  specials: [],
};

describe("useUnitSave: hired swords", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.batchWarbandHirelings.mockImplementation(answerBatch([baseHireling]));
    apiMocks.getWarbandSummary.mockResolvedValue({});
    apiMocks.getWarbandSummary.mockResolvedValue({});
  });

  it("creates a queued recruit in the batch with level_up 0, so its starting XP mints none (decision 1)", async () => {
    const onSuccess = vi.fn();
    const originalRef = {
      current: new Map<number, string>([[7, JSON.stringify(baseForm)]]),
    };

    const { result } = renderHook(() =>
      useUnitSave(
        hirelingKind,
        hirelingParams({
          warbandId: 9,
          canEdit: true,
          currentHirelings: [baseHireling],
          hirelingForms: [{ ...baseForm, id: undefined, draftKey: "draft-1", xp: "5" }],
          removedHirelingIds: [],
          isAddingHirelingForm: false,
          newHirelingForm: blankNewHirelingForm,
          raceQuery: "",
          originalHirelingFormsRef: originalRef,
          onSuccess,
        })
      )
    );

    await act(async () => {
      await result.current.handleSaveChanges();
    });

    expect(batchUpdates(apiMocks.batchWarbandHirelings)).toEqual([]);
    expect(batchCreates(apiMocks.batchWarbandHirelings)).toEqual([
      expect.objectContaining({ xp: 5, level_up: 0, no_level_ups: false }),
    ]);
  });

  it("does not force level_up when updating an existing hired sword from the initial edit set", async () => {
    const onSuccess = vi.fn();
    const originalRef = {
      current: new Map<number, string>([[7, JSON.stringify(baseForm)]]),
    };

    const { result } = renderHook(() =>
      useUnitSave(
        hirelingKind,
        hirelingParams({
          warbandId: 9,
          canEdit: true,
          currentHirelings: [baseHireling],
          hirelingForms: [{ ...baseForm, xp: "5" }],
          removedHirelingIds: [],
          isAddingHirelingForm: false,
          newHirelingForm: blankNewHirelingForm,
          raceQuery: "",
          originalHirelingFormsRef: originalRef,
          onSuccess,
        })
      )
    );

    await act(async () => {
      await result.current.handleSaveChanges();
    });

    const payload = batchUpdate(apiMocks.batchWarbandHirelings, 7);
    expect(payload).toMatchObject({ xp: 5, no_level_ups: false });
    expect(payload).not.toHaveProperty("level_up");
  });
});

describe("useUnitSave: hired swords characterisation", () => {
  const veteran = makeVeteranHireling();
  const second = makeVeteranHireling({ id: 32, name: "Sister Ilse" });

  const snapshotOf = (forms: HirelingFormEntry[]) =>
    new Map(forms.map((form) => [form.id as number, JSON.stringify(form)]));

  const renderSave = (overrides: Partial<SaveParams> = {}) => {
    const forms = [veteran, second].map(mapHirelingToForm);
    const params: SaveParams = {
      warbandId: 9,
      canEdit: true,
      currentHirelings: [veteran, second],
      hirelingForms: forms,
      removedHirelingIds: [],
      isAddingHirelingForm: false,
      newHirelingForm: blankNewHirelingForm,
      raceQuery: "",
      originalHirelingFormsRef: { current: snapshotOf(forms) },
      onSuccess: vi.fn(),
      pendingPurchases: [],
      onPendingCleared: vi.fn(),
      ...overrides,
    };
    const hook = renderHook(() => useUnitSave(hirelingKind, hirelingParams(params)));
    const save = () =>
      act(async () => {
        await hook.result.current.handleSaveChanges();
      });
    return { ...hook, params, save };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.batchWarbandHirelings.mockImplementation(answerBatch([veteran, second], { gold: 80 }));
    apiMocks.getWarbandSummary.mockResolvedValue({ gold: 80 });
  });

  it("round-trips a loaded hired sword into its PATCH body, armour save as a number (decision 11, BUG-87)", async () => {
    const forms = [veteran].map(mapHirelingToForm);
    const { save } = renderSave({
      currentHirelings: [veteran],
      hirelingForms: forms,
      originalHirelingFormsRef: { current: new Map() },
    });

    await save();

    expect(batchUpdate(apiMocks.batchWarbandHirelings, 31)).toEqual({
      name: "Brother Hal",
      unit_type: "Warrior Priest",
      race: 1,
      price: 40,
      upkeep_price: 15,
      rating: 25,
      xp: 4,
      deeds: "Blessed the warband before the storm.",
      armour_save: 4,
      large: false,
      caster: "Priest",
      half_rate: false,
      no_level_ups: false,
      blood_pacted: false,
      kind: "hired_sword",
      injury_table: "henchman",
      stays: "always",
      payment_note: "",
      available_skills: ["Combat", "Academic"],
      movement: 4,
      weapon_skill: 4,
      ballistic_skill: 3,
      strength: 3,
      toughness: 3,
      wounds: 1,
      initiative: 3,
      attacks: 1,
      leadership: 8,
      items: [
        { id: 105, cost: 3 },
        { id: 103, cost: 20 },
      ],
      skill_ids: [203],
      special_ids: [403],
      spell_ids: [302],
    });
  });

  it("reads a typed ' 5+ ' as the save 5 (decision 11, BUG-87)", async () => {
    const forms = [veteran].map(mapHirelingToForm);
    const { save } = renderSave({
      currentHirelings: [veteran],
      hirelingForms: [{ ...forms[0], armour_save: " 5+ " }],
    });

    await save();

    expect(batchUpdate(apiMocks.batchWarbandHirelings, 31)?.armour_save).toBe(5);
  });

  it("updates only changed hired swords in one batch, using its summary", async () => {
    const forms = [veteran, second].map(mapHirelingToForm);
    const { save } = renderSave({
      hirelingForms: [forms[0], { ...forms[1], blood_pacted: true }],
    });

    await save();

    expect(batchUpdates(apiMocks.batchWarbandHirelings).map((entry) => entry.id)).toEqual([32]);
    expect(batchUpdate(apiMocks.batchWarbandHirelings, 32)).toEqual(
      expect.objectContaining({ blood_pacted: true })
    );
    expect(apiMocks.getWarbandSummary).not.toHaveBeenCalled();
  });

  it("dismisses hired swords in the batch and writes its summary", async () => {
    const { save, params } = renderSave({
      hirelingForms: [mapHirelingToForm(veteran)],
      removedHirelingIds: [32],
    });

    await save();

    expect(batchDismissals(apiMocks.batchWarbandHirelings)).toEqual([32]);
    expect(apiMocks.getWarbandSummary).not.toHaveBeenCalled();
    expect(params.onSuccess).toHaveBeenCalledWith([veteran]);
    expect(eventMocks.emitWarbandUpdate).toHaveBeenCalledWith(9, { summary: { gold: 80 } });
  });

  it("sends purchases for kept hired swords only, in the batch (decision 1)", async () => {
    const purchase = {
      unitType: "hirelings" as const,
      itemId: 101,
      itemName: "Sword",
      quantity: 1,
      unitPrice: 10,
      isBuying: true,
      line: { item_id: 101, quantity: 1, price: 10, availability_id: null, is_buying: true },
    };
    const { save, params } = renderSave({
      hirelingForms: [mapHirelingToForm(veteran)],
      removedHirelingIds: [32],
      pendingPurchases: [
        { ...purchase, unitId: "31" },
        { ...purchase, unitId: "32" },
      ],
    });

    await save();

    expect(batchPurchases(apiMocks.batchWarbandHirelings)).toEqual([
      { unit_id: 31, item_id: 101, quantity: 1, price: 10, availability_id: null, is_buying: true },
    ]);
    expect(apiMocks.createWarbandTrade).not.toHaveBeenCalled();
    expect(apiMocks.createWarbandLog).not.toHaveBeenCalled();
    expect(params.onPendingCleared).toHaveBeenCalledTimes(1);
  });

  it("does not require any particular unit to be marked (no leader rule)", async () => {
    const { save, result } = renderSave({ currentHirelings: [], hirelingForms: [] });

    await save();

    expect(result.current.saveError).toBe("");
  });

  it("blocks the save while the add form has a loadout queued", async () => {
    const { save, result } = renderSave({
      isAddingHirelingForm: true,
      newHirelingForm: { ...blankNewHirelingForm, items: [veteran.items[0]] },
    });

    await save();

    expect(result.current.saveError).toBe(
      "Finish creating the new hired sword or cancel it before saving."
    );
  });

  it("shows the error when a write fails", async () => {
    apiMocks.batchWarbandHirelings.mockRejectedValue(new Error("Not found"));
    const { save, result, params } = renderSave({ removedHirelingIds: [32] });

    await save();

    expect(result.current.saveError).toBe("Not found");
    expect(params.onSuccess).not.toHaveBeenCalled();
  });
});
