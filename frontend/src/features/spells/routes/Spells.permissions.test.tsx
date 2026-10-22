/**
 * The Spells page as the app mounts it (layout, fake server): Add and Edit both follow
 * `edit_catalogue` (BUG-15, CAT-TEST-18, decision 4); Edit shows on a book spell too, whose
 * edit makes the campaign's version (CAT-TWEAK-01).
 */
import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  OWNER,
  PLAYER,
  campaignFor,
  campaignSummary,
  routeCampaignShell,
} from "@/test/campaign-fixtures";
import { LIST, routeCatalogue, spell } from "@/test/catalogue-fixtures";
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

const row = (name: string) => screen.getByRole("row", { name: new RegExp(`^${name}`) });

/** Signs in as Mira, a player whose campaign payload carries `permissions`. */
function signInAsPlayer(permissions: string[]) {
  auth.user = { id: PLAYER.id, email: PLAYER.email };
  routeCampaignShell({ campaign: campaignFor("player", { permissions }), viewer: PLAYER });
}

async function openSpells() {
  renderCatalogueRoute("/campaigns/1/spells");
  await screen.findByRole("row", { name: /^Gutter Hex/ });
}

beforeEach(() => {
  fakeApi.reset();
  fakeRealtime.reset();
  auth.user = { id: OWNER.id, email: OWNER.email };
  routeCampaignShell({ campaign: campaignSummary() });
  routeCatalogue();
});

describe("Spells: who sees Add and Edit", () => {
  it("offers the owner Add spell and Edit on the campaign's spell and on a book spell (CAT-TWEAK-01)", async () => {
    await openSpells();

    expect(screen.getByRole("button", { name: "Add spell" })).toBeVisible();
    expect(within(row("Gutter Hex")).getByRole("button", { name: "Edit spell" })).toBeVisible();
    expect(
      within(row("Fires of U'Zhul")).getByRole("button", { name: "Edit spell" })
    ).toBeVisible();
  });

  it("offers a player holding edit_catalogue Add spell and Edit on the campaign's spell and on a book spell (BUG-15, CAT-TEST-18, CAT-TWEAK-01)", async () => {
    signInAsPlayer(["edit_catalogue"]);

    await openSpells();

    expect(screen.getByRole("button", { name: "Add spell" })).toBeVisible();
    expect(within(row("Gutter Hex")).getByRole("button", { name: "Edit spell" })).toBeVisible();
    expect(
      within(row("Fires of U'Zhul")).getByRole("button", { name: "Edit spell" })
    ).toBeVisible();
  });

  it("offers a player without edit_catalogue neither Add spell nor Edit, whatever else they hold (BUG-15, CAT-TEST-18)", async () => {
    signInAsPlayer(["delete_catalogue", "manage_rules"]);

    await openSpells();

    expect(screen.queryByRole("button", { name: "Add spell" })).toBeNull();
    expect(within(row("Gutter Hex")).queryByRole("button", { name: "Edit spell" })).toBeNull();
  });

  it("offers a player holding edit_catalogue but not delete_catalogue the edit form with no Delete (BUG-15, CAT-TEST-18, decision 5)", async () => {
    const user = setupUser();
    signInAsPlayer(["edit_catalogue"]);
    await openSpells();

    await user.click(within(row("Gutter Hex")).getByRole("button", { name: "Edit spell" }));

    expect(screen.getByRole("button", { name: "Save changes" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
  });

  it("lets a player granted delete_catalogue delete the campaign's spell: the usage check, one DELETE, and the row goes", async () => {
    const user = setupUser();
    signInAsPlayer(["edit_catalogue", "delete_catalogue"]);
    fakeApi.on("GET /spells/950/usage/", {
      units: 0,
      warbands: 0,
      stashes: 0,
      bestiary_entries: 0,
    });
    fakeApi.on("DELETE /spells/950/", null);
    await openSpells();
    fakeApi.on(LIST.spells, [spell()]);

    await user.click(within(row("Gutter Hex")).getByRole("button", { name: "Edit spell" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await within(screen.getByRole("dialog")).findByText(/deleted for good/);
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Delete spell" })
    );

    await waitFor(() => expect(screen.queryByRole("row", { name: /^Gutter Hex/ })).toBeNull());
    expect(fakeApi.countOf("DELETE /spells/950/")).toBe(1);
  });
});
