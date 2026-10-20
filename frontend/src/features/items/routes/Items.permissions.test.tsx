/**
 * The Wargear page as the app mounts it (layout, fake server): which capability flags gate Add
 * and Edit today. Add reads `add_custom`, Edit reads `manage_items` (and never shows on book rows
 * or house-rule clones), so a player can add an item but never fix it (BUG-15). PR A gates both
 * on `edit_catalogue`.
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
  it("offers the owner Add item and Edit on campaign items, never on book items", async () => {
    await openWargear();

    expect(screen.getByRole("button", { name: "Add item" })).toBeVisible();
    expect(editOn("Rusty Cleaver")).toBeVisible();
    expect(editOn("Axe")).toBeVisible();
    expect(editOn("Sword")).toBeNull();
  });

  // Characterises current behaviour (BUG-15, CAT-TEST-03, pinned; flips in PR A)
  it("offers a player holding add_custom Add item but no Edit, not even on what they added (BUG-15, pinned; flips in PR A)", async () => {
    signInAsPlayer(["add_custom"]);

    await openWargear();

    expect(screen.getByRole("button", { name: "Add item" })).toBeVisible();
    expect(editOn("Rusty Cleaver")).toBeNull();
    expect(editOn("Axe")).toBeNull();
  });

  // Characterises current behaviour (BUG-15, pinned; flips in PR A)
  it("offers a player holding manage_items alone Edit on campaign items but no Add item (BUG-15, pinned; flips in PR A)", async () => {
    signInAsPlayer(["manage_items"]);

    await openWargear();

    expect(screen.queryByRole("button", { name: "Add item" })).toBeNull();
    expect(editOn("Rusty Cleaver")).toBeVisible();
    expect(editOn("Sword")).toBeNull();
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
