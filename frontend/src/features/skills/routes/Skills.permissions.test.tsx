/**
 * The Skills page as the app mounts it (layout, fake server): Add and Edit both follow
 * `edit_catalogue` (BUG-15, CAT-TEST-18, decision 4); Edit never shows on a book skill.
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
import { quickHands, routeCatalogue } from "@/test/catalogue-fixtures";
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

  it("offers a player holding edit_catalogue Add skill and Edit on the campaign's skill, never on a book skill (BUG-15, CAT-TEST-18)", async () => {
    signInAsPlayer(["edit_catalogue"]);

    await openSkills();

    expect(screen.getByRole("button", { name: "Add skill" })).toBeVisible();
    expect(within(row("Quick Hands")).getByRole("button", { name: "Edit skill" })).toBeVisible();
    expect(
      within(row("Strike to Injure")).queryByRole("button", { name: "Edit skill" })
    ).toBeNull();
  });

  it("offers a player without edit_catalogue neither Add skill nor Edit, so no form the server would refuse (BUG-15, CAT-TEST-18)", async () => {
    signInAsPlayer([]);

    await openSkills();

    expect(screen.queryByRole("button", { name: "Add skill" })).toBeNull();
    expect(within(row("Quick Hands")).queryByRole("button", { name: "Edit skill" })).toBeNull();
  });

  it("gives delete_catalogue alone no Add skill or Edit (BUG-15)", async () => {
    signInAsPlayer(["delete_catalogue"]);

    await openSkills();

    expect(screen.queryByRole("button", { name: "Add skill" })).toBeNull();
    expect(within(row("Quick Hands")).queryByRole("button", { name: "Edit skill" })).toBeNull();
  });

  it("lets a player holding edit_catalogue edit the campaign's skill: one PATCH, and the form closes", async () => {
    const user = setupUser();
    signInAsPlayer(["edit_catalogue"]);
    fakeApi.on("PATCH /skills/900/", (body: object) => ({ ...quickHands, ...body }));
    await openSkills();

    await user.click(within(row("Quick Hands")).getByRole("button", { name: "Edit skill" }));
    const name = screen.getByDisplayValue("Quick Hands");
    await user.clear(name);
    await user.type(name, "Quicker Hands");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull());
    expect(fakeApi.bodyOf("PATCH /skills/900/")).toEqual({
      name: "Quicker Hands",
      type: "Speed",
      description: "Steals a drink before anyone notices.",
    });
  });
});

describe("Skills: who sees Delete (decision 5)", () => {
  it("offers Delete in the edit form to a player granted delete_catalogue, and not to one without it", async () => {
    const user = setupUser();
    signInAsPlayer(["edit_catalogue"]);
    const { unmount } = await openSkillsAndEdit(user);
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
    unmount();

    signInAsPlayer(["edit_catalogue", "delete_catalogue"]);
    await openSkillsAndEdit(user);
    expect(screen.getByRole("button", { name: "Delete" })).toBeVisible();
  });
});

async function openSkillsAndEdit(user: ReturnType<typeof setupUser>) {
  const view = renderCatalogueRoute("/campaigns/1/skills");
  await screen.findByRole("row", { name: /^Quick Hands/ });
  await user.click(within(row("Quick Hands")).getByRole("button", { name: "Edit skill" }));
  expect(screen.getByRole("button", { name: "Save changes" })).toBeVisible();
  return view;
}
