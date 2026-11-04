/**
 * The lad's got talent on a group whose rules say it can't be promoted (`promotable` off, copied
 * from its template fighter) warns and still promotes.
 */
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithQueryClient } from "@/test/query-test-utils";

import type { HenchmenGroup } from "../../types/warband-types";
import LadsGotTalent from "./LadsGotTalent";

const zombies = {
  id: 4,
  warband_id: 9,
  name: "Zombies",
  unit_type: "Zombie",
  promotable: false,
  henchmen: [{ id: 1, name: "Shambler", dead: false }],
} as unknown as HenchmenGroup;

describe("LadsGotTalent", () => {
  it("warns when the group can't be promoted in its rules, and still offers the promotion", () => {
    renderWithQueryClient(
      <LadsGotTalent
        group={zombies}
        warbandId={9}
        heroes={[]}
        maxHeroes={6}
        onPromoted={() => undefined}
      />
    );
    expect(screen.getByText("Zombies can't be promoted in their rules.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pick who joins the heroes" })).toBeInTheDocument();
  });

  it("says nothing for a group that can be promoted", () => {
    renderWithQueryClient(
      <LadsGotTalent
        group={{ ...zombies, promotable: true }}
        warbandId={9}
        heroes={[]}
        maxHeroes={6}
        onPromoted={() => undefined}
      />
    );
    expect(screen.queryByText(/can't be promoted/)).toBeNull();
  });
});
