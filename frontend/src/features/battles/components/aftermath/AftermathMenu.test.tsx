/**
 * The Aftermath's ⋯ menu (William, 18 Nov 2026: "close post battle shouldn't be an option at all,
 * you shouldn't have control over somewhere else outside of the battle control settings page";
 * "skip post battle should just become skip aftermath"): Skip aftermath, and nothing else.
 */
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PostgameBattle } from "@/features/battles/hooks/usePostgameBattle";
import { BATTLE_ID, CAMPAIGN_ID, battleState, myParticipant } from "@/test/battle-fixtures";
import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";

import AftermathMenu from "./AftermathMenu";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

vi.mock("@/stores/app-store", () => ({
  useAppStore: () => ({ clearCurrentBattleSession: vi.fn() }),
}));

const SKIP = `POST /campaigns/${CAMPAIGN_ID}/battles/${BATTLE_ID}/skip-postbattle/`;

const show = (applied: ("injuries" | "xp" | "explore")[] = []) => {
  const state = battleState({ status: "postbattle" });
  const participant = myParticipant({
    status: "finished_battle",
    postbattle_json: {
      exploration: { dice_values: [], resource_id: null },
      finds: { gold_crowns: 0, items: [] },
      upkeep: { pay_upkeep: true, entries: {} },
      unit_results: {},
      aftermath: { applied, done_at: null, received: {} },
    },
  });
  const battle = {
    participant,
    applyBattleResponse: vi.fn(),
    capabilities: { close_postbattle: true, confirm_results: true },
  } as unknown as PostgameBattle;
  renderWithQueryClient(<AftermathMenu battle={battle} battleState={state} />);
  return battle;
};

beforeEach(() => {
  fakeApi.reset();
  fakeApi.on(SKIP, battleState({ status: "ended" }));
});

describe("The Aftermath's menu", () => {
  it("offers Skip aftermath and never closes anyone else's post-battle", async () => {
    show();

    await userEvent.click(screen.getByRole("button", { name: "More post-battle actions" }));

    expect(screen.getByRole("menuitem", { name: "Skip aftermath" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /close/i })).toBeNull();
  });

  it("asks first, then skips the rest of the aftermath", async () => {
    const battle = show();

    await userEvent.click(screen.getByRole("button", { name: "More post-battle actions" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Skip aftermath" }));
    expect(screen.getByText(/Nothing else from this page is applied/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Skip aftermath" }));

    await waitFor(() => expect(fakeApi.calls()).toContain(SKIP));
    expect(battle.applyBattleResponse).toHaveBeenCalled();
  });

  it("says a step already confirmed stays in the warband", async () => {
    show(["injuries"]);

    await userEvent.click(screen.getByRole("button", { name: "More post-battle actions" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Skip aftermath" }));

    expect(screen.getByText(/already confirmed stay in your warband/)).toBeInTheDocument();
  });
});
