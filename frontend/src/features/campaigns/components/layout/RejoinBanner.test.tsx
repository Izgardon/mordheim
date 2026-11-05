/**
 * The rejoin banner (William: "a permanent banner at the top prompting to rejoin"): where you are
 * and one button there, its label following where you stand; with several battles, the one that
 * needs you most and "+N more" to the Battles page. Nothing to dismiss.
 */
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import type { BattleViewer } from "@/features/battles/types/battle-types";
import { yourOpenBattles } from "@/features/battles/utils/open-battles";
import { battleState } from "@/test/battle-fixtures";

import RejoinBanner from "./RejoinBanner";

const open = (id: number, viewer: BattleViewer, scenario = "Street Fight") => {
  const state = battleState({ id, number: 6, scenario });
  state.viewer = viewer;
  return state;
};

function renderBanner(states: ReturnType<typeof open>[]) {
  return render(
    <MemoryRouter>
      <RejoinBanner campaignId={1} battles={yourOpenBattles(states)} />
    </MemoryRouter>
  );
}

describe("RejoinBanner", () => {
  it("says where you are, with one way back and nothing to dismiss", () => {
    renderBanner([open(40, { participant_status: "in_battle", unfinished: true, page: "active" })]);

    const banner = screen.getByRole("status", { name: "Your battle" });
    expect(banner).toHaveTextContent("You're in a battle: Street Fight, Battle 6");
    expect(within(banner).getAllByRole("link")).toHaveLength(1);
    expect(within(banner).getByRole("link", { name: "Rejoin" })).toHaveAttribute(
      "href",
      "/campaigns/1/battles/40/active"
    );
    expect(screen.queryByRole("button", { name: /dismiss|close/i })).toBeNull();
  });

  it.each([
    ["finished_battle", "postbattle", "To the Aftermath", "You're in a battle"],
    ["ready", "prebattle", "Open pre-battle", "You're in a battle"],
    ["invited", "prebattle", "Answer the invitation", "You're invited to a battle"],
  ] as const)("a %s player on %s reads %s", (status, page, action, lead) => {
    renderBanner([open(40, { participant_status: status, unfinished: true, page })]);

    expect(screen.getByRole("status", { name: "Your battle" })).toHaveTextContent(lead);
    expect(screen.getByRole("link", { name: action })).toHaveAttribute(
      "href",
      `/campaigns/1/battles/40/${page}`
    );
  });

  it("shows the battle that needs you most, and the rest as +N more", () => {
    renderBanner([
      open(42, { participant_status: "invited", unfinished: true, page: "prebattle" }, "Ambush"),
      open(41, { participant_status: "accepted", unfinished: true, page: "prebattle" }, "Raid"),
      open(40, { participant_status: "finished_battle", unfinished: true, page: "postbattle" }),
    ]);

    const banner = screen.getByRole("status", { name: "Your battle" });
    expect(banner).toHaveTextContent("You're in a battle: Street Fight, Battle 6");
    expect(within(banner).getByRole("link", { name: "To the Aftermath" })).toBeInTheDocument();
    expect(within(banner).getByRole("link", { name: "+2 more" })).toHaveAttribute(
      "href",
      "/campaigns/1/battles"
    );
  });

  it("shows nothing with no unfinished battle", () => {
    renderBanner([
      open(40, { participant_status: "confirmed_postbattle", unfinished: false, page: null }),
    ]);

    expect(screen.queryByRole("status")).toBeNull();
  });
});
