import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { toParticipantRosters } from "@/features/battles/api/battle-queries";
import type { BattleRosterMap } from "@/features/battles/types/battle-types";
import { battleRosters, OPPONENT, opponentParticipant } from "@/test/battle-fixtures";
import { setupUser } from "@/test/user-event";

import { battleSides } from "./battle-units";
import { OtherWarband } from "./SideUnits";

/** The opponent's hero with gear, a skill and a rule, as `GET rosters/` sends everyone's. */
function theirRosters(): BattleRosterMap {
  const rosters = battleRosters();
  const theirs = rosters[String(OPPONENT.id)];
  theirs.heroes = [
    {
      ...theirs.heroes[0],
      items: [{ id: 31, name: "Throwing Knives", count: 2, singleUse: false }],
      skills: [{ id: 41, name: "Step Aside" }],
      specials: [{ id: 51, name: "Fear" }],
    },
  ];
  return rosters;
}

function renderTheirs(map: BattleRosterMap = theirRosters()) {
  const rosters = toParticipantRosters(map);
  const participant = opponentParticipant();
  const [side] = battleSides([participant], rosters, [], OPPONENT.id + 1);
  if (side.kind !== "warband") throw new Error("expected a warband side");
  const onOpen = vi.fn();
  render(
    <OtherWarband side={side} roster={rosters[OPPONENT.id]} isMobile={false} onOpen={onOpen} />
  );
  return { onOpen };
}

describe("OtherWarband", () => {
  it("shows another warband's unit whole: its profile, gear, skills and rules", async () => {
    const user = setupUser();
    const { onOpen } = renderTheirs();

    const card = screen.getByRole("article", { name: "Black Fang" });
    expect(within(card).getByText("Assassin")).toBeInTheDocument();
    // the ten-cell profile, which the old rows left out entirely
    expect(within(card).getByText("WS")).toBeInTheDocument();
    expect(within(card).getByText("Ld")).toBeInTheDocument();
    expect(within(card).getByText("Standing")).toBeInTheDocument();
    expect(within(card).getByText("W 1/1")).toBeInTheDocument();

    await user.click(within(card).getByRole("button", { name: /Gear/ }));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ key: "hero:2" }), "gear");

    await user.click(within(card).getByRole("button", { name: /Skills/ }));
    expect(onOpen).toHaveBeenLastCalledWith(expect.objectContaining({ key: "hero:2" }), "skills");
  });

  it("offers nothing that changes their unit", () => {
    renderTheirs();
    const card = screen.getByRole("article", { name: "Black Fang" });

    expect(within(card).queryByRole("button", { name: /Kill/ })).toBeNull();
    expect(within(card).queryByRole("button", { name: /Tap for the next/ })).toBeNull();
    expect(within(card).queryByRole("group", { name: /Wounds for/ })).toBeNull();
    expect(within(card).queryByRole("button", { name: /note/i })).toBeNull();
    expect(screen.queryByRole("button", { name: "Add a unit" })).toBeNull();
  });

  it("says so while their roster is still being read", () => {
    const rosters = toParticipantRosters(theirRosters());
    const participant = opponentParticipant();
    const [side] = battleSides([participant], rosters, [], OPPONENT.id + 1);
    if (side.kind !== "warband") throw new Error("expected a warband side");
    render(<OtherWarband side={side} roster={undefined} isMobile={false} onOpen={vi.fn()} />);

    expect(screen.getByText("Reading their roster…")).toBeInTheDocument();
  });
});
