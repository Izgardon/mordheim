/**
 * The Encampments page as the app mounts it (layout, fake server): who may add and edit, what a
 * new encampment's owner defaults to, the requests behind the page, and the disabled state.
 */
import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ADMIN,
  NAMELESS,
  OWNER,
  PLAYER,
  campaignApi,
  campaignFor,
  campaignPlayers,
  campaignSummary,
  encampment,
  routeCampaignShell,
} from "@/test/campaign-fixtures";
import { renderCampaignRoute } from "@/test/campaign-routes";
import { fakeApi } from "@/test/fake-api";
import { fakeRealtime } from "@/test/fake-realtime";
import { chooseOption } from "@/test/select-option";
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

const ENCAMPMENTS = `GET ${campaignApi("encampments/")}`;
const PLAYERS = `GET ${campaignApi("players/")}`;
const CREATE = `POST ${campaignApi("encampments/")}`;
const UPDATE = `PATCH ${campaignApi("encampments/4/")}`;

const row = (name: string) => screen.getByRole("row", { name: new RegExp(`^${name}`) });

async function openEncampments() {
  renderCampaignRoute("/campaigns/1/encampments");
  expect(await screen.findByRole("heading", { name: "Campaign Encampments" })).toBeInTheDocument();
  await screen.findByRole("row", { name: /^Sailmakers' Row/ });
}

/** Signs in as a player whose campaign payload carries `permissions`. */
function signInAsPlayer(permissions: string[]) {
  auth.user = { id: PLAYER.id, email: PLAYER.email };
  routeCampaignShell({
    campaign: campaignFor("player", { enable_encampments: true, permissions }),
    viewer: PLAYER,
  });
}

beforeEach(() => {
  fakeApi.reset();
  fakeRealtime.reset();
  auth.user = { id: OWNER.id, email: OWNER.email };
  routeCampaignShell({ campaign: campaignSummary({ enable_encampments: true }) });
  fakeApi.on(ENCAMPMENTS, [encampment()]);
  fakeApi.on(PLAYERS, campaignPlayers());
});

describe("Encampments: who may add and edit", () => {
  it("shows a player without manage_encampments the list but no Add or Edit (decision 9, CAMP-TWEAK-08, pinned; flips in PR C)", async () => {
    signInAsPlayer(["add_custom"]);

    await openEncampments();

    expect(row("Sailmakers' Row")).toHaveTextContent("Mira");
    expect(screen.queryByRole("button", { name: "Add encampment" })).not.toBeInTheDocument();
    expect(within(row("Sailmakers' Row")).queryByRole("button")).not.toBeInTheDocument();
  });

  it("gives a player granted manage_encampments Add and Edit", async () => {
    signInAsPlayer(["add_custom", "manage_encampments"]);

    await openEncampments();

    expect(screen.getByRole("button", { name: "Add encampment" })).toBeInTheDocument();
    expect(
      within(row("Sailmakers' Row")).getByRole("button", { name: "Edit" })
    ).toBeInTheDocument();
  });
});

describe("Encampments: adding and editing, as the owner", () => {
  it("defaults a new encampment's owner to Unassigned, POSTs owner_id null and lists it in name order; nothing can be deleted (decision 9, CAMP-TWEAK-08, pinned; flips in PR C)", async () => {
    const user = setupUser();
    fakeApi.on(CREATE, (body: unknown) =>
      encampment({ ...(body as object), id: 5, owner_name: null })
    );
    await openEncampments();

    await user.click(screen.getByRole("button", { name: "Add encampment" }));

    expect(screen.getByRole("combobox")).toHaveTextContent("Unassigned");
    await user.type(screen.getByPlaceholderText("Sailmakers' Row"), "Bell Tower");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.queryByRole("combobox")).not.toBeInTheDocument());
    expect(fakeApi.bodyOf(CREATE)).toEqual({ name: "Bell Tower", owner_id: null, description: "" });
    const names = screen
      .getAllByRole("row")
      .slice(1)
      .map((entry) => entry.querySelector("td")!.textContent);
    expect(names).toEqual(["Bell Tower", "Sailmakers' Row"]);
    expect(row("Bell Tower")).toHaveTextContent("Unassigned");
    expect(screen.queryByRole("button", { name: /delete|remove/i })).not.toBeInTheDocument();
  });

  it("says a name is required and sends nothing without one", async () => {
    const user = setupUser();
    await openEncampments();

    await user.click(screen.getByRole("button", { name: "Add encampment" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByText("Name is required.")).toBeInTheDocument();
    expect(fakeApi.countOf(CREATE)).toBe(0);
  });

  it("edits with every member from players/ as a possible owner, PATCHing the whole form", async () => {
    const user = setupUser();
    fakeApi.on(UPDATE, (body: unknown) =>
      encampment({ ...(body as object), owner_name: ADMIN.name })
    );
    await openEncampments();

    await user.click(within(row("Sailmakers' Row")).getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("combobox")).toHaveTextContent("Mira");
    await chooseOption(user, screen.getByRole("combobox"), ADMIN.name);
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(row("Sailmakers' Row")).toHaveTextContent(ADMIN.name));
    expect(fakeApi.bodyOf(UPDATE)).toEqual({
      name: "Sailmakers' Row",
      owner_id: ADMIN.id,
      description: "Rope, canvas and a dry place to sleep.",
    });
  });

  it("shows the email today's server sends as a nameless owner's name, in the list and the owner picker (SEC-13, pinned; flips in PR A)", async () => {
    const user = setupUser();
    fakeApi.on(ENCAMPMENTS, [encampment({ owner_id: NAMELESS.id, owner_name: NAMELESS.name })]);
    await openEncampments();

    expect(row("Sailmakers' Row")).toHaveTextContent("nameless@example.com");
    await user.click(within(row("Sailmakers' Row")).getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("combobox")).toHaveTextContent("nameless@example.com");
  });
});

describe("Encampments: requests", () => {
  it("reads the encampments and the whole players list, for the owner names, together (PERF-41, pinned; flips in PR A)", async () => {
    await openEncampments();

    expect(fakeApi.countOf(ENCAMPMENTS)).toBe(1);
    expect(fakeApi.countOf(PLAYERS)).toBe(1);
    expect(fakeApi.countOf(`GET ${campaignApi("players/?fields=basic")}`)).toBe(0);
  });

  it("reads both again on every visit (CAMP-CQ-05, pinned; flips in PR B)", async () => {
    const user = setupUser();
    await openEncampments();

    await user.click(screen.getByRole("link", { name: "Skills" }));
    await screen.findByText("Skills page");
    await user.click(screen.getByRole("link", { name: "Encampments" }));
    await screen.findByRole("row", { name: /^Sailmakers' Row/ });

    expect(fakeApi.countOf(ENCAMPMENTS)).toBe(2);
    expect(fakeApi.countOf(PLAYERS)).toBe(2);
  });

  it("says the page is disabled and reads nothing when encampments are off", async () => {
    routeCampaignShell({ campaign: campaignSummary({ enable_encampments: false }) });

    renderCampaignRoute("/campaigns/1/encampments");

    expect(
      await screen.findByText(/Encampments are currently disabled for this campaign/)
    ).toBeInTheDocument();
    expect(fakeApi.countOf(ENCAMPMENTS)).toBe(0);
    expect(fakeApi.countOf(PLAYERS)).toBe(0);
    expect(screen.queryByRole("button", { name: "Add encampment" })).not.toBeInTheDocument();
  });
});
