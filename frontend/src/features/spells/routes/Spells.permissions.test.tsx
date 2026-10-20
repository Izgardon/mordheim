/**
 * The Spells page as the app mounts it (layout, fake server): Add and Edit both follow
 * `edit_catalogue` (BUG-15, CAT-TEST-18, decision 4); Edit never shows on a book spell.
 */
import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";
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
  it("offers the owner Add spell and Edit on the campaign's spell, never on a book spell", async () => {
    await openSpells();

    expect(screen.getByRole("button", { name: "Add spell" })).toBeVisible();
    expect(within(row("Gutter Hex")).getByRole("button", { name: "Edit spell" })).toBeVisible();
    expect(within(row("Fires of U'Zhul")).queryByRole("button", { name: "Edit spell" })).toBeNull();
  });

  it("offers a player holding edit_catalogue Add spell and Edit on the campaign's spell, never on a book spell (BUG-15, CAT-TEST-18)", async () => {
    signInAsPlayer(["edit_catalogue"]);

    await openSpells();

    expect(screen.getByRole("button", { name: "Add spell" })).toBeVisible();
    expect(within(row("Gutter Hex")).getByRole("button", { name: "Edit spell" })).toBeVisible();
    expect(within(row("Fires of U'Zhul")).queryByRole("button", { name: "Edit spell" })).toBeNull();
  });

  it("offers a player without edit_catalogue neither Add spell nor Edit, whatever else they hold (BUG-15, CAT-TEST-18)", async () => {
    signInAsPlayer(["delete_catalogue", "manage_rules"]);

    await openSpells();

    expect(screen.queryByRole("button", { name: "Add spell" })).toBeNull();
    expect(within(row("Gutter Hex")).queryByRole("button", { name: "Edit spell" })).toBeNull();
  });

  // Characterises current behaviour (BUG-15, CAT-TEST-18, pinned; flips in PR A)
  it("lets that player open Delete and learn of the 403 only after confirming, in the still-open confirm (BUG-15, pinned; flips in PR A)", async () => {
    const user = setupUser();
    const denied = "You do not have permission to perform this action.";
    signInAsPlayer(["edit_catalogue"]);
    fakeApi.fail("DELETE /spells/950/", new ApiError(denied, 403, { detail: denied }));
    await openSpells();

    await user.click(within(row("Gutter Hex")).getByRole("button", { name: "Edit spell" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Delete spell" }));

    // The confirm stays open and shows the refusal (BUG-148).
    const confirm = screen.getByRole("dialog");
    expect(await within(confirm).findByRole("alert")).toHaveTextContent(denied);
    expect(within(confirm).getByRole("button", { name: "Delete spell" })).toBeEnabled();
    expect(fakeApi.countOf("DELETE /spells/950/")).toBe(1);
  });
});
