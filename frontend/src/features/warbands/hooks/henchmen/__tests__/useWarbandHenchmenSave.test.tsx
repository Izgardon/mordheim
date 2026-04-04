import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useWarbandHenchmenSave } from "../useWarbandHenchmenSave";

import type {
  HenchmenGroup,
  HenchmenGroupFormEntry,
} from "@/features/warbands/types/warband-types";

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
vi.mock("@/features/warbands/api/warbands-items", () => ({
  removeWarbandItem: vi.fn(),
}));

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
        groupForms: [{ ...baseForm, id: undefined, xp: "5", henchmen: [{ id: 0, name: "Blade One", kills: 0, dead: false }] }],
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

    expect(apiMocks.updateWarbandHenchmenGroup).toHaveBeenCalledWith(
      9,
      11,
      expect.objectContaining({
        xp: 5,
        level_up: 0,
        no_level_ups: false,
      }),
      { emitUpdate: false }
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
