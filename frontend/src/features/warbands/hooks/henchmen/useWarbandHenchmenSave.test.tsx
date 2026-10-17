import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useWarbandHenchmenSave } from "./useWarbandHenchmenSave";
import { mapHenchmenGroupToForm } from "@/features/warbands/utils/warband-utils";

import type {
  HenchmenGroup,
  HenchmenGroupFormEntry,
} from "@/features/warbands/types/warband-types";
import { makeVeteranHenchmenGroup } from "@/test/warband-fixtures";

const apiMocks = vi.hoisted(() => ({
  createWarbandHenchmenGroup: vi.fn(),
  updateWarbandHenchmenGroup: vi.fn(),
  deleteWarbandHenchmenGroup: vi.fn(),
  getWarbandSummary: vi.fn(),
  createWarbandLog: vi.fn(),
  createWarbandTrade: vi.fn(),
}));

const eventMocks = vi.hoisted(() => ({
  emitWarbandUpdate: vi.fn(),
}));

vi.mock("@/features/warbands/api/warbands-api", () => apiMocks);
vi.mock("@/features/warbands/api/warbands-events", () => eventMocks);
const itemMocks = vi.hoisted(() => ({
  removeWarbandItem: vi.fn(),
}));

vi.mock("@/features/warbands/api/warbands-items", () => itemMocks);

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

describe("useWarbandHenchmenSave", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.createWarbandHenchmenGroup.mockResolvedValue(baseGroup);
    apiMocks.updateWarbandHenchmenGroup.mockResolvedValue(baseGroup);
    apiMocks.deleteWarbandHenchmenGroup.mockResolvedValue(undefined);
    apiMocks.getWarbandSummary.mockResolvedValue({});
  });

  it("sends level_up 0 when creating a new henchmen group", async () => {
    const onSuccess = vi.fn();
    const originalRef = { current: new Map<number, string>() };

    const { result } = renderHook(() =>
      useWarbandHenchmenSave({
        warbandId: 9,
        canEdit: true,
        currentGroups: [],
        groupForms: [
          {
            ...baseForm,
            id: undefined,
            xp: "5",
            henchmen: [{ id: 0, name: "Blade One", kills: 0, dead: false }],
          },
        ],
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
    );

    await act(async () => {
      await result.current.handleSaveChanges();
    });

    expect(apiMocks.createWarbandHenchmenGroup).toHaveBeenCalledWith(
      9,
      expect.objectContaining({
        xp: 5,
        level_up: 0,
        no_level_ups: false,
      }),
      { emitUpdate: false }
    );
  });

  it("suppresses first-save level ups for groups created during the current edit session", async () => {
    const onSuccess = vi.fn();
    const originalRef = {
      current: new Map<number, string>([[11, JSON.stringify(baseForm)]]),
    };

    const { result } = renderHook(() =>
      useWarbandHenchmenSave({
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
        sessionInitialGroupIds: [],
        onSuccess,
      })
    );

    await act(async () => {
      await result.current.handleSaveChanges();
    });

    // update* takes no options argument (it never emits a warband update itself).
    expect(apiMocks.updateWarbandHenchmenGroup).toHaveBeenCalledWith(
      9,
      11,
      expect.objectContaining({
        xp: 5,
        level_up: 0,
        no_level_ups: false,
      })
    );
  });

  it("does not force level_up when updating an existing group from the initial edit set", async () => {
    const onSuccess = vi.fn();
    const originalRef = {
      current: new Map<number, string>([[11, JSON.stringify(baseForm)]]),
    };

    const { result } = renderHook(() =>
      useWarbandHenchmenSave({
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
        sessionInitialGroupIds: [11],
        onSuccess,
      })
    );

    await act(async () => {
      await result.current.handleSaveChanges();
    });

    const payload = apiMocks.updateWarbandHenchmenGroup.mock.calls[0][2];
    expect(payload).toMatchObject({ xp: 5, no_level_ups: false });
    expect(payload).not.toHaveProperty("level_up");
  });
});

describe("useWarbandHenchmenSave characterisation", () => {
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

  type SaveParams = Parameters<typeof useWarbandHenchmenSave>[0];

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
      sessionInitialGroupIds: [21, 22],
      onSuccess: vi.fn(),
      pendingPurchases: [],
      onPendingCleared: vi.fn(),
      ...overrides,
    };
    const hook = renderHook(() => useWarbandHenchmenSave(params));
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

  const itemIds = (body: { items: { id: number }[] }) => body.items.map((item) => item.id);

  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.updateWarbandHenchmenGroup.mockImplementation(
      async (_w: number, id: number, body: object) => ({
        ...(id === veteran.id ? veteran : second),
        ...body,
      })
    );
    apiMocks.deleteWarbandHenchmenGroup.mockResolvedValue(undefined);
    apiMocks.getWarbandSummary.mockResolvedValue({ gold: 50 });
    itemMocks.removeWarbandItem.mockResolvedValue(undefined);
  });

  it("round-trips a loaded group into its PATCH body; armour save stays a string (BUG-87, pinned)", async () => {
    const { save } = renderSave({
      currentGroups: [veteran],
      groupForms: [mapHenchmenGroupToForm(veteran)],
      originalGroupFormsRef: { current: new Map() },
    });

    await save();

    expect(apiMocks.updateWarbandHenchmenGroup).toHaveBeenCalledWith(9, 21, {
      name: "Black Knives",
      unit_type: "Thugs",
      race: 1,
      price: 25,
      xp: 4,
      max_size: 5,
      deeds: "Held the bridge for a whole turn.",
      armour_save: "6",
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

    const body = apiMocks.updateWarbandHenchmenGroup.mock.calls[0][2];
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

  it("takes items picked from the stash out of the stash after the group writes", async () => {
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

    expect(itemMocks.removeWarbandItem).toHaveBeenCalledWith(9, 104, 1, { emitUpdate: false });
    const body = apiMocks.updateWarbandHenchmenGroup.mock.calls[0][2];
    expect(itemIds(body)).toEqual([104, 104, 104, 102, 102, 102, 104]);
    expect(body.henchmen[3].item_notes).toBe(
      "Base: 25 gc. XP: 4 x2 = 8 gc. Items: Club (from stash), Dagger (ignored)"
    );
  });

  it("PATCHes only changed groups, GETs the summary once and broadcasts it", async () => {
    const forms = [veteran, second].map(mapHenchmenGroupToForm);
    const { save, params } = renderSave({
      groupForms: [forms[0], { ...forms[1], name: "Crossbow Boys" }],
    });

    await save();

    expect(apiMocks.updateWarbandHenchmenGroup).toHaveBeenCalledTimes(1);
    expect(apiMocks.updateWarbandHenchmenGroup.mock.calls[0][1]).toBe(22);
    expect(apiMocks.getWarbandSummary).toHaveBeenCalledTimes(1);
    expect(eventMocks.emitWarbandUpdate).toHaveBeenCalledWith(9, { summary: { gold: 50 } });
    expect(params.onSuccess).toHaveBeenCalledWith([
      veteran,
      expect.objectContaining({ id: 22, name: "Crossbow Boys" }),
    ]);
  });

  it("DELETEs dismissed groups and drops their pending purchases", async () => {
    apiMocks.createWarbandTrade.mockResolvedValue({ id: 1 });
    apiMocks.createWarbandLog.mockResolvedValue({});
    const purchase = {
      unitType: "henchmen" as const,
      itemId: 101,
      itemName: "Sword",
      quantity: 1,
      unitPrice: 10,
      isBuying: true,
    };
    const { save, params } = renderSave({
      groupForms: [mapHenchmenGroupToForm(veteran)],
      removedGroupIds: [22],
      pendingPurchases: [
        { ...purchase, unitId: "21" },
        { ...purchase, unitId: "22" },
      ],
    });

    await save();

    expect(apiMocks.deleteWarbandHenchmenGroup).toHaveBeenCalledWith(9, 22, { emitUpdate: false });
    expect(apiMocks.createWarbandTrade).toHaveBeenCalledTimes(1);
    expect(apiMocks.createWarbandLog).toHaveBeenCalledWith(
      9,
      expect.objectContaining({
        entry_type: "henchmen_item",
        payload: { hero: "Black Knives", item: "Sword", price: 10 },
      }),
      { emitUpdate: false }
    );
    expect(params.onSuccess).toHaveBeenCalledWith([veteran]);
  });

  it("blocks the save while a member has no name", async () => {
    const { save, result } = renderSave(withNewMember({ id: 0, name: "", kills: 0, dead: false }));

    await save();

    expect(result.current.saveError).toBe("Fix group details before saving.");
    expect(apiMocks.updateWarbandHenchmenGroup).not.toHaveBeenCalled();
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

  it("POSTs groups without an id with numeric armour save and recruit notes (create-on-Save branch; ROST-CQ-05)", async () => {
    apiMocks.createWarbandHenchmenGroup.mockResolvedValue({ ...veteran, id: 23 });
    const draft = { ...mapHenchmenGroupToForm(veteran), id: undefined };
    draft.henchmen = draft.henchmen.map((h) => ({ ...h, id: 0 }));
    const { save } = renderSave({ groupForms: [draft] });

    await save();

    expect(apiMocks.createWarbandHenchmenGroup).toHaveBeenCalledWith(
      9,
      expect.objectContaining({
        armour_save: 6,
        level_up: 0,
        item_notes: "Base: 25 gc. XP: 4 x2 = 8 gc. Items: Club (3 gc), Dagger (2 gc)",
        henchmen: [
          { name: "Blade One", kills: 2, dead: false },
          { name: "Blade Two", kills: 0, dead: false },
          { name: "Blade Three", kills: 1, dead: false },
        ],
      }),
      { emitUpdate: false }
    );
  });

  it("shows the error when a write fails", async () => {
    apiMocks.updateWarbandHenchmenGroup.mockRejectedValue(new Error("Bad member"));
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
