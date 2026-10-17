import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useWarbandSave } from "./useWarbandSave";
import { mapHeroToForm, type NewHeroForm } from "@/features/warbands/utils/warband-utils";

import type { PendingPurchase } from "@/features/warbands/utils/pending-purchases";
import type { HeroFormEntry, Warband, WarbandHero } from "@/features/warbands/types/warband-types";
import { makeVeteranHero } from "@/test/warband-fixtures";

const api = vi.hoisted(() => ({
  createWarbandHero: vi.fn(),
  updateWarbandHero: vi.fn(),
  deleteWarbandHero: vi.fn(),
  getWarbandSummary: vi.fn(),
  updateWarband: vi.fn(),
  createWarbandTrade: vi.fn(),
  createWarbandLog: vi.fn(),
}));

vi.mock("@/features/warbands/api/warbands-api", () => api);

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

type SaveParams = Parameters<typeof useWarbandSave>[0];

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
  const hook = renderHook(() => useWarbandSave(params));
  const save = () =>
    act(async () => {
      await hook.result.current.handleSaveChanges();
    });
  return { ...hook, params, save };
};

/** The PATCH body for the veteran hero, as `mapHeroToForm → save` builds it. */
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

describe("useWarbandSave (heroes, ROST-TEST-15)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.updateWarbandHero.mockImplementation(async (_w: number, id: number, body: object) => ({
      ...(id === leader.id ? leader : champion),
      ...body,
    }));
    api.deleteWarbandHero.mockResolvedValue(undefined);
    api.getWarbandSummary.mockResolvedValue({ gold: 120, rating: 99 });
    api.createWarbandTrade.mockResolvedValue({ id: 700 });
    api.createWarbandLog.mockResolvedValue({});
  });

  it("PATCHes only the heroes whose form changed, with the full mapped hero", async () => {
    const forms = [leader, champion].map(mapHeroToForm);
    const { save } = renderSave({
      heroForms: [{ ...forms[0], deeds: "Slew the Possessed at the well." }, { ...forms[1] }],
      originalHeroFormsRef: {
        current: snapshotOf([{ ...forms[0], deeds: "old deeds" }, forms[1]]),
      },
    });

    await save();

    expect(api.updateWarbandHero).toHaveBeenCalledTimes(1);
    expect(api.updateWarbandHero).toHaveBeenCalledWith(9, 11, veteranPatchBody);
    expect(api.createWarbandHero).not.toHaveBeenCalled();
    expect(api.deleteWarbandHero).not.toHaveBeenCalled();
  });

  it("round-trips an untouched hero to the same values it was loaded with", async () => {
    const forms = [leader].map(mapHeroToForm);
    const { save } = renderSave({
      heroes: [leader],
      heroForms: forms,
      originalHeroFormsRef: { current: new Map() },
    });

    await save();

    expect(api.updateWarbandHero).toHaveBeenCalledWith(9, 11, veteranPatchBody);
  });

  it("DELETEs dismissed heroes, then GETs the summary once and hands back the merged roster", async () => {
    const forms = [leader].map(mapHeroToForm);
    const { save, params } = renderSave({
      heroForms: forms,
      removedHeroIds: [12],
    });

    await save();

    expect(api.deleteWarbandHero).toHaveBeenCalledWith(9, 12, { emitUpdate: false });
    expect(api.updateWarbandHero).not.toHaveBeenCalled();
    expect(api.getWarbandSummary).toHaveBeenCalledTimes(1);
    expect(params.onSuccess).toHaveBeenCalledWith({ ...warband, gold: 120, rating: 99 }, [leader]);
  });

  it("commits pending purchases for kept heroes after the unit writes, then GETs the summary", async () => {
    const order: string[] = [];
    api.updateWarbandHero.mockImplementation(async () => {
      order.push("PATCH hero");
      return leader;
    });
    api.deleteWarbandHero.mockImplementation(async () => {
      order.push("DELETE hero");
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
    const pendingPurchases: PendingPurchase[] = [
      {
        unitType: "heroes",
        unitId: "11",
        itemId: 101,
        itemName: "Sword",
        quantity: 1,
        unitPrice: 10,
        isBuying: true,
      },
      {
        unitType: "heroes",
        unitId: "12",
        itemId: 102,
        itemName: "Dagger",
        quantity: 1,
        unitPrice: 2,
        isBuying: true,
      },
      {
        unitType: "henchmen",
        unitId: "21",
        itemId: 104,
        itemName: "Club",
        quantity: 1,
        unitPrice: 3,
        isBuying: true,
      },
    ];
    const forms = [leader].map(mapHeroToForm);
    const { save, params } = renderSave({
      heroForms: [{ ...forms[0], name: "Aldric" }],
      removedHeroIds: [12],
      pendingPurchases,
    });

    await save();

    expect(order).toEqual([
      "PATCH hero",
      "DELETE hero",
      "POST trade Sword",
      'POST log {"hero":"Aldric","item":"Sword","price":10}',
      "GET summary",
    ]);
    expect(params.onPendingCleared).toHaveBeenCalledTimes(1);
  });

  it("skips the summary GET when nothing changed", async () => {
    const { save, params } = renderSave();

    await save();

    expect(api.updateWarbandHero).not.toHaveBeenCalled();
    expect(api.getWarbandSummary).not.toHaveBeenCalled();
    expect(params.onSuccess).toHaveBeenCalledWith(warband, [leader, champion]);
  });

  it("PATCHes the warband first when its name or faction changed", async () => {
    api.updateWarband.mockResolvedValue({ ...warband, name: "The Grey Wolves" });
    const { save, params } = renderSave({
      warbandForm: { name: " The Grey Wolves ", faction: "Mercenaries" },
    });

    await save();

    expect(api.updateWarband).toHaveBeenCalledWith(
      9,
      { name: "The Grey Wolves", faction: "Mercenaries" },
      { emitUpdate: false }
    );
    expect(params.onSuccess).toHaveBeenCalledWith(
      { ...warband, name: "The Grey Wolves" },
      expect.any(Array)
    );
  });

  it("requires a leader even when there are no heroes (BUG-64, pinned; flips in PR C)", async () => {
    const { save, result } = renderSave({ heroes: [], heroForms: [] });

    await save();

    expect(result.current.saveError).toBe("Select a leader before saving.");
    expect(result.current.hasAttemptedSave).toBe(true);
    expect(api.updateWarbandHero).not.toHaveBeenCalled();
    expect(api.getWarbandSummary).not.toHaveBeenCalled();
  });

  it("requires a leader after dismissing the only leader (BUG-64, pinned; flips in PR C)", async () => {
    const { save, result } = renderSave({
      heroForms: [mapHeroToForm(champion)],
      removedHeroIds: [11],
    });

    await save();

    expect(result.current.saveError).toBe("Select a leader before saving.");
    expect(api.deleteWarbandHero).not.toHaveBeenCalled();
  });

  it("blocks the save while a hero form is invalid", async () => {
    const forms = [leader, champion].map(mapHeroToForm);
    const { save, result } = renderSave({ heroForms: [{ ...forms[0], name: " " }, forms[1]] });

    await save();

    expect(result.current.saveError).toBe("Fix hero details before saving.");
    expect(result.current.hasAttemptedSave).toBe(true);
    expect(api.updateWarbandHero).not.toHaveBeenCalled();
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

    expect(api.deleteWarbandHero).not.toHaveBeenCalled();
    expect(params.onSuccess).not.toHaveBeenCalled();
  });

  it("sends no level_up for a hero created this session (BUG-65, pinned; flips in PR C)", async () => {
    // The route POSTs a new hero on "Create hero" and snapshots its form, so typing a starting
    // XP afterwards is an ordinary change. Henchmen and hired swords send `level_up: 0` here.
    const recruit = makeVeteranHero({ id: 13, name: "Recruit", is_leader: false, xp: 0 });
    const recruitForm = mapHeroToForm(recruit);
    const forms = [mapHeroToForm(leader), { ...recruitForm, xp: "5" }];
    const { save } = renderSave({
      heroes: [leader, recruit],
      heroForms: forms,
      originalHeroFormsRef: { current: snapshotOf([forms[0], recruitForm]) },
    });

    await save();

    const body = api.updateWarbandHero.mock.calls[0][2];
    expect(api.updateWarbandHero.mock.calls[0][1]).toBe(13);
    expect(body.xp).toBe(5);
    expect(body).not.toHaveProperty("level_up");
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

      expect(api.updateWarbandHero.mock.calls[0][2].armour_save).toBe(sent);
    }
  );

  it("POSTs heroes without an id (create-on-Save branch, unreachable while the route creates immediately; ROST-CQ-05)", async () => {
    const created = makeVeteranHero({ id: 14, name: "Late Recruit", is_leader: false });
    api.createWarbandHero.mockResolvedValue(created);
    const draft: HeroFormEntry = {
      ...mapHeroToForm(created),
      id: undefined,
      armour_save: "5+",
    };
    const { save, params } = renderSave({
      heroes: [leader],
      heroForms: [mapHeroToForm(leader), draft],
    });

    await save();

    expect(api.createWarbandHero).toHaveBeenCalledWith(
      9,
      expect.objectContaining({ name: "Late Recruit", armour_save: null, xp: 7, price: 60 }),
      { emitUpdate: false }
    );
    expect(api.createWarbandHero.mock.calls[0][1]).not.toHaveProperty("level_up");
    expect(params.onSuccess).toHaveBeenCalledWith(expect.anything(), [leader, created]);
  });

  it("shows the error and keeps the session when a write fails", async () => {
    api.updateWarbandHero.mockRejectedValue(new Error("Hero not found"));
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
