import { MemoryRouter } from "react-router-dom";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithQueryClient } from "@/test/query-test-utils";

import type { CampaignBattleHistoryEntry } from "../../types/campaign-types";
import BattleRows from "./BattleRows";

const battle = (id: number, scenario: string): CampaignBattleHistoryEntry => ({
  id,
  number: id,
  scenario,
  winners: [],
  date: "5 Nov",
  participants: [],
  moments: [],
});

describe("BattleRows", () => {
  const battles = [battle(2, "Street Fight"), battle(1, "Bridge")];

  it("starts with the newest battle open", () => {
    renderWithQueryClient(
      <MemoryRouter>
        <BattleRows battles={battles} campaignId={7} isMobile={false} />
      </MemoryRouter>
    );
    expect(screen.getByRole("button", { name: /Street Fight/ })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
  });

  // the header's Record window links a battle (William, 22 Nov 2026)
  it("starts with a linked battle open instead", () => {
    renderWithQueryClient(
      <MemoryRouter>
        <BattleRows battles={battles} campaignId={7} isMobile={false} linkedId={1} />
      </MemoryRouter>
    );
    expect(screen.getByRole("button", { name: /Bridge/ })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: /Street Fight/ })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
  });
});
