/**
 * The battle's cards sit under a heading per unit type (William, 12 Nov 2026: "by unit type"),
 * your own side and another warband's alike; a type nobody brought has no heading. A model whose
 * status has just changed wears a brief mark (item 10).
 */
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { toParticipantRosters } from "@/features/battles/api/battle-queries";
import type { BattleUnitInformationEntry } from "@/features/battles/types/battle-types";
import {
  battleRosters,
  ME,
  myParticipant,
  OPPONENT,
  opponentParticipant,
} from "@/test/battle-fixtures";

import { battleSections } from "./battle-units";
import { STATUS_MARK_MS } from "./use-recent-status";
import WarbandUnits from "./WarbandUnits";

const headings = () => screen.getAllByRole("heading", { level: 2 }).map((node) => node.textContent);

const sectionsOf = (
  mine: boolean,
  information: Record<string, Partial<BattleUnitInformationEntry>> = {}
) => {
  const rosters = toParticipantRosters(battleRosters());
  return mine
    ? battleSections(myParticipant({ unit_information_json: information }), rosters[ME.id])
    : battleSections(
        opponentParticipant({ unit_information_json: information }),
        rosters[OPPONENT.id]
      );
};

const marks = (name: string) =>
  screen.getByRole("article", { name }).querySelectorAll(".status-flash").length;

afterEach(() => vi.useRealTimers());

describe("WarbandUnits", () => {
  it("heads each section of your own side, in the cards' order", () => {
    render(
      <WarbandUnits
        sections={sectionsOf(true)}
        isMobile={false}
        onOpen={vi.fn()}
        actions={{
          canAct: true,
          savingKeys: {},
          onKill: vi.fn(),
          onStatus: vi.fn(),
          onWounds: vi.fn(),
          onDismount: vi.fn(),
          onNote: vi.fn(),
          onAdd: vi.fn(),
        }}
      />
    );

    // no animals and no temporary units in the fixture: those headings stay away
    expect(headings()).toEqual(["Heroes", "Henchmen", "Hired swords"]);
    // what the phone's Jump button steps through
    expect(
      screen.getAllByRole("heading", { level: 2 }).map((node) => node.dataset.jumpSection)
    ).toEqual(["hero", "henchman", "hireling"]);
    expect(screen.getByRole("article", { name: "Captain Wolf" })).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Youngbloods" })).toBeInTheDocument();
  });

  it("marks a model whose status changed, and only until the mark runs out", () => {
    vi.useFakeTimers();
    const { rerender } = render(
      <WarbandUnits sections={sectionsOf(false)} isMobile onOpen={vi.fn()} />
    );
    const card = () => screen.getByRole("article", { name: "Black Fang" });

    expect(card()).not.toHaveClass("status-flash");

    rerender(
      <WarbandUnits
        sections={sectionsOf(false, { "hero:2": { status: "knocked_down" } })}
        isMobile
        onOpen={vi.fn()}
      />
    );
    // the model (the card) and the card's status section
    expect(card()).toHaveClass("status-flash");
    expect(marks("Black Fang")).toBe(1);

    act(() => void vi.advanceTimersByTime(STATUS_MARK_MS + 10));
    expect(card()).not.toHaveClass("status-flash");
    expect(marks("Black Fang")).toBe(0);
  });

  it("marks a henchman's tile inside his group's card", () => {
    vi.useFakeTimers();
    const { rerender } = render(
      <WarbandUnits sections={sectionsOf(true)} isMobile onOpen={vi.fn()} />
    );

    expect(marks("Youngbloods")).toBe(0);

    rerender(
      <WarbandUnits
        sections={sectionsOf(true, { "henchman:2": { status: "stunned" } })}
        isMobile
        onOpen={vi.fn()}
      />
    );
    expect(marks("Youngbloods")).toBe(1);
    expect(screen.getByRole("article", { name: "Youngbloods" })).not.toHaveClass("status-flash");

    act(() => void vi.advanceTimersByTime(STATUS_MARK_MS + 10));
    expect(marks("Youngbloods")).toBe(0);
  });

  it("heads another warband's the same way, with nothing to act on", () => {
    render(<WarbandUnits sections={sectionsOf(false)} isMobile onOpen={vi.fn()} />);

    expect(headings()).toEqual(["Heroes"]);
    expect(screen.queryByRole("button", { name: "Add a unit" })).toBeNull();
  });
});
