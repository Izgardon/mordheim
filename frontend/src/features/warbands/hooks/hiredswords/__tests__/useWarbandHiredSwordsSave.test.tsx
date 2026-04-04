import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useWarbandHiredSwordsSave } from "../useWarbandHiredSwordsSave";

import type {
  HiredSwordFormEntry,
  WarbandHiredSword,
} from "@/features/warbands/types/warband-types";

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
vi.mock("@/features/warbands/api/warbands-events", () => eventMocks);

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

describe("useWarbandHiredSwordsSave", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.createWarbandHiredSword.mockResolvedValue(baseHiredSword);
    apiMocks.updateWarbandHiredSword.mockResolvedValue(baseHiredSword);
    apiMocks.deleteWarbandHiredSword.mockResolvedValue(undefined);
    apiMocks.getWarbandSummary.mockResolvedValue({});
  });

  it("sends level_up 0 when creating a new hired sword", async () => {
    const onSuccess = vi.fn();
    const originalRef = { current: new Map<number, string>() };

    const { result } = renderHook(() =>
      useWarbandHiredSwordsSave({
        warbandId: 9,
        canEdit: true,
        currentHiredSwords: [],
        hiredSwordForms: [{ ...baseForm, id: undefined, xp: "5" }],
        removedHiredSwordIds: [],
        isAddingHiredSwordForm: false,
        newHiredSwordForm: blankNewHiredSwordForm,
        raceQuery: "",
        originalHiredSwordFormsRef: originalRef,
        onSuccess,
      })
    );

    await act(async () => {
      await result.current.handleSaveChanges();
    });

    expect(apiMocks.createWarbandHiredSword).toHaveBeenCalledWith(
      9,
      expect.objectContaining({
        xp: 5,
        level_up: 0,
        no_level_ups: false,
      }),
      { emitUpdate: false }
    );
  });

  it("suppresses first-save level ups for hired swords created during the current edit session", async () => {
    const onSuccess = vi.fn();
    const originalRef = {
      current: new Map<number, string>([[7, JSON.stringify(baseForm)]]),
    };

    const { result } = renderHook(() =>
      useWarbandHiredSwordsSave({
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
    );

    await act(async () => {
      await result.current.handleSaveChanges();
    });

    expect(apiMocks.updateWarbandHiredSword).toHaveBeenCalledWith(
      9,
      7,
      expect.objectContaining({
        xp: 5,
        level_up: 0,
        no_level_ups: false,
      }),
      { emitUpdate: false }
    );
  });

  it("does not force level_up when updating an existing hired sword from the initial edit set", async () => {
    const onSuccess = vi.fn();
    const originalRef = {
      current: new Map<number, string>([[7, JSON.stringify(baseForm)]]),
    };

    const { result } = renderHook(() =>
      useWarbandHiredSwordsSave({
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
    );

    await act(async () => {
      await result.current.handleSaveChanges();
    });

    const payload = apiMocks.updateWarbandHiredSword.mock.calls[0][2];
    expect(payload).toMatchObject({ xp: 5, no_level_ups: false });
    expect(payload).not.toHaveProperty("level_up");
  });
});
