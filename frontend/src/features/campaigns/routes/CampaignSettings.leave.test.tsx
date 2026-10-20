/**
 * Settings → Personal → Leave campaign (decision 4, CAMP-NEW-03) as the app mounts it (layout,
 * fake server): the preview of what closes, the owner's hand-over-first rule and leaving alone.
 */
import { act, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";
import {
  OWNER,
  PLAYER,
  campaignApi,
  campaignFor,
  campaignSummary,
  routeCampaignShell,
} from "@/test/campaign-fixtures";
import { renderCampaignRoute } from "@/test/campaign-routes";
import { fakeApi } from "@/test/fake-api";
import { fakeRealtime } from "@/test/fake-realtime";
import { setupUser } from "@/test/user-event";

import type { LeavePreview } from "../types/campaign-types";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/lib/realtime/client", async () => (await import("@/test/fake-realtime")).fakeClient);
const auth = vi.hoisted(() => ({
  user: { id: 9, email: "mira@example.com" },
  signOut: () => undefined,
}));
vi.mock("@/features/auth/hooks/use-auth", () => ({ useAuth: () => auth }));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));
vi.mock("@/features/realtime/components/CampaignDiceRollerMenu", () => ({ default: () => null }));

const PREVIEW = `GET ${campaignApi("leave/")}`;
const LEAVE = `POST ${campaignApi("leave/")}`;

const preview = (overrides: Partial<LeavePreview> = {}): LeavePreview => ({
  member: { id: PLAYER.id, name: PLAYER.name, role: "player" },
  warband: { id: PLAYER.warband!.id, name: PLAYER.warband!.name },
  battles: [{ id: 40, scenario: "Ford", status: "inviting", outcome: "cancelled" }],
  trades: [{ id: "trade-1", status: "pending", with: { id: OWNER.id, name: OWNER.name } }],
  notifications: 2,
  archives_campaign: false,
  ...overrides,
});

const openSettings = async () => {
  renderCampaignRoute("/campaigns/1/settings");
  return screen.findByRole("region", { name: "Leave campaign" });
};

beforeEach(() => {
  fakeApi.reset();
  fakeRealtime.reset();
  auth.user = { id: PLAYER.id, email: PLAYER.email };
  routeCampaignShell({ campaign: campaignFor("player"), viewer: PLAYER });
});

describe("Leave campaign (CAMP-NEW-03)", () => {
  it("lists what leaving closes, says your warband is kept, then leaves for the campaigns list with a toast", async () => {
    const user = setupUser();
    fakeApi.on(PREVIEW, preview());
    fakeApi.on(LEAVE, { outcome: "left" });
    const card = await openSettings();

    await user.click(within(card).getByRole("button", { name: "Leave campaign" }));

    const dialog = screen.getByRole("dialog", { name: "Leave campaign" });
    expect(
      await within(dialog).findByText(/Your warband, Night Razors, is kept/)
    ).toBeInTheDocument();
    expect(dialog).toHaveTextContent("Battle #40, Ford (inviting): cancelled for everyone.");
    expect(dialog).toHaveTextContent(`Trade with ${OWNER.name} (pending): closed.`);
    await user.click(within(dialog).getByRole("button", { name: "Leave campaign" }));

    expect(await screen.findByText("Campaigns page")).toBeInTheDocument();
    expect(await screen.findByText("You left Shards of the Comet.")).toBeVisible();
    expect(fakeApi.countOf(LEAVE)).toBe(1);
  });

  it("tells an owner with company to hand ownership to an admin first, greying Leave out", async () => {
    const user = setupUser();
    auth.user = { id: OWNER.id, email: OWNER.email };
    routeCampaignShell();
    const card = await openSettings();

    expect(card).toHaveTextContent("Hand ownership to an admin first");
    const leave = within(card).getByRole("button", { name: "Leave campaign" });
    expect(leave).toHaveAttribute("aria-disabled", "true");
    await user.click(leave);

    expect(screen.queryByRole("dialog", { name: "Leave campaign" })).toBeNull();
    expect(fakeApi.countOf(PREVIEW)).toBe(0);
  });

  it("offers an owner alone in the campaign to leave by archiving it, and says so", async () => {
    const user = setupUser();
    auth.user = { id: OWNER.id, email: OWNER.email };
    routeCampaignShell({ campaign: campaignSummary({ player_count: 1 }) });
    fakeApi.on(PREVIEW, preview({ archives_campaign: true, battles: [], trades: [] }));
    fakeApi.on(LEAVE, { outcome: "archived" });
    const card = await openSettings();

    await user.click(within(card).getByRole("button", { name: "Leave (archives the campaign)" }));
    const dialog = screen.getByRole("dialog", { name: "Leave campaign" });
    expect(await within(dialog).findByText(/leaving archives it/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Leave (archives the campaign)" }));

    expect(await screen.findByText("Campaigns page")).toBeInTheDocument();
    expect(await screen.findByText("Shards of the Comet is archived.")).toBeVisible();
  });

  it("keeps the dialog open with the server's refusal", async () => {
    const user = setupUser();
    fakeApi.on(PREVIEW, preview());
    fakeApi.fail(
      LEAVE,
      new ApiError("Hand ownership to an admin before you leave.", 400, {
        detail: "Hand ownership to an admin before you leave.",
        code: "hand_over_first",
        fields: {},
      })
    );
    const card = await openSettings();
    await user.click(within(card).getByRole("button", { name: "Leave campaign" }));
    const dialog = screen.getByRole("dialog", { name: "Leave campaign" });
    await within(dialog).findByText(/Your warband, Night Razors, is kept/);

    await user.click(within(dialog).getByRole("button", { name: "Leave campaign" }));

    expect(
      await within(dialog).findByText("Hand ownership to an admin before you leave.")
    ).toBeVisible();
    expect(screen.getByLabelText("Current path")).toHaveTextContent("/campaigns/1/settings");
  });
});

describe("membership_left (CAMP-NEW-03)", () => {
  it("tells you, takes you off the campaign's pages and reads nothing of it again", async () => {
    renderCampaignRoute("/campaigns/1/settings");
    const channel = `private-user-${PLAYER.id}-notifications`;
    await waitFor(() => expect(fakeRealtime.subscriberCount(channel)).toBe(1));

    act(() =>
      fakeRealtime.emit(channel, "notification", {
        type: "membership_left",
        payload: { campaign_id: 1, campaign_name: "Shards of the Comet" },
      })
    );

    expect(await screen.findByText("You left Shards of the Comet.")).toBeInTheDocument();
    expect(await screen.findByText("Campaigns page")).toBeInTheDocument();
    expect(fakeApi.countOf(`GET ${campaignApi()}`)).toBe(1);
  });
});
