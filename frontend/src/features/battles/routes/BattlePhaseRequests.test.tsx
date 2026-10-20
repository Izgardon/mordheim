/**
 * Requests a creator's walk through the three phase pages sends: `BattleLayout` reads the battle's
 * state and the rosters once, and moving from page to page reads neither again (PERF-38); Finish my
 * battle's answer brings postbattle's rules and suggestions, so it needs no read either (item 8).
 */
import { act, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createQueryClient } from "@/lib/query-client";
import {
  ME,
  battlePath,
  battleRosters,
  battleState,
  mySheet,
  postbattleRules,
  statePath,
} from "@/test/battle-fixtures";
import { renderBattleRoute } from "@/test/battle-routes";
import { fakeApi } from "@/test/fake-api";
import { setupUser } from "@/test/user-event";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/lib/realtime/client", async () => (await import("@/test/fake-realtime")).fakeClient);
vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: 7, email: "owner@example.com" } }),
}));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));
vi.mock("@/features/realtime/components/CampaignDiceRollerMenu", () => ({ default: () => null }));

describe("battle phase requests", () => {
  it("reads rosters/ once and the state once from prebattle to postbattle (PERF-38, item 8)", async () => {
    const user = setupUser();
    fakeApi.reset();
    fakeApi.on(
      `GET ${statePath("prebattle")}`,
      battleState({ status: "prebattle", me: { status: "ready" }, opponent: { status: "ready" } })
    );
    fakeApi.on(`GET ${battlePath("rosters/")}`, battleRosters());
    fakeApi.on(`GET /warbands/${ME.warband.id}/sheet/`, mySheet());
    fakeApi.on(`POST ${battlePath("start/")}`, battleState({ status: "active" }));
    fakeApi.on(`POST ${battlePath("finish-mine/")}`, {
      ...battleState({
        status: "active",
        me: { status: "finished_battle", declared_result: "won" },
      }),
      rules: postbattleRules(),
      suggested_postbattle: {
        unit_results: {},
        exploration: { dice_count: 1 },
        upkeep: { entries: {} },
      },
    });

    // The app's own cache rules, as WarbandColdLoad.test.tsx explains.
    renderBattleRoute("prebattle", { queryClient: createQueryClient() });

    await user.click(await screen.findByRole("button", { name: "Start Battle" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Start" }));
    await user.click(await screen.findByRole("button", { name: "Finish my battle" }));
    const finishDialog = screen.getByRole("dialog", { name: "Finish my battle" });
    await user.click(within(finishDialog).getByRole("radio", { name: /I won/ }));
    await user.click(within(finishDialog).getByRole("button", { name: "Finish my battle" }));
    expect(await screen.findByRole("button", { name: "Finalise Postbattle" })).toBeInTheDocument();
    // Gives a late duplicate request the chance to start before counting.
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));

    // Start's and Finish's answers move the cached state on; the pages read nothing again.
    expect(fakeApi.calls()).toEqual([
      `GET ${statePath("prebattle")}`,
      `GET ${battlePath("rosters/")}`,
      `POST ${battlePath("start/")}`,
      `POST ${battlePath("finish-mine/")}`,
      // Postbattle's resources come from the warband's sheet query (BUG-127).
      `GET /warbands/${ME.warband.id}/sheet/`,
    ]);
  });
});
