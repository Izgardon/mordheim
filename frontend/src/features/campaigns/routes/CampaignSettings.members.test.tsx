/**
 * Settings → Campaign's members list as the app mounts it (layout, fake server): who sees which
 * action, Remove from campaign and its preview, role changes and permission grants, and the
 * requests each one sends.
 */
import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";
import { deferred } from "@/test/battle-fixtures";
import {
  ADMIN,
  NAMELESS,
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

import type { MemberRemovalPreview } from "../types/campaign-types";

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

const MEMBERS = `GET ${campaignApi("members/")}`;
const PERMISSIONS_PUT = `PUT ${campaignApi(`members/${PLAYER.id}/permissions/`)}`;
const ROLE_PATCH = `PATCH ${campaignApi(`members/${PLAYER.id}/role/`)}`;
const CATALOGUE = `GET ${campaignApi("permissions/")}`;
const REMOVAL_PREVIEW = `GET ${campaignApi(`members/${PLAYER.id}/removal/`)}`;
const MEMBER_DELETE = `DELETE ${campaignApi(`members/${PLAYER.id}/`)}`;
const REMOVE = "Remove from campaign";

/** `GET members/9/removal/`: Mira's open battles and trades, and her kept warband. */
const removalPreview = (overrides: Partial<MemberRemovalPreview> = {}): MemberRemovalPreview => ({
  member: { id: PLAYER.id, name: PLAYER.name, role: "player" },
  warband: { id: PLAYER.warband!.id, name: PLAYER.warband!.name },
  battles: [
    { id: 40, scenario: "Ford", status: "inviting", outcome: "cancelled" },
    { id: 41, scenario: "Ford", status: "postbattle", outcome: "skipped" },
  ],
  trades: [{ id: "trade-1", status: "pending", with: { id: OWNER.id, name: OWNER.name } }],
  notifications: 2,
  ...overrides,
});

/** The grant PUT's answer: the granted codes with their labels and descriptions. */
const grantAnswer = (body: unknown) =>
  PERMISSION_CATALOGUE.filter((entry) =>
    (body as { permissions: string[] }).permissions.includes(entry.code)
  );

const row = (name: string) => screen.getByRole("row", { name: new RegExp(`^${name}`) });

/** Opens Settings, then its Campaign tab, and waits for the members. */
async function openMembers(user: ReturnType<typeof setupUser>) {
  renderCampaignRoute("/campaigns/1/settings");
  const header = await screen.findByRole("banner");
  await user.click(within(header).getByRole("button", { name: "Campaign" }));
  await screen.findByRole("row", { name: /^Mira/ });
}

/** The grant menu (a Radix dropdown) opened from a player's permissions button. */
const grantMenu = (name: string) => screen.getByRole("menu", { name: `Permissions for ${name}` });

beforeEach(() => {
  fakeApi.reset();
  fakeRealtime.reset();
  auth.user = { id: OWNER.id, email: OWNER.email };
  routeCampaignShell();
  fakeApi.on(MEMBERS, campaignMembers());
  fakeApi.on(CATALOGUE, PERMISSION_CATALOGUE);
  fakeApi.on(`GET ${campaignApi("active-battles/")}`, []);
  fakeApi.on("GET /restrictions/?type=Setting", []);
});

describe("Settings members list, as the owner", () => {
  it("lists every member with email, rank and permissions; Remove from campaign on every row but the owner's, and no Kick (CAMP-UX-02, decision 1)", async () => {
    const user = setupUser();
    await openMembers(user);

    const owner = row(OWNER.name);
    expect(owner).toHaveTextContent(OWNER.email);
    expect(within(owner).getAllByText("Owner")).toHaveLength(2);
    expect(within(owner).getByRole("button", { name: "All permissions" })).toBeDisabled();
    expect(within(owner).queryByRole("checkbox")).not.toBeInTheDocument();
    expect(within(owner).queryByRole("button", { name: REMOVE })).not.toBeInTheDocument();

    const admin = row(ADMIN.name);
    expect(within(admin).getByRole("checkbox", { name: "Admin" })).toBeChecked();
    expect(within(admin).getByRole("checkbox", { name: "Admin" })).toBeEnabled();
    expect(within(admin).getByRole("button", { name: "All permissions" })).toBeDisabled();
    // The owner removes an admin directly, without demoting them first.
    expect(within(admin).getByRole("button", { name: REMOVE })).toBeInTheDocument();

    const player = row(PLAYER.name);
    expect(player).toHaveTextContent(PLAYER.email);
    expect(within(player).getByRole("checkbox", { name: "Admin" })).not.toBeChecked();
    expect(within(player).getByRole("button", { name: "Add custom" })).toBeEnabled();
    expect(within(player).getByRole("button", { name: REMOVE })).toBeInTheDocument();

    const nameless = row(NAMELESS.name);
    expect(within(nameless).getByRole("button", { name: "None" })).toBeEnabled();
    expect(within(nameless).getByRole("button", { name: REMOVE })).toBeInTheDocument();

    expect(screen.queryByRole("button", { name: "Kick" })).not.toBeInTheDocument();
    expect(fakeApi.countOf(MEMBERS)).toBe(1);
  });

  it("removes through one action that never deletes a warband: the preview says the warband is kept and lists what closes, then the membership DELETE drops the row (BUG-12, BUG-50, decision 1)", async () => {
    const user = setupUser();
    fakeApi.on(REMOVAL_PREVIEW, removalPreview());
    fakeApi.on(MEMBER_DELETE, undefined);
    await openMembers(user);

    await user.click(within(row(PLAYER.name)).getByRole("button", { name: REMOVE }));

    const dialog = screen.getByRole("dialog", { name: REMOVE });
    expect(await within(dialog).findByRole("list", { name: "What closes" })).toBeInTheDocument();
    expect(dialog).toHaveTextContent("Remove Mira from the campaign?");
    expect(dialog).toHaveTextContent(
      "Their warband, Night Razors, is kept: it stays in the campaign's history and comes back if Mira rejoins."
    );
    const lines = within(dialog)
      .getAllByRole("listitem")
      .map((item) => item.textContent);
    expect(lines).toEqual([
      "Battle #40, Ford (inviting): cancelled for everyone.",
      "Battle #41, Ford (postbattle): Mira is skipped and the battle goes on without them.",
      "Trade with Aldric (pending): closed.",
    ]);
    expect(dialog).toHaveTextContent("2 notifications waiting for Mira will be cleared.");
    expect(dialog).toHaveTextContent("To keep them out, regenerate the join code afterwards.");
    expect(dialog).not.toHaveTextContent(/cannot be undone|permanently/i);

    await user.click(within(dialog).getByRole("button", { name: REMOVE }));

    await waitFor(() =>
      expect(screen.queryByRole("row", { name: /^Mira/ })).not.toBeInTheDocument()
    );
    expect(fakeApi.calls().filter((call) => !call.startsWith("GET"))).toEqual([MEMBER_DELETE]);
    expect(fakeApi.calls().some((call) => call.startsWith("DELETE /warbands/"))).toBe(false);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("waits for the preview before Remove from campaign can be confirmed, and says when there is nothing to close", async () => {
    const user = setupUser();
    const answer = deferred<unknown>();
    fakeApi.on(REMOVAL_PREVIEW, () => answer.promise);
    await openMembers(user);

    await user.click(within(row(PLAYER.name)).getByRole("button", { name: REMOVE }));

    const dialog = screen.getByRole("dialog", { name: REMOVE });
    expect(dialog).toHaveTextContent("Checking what this closes...");
    expect(within(dialog).getByRole("button", { name: REMOVE })).toBeDisabled();

    answer.resolve(removalPreview({ battles: [], trades: [], notifications: 0 }));

    expect(await within(dialog).findByText("Mira has no open battles or trades.")).toBeVisible();
    expect(within(dialog).getByRole("button", { name: REMOVE })).toBeEnabled();
    expect(fakeApi.countOf(REMOVAL_PREVIEW)).toBe(1);
  });

  it("keeps the dialog open with the server's refusal and the row in place", async () => {
    const user = setupUser();
    fakeApi.on(REMOVAL_PREVIEW, removalPreview());
    fakeApi.fail(
      MEMBER_DELETE,
      new ApiError("Admins can only remove players.", 403, {
        detail: "Admins can only remove players.",
        code: "not_allowed",
      })
    );
    await openMembers(user);
    await user.click(within(row(PLAYER.name)).getByRole("button", { name: REMOVE }));
    const dialog = screen.getByRole("dialog", { name: REMOVE });
    await within(dialog).findByRole("list", { name: "What closes" });

    await user.click(within(dialog).getByRole("button", { name: REMOVE }));

    expect(await within(dialog).findByText("Admins can only remove players.")).toBeVisible();
    expect(screen.getByRole("row", { name: /^Mira/, hidden: true })).toBeInTheDocument();
  });

  it("never names a member by email in the remove dialog, even one sent without a name (SEC-13)", async () => {
    const user = setupUser();
    fakeApi.on(
      MEMBERS,
      campaignMembers().map((member) =>
        member.id === NAMELESS.id ? { ...member, name: "" } : member
      )
    );
    fakeApi.on(`GET ${campaignApi(`members/${NAMELESS.id}/removal/`)}`, {
      ...removalPreview({ battles: [], trades: [], notifications: 0 }),
      warband: null,
    });
    await openMembers(user);

    const nameless = screen.getByRole("row", { name: new RegExp(`^${NAMELESS.email}`) });
    await user.click(within(nameless).getByRole("button", { name: REMOVE }));

    const dialog = screen.getByRole("dialog", { name: REMOVE });
    expect(await within(dialog).findByText("This player has no warband.")).toBeVisible();
    expect(dialog).toHaveTextContent("Remove this player from the campaign?");
    expect(dialog).not.toHaveTextContent(NAMELESS.email);
  });

  it("offers every code GET permissions/ lists, with the server's labels and descriptions and in its order, spells, specials and battles included (BUG-15, CAMP-TEST-25)", async () => {
    const user = setupUser();
    await openMembers(user);

    await user.click(within(row(PLAYER.name)).getByRole("button", { name: "Add custom" }));

    const options = within(grantMenu(PLAYER.name)).getAllByRole("menuitemcheckbox");
    expect(options).toHaveLength(11);
    PERMISSION_CATALOGUE.forEach((entry, index) =>
      expect(options[index]).toHaveAccessibleName(`${entry.label} ${entry.description}`)
    );
    expect(options.map((option) => option.getAttribute("aria-checked") === "true")).toEqual(
      PERMISSION_CATALOGUE.map((entry) => entry.code === "add_custom")
    );
    expect(fakeApi.countOf(CATALOGUE)).toBe(1);
  });

  it("puts a grant the server refuses as unknown_permission back, says why and reads the codes again", async () => {
    const user = setupUser();
    fakeApi.fail(
      PERMISSIONS_PUT,
      new ApiError("Unknown permission: manage_specials.", 400, {
        detail: "Unknown permission: manage_specials.",
        code: "unknown_permission",
        fields: { permissions: ["Unknown permission: manage_specials."] },
      })
    );
    await openMembers(user);
    await user.click(within(row(PLAYER.name)).getByRole("button", { name: "Add custom" }));

    await user.click(screen.getByRole("menuitemcheckbox", { name: /^Manage specials/ }));

    expect(
      await within(row(PLAYER.name)).findByText("Unknown permission: manage_specials.")
    ).toBeInTheDocument();
    expect(screen.getByRole("menuitemcheckbox", { name: /^Manage specials/ })).not.toBeChecked();
    await waitFor(() => expect(fakeApi.countOf(CATALOGUE)).toBe(2));
  });

  it("ticks a code at once and PUTs the whole new list; the answer's codes become the row's label (CAMP-TEST-25 baseline)", async () => {
    const user = setupUser();
    const answer = deferred<unknown>();
    fakeApi.on(PERMISSIONS_PUT, () => answer.promise);
    await openMembers(user);
    await user.click(within(row(PLAYER.name)).getByRole("button", { name: "Add custom" }));

    await user.click(screen.getByRole("menuitemcheckbox", { name: /^Manage items/ }));

    expect(screen.getByRole("menuitemcheckbox", { name: /^Manage items/ })).toBeChecked();
    expect(screen.getByRole("menuitemcheckbox", { name: /^Manage skills/ })).toHaveAttribute(
      "aria-disabled",
      "true"
    );
    expect(fakeApi.bodyOf(PERMISSIONS_PUT)).toEqual({
      permissions: ["add_custom", "manage_items"],
    });

    answer.resolve(grantAnswer({ permissions: ["add_custom", "manage_items"] }));

    expect(
      await within(row(PLAYER.name)).findByRole("button", { name: "Add custom, Manage items" })
    ).toBeInTheDocument();
    expect(screen.getByRole("menuitemcheckbox", { name: /^Manage skills/ })).not.toHaveAttribute(
      "aria-disabled"
    );
  });

  it("puts a refused grant back and shows why on the row (CAMP-TEST-25 baseline)", async () => {
    const user = setupUser();
    fakeApi.fail(
      PERMISSIONS_PUT,
      new ApiError("Only owners and admins can change permissions.", 403, null)
    );
    await openMembers(user);
    await user.click(within(row(PLAYER.name)).getByRole("button", { name: "Add custom" }));

    await user.click(screen.getByRole("menuitemcheckbox", { name: /^Manage rules/ }));

    expect(
      await within(row(PLAYER.name)).findByText("Only owners and admins can change permissions.")
    ).toBeInTheDocument();
    expect(
      within(row(PLAYER.name)).getByRole("button", { name: "Add custom" })
    ).toBeInTheDocument();
    expect(screen.getByRole("menuitemcheckbox", { name: /^Manage rules/ })).not.toBeChecked();
  });

  it("closes the grant menu on Escape, handing focus back to its button, and on an outside click (CAMP-UX-07)", async () => {
    const user = setupUser();
    await openMembers(user);
    const trigger = within(row(PLAYER.name)).getByRole("button", { name: "Add custom" });
    await user.click(trigger);
    expect(grantMenu(PLAYER.name)).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    expect(grantMenu(PLAYER.name)).toBeInTheDocument();
    await user.click(screen.getByRole("heading", { name: "Roster" }));
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  });

  it("ticks a code from the keyboard: arrow keys move through the codes and Space ticks one", async () => {
    const user = setupUser();
    fakeApi.on(PERMISSIONS_PUT, (body: unknown) => grantAnswer(body));
    await openMembers(user);
    within(row(PLAYER.name)).getByRole("button", { name: "Add custom" }).focus();

    await user.keyboard("{Enter}");
    await waitFor(() =>
      expect(screen.getByRole("menuitemcheckbox", { name: /^Add custom/ })).toHaveFocus()
    );
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitemcheckbox", { name: /^Manage items/ })).toHaveFocus();
    await user.keyboard(" ");

    await waitFor(() =>
      expect(fakeApi.bodyOf(PERMISSIONS_PUT)).toEqual({
        permissions: ["add_custom", "manage_items"],
      })
    );
    expect(grantMenu(PLAYER.name)).toBeInTheDocument();
  });

  it("makes a player an admin through the role PATCH: All permissions, and the owner can still remove them", async () => {
    const user = setupUser();
    fakeApi.on(ROLE_PATCH, { id: PLAYER.id, role: "admin" });
    await openMembers(user);

    await user.click(within(row(PLAYER.name)).getByRole("checkbox", { name: "Admin" }));

    await waitFor(() =>
      expect(within(row(PLAYER.name)).getByRole("checkbox", { name: "Admin" })).toBeChecked()
    );
    expect(fakeApi.bodyOf(ROLE_PATCH)).toEqual({ role: "admin" });
    const player = row(PLAYER.name);
    expect(within(player).getByRole("button", { name: "All permissions" })).toBeDisabled();
    expect(within(player).getByRole("button", { name: REMOVE })).toBeInTheDocument();
  });

  it("puts a refused role change back and shows why on the row", async () => {
    const user = setupUser();
    fakeApi.fail(ROLE_PATCH, new ApiError("Owner role cannot be changed.", 400, null));
    await openMembers(user);

    await user.click(within(row(PLAYER.name)).getByRole("checkbox", { name: "Admin" }));

    expect(
      await within(row(PLAYER.name)).findByText("Owner role cannot be changed.")
    ).toBeInTheDocument();
    expect(within(row(PLAYER.name)).getByRole("checkbox", { name: "Admin" })).not.toBeChecked();
    expect(within(row(PLAYER.name)).getByRole("button", { name: REMOVE })).toBeInTheDocument();
  });
});

describe("Settings members list, as an admin", () => {
  beforeEach(() => {
    auth.user = { id: ADMIN.id, email: ADMIN.email };
    routeCampaignShell({ campaign: campaignFor("admin"), viewer: ADMIN });
  });

  it("can grant codes to players and remove players, but can't change roles or remove the owner or an admin; no Campaign Systems, Warband or delete cards", async () => {
    const user = setupUser();
    await openMembers(user);

    const player = row(PLAYER.name);
    expect(within(player).getByRole("checkbox", { name: "Admin" })).toBeDisabled();
    expect(within(row(ADMIN.name)).getByRole("checkbox", { name: "Admin" })).toBeDisabled();
    expect(within(player).getByRole("button", { name: "Add custom" })).toBeEnabled();
    expect(within(player).getByRole("button", { name: REMOVE })).toBeInTheDocument();
    expect(within(row(NAMELESS.name)).getByRole("button", { name: REMOVE })).toBeInTheDocument();
    expect(within(row(OWNER.name)).queryByRole("button", { name: REMOVE })).toBeNull();
    expect(within(row(ADMIN.name)).queryByRole("button", { name: REMOVE })).toBeNull();
    expect(screen.queryByRole("button", { name: "Kick" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Campaign Systems" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Delete campaign" })).not.toBeInTheDocument();
    // Pass 3: Active Battles for manage_battles, which admins hold.
    expect(fakeApi.countOf(`GET ${campaignApi("active-battles/")}`)).toBe(1);
  });
});
