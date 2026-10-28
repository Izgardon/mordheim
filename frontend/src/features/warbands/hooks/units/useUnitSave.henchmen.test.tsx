import { act, renderHook as renderBareHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useUnitSave, type UseUnitSaveParams } from "./useUnitSave";
import { henchmenKind, mapHenchmenGroupToForm } from "@/features/warbands/units/kinds/henchmen";

import type {
  HenchmenGroup,
  HenchmenGroupFormEntry,
  NewHenchmenGroupForm,
} from "@/features/warbands/types/warband-types";
import type { PendingPurchase } from "@/features/warbands/utils/pending-purchases";
import { makeVeteranHenchmenGroup } from "@/test/warband-fixtures";
import { createQueryWrapper } from "@/test/query-test-utils";
import { ApiError } from "@/lib/api-client";
import {
  answerBatch,
  batchCreates,
  batchDismissals,
  batchPurchases,
  batchStashTakes,
  batchUpdate,
  batchUpdates,
} from "@/test/batch-mock";

/** Save runs as a mutation, so the hook needs a QueryClient. */
const renderHook = <R,>(hook: () => R) => renderBareHook(hook, { wrapper: createQueryWrapper() });

const apiMocks = vi.hoisted(() => ({
  batchWarbandHenchmenGroups: vi.fn(),
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
/** A purchase queued for a group in edit mode, as the acquire dialog builds it. */
const queued = (unitId: string, itemId: number, itemName: string, unitPrice: number) =>
  ({
    unitType: "henchmen",
    unitId,
    itemId,
    itemName,
    quantity: 1,
    unitPrice,
    isBuying: true,
    line: {
      item_id: itemId,
      quantity: 1,
      price: unitPrice,
      availability_id: null,
      is_buying: true,
    },
  }) satisfies PendingPurchase;

/** The group save's inputs as the tests name them; `groupParams` maps them onto useUnitSave. */
type SaveParams = {
  warbandId: number | null;
  canEdit: boolean;
  currentGroups: HenchmenGroup[];
  groupForms: HenchmenGroupFormEntry[];
  removedGroupIds: number[];
  isAddingGroupForm: boolean;
  newGroupForm: NewHenchmenGroupForm;
  raceQuery: string;
  originalGroupFormsRef: { current: Map<number, string> };
  onSuccess: (refreshedGroups: HenchmenGroup[]) => void;
  pendingPurchases?: PendingPurchase[];
  onPendingCleared?: () => void;
};

const groupParams = (params: SaveParams): UseUnitSaveParams<"henchmen_group"> => ({
  warbandId: params.warbandId,
  canEdit: params.canEdit,
  units: params.currentGroups,
  forms: params.groupForms,
  removedIds: params.removedGroupIds,
  isAdding: params.isAddingGroupForm,
  newForm: params.newGroupForm,
  raceQuery: params.raceQuery,
  originalFormsRef: params.originalGroupFormsRef,
  onSuccess: (groups) => params.onSuccess(groups),
  pendingPurchases: params.pendingPurchases,
  onPendingCleared: params.onPendingCleared,
});

const baseForm: HenchmenGroupFormEntry = {
  id: 11,
  name: "Black Knives",
  unit_type: "Thugs",
  race_id: 3,
  race_name: "Human",
  stats: { M: "", WS: "", BS: "", S: "", T: "", W: "", I: "", A: "", Ld: "" },
  xp: "0",
  max_size: "5",
  price: "25",
  armour_save: "",
  deeds: "",
  large: false,
  half_rate: false,
  no_level_ups: false,
  items: [],
  skills: [],
  specials: [],
  henchmen: [{ id: 21, name: "Blade One", kills: 0, dead: false }],
};

const baseGroup: HenchmenGroup = {
  id: 11,
  warband_id: 9,
  name: "Black Knives",
  unit_type: "Thugs",
  race_id: 3,
  race_name: "Human",
  price: 25,
  xp: 0,
  max_size: 5,
  level_up: 0,
  deeds: "",
  armour_save: null,
  large: false,
  half_rate: false,
  no_level_ups: false,
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
  items: [],
  skills: [],
  specials: [],
  henchmen: [{ id: 21, name: "Blade One", kills: 0, dead: false }],
  race: undefined,
};

describe("useUnitSave: henchmen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.batchWarbandHenchmenGroups.mockImplementation(answerBatch([baseGroup]));
    apiMocks.getWarbandSummary.mockResolvedValue({});
    apiMocks.getWarbandSummary.mockResolvedValue({});
  });

  it("creates a queued recruit in the batch with level_up 0, so its starting XP mints none (decision 1)", async () => {
    const onSuccess = vi.fn();
    const originalRef = {
      current: new Map<number, string>([[11, JSON.stringify(baseForm)]]),
    };

    const { result } = renderHook(() =>
      useUnitSave(
        henchmenKind,
        groupParams({
          warbandId: 9,
          canEdit: true,
          currentGroups: [baseGroup],
          groupForms: [{ ...baseForm, id: undefined, draftKey: "draft-1", xp: "5" }],
          removedGroupIds: [],
          isAddingGroupForm: false,
          newGroupForm: {
            name: "",
            unit_type: "",
            race_id: null,
            race_name: "",
            price: "0",
            xp: "0",
            max_size: "5",
            firstHenchmanName: "",
          },
          raceQuery: "",
          originalGroupFormsRef: originalRef,
          onSuccess,
        })
      )
    );

    await act(async () => {
      await result.current.handleSaveChanges();
    });

    expect(batchUpdates(apiMocks.batchWarbandHenchmenGroups)).toEqual([]);
    expect(batchCreates(apiMocks.batchWarbandHenchmenGroups)).toEqual([
      expect.objectContaining({ xp: 5, level_up: 0, no_level_ups: false }),
    ]);
  });

  it("does not force level_up when updating an existing group from the initial edit set", async () => {
    const onSuccess = vi.fn();
    const originalRef = {
      current: new Map<number, string>([[11, JSON.stringify(baseForm)]]),
    };

    const { result } = renderHook(() =>
      useUnitSave(
        henchmenKind,
        groupParams({
          warbandId: 9,
          canEdit: true,
          currentGroups: [baseGroup],
          groupForms: [{ ...baseForm, xp: "5" }],
          removedGroupIds: [],
          isAddingGroupForm: false,
          newGroupForm: {
            name: "",
            unit_type: "",
            race_id: null,
            race_name: "",
            price: "0",
            xp: "0",
            max_size: "5",
            firstHenchmanName: "",
          },
          raceQuery: "",
          originalGroupFormsRef: originalRef,
          onSuccess,
        })
      )
    );

    await act(async () => {
      await result.current.handleSaveChanges();
    });

    const payload = batchUpdate(apiMocks.batchWarbandHenchmenGroups, 11);
    expect(payload).toMatchObject({ xp: 5, no_level_ups: false });
    expect(payload).not.toHaveProperty("level_up");
  });
});

describe("useUnitSave: henchmen characterisation", () => {
  const veteran = makeVeteranHenchmenGroup();
  const second = makeVeteranHenchmenGroup({
    id: 22,
    name: "Crossbowmen",
    items: [],
    henchmen: [{ id: 71, name: "Bolt", kills: 0, dead: false }],
  });
  const blankNewGroupForm = {
    name: "",
    unit_type: "",
    race_id: null,
    race_name: "",
    price: "0",
    xp: "0",
    max_size: "5",
    firstHenchmanName: "",
  };

  const snapshotOf = (forms: HenchmenGroupFormEntry[]) =>
    new Map(forms.map((form) => [form.id as number, JSON.stringify(form)]));

  const renderSave = (overrides: Partial<SaveParams> = {}) => {
    const forms = [veteran, second].map(mapHenchmenGroupToForm);
    const params: SaveParams = {
      warbandId: 9,
      canEdit: true,
      currentGroups: [veteran, second],
      groupForms: forms,
      removedGroupIds: [],
      isAddingGroupForm: false,
      newGroupForm: blankNewGroupForm,
      raceQuery: "",
      originalGroupFormsRef: { current: snapshotOf(forms) },
      onSuccess: vi.fn(),
      pendingPurchases: [],
      onPendingCleared: vi.fn(),
      ...overrides,
    };
    const hook = renderHook(() => useUnitSave(henchmenKind, groupParams(params)));
    const save = () =>
      act(async () => {
        await hook.result.current.handleSaveChanges();
      });
    return { ...hook, params, save };
  };

  const withNewMember = (member: HenchmenGroupFormEntry["henchmen"][number]) => {
    const form = mapHenchmenGroupToForm(veteran);
    return {
      currentGroups: [veteran],
      groupForms: [{ ...form, henchmen: [...form.henchmen, member] }],
      originalGroupFormsRef: { current: snapshotOf([form]) },
    };
  };

  type GroupBody = { items: { id: number }[]; henchmen: Record<string, unknown>[] };
  const itemIds = (body: GroupBody) => body.items.map((item) => item.id);

  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.batchWarbandHenchmenGroups.mockImplementation(
      answerBatch([veteran, second], { gold: 50 })
    );
    apiMocks.getWarbandSummary.mockResolvedValue({ gold: 50 });
  });

  it("round-trips a loaded group into its PATCH body, armour save as a number (decision 11, BUG-87)", async () => {
    const { save } = renderSave({
      currentGroups: [veteran],
      groupForms: [mapHenchmenGroupToForm(veteran)],
      originalGroupFormsRef: { current: new Map() },
    });

    await save();

    expect(batchUpdate(apiMocks.batchWarbandHenchmenGroups, 21)).toEqual({
      name: "Black Knives",
      unit_type: "Thugs",
      race: 1,
      price: 25,
      xp: 4,
      max_size: 5,
      deeds: "Held the bridge for a whole turn.",
      armour_save: 6,
      large: false,
      half_rate: false,
      no_level_ups: false,
      movement: 4,
      weapon_skill: 3,
      ballistic_skill: 3,
      strength: 3,
      toughness: 3,
      wounds: 1,
      initiative: 3,
      attacks: 1,
      leadership: 7,
      items: [
        { id: 104, cost: 3 },
        { id: 104, cost: 3 },
        { id: 104, cost: 3 },
        { id: 102, cost: 2 },
        { id: 102, cost: 2 },
        { id: 102, cost: 2 },
      ],
      skill_ids: [202],
      special_ids: [402],
      henchmen: [
        { id: 61, name: "Blade One", kills: 2, dead: false },
        { id: 62, name: "Blade Two", kills: 0, dead: false },
        { id: 63, name: "Blade Three", kills: 1, dead: false },
      ],
    });
  });

  it("adds a new member with his hire cost, recruit notes and a per-member share of the items", async () => {
    const { save } = renderSave(
      withNewMember({ id: 0, name: "Blade Four", kills: 0, dead: false, cost: "35" })
    );

    await save();

    const body = batchUpdate(apiMocks.batchWarbandHenchmenGroups, 21) as GroupBody;
    expect(body.henchmen[3]).toEqual({
      name: "Blade Four",
      kills: 0,
      dead: false,
      cost: 35,
      item_notes: "Base: 25 gc. XP: 4 x2 = 8 gc. Items: Club (3 gc), Dagger (2 gc)",
    });
    // Added copies follow ascending item id (Object.values over numeric keys), not load order.
    expect(itemIds(body)).toEqual([104, 104, 104, 102, 102, 102, 102, 104]);
  });

  it("takes items picked from the stash in the batch, not in the group's items (BUG-108)", async () => {
    const { save } = renderSave(
      withNewMember({
        id: 0,
        name: "Blade Four",
        kills: 0,
        dead: false,
        cost: 25,
        itemChoices: [
          { itemId: 104, action: "stash" },
          { itemId: 102, action: "ignore" },
        ],
      })
    );

    await save();

    expect(batchStashTakes(apiMocks.batchWarbandHenchmenGroups)).toEqual([
      { unit_id: 21, item_id: 104, quantity: 1 },
    ]);
    const body = batchUpdate(apiMocks.batchWarbandHenchmenGroups, 21) as GroupBody;
    // The server moves the Club over from the stash with its cost.
    expect(itemIds(body)).toEqual([104, 104, 104, 102, 102, 102]);
    expect(body.henchmen[3].item_notes).toBe(
      "Base: 25 gc. XP: 4 x2 = 8 gc. Items: Club (from stash), Dagger (ignored)"
    );
    expect(apiMocks.batchWarbandHenchmenGroups).toHaveBeenCalledTimes(1);
  });

  it("sends the stash take and a purchase in the one batch, with nothing after it", async () => {
    const { save, params } = renderSave({
      ...withNewMember({
        id: 0,
        name: "Blade Four",
        kills: 0,
        dead: false,
        cost: 25,
        itemChoices: [{ itemId: 104, action: "stash" }],
      }),
      pendingPurchases: [queued("21", 120, "Rope", 5)],
    });

    await save();

    expect(batchStashTakes(apiMocks.batchWarbandHenchmenGroups)).toEqual([
      { unit_id: 21, item_id: 104, quantity: 1 },
    ]);
    expect(batchPurchases(apiMocks.batchWarbandHenchmenGroups)).toEqual([
      { unit_id: 21, item_id: 120, quantity: 1, price: 5, availability_id: null, is_buying: true },
    ]);
    expect(apiMocks.createWarbandTrade).not.toHaveBeenCalled();
    expect(apiMocks.createWarbandLog).not.toHaveBeenCalled();
    expect(params.onSuccess).toHaveBeenCalledTimes(1);
  });

  it("says how many the stash holds when it ran short, and saves nothing", async () => {
    apiMocks.batchWarbandHenchmenGroups.mockRejectedValue(
      new ApiError("The stash holds 0 of these.", 400, {
        detail: "The stash holds 0 of these.",
        code: "not_enough_in_stash",
        fields: { "stash_takes.0.quantity": ["The stash holds 0 of these."] },
      })
    );
    const setup = withNewMember({
      id: 0,
      name: "Blade Four",
      kills: 0,
      dead: false,
      cost: 25,
      itemChoices: [{ itemId: 104, action: "stash" }],
    });
    const { save, params, result } = renderSave(setup);

    await save();

    expect(result.current.saveError).toBe("The stash holds 0 of these.");
    expect(result.current.formErrors.get(setup.groupForms[0])).toEqual([
      "Quantity: The stash holds 0 of these.",
    ]);
    expect(params.onSuccess).not.toHaveBeenCalled();
  });

  it("updates only changed groups in one batch and writes its summary", async () => {
    const forms = [veteran, second].map(mapHenchmenGroupToForm);
    const { save, params } = renderSave({
      groupForms: [forms[0], { ...forms[1], name: "Crossbow Boys" }],
    });

    await save();

    expect(batchUpdates(apiMocks.batchWarbandHenchmenGroups).map((entry) => entry.id)).toEqual([
      22,
    ]);
    expect(apiMocks.getWarbandSummary).not.toHaveBeenCalled();
    expect(eventMocks.emitWarbandUpdate).toHaveBeenCalledWith(9, { summary: { gold: 50 } });
    expect(params.onSuccess).toHaveBeenCalledWith([
      veteran,
      expect.objectContaining({ id: 22, name: "Crossbow Boys" }),
    ]);
  });

  it("dismisses groups in the batch and drops their pending purchases", async () => {
    const { save, params } = renderSave({
      groupForms: [mapHenchmenGroupToForm(veteran)],
      removedGroupIds: [22],
      pendingPurchases: [queued("21", 101, "Sword", 10), queued("22", 101, "Sword", 10)],
    });

    await save();

    expect(batchDismissals(apiMocks.batchWarbandHenchmenGroups)).toEqual([22]);
    expect(batchPurchases(apiMocks.batchWarbandHenchmenGroups)).toEqual([
      expect.objectContaining({ unit_id: 21, item_id: 101 }),
    ]);
    expect(params.onSuccess).toHaveBeenCalledWith([veteran]);
  });

  it("blocks the save while a member has no name", async () => {
    const { save, result } = renderSave(withNewMember({ id: 0, name: "", kills: 0, dead: false }));

    await save();

    expect(result.current.saveError).toBe("Fix group details before saving.");
    expect(apiMocks.batchWarbandHenchmenGroups).not.toHaveBeenCalled();
  });

  it("saves beside a group recruited from a creature, which has no race and unnamed members by design", async () => {
    // A creature group on the roster refused every henchmen Save ("Missing: Race, Henchmen names").
    const kennel = makeVeteranHenchmenGroup({
      id: 23,
      name: "Kennel",
      unit_type: "Wardogs",
      race_id: null,
      race_name: null,
      items: [],
      source_beast_id: 3,
      beast_kind: "creature",
      henchmen: [{ id: 81, name: "", kills: 0, dead: false }],
    });
    const forms = [veteran, kennel].map(mapHenchmenGroupToForm);
    const renamed = [{ ...forms[0], name: "Black Blades" }, forms[1]];
    const { save, result } = renderSave({
      currentGroups: [veteran, kennel],
      groupForms: renamed,
      originalGroupFormsRef: { current: snapshotOf(forms) },
    });

    await save();

    expect(result.current.saveError).toBeFalsy();
    expect(batchUpdates(apiMocks.batchWarbandHenchmenGroups).map((entry) => entry.id)).toEqual([
      21,
    ]);
  });

  it("blocks the save while the add-group draft has a first henchman typed", async () => {
    const { save, result } = renderSave({
      isAddingGroupForm: true,
      newGroupForm: { ...blankNewGroupForm, firstHenchmanName: "Bob" },
    });

    await save();

    expect(result.current.saveError).toBe(
      "Finish creating the new group or cancel it before saving."
    );
  });

  it("shows the error when a write fails", async () => {
    apiMocks.batchWarbandHenchmenGroups.mockRejectedValue(new Error("Bad member"));
    const forms = [veteran, second].map(mapHenchmenGroupToForm);
    const { save, result, params } = renderSave({
      groupForms: [{ ...forms[0], name: "Renamed" }, forms[1]],
    });

    await save();

    expect(result.current.saveError).toBe("Bad member");
    expect(params.onSuccess).not.toHaveBeenCalled();
    expect(eventMocks.emitWarbandUpdate).not.toHaveBeenCalled();
  });
});
