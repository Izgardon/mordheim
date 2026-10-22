/**
 * The Archived list on Wargear, Skills and Spells (decision 5, CAT-TWEAK-04, CAT-NEW-05): an
 * "Archived" switch, kept in the URL (`?archived=1`), reads the list with the campaign's archived
 * entries and the book entries removed for it, shows only those, and offers Restore to
 * `edit_catalogue` holders; a restored entry is back in the campaign's list.
 */
import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PLAYER, campaignFor, routeCampaignShell } from "@/test/campaign-fixtures";
import {
  ITEMS,
  LIST,
  SKILLS,
  availability,
  item,
  routeCatalogue,
  sword,
} from "@/test/catalogue-fixtures";
import { renderCatalogueRoute } from "@/test/catalogue-routes";
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

const ARCHIVED_ITEMS = `${LIST.items}&archived=1`;
const itemRow = (name: string) => screen.getByRole("button", { name: new RegExp(`^${name}`) });
const currentPath = () => screen.getByLabelText("Current path");

/** The campaign's own lantern, archived (a hero still carries one). */
const oldLantern = item({
  id: 245,
  campaign_id: 1,
  name: "Old Lantern",
  archived_at: "2026-10-20T10:00:00Z",
  availabilities: [availability({ id: 46, cost: 10 })],
});
/** The book Sword, removed for this campaign. */
const removedSword = { ...sword, archived_at: "2026-10-20T11:00:00Z" };

beforeEach(() => {
  fakeApi.reset();
  fakeRealtime.reset();
  auth.user = { id: 7, email: "aldric@example.com" };
  routeCampaignShell();
  routeCatalogue();
  fakeApi.on(ARCHIVED_ITEMS, [
    oldLantern,
    ...ITEMS.filter((entry) => entry.id !== 2),
    removedSword,
  ]);
});

async function openArchivedWargear(user: ReturnType<typeof setupUser>) {
  renderCatalogueRoute("/campaigns/1/items");
  await screen.findByRole("button", { name: /^Rusty Cleaver/ });
  await user.click(screen.getByRole("checkbox", { name: "Archived" }));
  await screen.findByRole("button", { name: /^Old Lantern/ });
}

describe("Wargear: the Archived list", () => {
  it("lists only what is archived or removed, from ?archived=1, with Restore and nothing to buy or edit", async () => {
    const user = setupUser();
    await openArchivedWargear(user);

    expect(currentPath()).toHaveTextContent("/campaigns/1/items?archived=1");
    expect(fakeApi.countOf(ARCHIVED_ITEMS)).toBe(1);
    expect(screen.queryByRole("button", { name: /^Rusty Cleaver/ })).toBeNull();
    const lantern = itemRow("Old Lantern");
    expect(within(lantern).getByText("Archived")).toBeVisible();
    expect(within(lantern).getByRole("button", { name: "Restore Old Lantern" })).toBeVisible();
    expect(within(lantern).queryByRole("button", { name: /^Acquire/ })).toBeNull();
    expect(within(lantern).queryByRole("button", { name: "Edit item" })).toBeNull();
    expect(within(itemRow("Sword")).getByRole("button", { name: "Restore Sword" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Add item" })).toBeNull();
  });

  it("restores an archived item: it leaves the Archived list and is back in the campaign's", async () => {
    const user = setupUser();
    const restored = { ...oldLantern, archived_at: null };
    fakeApi.on("POST /items/245/restore/", () => {
      fakeApi.on(ARCHIVED_ITEMS, [restored, ...ITEMS]);
      fakeApi.on(LIST.items, [restored, ...ITEMS]);
      return restored;
    });
    await openArchivedWargear(user);

    await user.click(screen.getByRole("button", { name: "Restore Old Lantern" }));

    expect(await screen.findByText("Old Lantern restored.")).toBeVisible();
    await waitFor(() => expect(screen.queryByRole("button", { name: /^Old Lantern/ })).toBeNull());
    expect(fakeApi.requests().find((request) => request.path.endsWith("restore/"))).toEqual({
      method: "POST",
      path: "/items/245/restore/",
    });
    await user.click(screen.getByRole("checkbox", { name: "Archived" }));
    expect(await screen.findByRole("button", { name: /^Old Lantern/ })).toBeVisible();
    expect(currentPath()).toHaveTextContent(/^\/campaigns\/1\/items$/);
  });

  it("restores a book item removed for the campaign by naming the campaign (CAT-NEW-05)", async () => {
    const user = setupUser();
    fakeApi.on("POST /items/2/restore/", { ...sword, archived_at: null });
    await openArchivedWargear(user);

    await user.click(screen.getByRole("button", { name: "Restore Sword" }));

    await waitFor(() =>
      expect(fakeApi.bodyOf("POST /items/2/restore/")).toEqual({ campaign_id: 1 })
    );
  });

  it("shows the Archived list to a player without edit_catalogue, with no Restore", async () => {
    const user = setupUser();
    auth.user = { id: PLAYER.id, email: PLAYER.email };
    routeCampaignShell({ campaign: campaignFor("player", { permissions: [] }), viewer: PLAYER });
    await openArchivedWargear(user);

    expect(within(itemRow("Old Lantern")).queryByRole("button", { name: /^Restore/ })).toBeNull();
  });
});

describe("Skills and Spells: the Archived list", () => {
  it("Skills: lists the archived skill with Restore, opened from a shared ?archived=1 link", async () => {
    const archivedSkill = {
      ...SKILLS[0],
      id: 912,
      name: "Old Trick",
      archived_at: "2026-10-20T10:00:00Z",
    };
    fakeApi.on(`${LIST.skills}&archived=1`, [archivedSkill, ...SKILLS]);
    renderCatalogueRoute("/campaigns/1/skills?archived=1");

    const row = await screen.findByRole("row", { name: /^Old Trick/ });
    expect(within(row).getByRole("button", { name: "Restore Old Trick" })).toBeVisible();
    expect(screen.queryByRole("row", { name: /^Quick Hands/ })).toBeNull();
    expect(screen.getByRole("checkbox", { name: "Archived" })).toBeChecked();
  });

  it("Spells: says so when nothing is archived", async () => {
    const user = setupUser();
    fakeApi.on(`${LIST.spells}&archived=1`, []);
    renderCatalogueRoute("/campaigns/1/spells");
    await screen.findByRole("row", { name: /^Gutter Hex/ });

    await user.click(screen.getByRole("checkbox", { name: "Archived" }));

    expect(await screen.findByText("Nothing archived.")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Add spell" })).toBeNull();
  });
});
