/**
 * A hireling on the warband sheet, by kind: the card says "Hired sword" or "Dramatis persona"
 * (never "hireling"); a dramatis persona shows his stay and pay, no level, no XP bar and no
 * Level Up!; an upkeep formula shows as a reminder; the expanded card lists the terms.
 */
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWithQueryClient } from "@/test/query-test-utils";
import { makeVeteranHireling } from "@/test/warband-fixtures";

import UnitExpandedCard from "./UnitExpandedCard";
import UnitLevelUpControl from "./UnitLevelUpControl";
import UnitSummaryCard from "./UnitSummaryCard";
import { hirelingKind } from "../../units/kinds/hireling";

vi.mock("../shared/unit_details/ExperienceBar", () => ({
  default: () => <div data-testid="experience-bar" />,
}));
vi.mock("./UnitListBlocks", () => ({ default: () => null }));
vi.mock("@/features/spells/components/NewHirelingSpellDialog", () => ({ default: () => null }));
vi.mock("@/features/skills/components/NewHirelingSkillDialog", () => ({ default: () => null }));

/** Bertha, hired from the catalogue: one battle, paid in a shard, on the hero table. */
const bertha = makeVeteranHireling({
  id: 60,
  name: "Bertha",
  unit_type: "Bertha Bestraufrung",
  kind: "dramatis_persona",
  injury_table: "hero",
  stays: "one_battle",
  payment_note: "25 gc or 1 shard",
  no_level_ups: true,
  level_up: 1,
  upkeep_price: 0,
});

const summary = (unit = bertha) =>
  renderWithQueryClient(
    <UnitSummaryCard kind={hirelingKind} unit={unit} warbandId={1} renderExpandedCard={false} />
  );

describe("a hireling's card, by kind", () => {
  it("labels a hired sword Hired sword, with its level and type", () => {
    summary(makeVeteranHireling());

    expect(screen.getByText("Hired sword")).toBeVisible();
    expect(screen.getByText(/^Level \d+ Warrior Priest$/)).toBeVisible();
    expect(screen.queryByText(/hireling/i)).toBeNull();
  });

  it("labels a dramatis persona Dramatis persona, with his stay and pay and no level", () => {
    summary();

    expect(screen.getByText("Dramatis persona")).toBeVisible();
    expect(screen.getByText("Bertha Bestraufrung")).toBeVisible();
    expect(screen.queryByText(/^Level/)).toBeNull();
    expect(screen.getByText("One battle · Paid in 25 gc or 1 shard")).toBeVisible();
  });

  it("gives a dramatis persona no XP bar, even one typed by hand without no_level_ups", () => {
    summary({ ...bertha, no_level_ups: false });

    expect(screen.queryByTestId("experience-bar")).toBeNull();
  });

  it("offers a dramatis persona no Level Up!, whatever the payload's level-ups", () => {
    renderWithQueryClient(
      <UnitLevelUpControl
        kind={hirelingKind}
        unit={{ ...bertha, no_level_ups: false }}
        warbandId={1}
        trigger={<button type="button">Level Up!</button>}
      />
    );

    expect(screen.queryByRole("button", { name: "Level Up!" })).toBeNull();
  });

  it("shows an upkeep formula as a reminder", () => {
    summary(
      makeVeteranHireling({ upkeep_price: 0, upkeep_cost_expression: "1 piece of wyrdstone" })
    );

    expect(screen.getByText("Upkeep: 1 piece of wyrdstone")).toBeVisible();
  });

  it("lists the upkeep formula, the hero table and a dramatis persona's terms on the expanded card", () => {
    renderWithQueryClient(
      <UnitExpandedCard
        kind={hirelingKind}
        unit={{ ...bertha, upkeep_cost_expression: "1 piece of wyrdstone" }}
        warbandId={1}
        onClose={() => {}}
      />
    );

    expect(screen.getAllByText("1 piece of wyrdstone").length).toBeGreaterThan(0);
    // The expanded card fades in, so these are in the page rather than visible yet.
    expect(screen.getByText("Hero table")).toBeInTheDocument();
    expect(screen.getByText("One battle")).toBeInTheDocument();
    expect(screen.getByText("25 gc or 1 shard")).toBeInTheDocument();
    expect(screen.queryByTestId("experience-bar")).toBeNull();
  });
});
