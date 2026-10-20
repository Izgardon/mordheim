/**
 * Settings → Campaign's members list as the app mounts it (layout, fake server): who sees which
 * action, Kick and Remove, role changes and permission grants, and the requests each one sends.
 */
import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";
import { deferred } from "@/test/battle-fixtures";
import {
  ADMIN,
  NAMELESS,
  OWNER,
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

const MEMBERS = `GET ${campaignApi("members/")}`;
const PERMISSIONS_PUT = `PUT ${campaignApi(`members/${PLAYER.id}/permissions/`)}`;
const ROLE_PATCH = `PATCH ${campaignApi(`members/${PLAYER.id}/role/`)}`;

/** The codes the server knows today and their names; the grant PUT drops any other code. */
const SERVER_CODES: Record<string, string> = {
  add_custom: "Add custom",
  manage_items: "Manage items",
  manage_skills: "Manage skills",
  manage_rules: "Manage rules",
  manage_warbands: "Manage warbands",
  manage_encampments: "Manage encampments",
  manage_locations: "Manage locations",
  manage_bestiary: "Manage bestiary",
  manage_battles: "Manage battles",
};
const grantAnswer = (body: unknown) =>
  (body as { permissions: string[] }).permissions
    .filter((code) => code in SERVER_CODES)
    .map((code) => ({ code, name: SERVER_CODES[code] }));

const row = (name: string) => screen.getByRole("row", { name: new RegExp(`^${name}`) });

/** Opens Settings, then its Campaign tab, and waits for the members. */
async function openMembers(user: ReturnType<typeof setupUser>) {
  renderCampaignRoute("/campaigns/1/settings");
  const header = await screen.findByRole("banner");
  await user.click(within(header).getByRole("button", { name: "Campaign" }));
  await screen.findByRole("row", { name: /^Mira/ });
}

/** The grant menu (a portal at the end of body) opened from a row's permissions button. */
function grantMenu() {
  const first = screen.getByRole("checkbox", { name: /^Add custom/ });
  return first.closest("label")!.parentElement!;
}

beforeEach(() => {
  fakeApi.reset();
  fakeRealtime.reset();
  auth.user = { id: OWNER.id, email: OWNER.email };
  routeCampaignShell();
  fakeApi.on(MEMBERS, campaignMembers());
  fakeApi.on(`GET ${campaignApi("active-battles/")}`, []);
  fakeApi.on("GET /restrictions/?type=Setting", []);
});

describe("Settings members list, as the owner", () => {
  it("lists every member with email, rank and permissions; Remove on players, Kick only beside a warband; nothing on the owner's or the admin's row (CAMP-UX-02)", async () => {
    const user = setupUser();
    await openMembers(user);

    const owner = row(OWNER.name);
    expect(owner).toHaveTextContent(OWNER.email);
    expect(within(owner).getAllByText("Owner")).toHaveLength(2);
    expect(within(owner).getByRole("button", { name: "All permissions" })).toBeDisabled();
    expect(within(owner).queryByRole("checkbox")).not.toBeInTheDocument();

    const admin = row(ADMIN.name);
    expect(within(admin).getByRole("checkbox", { name: "Admin" })).toBeChecked();
    expect(within(admin).getByRole("checkbox", { name: "Admin" })).toBeEnabled();
    expect(within(admin).getByRole("button", { name: "All permissions" })).toBeDisabled();
    // Admins can't be removed, and nothing on the row says so.
    expect(within(admin).queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();

    const player = row(PLAYER.name);
    expect(player).toHaveTextContent(PLAYER.email);
    expect(within(player).getByRole("checkbox", { name: "Admin" })).not.toBeChecked();
    expect(within(player).getByRole("button", { name: "Add custom" })).toBeEnabled();
    expect(within(player).getByRole("button", { name: "Remove" })).toBeInTheDocument();
    expect(within(player).getByRole("button", { name: "Kick" })).toBeInTheDocument();

    const nameless = row(NAMELESS.name);
    expect(within(nameless).getByRole("button", { name: "None" })).toBeEnabled();
    expect(within(nameless).getByRole("button", { name: "Remove" })).toBeInTheDocument();
    expect(within(nameless).queryByRole("button", { name: "Kick" })).not.toBeInTheDocument();

    expect(fakeApi.countOf(MEMBERS)).toBe(1);
  });

  it("Kick asks to delete the warband, then sends the warband DELETE, which the server refuses the owner (BUG-12, pinned; flips in PR A)", async () => {
    const user = setupUser();
    fakeApi.fail(
      `DELETE /warbands/${PLAYER.warband!.id}/`,
      new ApiError("Forbidden", 403, { detail: "Forbidden" })
    );
    await openMembers(user);

    await user.click(within(row(PLAYER.name)).getByRole("button", { name: "Kick" }));

    const dialog = screen.getByRole("dialog", { name: "Kick player" });
    expect(dialog).toHaveTextContent(
      "Delete Night Razors? This will permanently remove the warband and all its units."
    );
    await user.click(within(dialog).getByRole("button", { name: "Kick player" }));

    expect(await within(dialog).findByText("Forbidden")).toBeInTheDocument();
    expect(fakeApi.calls().filter((call) => !call.startsWith("GET"))).toEqual([
      `DELETE /warbands/${PLAYER.warband!.id}/`,
    ]);
    // The dialog stays open over the list (which Radix hides from the accessibility tree).
    expect(screen.getByRole("row", { name: /^Mira/, hidden: true })).toBeInTheDocument();
  });

  it("Remove says it cannot be undone, sends the member DELETE and drops the row (BUG-50, pinned; flips in PR A)", async () => {
    const user = setupUser();
    fakeApi.on(`DELETE ${campaignApi(`members/${PLAYER.id}/`)}`, undefined);
    await openMembers(user);

    await user.click(within(row(PLAYER.name)).getByRole("button", { name: "Remove" }));

    const dialog = screen.getByRole("dialog", { name: "Remove player" });
    expect(dialog).toHaveTextContent(
      "Remove Mira from the campaign? This action cannot be undone."
    );
    await user.click(within(dialog).getByRole("button", { name: "Remove player" }));

    await waitFor(() =>
      expect(screen.queryByRole("row", { name: /^Mira/ })).not.toBeInTheDocument()
    );
    expect(fakeApi.calls().filter((call) => !call.startsWith("GET"))).toEqual([
      `DELETE ${campaignApi(`members/${PLAYER.id}/`)}`,
    ]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("never names a member by email in the remove dialog, even one sent without a name (SEC-13)", async () => {
    const user = setupUser();
    fakeApi.on(
      MEMBERS,
      campaignMembers().map((member) =>
        member.id === NAMELESS.id ? { ...member, name: "" } : member
      )
    );
    await openMembers(user);

    const nameless = screen.getByRole("row", { name: new RegExp(`^${NAMELESS.email}`) });
    await user.click(within(nameless).getByRole("button", { name: "Remove" }));

    const dialog = screen.getByRole("dialog", { name: "Remove player" });
    expect(dialog).toHaveTextContent("Remove this player from the campaign?");
    expect(dialog).not.toHaveTextContent(NAMELESS.email);
  });

  it("offers six codes in the grant menu, none for encampments, bestiary, spells, specials or battles, and never reads GET permissions/ (BUG-15, CAMP-TEST-25 baseline, pinned; flips in PR A)", async () => {
    const user = setupUser();
    await openMembers(user);

    await user.click(within(row(PLAYER.name)).getByRole("button", { name: "Add custom" }));

    const options = within(grantMenu()).getAllByRole("checkbox");
    const labels = [
      "Add custom",
      "Manage items",
      "Manage skills",
      "Manage house rules",
      "Manage warbands",
      "Manage locations",
    ];
    expect(options).toHaveLength(labels.length);
    labels.forEach((label, index) =>
      expect(options[index]).toHaveAccessibleName(new RegExp(`^${label}`))
    );
    expect(options.map((option) => (option as HTMLInputElement).checked)).toEqual([
      true,
      false,
      false,
      false,
      false,
      false,
    ]);
    expect(fakeApi.countOf(`GET ${campaignApi("permissions/")}`)).toBe(0);
  });

  it("ticks a code at once and PUTs the whole new list; the answer's codes become the row's label (CAMP-TEST-25 baseline)", async () => {
    const user = setupUser();
    const answer = deferred<unknown>();
    fakeApi.on(PERMISSIONS_PUT, () => answer.promise);
    await openMembers(user);
    await user.click(within(row(PLAYER.name)).getByRole("button", { name: "Add custom" }));

    await user.click(screen.getByRole("checkbox", { name: /^Manage items/ }));

    expect(screen.getByRole("checkbox", { name: /^Manage items/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /^Manage skills/ })).toBeDisabled();
    expect(fakeApi.bodyOf(PERMISSIONS_PUT)).toEqual({
      permissions: ["add_custom", "manage_items"],
    });

    answer.resolve(grantAnswer({ permissions: ["add_custom", "manage_items"] }));

    expect(
      await within(row(PLAYER.name)).findByRole("button", { name: "Add custom, Manage items" })
    ).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /^Manage skills/ })).toBeEnabled();
  });

  it("puts a refused grant back and shows why on the row (CAMP-TEST-25 baseline)", async () => {
    const user = setupUser();
    fakeApi.fail(
      PERMISSIONS_PUT,
      new ApiError("Only owners and admins can change permissions.", 403, null)
    );
    await openMembers(user);
    await user.click(within(row(PLAYER.name)).getByRole("button", { name: "Add custom" }));

    await user.click(screen.getByRole("checkbox", { name: /^Manage house rules/ }));

    expect(
      await within(row(PLAYER.name)).findByText("Only owners and admins can change permissions.")
    ).toBeInTheDocument();
    expect(
      within(row(PLAYER.name)).getByRole("button", { name: "Add custom" })
    ).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /^Manage house rules/ })).not.toBeChecked();
  });

  it("closes the grant menu on an outside click but not on Escape (CAMP-UX-07, pinned; flips in PR A)", async () => {
    const user = setupUser();
    await openMembers(user);
    await user.click(within(row(PLAYER.name)).getByRole("button", { name: "Add custom" }));

    await user.keyboard("{Escape}");
    expect(screen.getByRole("checkbox", { name: /^Manage items/ })).toBeInTheDocument();

    await user.click(screen.getByRole("heading", { name: "Roster" }));
    expect(screen.queryByRole("checkbox", { name: /^Manage items/ })).not.toBeInTheDocument();
  });

  it("makes a player an admin through the role PATCH: All permissions, and no Remove or Kick", async () => {
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
    expect(within(player).queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
    expect(within(player).queryByRole("button", { name: "Kick" })).not.toBeInTheDocument();
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
    expect(within(row(PLAYER.name)).getByRole("button", { name: "Remove" })).toBeInTheDocument();
  });
});

describe("Settings members list, as an admin", () => {
  beforeEach(() => {
    auth.user = { id: ADMIN.id, email: ADMIN.email };
    routeCampaignShell({ campaign: campaignFor("admin"), viewer: ADMIN });
  });

  it("can grant codes to players but can't change roles or remove anyone; no Campaign Systems, Warband or delete cards", async () => {
    const user = setupUser();
    await openMembers(user);

    const player = row(PLAYER.name);
    expect(within(player).getByRole("checkbox", { name: "Admin" })).toBeDisabled();
    expect(within(row(ADMIN.name)).getByRole("checkbox", { name: "Admin" })).toBeDisabled();
    expect(within(player).getByRole("button", { name: "Add custom" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Kick" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Campaign Systems" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Delete campaign" })).not.toBeInTheDocument();
    // Pass 3: Active Battles for manage_battles, which admins hold.
    expect(fakeApi.countOf(`GET ${campaignApi("active-battles/")}`)).toBe(1);
  });
});
