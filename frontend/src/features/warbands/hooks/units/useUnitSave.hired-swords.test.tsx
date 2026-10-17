import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useUnitSave, type UseUnitSaveParams } from "./useUnitSave";
import { hiredSwordKind, mapHiredSwordToForm } from "@/features/warbands/units/kinds/hired-sword";

import type {
  HiredSwordFormEntry,
  NewHiredSwordForm,
  WarbandHiredSword,
} from "@/features/warbands/types/warband-types";
import type { PendingPurchase } from "@/features/warbands/utils/pending-purchases";
import { makeVeteranHiredSword } from "@/test/warband-fixtures";

const apiMocks = vi.hoisted(() => ({
  createWarbandHiredSword: vi.fn(),
  updateWarbandHiredSword: vi.fn(),
  deleteWarbandHiredSword: vi.fn(),
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
vi.mock("@/features/warbands/api/warbands-events", () => eventMocks);

/** The hired-sword save's inputs as the tests name them; `hiredParams` maps them onto useUnitSave. */
type SaveParams = {
  warbandId: number;
  canEdit: boolean;
  currentHiredSwords: WarbandHiredSword[];
  hiredSwordForms: HiredSwordFormEntry[];
  removedHiredSwordIds: number[];
  isAddingHiredSwordForm: boolean;
  newHiredSwordForm: NewHiredSwordForm;
  raceQuery: string;
  originalHiredSwordFormsRef: { current: Map<number, string> };
  sessionInitialHiredSwordIds?: readonly number[];
  onSuccess: (refreshed: WarbandHiredSword[]) => void;
  pendingPurchases?: PendingPurchase[];
  onPendingCleared?: () => void;
};

const hiredParams = (params: SaveParams): UseUnitSaveParams<"hired_sword"> => ({
  warbandId: params.warbandId,
  canEdit: params.canEdit,
  units: params.currentHiredSwords,
  forms: params.hiredSwordForms,
  removedIds: params.removedHiredSwordIds,
  isAdding: params.isAddingHiredSwordForm,
  newForm: params.newHiredSwordForm,
  raceQuery: params.raceQuery,
  originalFormsRef: params.originalHiredSwordFormsRef,
  sessionInitialIds: params.sessionInitialHiredSwordIds,
  onSuccess: (refreshed) => params.onSuccess(refreshed),
  pendingPurchases: params.pendingPurchases,
  onPendingCleared: params.onPendingCleared,
});

const baseForm: HiredSwordFormEntry = {
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

const baseHiredSword: WarbandHiredSword = {
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

const blankNewHiredSwordForm = {
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
    apiMocks.createWarbandHiredSword.mockResolvedValue(baseHiredSword);
    apiMocks.updateWarbandHiredSword.mockResolvedValue(baseHiredSword);
    apiMocks.deleteWarbandHiredSword.mockResolvedValue(undefined);
    apiMocks.getWarbandSummary.mockResolvedValue({});
  });

  it("suppresses first-save level ups for hired swords created during the current edit session", async () => {
    const onSuccess = vi.fn();
    const originalRef = {
      current: new Map<number, string>([[7, JSON.stringify(baseForm)]]),
    };

    const { result } = renderHook(() =>
      useUnitSave(
        hiredSwordKind,
        hiredParams({
          warbandId: 9,
          canEdit: true,
          currentHiredSwords: [baseHiredSword],
          hiredSwordForms: [{ ...baseForm, xp: "5" }],
          removedHiredSwordIds: [],
          isAddingHiredSwordForm: false,
          newHiredSwordForm: blankNewHiredSwordForm,
          raceQuery: "",
          originalHiredSwordFormsRef: originalRef,
          sessionInitialHiredSwordIds: [],
          onSuccess,
        })
      )
    );

    await act(async () => {
      await result.current.handleSaveChanges();
    });

    // update* takes no options argument (it never emits a warband update itself).
    expect(apiMocks.updateWarbandHiredSword).toHaveBeenCalledWith(
      9,
      7,
      expect.objectContaining({
        xp: 5,
        level_up: 0,
        no_level_ups: false,
      })
    );
  });

  it("does not force level_up when updating an existing hired sword from the initial edit set", async () => {
    const onSuccess = vi.fn();
    const originalRef = {
      current: new Map<number, string>([[7, JSON.stringify(baseForm)]]),
    };

    const { result } = renderHook(() =>
      useUnitSave(
        hiredSwordKind,
        hiredParams({
          warbandId: 9,
          canEdit: true,
          currentHiredSwords: [baseHiredSword],
          hiredSwordForms: [{ ...baseForm, xp: "5" }],
          removedHiredSwordIds: [],
          isAddingHiredSwordForm: false,
          newHiredSwordForm: blankNewHiredSwordForm,
          raceQuery: "",
          originalHiredSwordFormsRef: originalRef,
          sessionInitialHiredSwordIds: [7],
          onSuccess,
        })
      )
    );

    await act(async () => {
      await result.current.handleSaveChanges();
    });

    const payload = apiMocks.updateWarbandHiredSword.mock.calls[0][2];
    expect(payload).toMatchObject({ xp: 5, no_level_ups: false });
    expect(payload).not.toHaveProperty("level_up");
  });
});

describe("useUnitSave: hired swords characterisation", () => {
  const veteran = makeVeteranHiredSword();
  const second = makeVeteranHiredSword({ id: 32, name: "Sister Ilse" });

  const snapshotOf = (forms: HiredSwordFormEntry[]) =>
    new Map(forms.map((form) => [form.id as number, JSON.stringify(form)]));

  const renderSave = (overrides: Partial<SaveParams> = {}) => {
    const forms = [veteran, second].map(mapHiredSwordToForm);
    const params: SaveParams = {
      warbandId: 9,
      canEdit: true,
      currentHiredSwords: [veteran, second],
      hiredSwordForms: forms,
      removedHiredSwordIds: [],
      isAddingHiredSwordForm: false,
      newHiredSwordForm: blankNewHiredSwordForm,
      raceQuery: "",
      originalHiredSwordFormsRef: { current: snapshotOf(forms) },
      sessionInitialHiredSwordIds: [31, 32],
      onSuccess: vi.fn(),
      pendingPurchases: [],
      onPendingCleared: vi.fn(),
      ...overrides,
    };
    const hook = renderHook(() => useUnitSave(hiredSwordKind, hiredParams(params)));
    const save = () =>
      act(async () => {
        await hook.result.current.handleSaveChanges();
      });
    return { ...hook, params, save };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.updateWarbandHiredSword.mockImplementation(
      async (_w: number, id: number, body: object) => ({
        ...(id === veteran.id ? veteran : second),
        ...body,
      })
    );
    apiMocks.deleteWarbandHiredSword.mockResolvedValue(undefined);
    apiMocks.getWarbandSummary.mockResolvedValue({ gold: 80 });
  });

  it("round-trips a loaded hired sword into its PATCH body; armour save stays a string (BUG-87, pinned)", async () => {
    const forms = [veteran].map(mapHiredSwordToForm);
    const { save } = renderSave({
      currentHiredSwords: [veteran],
      hiredSwordForms: forms,
      originalHiredSwordFormsRef: { current: new Map() },
    });

    await save();

    expect(apiMocks.updateWarbandHiredSword).toHaveBeenCalledWith(9, 31, {
      name: "Brother Hal",
      unit_type: "Warrior Priest",
      race: 1,
      price: 40,
      upkeep_price: 15,
      rating: 25,
      xp: 4,
      deeds: "Blessed the warband before the storm.",
      armour_save: "4",
      large: false,
      caster: "Priest",
      half_rate: false,
      no_level_ups: false,
      blood_pacted: false,
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

  it("sends a typed armour save verbatim, '5+' included (BUG-87, pinned)", async () => {
    const forms = [veteran].map(mapHiredSwordToForm);
    const { save } = renderSave({
      currentHiredSwords: [veteran],
      hiredSwordForms: [{ ...forms[0], armour_save: " 5+ " }],
    });

    await save();

    expect(apiMocks.updateWarbandHiredSword.mock.calls[0][2].armour_save).toBe("5+");
  });

  it("PATCHes only changed hired swords and GETs the summary once", async () => {
    const forms = [veteran, second].map(mapHiredSwordToForm);
    const { save } = renderSave({
      hiredSwordForms: [forms[0], { ...forms[1], blood_pacted: true }],
    });

    await save();

    expect(apiMocks.updateWarbandHiredSword).toHaveBeenCalledTimes(1);
    expect(apiMocks.updateWarbandHiredSword).toHaveBeenCalledWith(
      9,
      32,
      expect.objectContaining({ blood_pacted: true })
    );
    expect(apiMocks.getWarbandSummary).toHaveBeenCalledTimes(1);
  });

  it("DELETEs dismissed hired swords and broadcasts the refreshed summary", async () => {
    const { save, params } = renderSave({
      hiredSwordForms: [mapHiredSwordToForm(veteran)],
      removedHiredSwordIds: [32],
    });

    await save();

    expect(apiMocks.deleteWarbandHiredSword).toHaveBeenCalledWith(9, 32, { emitUpdate: false });
    expect(apiMocks.getWarbandSummary).toHaveBeenCalledTimes(1);
    expect(params.onSuccess).toHaveBeenCalledWith([veteran]);
    expect(eventMocks.emitWarbandUpdate).toHaveBeenCalledWith(9, { summary: { gold: 80 } });
  });

  it("commits purchases for kept hired swords only, naming them in the log", async () => {
    apiMocks.createWarbandTrade.mockResolvedValue({ id: 1 });
    apiMocks.createWarbandLog.mockResolvedValue({});
    const purchase = {
      unitType: "hiredswords" as const,
      itemId: 101,
      itemName: "Sword",
      quantity: 1,
      unitPrice: 10,
      isBuying: true,
    };
    const { save, params } = renderSave({
      hiredSwordForms: [mapHiredSwordToForm(veteran)],
      removedHiredSwordIds: [32],
      pendingPurchases: [
        { ...purchase, unitId: "31" },
        { ...purchase, unitId: "32" },
      ],
    });

    await save();

    expect(apiMocks.createWarbandTrade).toHaveBeenCalledTimes(1);
    expect(apiMocks.createWarbandLog).toHaveBeenCalledWith(
      9,
      expect.objectContaining({
        entry_type: "hired_sword_item",
        payload: { hero: "Brother Hal", item: "Sword", price: 10 },
      }),
      { emitUpdate: false }
    );
    expect(params.onPendingCleared).toHaveBeenCalledTimes(1);
  });

  it("does not require any particular unit to be marked (no leader rule)", async () => {
    const { save, result } = renderSave({ currentHiredSwords: [], hiredSwordForms: [] });

    await save();

    expect(result.current.saveError).toBe("");
  });

  it("blocks the save while the add form has a loadout queued", async () => {
    const { save, result } = renderSave({
      isAddingHiredSwordForm: true,
      newHiredSwordForm: { ...blankNewHiredSwordForm, items: [veteran.items[0]] },
    });

    await save();

    expect(result.current.saveError).toBe(
      "Finish creating the new hired sword or cancel it before saving."
    );
  });

  it("shows the error when a write fails", async () => {
    apiMocks.deleteWarbandHiredSword.mockRejectedValue(new Error("Not found"));
    const { save, result, params } = renderSave({ removedHiredSwordIds: [32] });

    await save();

    expect(result.current.saveError).toBe("Not found");
    expect(params.onSuccess).not.toHaveBeenCalled();
  });
});
