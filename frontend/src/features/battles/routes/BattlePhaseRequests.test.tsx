/**
 * Requests a creator's walk through the three phase pages sends: each page loads the battle's
 * state and the rosters again, though neither changed in between (PERF-38).
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
  it("reads rosters/ and the full state once per phase page: three times each from prebattle to postbattle (PERF-38, pinned; flips in PR B)", async () => {
    const user = setupUser();
    fakeApi.reset();
    fakeApi.on(
      `GET ${statePath("prebattle")}`,
      battleState({ status: "prebattle", me: { status: "ready" }, opponent: { status: "ready" } })
    );
    fakeApi.on(`GET ${statePath("active")}`, battleState({ status: "active" }));
    fakeApi.on(
      `GET ${statePath("postbattle")}`,
      battleState({ status: "postbattle", winner_warband_ids_json: [ME.warband.id] })
    );
    fakeApi.on(`GET ${battlePath("rosters/")}`, battleRosters());
    fakeApi.on(`GET /warbands/${ME.warband.id}/sheet/`, mySheet());
    fakeApi.on(`POST ${battlePath("start/")}`, battleState({ status: "active" }));
    fakeApi.on(`POST ${battlePath("finish/")}`, battleState({ status: "postbattle" }));

    // The app's own cache rules, as WarbandColdLoad.test.tsx explains.
    renderBattleRoute("prebattle", { queryClient: createQueryClient() });

    await user.click(await screen.findByRole("button", { name: "Start Battle" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Start" }));
    await user.click(await screen.findByRole("button", { name: "End Battle" }));
    const endDialog = screen.getByRole("dialog", { name: "End Active Battle" });
    await user.click(within(endDialog).getByRole("checkbox", { name: "Iron Vultures" }));
    await user.click(within(endDialog).getByRole("button", { name: "End battle" }));
    expect(await screen.findByRole("button", { name: "Finalise Postbattle" })).toBeInTheDocument();
    // Gives a late duplicate request the chance to start before counting.
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));

    expect(fakeApi.calls()).toEqual([
      `GET ${statePath("prebattle")}`,
      `GET ${battlePath("rosters/")}`,
      `POST ${battlePath("start/")}`,
      `GET ${statePath("active")}`,
      `GET ${battlePath("rosters/")}`,
      `POST ${battlePath("finish/")}`,
      `GET ${statePath("postbattle")}`,
      `GET ${battlePath("rosters/")}`,
      // Postbattle's resources come from the warband's sheet query (BUG-127).
      `GET /warbands/${ME.warband.id}/sheet/`,
    ]);
  });
});
