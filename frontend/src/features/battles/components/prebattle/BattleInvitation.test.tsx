import { screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PrebattlePage } from "@/features/battles/hooks/usePrebattlePage";
import { BATTLE_ID, CAMPAIGN_ID, battleState, myParticipant } from "@/test/battle-fixtures";
import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { makeScenario } from "@/test/scenario-fixtures";
import { setupUser } from "@/test/user-event";

import BattleInvitation from "./BattleInvitation";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

/** The invitation's page, as much of it as the card reads. */
function page(scenarioId: number | null): PrebattlePage {
  const state = battleState({ status: "inviting", scenario: "Skirmish", scenario_id: scenarioId });
  return {
    battle: { battleState: state, campaignId: CAMPAIGN_ID, battleId: BATTLE_ID },
    selection: { currentParticipant: myParticipant({ status: "invited" }) },
    ready: { actionError: "", isAcceptingInvite: false, acceptInvite: vi.fn() },
    flags: { isBattleCreator: false, canAcceptInvite: false, canDeclineInvite: false },
    declining: { error: "", isDeclining: false, decline: vi.fn() },
    creatorCancel: { setIsOpen: vi.fn() },
  } as unknown as PrebattlePage;
}

const show = (scenarioId: number | null) =>
  renderWithQueryClient(
    <MemoryRouter>
      <BattleInvitation page={page(scenarioId)} />
    </MemoryRouter>
  );

describe("BattleInvitation", () => {
  beforeEach(() => fakeApi.reset());

  it("opens the campaign scenario it is played as from Read the scenario", async () => {
    fakeApi.on("GET /scenarios/4/", makeScenario({ id: 4, name: "Skirmish" }));
    const user = setupUser();
    show(4);

    await user.click(screen.getByRole("button", { name: "Read the scenario" }));

    const details = await screen.findByRole("dialog", { name: "Skirmish" });
    expect(
      await within(details).findByRole("heading", { name: "Special rules" })
    ).toBeInTheDocument();
  });

  it("offers nothing to read for a typed scenario", () => {
    show(null);
    expect(screen.getByRole("heading", { name: "Skirmish" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Read the scenario" })).toBeNull();
  });
});
