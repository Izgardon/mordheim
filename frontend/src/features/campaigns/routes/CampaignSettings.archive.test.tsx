/**
 * Archive, restore and delete for good (decision 5, CAMP-NEW-04, CAMP-TWEAK-04) as the app mounts
 * them (layout, fake server): the archive's dialog, the read-only banner, restoring, the typed
 * name for deleting for good, and the app's answer to a campaign_archived refusal.
 */
import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";
import {
  PLAYER,
  campaignApi,
  campaignFor,
  campaignMembers,
  campaignSummary,
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
const auth = vi.hoisted(() => ({
  user: { id: 7, email: "aldric@example.com" },
  signOut: () => undefined,
}));
vi.mock("@/features/auth/hooks/use-auth", () => ({ useAuth: () => auth }));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));
vi.mock("@/features/realtime/components/CampaignDiceRollerMenu", () => ({ default: () => null }));

const ARCHIVED_AT = "2026-10-20T10:00:00Z";
const CAMPAIGN = `GET ${campaignApi()}`;
const ARCHIVED_DETAIL =
  "This campaign is archived, so nothing in it can change. Its owner can restore it.";
const archivedRefusal = () =>
  new ApiError(ARCHIVED_DETAIL, 403, {
    detail: ARCHIVED_DETAIL,
    code: "campaign_archived",
    fields: {},
  });

async function openCampaignTab(user: ReturnType<typeof setupUser>) {
  renderCampaignRoute("/campaigns/1/settings");
  const header = await screen.findByRole("banner");
  await user.click(within(header).getByRole("button", { name: "Campaign" }));
}

beforeEach(() => {
  fakeApi.reset();
  fakeRealtime.reset();
  auth.user = { id: 7, email: "aldric@example.com" };
  routeCampaignShell();
  routeOverviewLists();
  fakeApi.on(`GET ${campaignApi("members/")}`, campaignMembers());
  fakeApi.on(`GET ${campaignApi("permissions/")}`, []);
  fakeApi.on(`GET ${campaignApi("active-battles/")}`, []);
  fakeApi.on("GET /restrictions/?type=Setting", []);
});

describe("Archive campaign (CAMP-NEW-04)", () => {
  it("replaces Close and Delete; its dialog says what closes and that it becomes read-only, then the campaign shows as archived", async () => {
    const user = setupUser();
    fakeApi.on(`POST ${campaignApi("archive/")}`, campaignSummary({ archived_at: ARCHIVED_AT }));
    await openCampaignTab(user);
    expect(screen.queryByRole("button", { name: "Close campaign" })).toBeNull();

    await user.click(await screen.findByRole("button", { name: "Archive campaign" }));

    const dialog = screen.getByRole("dialog", { name: "Archive campaign" });
    expect(dialog).toHaveTextContent("Open battles are cancelled");
    expect(dialog).toHaveTextContent("Pending and accepted trades close.");
    expect(dialog).toHaveTextContent("read-only for everyone");
    expect(dialog).toHaveTextContent("You can restore it from Settings at any time.");
    await user.click(within(dialog).getByRole("button", { name: "Archive campaign" }));

    expect(await screen.findByText(/This campaign is archived: read-only/)).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Restore campaign" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete for good" })).toBeInTheDocument();
    expect(fakeApi.countOf(`POST ${campaignApi("archive/")}`)).toBe(1);
  });

  it("restores an archived campaign for its owner, and the banner goes", async () => {
    const user = setupUser();
    routeCampaignShell({ campaign: campaignSummary({ archived_at: ARCHIVED_AT }) });
    fakeApi.on(`POST ${campaignApi("restore/")}`, campaignSummary({ archived_at: null }));
    await openCampaignTab(user);
    expect(screen.getByText(/This campaign is archived: read-only/)).toBeInTheDocument();

    await user.click(await screen.findByRole("button", { name: "Restore campaign" }));

    await waitFor(() =>
      expect(screen.queryByText(/This campaign is archived: read-only/)).toBeNull()
    );
    expect(await screen.findByRole("button", { name: "Archive campaign" })).toBeInTheDocument();
  });
});

describe("Delete for good (CAMP-TWEAK-04)", () => {
  beforeEach(() => {
    routeCampaignShell({ campaign: campaignSummary({ archived_at: ARCHIVED_AT }) });
  });

  it("lists what is destroyed and waits for the campaign's name, case and all, then deletes and leaves", async () => {
    const user = setupUser();
    fakeApi.on(`DELETE ${campaignApi()}`, undefined);
    await openCampaignTab(user);

    await user.click(await screen.findByRole("button", { name: "Delete for good" }));

    const dialog = screen.getByRole("dialog", { name: "Delete for good" });
    for (const lost of ["warbands", "battles", "trades", "logs", "house-rule items"]) {
      expect(dialog).toHaveTextContent(lost);
    }
    const input = within(dialog).getByRole("textbox", { name: /Type Shards of the Comet/ });
    const confirm = within(dialog).getByRole("button", { name: "Delete for good" });
    expect(confirm).toBeDisabled();
    await user.type(input, "shards of the comet");
    expect(confirm).toBeDisabled();
    await user.clear(input);
    await user.type(input, "  Shards of the Comet ");
    expect(confirm).toBeEnabled();
    await user.click(confirm);

    expect(await screen.findByText("Campaigns page")).toBeInTheDocument();
    expect(fakeApi.bodyOf(`DELETE ${campaignApi()}`)).toEqual({ name: "Shards of the Comet" });
  });

  it("shows the server's name_mismatch refusal", async () => {
    const user = setupUser();
    fakeApi.fail(
      `DELETE ${campaignApi()}`,
      new ApiError("Type the campaign's name to delete it for good.", 400, {
        detail: "Type the campaign's name to delete it for good.",
        code: "name_mismatch",
        fields: { name: ["Type the campaign's name to delete it for good."] },
      })
    );
    await openCampaignTab(user);
    await user.click(await screen.findByRole("button", { name: "Delete for good" }));
    const dialog = screen.getByRole("dialog", { name: "Delete for good" });

    await user.type(within(dialog).getByRole("textbox"), "Shards of the Comet");
    await user.click(within(dialog).getByRole("button", { name: "Delete for good" }));

    expect(
      await within(dialog).findByText("Type the campaign's name to delete it for good.")
    ).toBeVisible();
  });
});

describe("An archived campaign", () => {
  it("shows a player the read-only banner and no Start battle, with no way to restore it", async () => {
    auth.user = { id: PLAYER.id, email: PLAYER.email };
    routeCampaignShell({
      campaign: campaignFor("player", { archived_at: ARCHIVED_AT }),
      viewer: PLAYER,
    });

    renderCampaignRoute("/campaigns/1");

    expect(await screen.findByText(/This campaign is archived: read-only/)).toBeInTheDocument();
    await screen.findByRole("heading", { name: /Roster/ });
    expect(screen.queryByRole("button", { name: "Start battle" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Restore it in Settings" })).toBeNull();
  });

  it("points its owner to Restore in Settings", async () => {
    routeCampaignShell({ campaign: campaignSummary({ archived_at: ARCHIVED_AT }) });

    renderCampaignRoute("/campaigns/1");

    expect(await screen.findByRole("link", { name: "Restore it in Settings" })).toHaveAttribute(
      "href",
      "/campaigns/1/settings?tab=campaign"
    );
  });

  it("toasts a campaign_archived refusal from any write and reads the campaign again", async () => {
    const user = setupUser();
    fakeApi.fail(`PATCH ${campaignApi()}`, archivedRefusal());
    await openCampaignTab(user);
    const features = (await screen.findByText("Campaign features")).parentElement!.parentElement!;

    await user.click(screen.getByRole("checkbox", { name: "Enable encampments" }));
    await user.click(within(features).getByRole("button", { name: "Save" }));

    expect((await screen.findAllByText(ARCHIVED_DETAIL)).length).toBeGreaterThan(0);
    await waitFor(() => expect(fakeApi.countOf(CAMPAIGN)).toBe(2));
  });
});
