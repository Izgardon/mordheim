import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import HenchmenExpandedCard from "./HenchmenExpandedCard";
import HenchmenSummaryCard from "./HenchmenSummaryCard";

import type { HenchmenGroup } from "../../../types/warband-types";

vi.mock("../../shared/unit_details/ExperienceBar", () => ({
  default: () => <div data-testid="experience-bar" />,
}));

vi.mock("../blocks/HenchmenListBlocks", () => ({
  default: () => <div data-testid="henchmen-list-blocks" />,
}));

const baseGroup: HenchmenGroup = {
  id: 1,
  warband_id: 1,
  name: "Black Knives",
  unit_type: "Thugs",
  race_id: 1,
  race_name: "Human",
  price: 25,
  xp: 4,
  max_size: 5,
  level_up: 0,
  deeds: "Test deeds",
  armour_save: null,
  large: false,
  half_rate: false,
  no_level_ups: false,
  dead: false,
  movement: 4,
  weapon_skill: 2,
  ballistic_skill: 2,
  strength: 3,
  toughness: 3,
  wounds: 1,
  initiative: 3,
  attacks: 1,
  leadership: 6,
  race: {
    name: "Human",
    movement: 4,
    weapon_skill: 2,
    ballistic_skill: 2,
    strength: 3,
    toughness: 3,
    wounds: 1,
    initiative: 3,
    attacks: 1,
    leadership: 6,
  },
  items: [],
  skills: [],
  specials: [],
  henchmen: [{ id: 10, name: "Blade One", kills: 0, dead: false }],
};

describe("Henchmen no level ups", () => {
  it("hides the summary experience bar when no_level_ups is enabled", () => {
    const { rerender } = render(
      <HenchmenSummaryCard group={baseGroup} warbandId={1} renderExpandedCard={false} />
    );

    expect(screen.getByTestId("experience-bar")).toBeInTheDocument();

    rerender(
      <HenchmenSummaryCard
        group={{ ...baseGroup, no_level_ups: true }}
        warbandId={1}
        renderExpandedCard={false}
      />
    );

    expect(screen.queryByTestId("experience-bar")).not.toBeInTheDocument();
  });

  it("hides the expanded experience bar when no_level_ups is enabled", () => {
    const { rerender } = render(
      <HenchmenExpandedCard group={baseGroup} warbandId={1} onClose={() => {}} />
    );

    expect(screen.getByTestId("experience-bar")).toBeInTheDocument();

    rerender(
      <HenchmenExpandedCard
        group={{ ...baseGroup, no_level_ups: true }}
        warbandId={1}
        onClose={() => {}}
      />
    );

    expect(screen.queryByTestId("experience-bar")).not.toBeInTheDocument();
  });
});
