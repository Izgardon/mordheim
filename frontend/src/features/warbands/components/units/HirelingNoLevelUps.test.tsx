import { screen } from "@testing-library/react";

import { renderWithQueryClient } from "@/test/query-test-utils";
import { describe, expect, it, vi } from "vitest";

import UnitExpandedCard from "./UnitExpandedCard";
import UnitSummaryCard from "./UnitSummaryCard";
import { hirelingKind } from "../../units/kinds/hireling";

import type { WarbandHireling } from "../../types/warband-types";

vi.mock("../shared/unit_details/ExperienceBar", () => ({
  default: () => <div data-testid="experience-bar" />,
}));

vi.mock("./UnitListBlocks", () => ({
  default: () => <div data-testid="hireling-list-blocks" />,
}));

vi.mock("@/features/spells/components/NewHirelingSpellDialog", () => ({
  default: () => null,
}));

vi.mock("@/features/skills/components/NewHirelingSkillDialog", () => ({
  default: () => null,
}));

const baseHireling: WarbandHireling = {
  id: 2,
  warband_id: 1,
  name: "Ogre Bodyguard",
  unit_type: "Ogre",
  race_id: 1,
  race_name: "Ogre",
  price: 80,
  hire_cost_expression: null,
  upkeep_price: 15,
  upkeep_cost_expression: null,
  rating: 20,
  xp: 4,
  kills: 0,
  level_up: 0,
  deeds: "Test deeds",
  armour_save: null,
  large: true,
  caster: "No",
  half_rate: false,
  no_level_ups: false,
  blood_pacted: false,
  dead: false,
  movement: 6,
  weapon_skill: 4,
  ballistic_skill: 2,
  strength: 4,
  toughness: 4,
  wounds: 3,
  initiative: 3,
  attacks: 3,
  leadership: 7,
  created_at: "2026-04-04T10:00:00Z",
  updated_at: "2026-04-04T10:00:00Z",
  race: {
    name: "Ogre",
    movement: 6,
    weapon_skill: 4,
    ballistic_skill: 2,
    strength: 4,
    toughness: 4,
    wounds: 3,
    initiative: 3,
    attacks: 3,
    leadership: 7,
  },
  items: [],
  skills: [],
  specials: [],
  spells: [],
};

describe("Hired sword no level ups", () => {
  it("hides the summary experience bar when no_level_ups is enabled", () => {
    const { rerender } = renderWithQueryClient(
      <UnitSummaryCard
        kind={hirelingKind}
        unit={baseHireling}
        warbandId={1}
        renderExpandedCard={false}
      />
    );

    expect(screen.getByTestId("experience-bar")).toBeInTheDocument();

    rerender(
      <UnitSummaryCard
        kind={hirelingKind}
        unit={{ ...baseHireling, no_level_ups: true }}
        warbandId={1}
        renderExpandedCard={false}
      />
    );

    expect(screen.queryByTestId("experience-bar")).not.toBeInTheDocument();
  });

  it("hides the expanded experience bar when no_level_ups is enabled", () => {
    const { rerender } = renderWithQueryClient(
      <UnitExpandedCard kind={hirelingKind} unit={baseHireling} warbandId={1} onClose={() => {}} />
    );

    expect(screen.getByTestId("experience-bar")).toBeInTheDocument();

    rerender(
      <UnitExpandedCard
        kind={hirelingKind}
        unit={{ ...baseHireling, no_level_ups: true }}
        warbandId={1}
        onClose={() => {}}
      />
    );

    expect(screen.queryByTestId("experience-bar")).not.toBeInTheDocument();
  });
});
