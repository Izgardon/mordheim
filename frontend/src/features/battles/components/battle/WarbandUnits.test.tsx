/**
 * The battle's cards sit under a heading per unit type (William, 12 Nov 2026: "by unit type"),
 * your own side and another warband's alike; a type nobody brought has no heading.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { toParticipantRosters } from "@/features/battles/api/battle-queries";
import {
  battleRosters,
  ME,
  myParticipant,
  OPPONENT,
  opponentParticipant,
} from "@/test/battle-fixtures";

import { battleSections } from "./battle-units";
import WarbandUnits from "./WarbandUnits";

const headings = () => screen.getAllByRole("heading", { level: 2 }).map((node) => node.textContent);

const sectionsOf = (mine: boolean) => {
  const rosters = toParticipantRosters(battleRosters());
  return mine
    ? battleSections(myParticipant(), rosters[ME.id])
    : battleSections(opponentParticipant(), rosters[OPPONENT.id]);
};

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
    expect(headings()).toEqual(["Heroes", "Hired swords", "Henchmen"]);
    expect(screen.getByRole("article", { name: "Captain Wolf" })).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Youngbloods" })).toBeInTheDocument();
  });

  it("heads another warband's the same way, with nothing to act on", () => {
    render(<WarbandUnits sections={sectionsOf(false)} isMobile onOpen={vi.fn()} />);

    expect(headings()).toEqual(["Heroes"]);
    expect(screen.queryByRole("button", { name: "Add a unit" })).toBeNull();
  });
});
