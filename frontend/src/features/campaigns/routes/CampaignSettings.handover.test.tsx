/**
 * Settings → Campaign's hand-over (decision 4, CAMP-NEW-02) as the app mounts it (layout, fake
 * server): the owner makes an admin the owner and becomes an admin.
 */
import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";
import {
  ADMIN,
  OWNER,
  PERMISSION_CATALOGUE,
  PLAYER,
  campaignApi,
  campaignFor,
  campaignMembers,
  routeCampaignShell,
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

const CAMPAIGN = `GET ${campaignApi()}`;
const MEMBERS = `GET ${campaignApi("members/")}`;
const OWNERSHIP = `POST ${campaignApi("ownership/")}`;
const MAKE_OWNER = "Make owner";

const row = (name: string) => screen.getByRole("row", { name: new RegExp(`^${name}`) });

async function openMembers(user: ReturnType<typeof setupUser>) {
  renderCampaignRoute("/campaigns/1/settings");
  const header = await screen.findByRole("banner");
  await user.click(within(header).getByRole("button", { name: "Campaign" }));
  await screen.findByRole("row", { name: /^Mira/ });
}

beforeEach(() => {
  fakeApi.reset();
  fakeRealtime.reset();
  auth.user = { id: OWNER.id, email: OWNER.email };
  routeCampaignShell();
  fakeApi.on(MEMBERS, campaignMembers());
  fakeApi.on(`GET ${campaignApi("permissions/")}`, PERMISSION_CATALOGUE);
  fakeApi.on(`GET ${campaignApi("active-battles/")}`, []);
  fakeApi.on("GET /restrictions/?type=Setting", []);
});

describe("Hand ownership to an admin (CAMP-NEW-02)", () => {
  it("offers Make owner on an admin's row; the confirm names them and says you become an admin, then the campaign and members are read again", async () => {
    const user = setupUser();
    fakeApi.on(OWNERSHIP, { owner_id: ADMIN.id, previous_owner_id: OWNER.id });
    await openMembers(user);
    expect(within(row(OWNER.name)).queryByRole("button", { name: MAKE_OWNER })).toBeNull();

    await user.click(within(row(ADMIN.name)).getByRole("button", { name: MAKE_OWNER }));

    const dialog = screen.getByRole("dialog", { name: "Hand over the campaign" });
    expect(dialog).toHaveTextContent(`Make ${ADMIN.name} the owner of Shards of the Comet?`);
    expect(dialog).toHaveTextContent("You become an admin");
    await user.click(within(dialog).getByRole("button", { name: MAKE_OWNER }));

    await waitFor(() => expect(fakeApi.countOf(CAMPAIGN)).toBe(2));
    expect(fakeApi.bodyOf(OWNERSHIP)).toEqual({ user_id: ADMIN.id });
    await waitFor(() => expect(fakeApi.countOf(MEMBERS)).toBe(2));
    expect(await screen.findByText(`${ADMIN.name} now owns Shards of the Comet.`)).toBeVisible();
    expect(screen.queryByRole("dialog", { name: "Hand over the campaign" })).toBeNull();
  });

  it("shows Make owner greyed out on a player's row, saying to make them an admin first, and sends nothing", async () => {
    const user = setupUser();
    await openMembers(user);

    const makeOwner = within(row(PLAYER.name)).getByRole("button", { name: MAKE_OWNER });
    expect(makeOwner).toHaveAttribute("aria-disabled", "true");
    expect(makeOwner).toHaveAttribute("title", "Make them an admin first");

    await user.click(makeOwner);

    expect(await screen.findByText("Make them an admin first")).toBeVisible();
    expect(screen.queryByRole("dialog", { name: "Hand over the campaign" })).toBeNull();
    expect(fakeApi.countOf(OWNERSHIP)).toBe(0);
  });

  it("says why when the server refuses: they are no longer an admin (not_an_admin)", async () => {
    const user = setupUser();
    fakeApi.fail(
      OWNERSHIP,
      new ApiError("Ownership can only go to an admin. Make them an admin first.", 400, {
        detail: "Ownership can only go to an admin. Make them an admin first.",
        code: "not_an_admin",
        fields: { user_id: ["Ownership can only go to an admin. Make them an admin first."] },
      })
    );
    await openMembers(user);

    await user.click(within(row(ADMIN.name)).getByRole("button", { name: MAKE_OWNER }));
    const dialog = screen.getByRole("dialog", { name: "Hand over the campaign" });
    await user.click(within(dialog).getByRole("button", { name: MAKE_OWNER }));

    expect(
      await within(dialog).findByText(
        "Ownership can only go to an admin. Make them an admin first."
      )
    ).toBeVisible();
    expect(fakeApi.countOf(CAMPAIGN)).toBe(1);
  });

  it("is not offered to an admin", async () => {
    const user = setupUser();
    auth.user = { id: ADMIN.id, email: ADMIN.email };
    routeCampaignShell({ campaign: campaignFor("admin"), viewer: ADMIN });
    await openMembers(user);

    expect(screen.queryByRole("button", { name: MAKE_OWNER })).toBeNull();
  });
});
