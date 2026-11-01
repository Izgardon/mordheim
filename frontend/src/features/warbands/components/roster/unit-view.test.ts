import { describe, expect, it } from "vitest";

import type { UnitKill } from "../../types/warband-types";
import { killLine, unitTypeLine, type RosterUnit } from "./unit-view";

const kill = (fields: Partial<UnitKill> = {}): UnitKill => ({
  id: 1,
  victim: "Magister Halvard",
  victim_kind: "hero",
  victim_warband: "Grey Order",
  battle_id: 4,
  scenario: "Street Fight",
  date: "2026-03-24T20:00:00+00:00",
  round: 2,
  phase: "fight",
  how: "melee",
  by: null,
  ...fields,
});

describe("killLine", () => {
  it("names the victim, the battle, the round and how", () => {
    expect(killLine(kill())).toBe("Magister Halvard · Street Fight · round 2 · melee");
  });

  it("says which model of a group scored it", () => {
    expect(killLine(kill({ by: "Kurt", how: null }))).toBe(
      "Magister Halvard · Street Fight · round 2 · by Kurt"
    );
  });

  it("marks a kill logged after the fight, and dates a battle with no scenario", () => {
    expect(killLine(kill({ round: null, phase: "after", how: "other" }))).toBe(
      "Magister Halvard · Street Fight · after the fight · other"
    );
    expect(killLine(kill({ scenario: " " }))).toBe("Magister Halvard · 24 Mar · round 2 · melee");
  });
});

describe("unitTypeLine", () => {
  const hireling = (fields: Record<string, unknown>) =>
    ({ kind: "hireling", unit: { id: 3, ...fields } }) as unknown as RosterUnit;

  it("shows the type, unless it is the name already", () => {
    expect(unitTypeLine(hireling({ name: "Grukk", unit_type: "Ogre Bodyguard" }))).toBe(
      "Ogre Bodyguard"
    );
    // a dramatis persona hired as himself printed his name twice (After the passes)
    const persona = { name: "Bertha Bestraufrung", unit_type: "Bertha Bestraufrung" };
    expect(unitTypeLine(hireling({ ...persona, kind: "dramatis_persona" }))).toBe(
      "Dramatis persona"
    );
    expect(unitTypeLine(hireling({ name: "", unit_type: "Ogre Bodyguard" }))).toBe("Hired sword");
    expect(unitTypeLine(hireling({ name: "", unit_type: "" }))).toBe("");
  });
});
