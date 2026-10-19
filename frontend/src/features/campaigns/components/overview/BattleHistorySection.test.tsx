import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";
import type { CampaignBattleHistoryEntry, CampaignPlayer } from "../../types/campaign-types";
import BattleHistorySection from "./BattleHistorySection";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/features/auth/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: 7 } }) }));

const RECORD_PATH = "/campaigns/1/battles/40/record/";

const players: CampaignPlayer[] = [
  {
    id: 7,
    name: "Owner",
    warband: { id: 101, name: "Iron Vultures", faction: "", wins: 0, losses: 0 },
  },
  {
    id: 9,
    name: "Player",
    warband: { id: 102, name: "Night Razors", faction: "", wins: 0, losses: 0 },
  },
  {
    id: 12,
    name: "Bors",
    warband: { id: 103, name: "Grey Wardens", faction: "", wins: 0, losses: 0 },
  },
];

const history: CampaignBattleHistoryEntry[] = [
  {
    id: 40,
    scenario: "Street Fight",
    winners: ["Night Razors"],
    date: "18/10/26",
    participants: [
      {
        warband_id: 101,
        warband_name: "Iron Vultures",
        kills: 0,
        ooas: 0,
        deaths: [],
        xp_gain: 0,
        exploration: [],
      },
      {
        warband_id: 102,
        warband_name: "Night Razors",
        kills: 1,
        ooas: 0,
        deaths: [],
        xp_gain: 2,
        exploration: [],
      },
    ],
  },
];

const renderSection = (canEditRecords: boolean) => {
  const onRecordSaved = vi.fn();
  renderWithQueryClient(
    <BattleHistorySection
      campaignId={1}
      canEditRecords={canEditRecords}
      onRecordSaved={onRecordSaved}
      isLoading={false}
      error=""
      battles={history}
      players={players}
      isMobile={false}
      mobileExpanded
      onToggleMobileExpanded={vi.fn()}
    />
  );
  return onRecordSaved;
};

describe("BattleHistorySection (BATL-NEW-04)", () => {
  beforeEach(() => {
    fakeApi.reset();
    fakeApi.on(`GET ${RECORD_PATH}`, {
      battle_id: 40,
      flow_type: "normal",
      scenario: "Street Fight",
      scenario_link: null,
      date: "2026-10-18",
      participants: [
        {
          warband_id: 101,
          warband_name: "Iron Vultures",
          user_id: 7,
          user_label: "Owner",
          declared_rating: 120,
          removed: false,
        },
        {
          warband_id: 102,
          warband_name: "Night Razors",
          user_id: 9,
          user_label: "Player",
          declared_rating: 140,
          removed: false,
        },
      ],
      winner_warband_ids: [102],
      loser_warband_ids: [101],
    });
    fakeApi.on(`PATCH ${RECORD_PATH}`, () => ({ battle: {}, participants: [], events: [] }));
  });

  it("edits a past battle's record, saying nothing else is recalculated", async () => {
    const user = setupUser();
    const onRecordSaved = renderSection(true);

    await user.click(screen.getByText("Street Fight"));
    await user.click(screen.getByRole("button", { name: "Edit the record of Street Fight" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit battle record" });
    expect(dialog).toHaveAccessibleDescription(
      /Only this battle's record changes. No wins, losses, XP, gold or kills are recalculated/
    );
    const scenario = await within(dialog).findByDisplayValue("Street Fight");
    await user.clear(scenario);
    await user.type(scenario, "Street Brawl");
    await user.click(within(dialog).getByRole("checkbox", { name: "Grey Wardens took part" }));
    await user.click(within(dialog).getByRole("checkbox", { name: "Night Razors won" }));
    await user.click(within(dialog).getByRole("checkbox", { name: "Grey Wardens won" }));
    await user.click(within(dialog).getByRole("button", { name: "Save record" }));

    await waitFor(() => expect(onRecordSaved).toHaveBeenCalled());
    expect(fakeApi.bodyOf(`PATCH ${RECORD_PATH}`)).toEqual({
      scenario: "Street Brawl",
      scenario_link: null,
      date: "2026-10-18",
      participants: [{ warband_id: 101 }, { warband_id: 102 }, { warband_id: 103 }],
      winners: [103],
      losers: [101, 102],
    });
  });

  it("offers Edit record only to battle managers", async () => {
    const user = setupUser();
    renderSection(false);
    await user.click(screen.getByText("Street Fight"));
    expect(screen.queryByRole("button", { name: /Edit the record/ })).toBeNull();
  });
});
