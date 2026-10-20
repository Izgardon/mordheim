/**
 * The Spells page as the app mounts it (layout, fake server): which capability flags gate Add and
 * Edit today. Add reads `add_custom`; Edit reads nothing, so every campaign spell offers it to
 * everyone (BUG-15, CAT-TEST-18). PR A gates both on `edit_catalogue`.
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

  // Characterises current behaviour (BUG-15, CAT-TEST-18, pinned; flips in PR A)
  it("offers a player holding only add_custom Edit on every campaign spell (BUG-15, CAT-TEST-18, pinned; flips in PR A)", async () => {
    signInAsPlayer(["add_custom"]);

    await openSpells();

    expect(screen.getByRole("button", { name: "Add spell" })).toBeVisible();
    expect(within(row("Gutter Hex")).getByRole("button", { name: "Edit spell" })).toBeVisible();
  });

  // Characterises current behaviour (BUG-15, CAT-TEST-18, pinned; flips in PR A)
  it("offers Edit to a player holding no code at all; only Add spell is gated, on add_custom (BUG-15, pinned; flips in PR A)", async () => {
    signInAsPlayer([]);

    await openSpells();

    expect(screen.queryByRole("button", { name: "Add spell" })).toBeNull();
    expect(within(row("Gutter Hex")).getByRole("button", { name: "Edit spell" })).toBeVisible();
  });

  // Characterises current behaviour (BUG-15, pinned; flips in PR A)
  it("reads no manage_spells flag: holding it alone gives no Add spell, and Edit shows regardless (BUG-15, pinned; flips in PR A)", async () => {
    signInAsPlayer(["manage_spells"]);

    await openSpells();

    expect(screen.queryByRole("button", { name: "Add spell" })).toBeNull();
    expect(within(row("Gutter Hex")).getByRole("button", { name: "Edit spell" })).toBeVisible();
  });

  // Characterises current behaviour (BUG-15, CAT-TEST-18, pinned; flips in PR A)
  it("lets that player open Delete and learn of the 403 only after confirming, behind the still-open confirm (BUG-15, pinned; flips in PR A)", async () => {
    const user = setupUser();
    signInAsPlayer(["add_custom"]);
    fakeApi.fail(
      "DELETE /spells/950/",
      new ApiError("You do not have permission to perform this action.", 403, {})
    );
    await openSpells();

    await user.click(within(row("Gutter Hex")).getByRole("button", { name: "Edit spell" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Delete spell" }));

    // The form under the dialog shows the error; the confirm stays open over it.
    expect(
      await screen.findByText("You do not have permission to perform this action.")
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Delete spell" })
    ).toBeEnabled();
    expect(fakeApi.countOf("DELETE /spells/950/")).toBe(1);
  });
});
