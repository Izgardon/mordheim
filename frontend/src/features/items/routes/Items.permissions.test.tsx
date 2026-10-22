/**
 * The Wargear page as the app mounts it (layout, fake server): Add and Edit both follow
 * `edit_catalogue` (BUG-15, decision 4). Edit shows on every row: a book item's edit makes the
 * campaign's version (CAT-TWEAK-01) and a house rule's clone detaches from its rule.
 */
import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  OWNER,
  PLAYER,
  campaignFor,
  campaignSummary,
  routeCampaignShell,
} from "@/test/campaign-fixtures";
import { routeCatalogue } from "@/test/catalogue-fixtures";
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

/** An item's row (the table makes each row a button that expands it). */
const row = (name: string) => screen.getByRole("button", { name: new RegExp(`^${name}`) });
const editOn = (name: string) => within(row(name)).queryByRole("button", { name: "Edit item" });

/** Signs in as Mira, a player whose campaign payload carries `permissions`. */
function signInAsPlayer(permissions: string[]) {
  auth.user = { id: PLAYER.id, email: PLAYER.email };
  routeCampaignShell({ campaign: campaignFor("player", { permissions }), viewer: PLAYER });
}

async function openWargear() {
  renderCatalogueRoute("/campaigns/1/items");
  await screen.findByRole("button", { name: /^Rusty Cleaver/ });
}

beforeEach(() => {
  fakeApi.reset();
  fakeRealtime.reset();
  auth.user = { id: OWNER.id, email: OWNER.email };
  routeCampaignShell({ campaign: campaignSummary() });
  routeCatalogue();
});

describe("Wargear: who sees Add and Edit", () => {
  it("offers the owner Add item and Edit on every item, book items included (CAT-TWEAK-01)", async () => {
    await openWargear();

    expect(screen.getByRole("button", { name: "Add item" })).toBeVisible();
    expect(editOn("Rusty Cleaver")).toBeVisible();
    expect(editOn("Axe")).toBeVisible();
    expect(editOn("Sword")).toBeVisible();
  });

  it("offers a player holding edit_catalogue Add item and Edit on every item, book items and a house rule's clone included (BUG-15, CAT-TEST-18, CAT-TWEAK-01)", async () => {
    const user = setupUser();
    signInAsPlayer(["edit_catalogue"]);

    await openWargear();

    expect(screen.getByRole("button", { name: "Add item" })).toBeVisible();
    expect(editOn("Rusty Cleaver")).toBeVisible();
    expect(editOn("Sword")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Armour" }));
    expect(editOn("Heavy Armour")).toBeVisible();
  });

  it("offers a player without edit_catalogue neither Add item nor Edit, whatever else they hold (BUG-15)", async () => {
    signInAsPlayer(["delete_catalogue", "manage_rules", "manage_warbands"]);

    await openWargear();

    expect(screen.queryByRole("button", { name: "Add item" })).toBeNull();
    expect(editOn("Rusty Cleaver")).toBeNull();
  });

  it("offers a player holding no code neither Add item nor Edit, while Acquire stays on every row", async () => {
    signInAsPlayer([]);

    await openWargear();

    expect(screen.queryByRole("button", { name: "Add item" })).toBeNull();
    expect(editOn("Rusty Cleaver")).toBeNull();
    expect(
      within(row("Rusty Cleaver")).getByRole("button", { name: "Acquire melee weapon" })
    ).toBeVisible();
  });
});

describe("Wargear: who sees Delete (decision 5)", () => {
  it("offers Delete in the edit form only with delete_catalogue: the owner has it, a joined player doesn't", async () => {
    const user = setupUser();
    signInAsPlayer(["edit_catalogue"]);
    await openWargear();

    await user.click(editOn("Rusty Cleaver")!);

    expect(screen.getByRole("button", { name: "Save changes" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
  });

  it("offers the owner Delete in the edit form", async () => {
    const user = setupUser();
    await openWargear();

    await user.click(editOn("Rusty Cleaver")!);

    expect(screen.getByRole("button", { name: "Delete" })).toBeVisible();
  });
});
