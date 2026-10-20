/**
 * The Skills page as the app mounts it (layout, fake server): which capability flags gate Add and
 * Edit today. Add reads `add_custom`; Edit reads nothing, so every campaign skill offers it to
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
import { LIST, routeCatalogue } from "@/test/catalogue-fixtures";
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

async function openSkills() {
  renderCatalogueRoute("/campaigns/1/skills");
  await screen.findByRole("row", { name: /^Quick Hands/ });
}

beforeEach(() => {
  fakeApi.reset();
  fakeRealtime.reset();
  auth.user = { id: OWNER.id, email: OWNER.email };
  routeCampaignShell({ campaign: campaignSummary() });
  routeCatalogue();
});

describe("Skills: who sees Add and Edit", () => {
  it("offers the owner Add skill and Edit on the campaign's skill, never on a book skill", async () => {
    await openSkills();

    expect(screen.getByRole("button", { name: "Add skill" })).toBeVisible();
    expect(within(row("Quick Hands")).getByRole("button", { name: "Edit skill" })).toBeVisible();
    expect(
      within(row("Strike to Injure")).queryByRole("button", { name: "Edit skill" })
    ).toBeNull();
  });

  // Characterises current behaviour (BUG-15, CAT-TEST-18, pinned; flips in PR A)
  it("offers a player holding only add_custom Edit on every campaign skill (BUG-15, CAT-TEST-18, pinned; flips in PR A)", async () => {
    signInAsPlayer(["add_custom"]);

    await openSkills();

    expect(screen.getByRole("button", { name: "Add skill" })).toBeVisible();
    expect(within(row("Quick Hands")).getByRole("button", { name: "Edit skill" })).toBeVisible();
    expect(
      within(row("Strike to Injure")).queryByRole("button", { name: "Edit skill" })
    ).toBeNull();
  });

  // Characterises current behaviour (BUG-15, CAT-TEST-18, pinned; flips in PR A)
  it("offers Edit to a player holding no code at all; only Add skill is gated, on add_custom (BUG-15, pinned; flips in PR A)", async () => {
    signInAsPlayer([]);

    await openSkills();

    expect(screen.queryByRole("button", { name: "Add skill" })).toBeNull();
    expect(within(row("Quick Hands")).getByRole("button", { name: "Edit skill" })).toBeVisible();
  });

  // Characterises current behaviour (BUG-15, pinned; flips in PR A)
  it("reads no manage_skills flag: holding it alone gives no Add skill, and Edit shows regardless (BUG-15, pinned; flips in PR A)", async () => {
    signInAsPlayer(["manage_skills"]);

    await openSkills();

    expect(screen.queryByRole("button", { name: "Add skill" })).toBeNull();
    expect(within(row("Quick Hands")).getByRole("button", { name: "Edit skill" })).toBeVisible();
  });

  // Characterises current behaviour (BUG-15, CAT-TEST-18, pinned; flips in PR A)
  it("lets that player fill in the edit form and learn of the 403 only after Save changes (BUG-15, CAT-TEST-18, pinned; flips in PR A)", async () => {
    const user = setupUser();
    signInAsPlayer(["add_custom"]);
    fakeApi.fail(
      "PATCH /skills/900/",
      new ApiError("You do not have permission to perform this action.", 403, {})
    );
    await openSkills();

    await user.click(within(row("Quick Hands")).getByRole("button", { name: "Edit skill" }));
    const name = screen.getByDisplayValue("Quick Hands");
    await user.clear(name);
    await user.type(name, "Quicker Hands");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(
      await screen.findByText("You do not have permission to perform this action.")
    ).toBeVisible();
    expect(fakeApi.bodyOf("PATCH /skills/900/")).toEqual({
      name: "Quicker Hands",
      type: "Speed",
      description: "Steals a drink before anyone notices.",
    });
    expect(fakeApi.countOf(LIST.skills)).toBe(1);
  });
});
