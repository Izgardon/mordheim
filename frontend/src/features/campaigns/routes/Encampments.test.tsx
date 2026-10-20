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
const PLAYER_NAMES = `GET ${campaignApi("players/?fields=basic")}`;
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
  fakeApi.on(
    PLAYER_NAMES,
    campaignPlayers().map(({ id, name }) => ({ id, name }))
  );
});

describe("Encampments: who may add and edit", () => {
  it("lets any member add one; Edit and Delete follow each row's capabilities (decision 9, CAMP-TWEAK-08)", async () => {
    signInAsPlayer(["add_custom"]);
    fakeApi.on(ENCAMPMENTS, [
      encampment(),
      encampment({
        id: 6,
        name: "Old Mill",
        owner_id: OWNER.id,
        owner_name: OWNER.name,
        capabilities: { edit: false },
      }),
    ]);

    await openEncampments();

    expect(screen.getByRole("button", { name: "Add encampment" })).toBeInTheDocument();
    expect(
      within(row("Sailmakers' Row")).getByRole("button", { name: "Edit" })
    ).toBeInTheDocument();
    expect(
      within(row("Sailmakers' Row")).getByRole("button", { name: "Delete" })
    ).toBeInTheDocument();
    expect(within(row("Old Mill")).queryByRole("button")).not.toBeInTheDocument();
  });

  it("gives a player granted manage_encampments Add and Edit", async () => {
    signInAsPlayer(["add_custom", "manage_encampments"]);

    await openEncampments();

    expect(screen.getByRole("button", { name: "Add encampment" })).toBeInTheDocument();
    expect(
      within(row("Sailmakers' Row")).getByRole("button", { name: "Edit" })
    ).toBeInTheDocument();
  });

  it("marks an owner who has left the campaign", async () => {
    fakeApi.on(ENCAMPMENTS, [encampment({ owner_left: true })]);

    await openEncampments();

    expect(row("Sailmakers' Row")).toHaveTextContent("Mira (left)");
  });
});

describe("Encampments: adding and editing, as the owner", () => {
  it("defaults a new encampment's owner to you, POSTs your id and lists it in name order (decision 9, CAMP-TWEAK-08)", async () => {
    const user = setupUser();
    fakeApi.on(CREATE, (body: unknown) =>
      encampment({ ...(body as object), id: 5, owner_name: OWNER.name })
    );
    await openEncampments();

    await user.click(screen.getByRole("button", { name: "Add encampment" }));

    expect(screen.getByRole("combobox")).toHaveTextContent(OWNER.name);
    await user.type(screen.getByPlaceholderText("Sailmakers' Row"), "Bell Tower");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.queryByRole("combobox")).not.toBeInTheDocument());
    expect(fakeApi.bodyOf(CREATE)).toEqual({
      name: "Bell Tower",
      owner_id: OWNER.id,
      description: "",
    });
    const names = screen
      .getAllByRole("row")
      .slice(1)
      .map((entry) => entry.querySelector("td")!.textContent);
    expect(names).toEqual(["Bell Tower", "Sailmakers' Row"]);
    expect(row("Bell Tower")).toHaveTextContent(OWNER.name);
  });

  it("can give a new encampment to nobody", async () => {
    const user = setupUser();
    fakeApi.on(CREATE, (body: unknown) =>
      encampment({ ...(body as object), id: 5, owner_name: null })
    );
    await openEncampments();

    await user.click(screen.getByRole("button", { name: "Add encampment" }));
    await chooseOption(user, screen.getByRole("combobox"), "Nobody");
    await user.type(screen.getByPlaceholderText("Sailmakers' Row"), "Bell Tower");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(fakeApi.countOf(CREATE)).toBe(1));
    expect(fakeApi.bodyOf(CREATE)).toEqual({ name: "Bell Tower", owner_id: null, description: "" });
    expect(await screen.findByRole("row", { name: /^Bell Tower/ })).toHaveTextContent("Nobody");
  });

  it("deletes an encampment after a confirm, and it leaves the list", async () => {
    const user = setupUser();
    fakeApi.on(`DELETE ${campaignApi("encampments/4/")}`, undefined);
    await openEncampments();

    await user.click(within(row("Sailmakers' Row")).getByRole("button", { name: "Delete" }));
    const confirm = screen.getByRole("dialog", { name: "Delete encampment" });
    expect(confirm).toHaveTextContent("Delete Sailmakers' Row?");
    await user.click(within(confirm).getByRole("button", { name: "Delete" }));

    await waitFor(() =>
      expect(screen.queryByRole("row", { name: /^Sailmakers' Row/ })).not.toBeInTheDocument()
    );
    expect(fakeApi.countOf(`DELETE ${campaignApi("encampments/4/")}`)).toBe(1);
  });

  it("says a name is required and sends nothing without one", async () => {
    const user = setupUser();
    await openEncampments();

    await user.click(screen.getByRole("button", { name: "Add encampment" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByText("Name is required.")).toBeInTheDocument();
    expect(fakeApi.countOf(CREATE)).toBe(0);
  });

  it("edits with every member from players/?fields=basic as a possible owner, PATCHing the whole form", async () => {
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

  it("keeps an owner who has left: the picker names them, and an edit that keeps them sends no owner", async () => {
    const user = setupUser();
    fakeApi.on(ENCAMPMENTS, [encampment({ owner_left: true })]);
    fakeApi.on(
      PLAYER_NAMES,
      campaignPlayers()
        .filter(({ id }) => id !== PLAYER.id)
        .map(({ id, name }) => ({ id, name }))
    );
    fakeApi.on(UPDATE, (body: unknown) => encampment({ ...(body as object), owner_left: true }));
    await openEncampments();

    await user.click(within(row("Sailmakers' Row")).getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("combobox")).toHaveTextContent("Mira (left)");
    await user.type(screen.getByDisplayValue(/Rope, canvas/), " Abandoned.");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    // The server refuses a non-member as owner, so the departed one isn't sent back.
    await waitFor(() => expect(fakeApi.countOf(UPDATE)).toBe(1));
    expect(fakeApi.bodyOf(UPDATE)).toEqual({
      name: "Sailmakers' Row",
      description: "Rope, canvas and a dry place to sleep. Abandoned.",
    });
  });

  it("shows a nameless owner by the server's display name, in the list and the owner picker, never an email (SEC-13)", async () => {
    const user = setupUser();
    fakeApi.on(ENCAMPMENTS, [encampment({ owner_id: NAMELESS.id, owner_name: NAMELESS.name })]);
    await openEncampments();

    expect(row("Sailmakers' Row")).toHaveTextContent("Player 12");
    await user.click(within(row("Sailmakers' Row")).getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("combobox")).toHaveTextContent("Player 12");
    expect(screen.queryByText(/@example\.com/)).not.toBeInTheDocument();
  });
});

describe("Encampments: requests", () => {
  it("reads the encampments and only the players' ids and names, for the owner picker, together (PERF-41)", async () => {
    await openEncampments();

    expect(fakeApi.countOf(ENCAMPMENTS)).toBe(1);
    expect(fakeApi.countOf(PLAYER_NAMES)).toBe(1);
    expect(fakeApi.countOf(PLAYERS)).toBe(0);
  });

  it("reads both once: a revisit within the stale time uses the cached lists (CAMP-CQ-05)", async () => {
    const user = setupUser();
    await openEncampments();

    await user.click(screen.getByRole("link", { name: "Skills" }));
    await screen.findByText("Skills page");
    await user.click(screen.getByRole("link", { name: "Encampments" }));
    await screen.findByRole("row", { name: /^Sailmakers' Row/ });

    expect(fakeApi.countOf(ENCAMPMENTS)).toBe(1);
    expect(fakeApi.countOf(PLAYER_NAMES)).toBe(1);
  });

  it("says the page is disabled and reads nothing when encampments are off", async () => {
    routeCampaignShell({ campaign: campaignSummary({ enable_encampments: false }) });

    renderCampaignRoute("/campaigns/1/encampments");

    expect(
      await screen.findByText(/Encampments are currently disabled for this campaign/)
    ).toBeInTheDocument();
    expect(fakeApi.countOf(ENCAMPMENTS)).toBe(0);
    expect(fakeApi.countOf(PLAYER_NAMES)).toBe(0);
    expect(screen.queryByRole("button", { name: "Add encampment" })).not.toBeInTheDocument();
  });
});
