/**
 * Requests a visit to the campaign overview sends, with the app's own cache rules
 * (`createQueryClient`): a cold load, then a revisit within every stale time.
 */
import { act, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryClient } from "@/lib/query-client";
import {
  OWNER,
  campaignApi,
  routeCampaignShell,
  routeOverviewLists,
} from "@/test/campaign-fixtures";
import { renderCampaignRoute } from "@/test/campaign-routes";
import { fakeApi } from "@/test/fake-api";
import { fakeRealtime } from "@/test/fake-realtime";
import { setupUser } from "@/test/user-event";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/lib/realtime/client", async () => (await import("@/test/fake-realtime")).fakeClient);
vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: 7, email: "aldric@example.com" }, signOut: () => undefined }),
}));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));
vi.mock("@/features/realtime/components/CampaignDiceRollerMenu", () => ({ default: () => null }));

/** Gives a late duplicate request the chance to start before counting. */
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 50)));

const OVERVIEW_LISTS = [
  `GET ${campaignApi("players/")}`,
  `GET ${campaignApi("trade-requests/?status=completed")}`,
  `GET ${campaignApi("battle-history/")}`,
  `GET ${campaignApi("pivotal-moments/")}`,
];

async function openOverview() {
  renderCampaignRoute("/campaigns/1", { queryClient: createQueryClient() });
  await screen.findByRole("button", { name: /Aldric/ });
  await screen.findByRole("button", { name: "Start battle" });
  await settle();
}

beforeEach(() => {
  fakeApi.reset();
  fakeRealtime.reset();
  routeCampaignShell();
  routeOverviewLists();
});

describe("campaign overview requests", () => {
  it("cold: the campaign, open battles, your warband and sheet, the bell, then the four lists and pending results, once each", async () => {
    await openOverview();

    expect([...fakeApi.calls()].sort()).toEqual(
      [
        "GET /notifications/",
        `GET ${campaignApi()}`,
        `GET ${campaignApi("battles/?open=1")}`,
        `GET /warbands/?campaign_id=1`,
        `GET /warbands/${OWNER.warband!.id}/sheet/`,
        ...OVERVIEW_LISTS,
        `GET ${campaignApi("battles/pending-results/")}`,
      ].sort()
    );
  });

  it("sends the four overview lists again on a revisit within every stale time, and nothing else (CAMP-TEST-04 baseline, pinned; flips in PR B)", async () => {
    const user = setupUser();
    await openOverview();
    await user.click(screen.getByRole("link", { name: "Skills" }));
    expect(await screen.findByText("Skills page")).toBeInTheDocument();
    fakeApi.clearRequests();

    await user.click(screen.getByRole("link", { name: "Campaign" }));
    await screen.findByRole("button", { name: /Aldric/ });
    await settle();

    expect([...fakeApi.calls()].sort()).toEqual([...OVERVIEW_LISTS].sort());
  });
});
