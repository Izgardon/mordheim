/**
 * Start the campaign heads the overview (William, 28 Nov 2026: "no way to start campaign on mobile
 * it seems, can we add it to the campaign page"): only before the start, only for those who may
 * (`capabilities.start`), and its button opens the confirm that starts it.
 */
import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { campaignFor, campaignSummary } from "@/test/campaign-fixtures";
import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";

import StartCampaignBanner from "./StartCampaignBanner";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

const notStarted = campaignSummary({ in_progress: false });
const START = "Start the campaign";

beforeEach(() => {
  fakeApi.reset();
});

describe("StartCampaignBanner", () => {
  it("opens the confirm, which starts the campaign", async () => {
    const user = setupUser();
    fakeApi.on(`PATCH /campaigns/${notStarted.id}/`, { ...notStarted, in_progress: true });
    renderWithQueryClient(<StartCampaignBanner campaign={notStarted} />);

    expect(screen.getByRole("status")).toHaveTextContent("Not started yet.");
    await user.click(screen.getByRole("button", { name: START }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Battles count towards it from now on.");
    expect(fakeApi.calls()).toEqual([]);

    await user.click(screen.getAllByRole("button", { name: START }).at(-1) as HTMLElement);
    await waitFor(() =>
      expect(fakeApi.bodyOf(`PATCH /campaigns/${notStarted.id}/`)).toEqual({ in_progress: true })
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("is gone once the campaign has started", () => {
    renderWithQueryClient(
      <StartCampaignBanner campaign={campaignSummary({ in_progress: true })} />
    );

    expect(screen.queryByRole("button", { name: START })).toBeNull();
  });

  it("is not shown to a player who may not start it", () => {
    renderWithQueryClient(
      <StartCampaignBanner campaign={campaignFor("player", { in_progress: false })} />
    );

    expect(screen.queryByRole("button", { name: START })).toBeNull();
  });

  it("is not shown in an archived campaign", () => {
    const archived = campaignSummary({ in_progress: false, archived_at: "2026-11-01T18:00:00Z" });
    renderWithQueryClient(<StartCampaignBanner campaign={archived} />);

    expect(screen.queryByRole("button", { name: START })).toBeNull();
  });
});
