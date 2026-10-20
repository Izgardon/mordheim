/**
 * The Bestiary and Hired Swords pages as the app mounts them (layout, fake server): both gate
 * their Add control on `edit_catalogue`, the one catalogue code players hold on joining (BUG-15,
 * decision 4).
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

  it("offers a player holding edit_catalogue, as joining grants it, Add entry (BUG-15, CAT-TWEAK-05)", async () => {
    signInAsPlayer(["edit_catalogue"]);

    await openBestiary();

    expect(screen.getByRole("button", { name: "Add entry" })).toBeVisible();
  });

  it("offers a player without edit_catalogue no Add entry", async () => {
    signInAsPlayer(["delete_catalogue"]);

    await openBestiary();

    expect(screen.queryByRole("button", { name: "Add entry" })).toBeNull();
  });
});

describe("Hired Swords: who sees Add hired sword", () => {
  it("offers the owner Add hired sword", async () => {
    await openHiredSwords();

    expect(screen.getByRole("button", { name: "Add hired sword" })).toBeVisible();
  });

  it("offers a player holding edit_catalogue Add hired sword (BUG-15, CAT-TWEAK-05)", async () => {
    signInAsPlayer(["edit_catalogue"]);

    await openHiredSwords();

    expect(screen.getByRole("button", { name: "Add hired sword" })).toBeVisible();
  });

  it("offers a player without edit_catalogue no Add hired sword", async () => {
    signInAsPlayer([]);

    await openHiredSwords();

    expect(screen.queryByRole("button", { name: "Add hired sword" })).toBeNull();
  });
});
