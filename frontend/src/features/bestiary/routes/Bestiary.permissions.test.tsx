/**
 * The Bestiary and Hired Swords pages as the app mounts them (layout, fake server): both gate
 * their Add control on `manage_bestiary`, which players don't get on joining (their `add_custom`
 * unlocks nothing here). PR A gates them on `edit_catalogue` with the other pages.
 */
import { screen } from "@testing-library/react";
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

/** Signs in as Mira, a player whose campaign payload carries `permissions`. */
function signInAsPlayer(permissions: string[]) {
  auth.user = { id: PLAYER.id, email: PLAYER.email };
  routeCampaignShell({ campaign: campaignFor("player", { permissions }), viewer: PLAYER });
}

async function openBestiary() {
  renderCatalogueRoute("/campaigns/1/bestiary");
  expect(await screen.findByText("Sewer Rat")).toBeInTheDocument();
}

async function openHiredSwords() {
  renderCatalogueRoute("/campaigns/1/hired-swords");
  expect(await screen.findByText("Pit Fighter")).toBeInTheDocument();
}

beforeEach(() => {
  fakeApi.reset();
  fakeRealtime.reset();
  auth.user = { id: OWNER.id, email: OWNER.email };
  routeCampaignShell({ campaign: campaignSummary() });
  routeCatalogue();
});

describe("Bestiary: who sees Add entry", () => {
  it("offers the owner Add entry", async () => {
    await openBestiary();

    expect(screen.getByRole("button", { name: "Add entry" })).toBeVisible();
  });

  // Characterises current behaviour (BUG-15, CAT-TWEAK-05, pinned; flips in PR A)
  it("offers a player holding add_custom no Add entry: it reads manage_bestiary (BUG-15, pinned; flips in PR A)", async () => {
    signInAsPlayer(["add_custom"]);

    await openBestiary();

    expect(screen.queryByRole("button", { name: "Add entry" })).toBeNull();
  });

  it("offers a player granted manage_bestiary Add entry", async () => {
    signInAsPlayer(["add_custom", "manage_bestiary"]);

    await openBestiary();

    expect(screen.getByRole("button", { name: "Add entry" })).toBeVisible();
  });
});

describe("Hired Swords: who sees Add hired sword", () => {
  it("offers the owner Add hired sword", async () => {
    await openHiredSwords();

    expect(screen.getByRole("button", { name: "Add hired sword" })).toBeVisible();
  });

  // Characterises current behaviour (BUG-15, CAT-TWEAK-05, pinned; flips in PR A)
  it("offers a player holding add_custom no Add hired sword: it reads manage_bestiary (BUG-15, pinned; flips in PR A)", async () => {
    signInAsPlayer(["add_custom"]);

    await openHiredSwords();

    expect(screen.queryByRole("button", { name: "Add hired sword" })).toBeNull();
  });

  it("offers a player granted manage_bestiary Add hired sword", async () => {
    signInAsPlayer(["manage_bestiary"]);

    await openHiredSwords();

    expect(screen.getByRole("button", { name: "Add hired sword" })).toBeVisible();
  });
});
