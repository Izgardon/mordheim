import { describe, expect, it } from "vitest";

import type { PrebattleUnit } from "@/features/battles/components/prebattle/prebattle-types";
import { toParticipantRosters } from "@/features/battles/api/battle-queries";
import { ME, battleRosters, myParticipant, opponentParticipant } from "@/test/battle-fixtures";

import {
  buildConfigPayload,
  initialPrebattleConfig,
  parseDeclaredRating,
  statusRatings,
  withOverrideStat,
  withUnitNotes,
} from "./prebattle-config";

const roster = toParticipantRosters(battleRosters())[ME.id];
const wolf = roster.heroes[0] as PrebattleUnit;

describe("prebattle-config", () => {
  it("starts with every unit selected when nothing was saved, keeping the server's hash", () => {
    const initial = initialPrebattleConfig(myParticipant({ selected_unit_keys_json: [] }), roster);

    expect(initial.selectedKeys).toEqual(["hero:1", "hero:3", "hireling:4", "henchman:2"]);
    expect(JSON.parse(initial.savedHash).selected_unit_keys_json).toEqual([]);
  });

  it("keeps the saved selection, without units that are no longer on the roster", () => {
    const initial = initialPrebattleConfig(
      myParticipant({ selected_unit_keys_json: ["hero:3", "hero:99"] }),
      roster
    );

    expect(initial.selectedKeys).toEqual(["hero:3"]);
  });

  it("drops a typed stat equal to the unit's own, and the unit once it has none", () => {
    const changed = withOverrideStat({}, wolf, "weapon_skill", "5");
    expect(changed).toEqual({ "hero:1": { stats: { weapon_skill: 5 } } });
    expect(withOverrideStat(changed, wolf, "weapon_skill", "4")).toEqual({});
    expect(withOverrideStat(changed, wolf, "weapon_skill", "")).toEqual({});
  });

  it("keeps notes per unit and drops empty ones", () => {
    expect(withUnitNotes({}, "hero:1", "Limping")).toEqual({ "hero:1": "Limping" });
    expect(withUnitNotes({ "hero:1": "Limping" }, "hero:1", "")).toEqual({});
  });

  it("reads a typed rating as a whole number from 0 to 9999", () => {
    expect(parseDeclaredRating(" 57 ")).toBe(57);
    expect(parseDeclaredRating("12345")).toBe(9999);
    expect(parseDeclaredRating("")).toBeNull();
    expect(parseDeclaredRating("abc")).toBeNull();
  });

  it("adds temporary units to the declared rating, yours from the form", () => {
    const ogre = { key: "custom:1", rating: 20 } as PrebattleUnit;
    const ratings = statusRatings(
      [myParticipant({ declared_rating: 57 }), opponentParticipant({ declared_rating: null })],
      ME.id,
      [ogre]
    );

    expect(ratings).toEqual({ 7: 77, 9: null });
  });

  it("builds the config body from the form", () => {
    const payload = buildConfigPayload(
      {},
      {
        allUnits: [wolf],
        customUnits: [],
        selectedKeys: ["hero:1"],
        overrides: {},
        notes: { "hero:1": "Limping" },
        declaredRating: 57,
        battleNotes: "Ambush",
      }
    );

    expect(payload).toMatchObject({
      selected_unit_keys_json: ["hero:1"],
      custom_units_json: [],
      declared_rating: 57,
      battle_notes: "Ambush",
    });
    expect(payload.unit_information_json["hero:1"]?.notes).toBe("Limping");
  });
});
