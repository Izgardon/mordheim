/**
 * Settings → Campaign's owner cards as the app mounts them (layout, fake server): starting gold
 * and the warband caps, the campaign feature toggles, the delete card, and the join code.
 */
import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";
import {
  OWNER,
  PLAYER,
  campaignApi,
  campaignFor,
  campaignMembers,
  campaignSummary,
  patchedCampaign,
  routeCampaignShell,
} from "@/test/campaign-fixtures";
import { renderCampaignRoute } from "@/test/campaign-routes";
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

const PATCH_CAMPAIGN = `PATCH ${campaignApi()}`;
const MY_SHEET = `GET /warbands/${OWNER.warband!.id}/sheet/`;

const patches = () => fakeApi.requests().filter((request) => request.method === "PATCH");

/** The block under a card's label (label, inputs and its Save). */
const blockOf = (label: string) => screen.getByText(label).parentElement!;

/** Opens Settings and its Campaign tab as the owner, and waits for the owner's cards. */
async function openCampaignTab(user: ReturnType<typeof setupUser>) {
  renderCampaignRoute("/campaigns/1/settings");
  const header = await screen.findByRole("banner");
  await user.click(within(header).getByRole("button", { name: "Campaign" }));
  await screen.findByRole("heading", { name: "Campaign Systems" });
}

beforeEach(() => {
  fakeApi.reset();
  fakeRealtime.reset();
  auth.user = { id: OWNER.id, email: OWNER.email };
  const campaign = campaignSummary();
  routeCampaignShell({ campaign });
  fakeApi.on(PATCH_CAMPAIGN, (body: unknown) => patchedCampaign(campaign, body));
  fakeApi.on(`GET ${campaignApi("members/")}`, campaignMembers());
  fakeApi.on(`GET ${campaignApi("active-battles/")}`, []);
  fakeApi.on("GET /restrictions/?type=Setting", []);
});

describe("Starting gold and warband caps", () => {
  it("saves a new starting gold at once with one PATCH: no question about existing warbands, and your sheet isn't read again (BUG-78, pinned; flips in PR A)", async () => {
    const user = setupUser();
    await openCampaignTab(user);
    const gold = blockOf("Starting gold");
    const input = within(gold).getByRole("spinbutton");
    expect(input).toHaveValue(500);
    const sheetReads = fakeApi.countOf(MY_SHEET);

    await user.clear(input);
    await user.type(input, "600");
    await user.click(within(gold).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(patches()).toHaveLength(1));
    expect(patches()[0].body).toEqual({ starting_gold: 600 });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // The answer becomes the campaign: the field keeps 600 and Save has nothing left to save.
    await waitFor(() => expect(within(gold).getByRole("button", { name: "Save" })).toBeDisabled());
    expect(input).toHaveValue(600);
    expect(fakeApi.countOf(MY_SHEET)).toBe(sheetReads);
  });

  it("sends the hero and hired-sword caps as typed, with no upper limit, and shows the server's refusal (BUG-76)", async () => {
    const user = setupUser();
    // Today's server fails a cap past its smallint column with a 500.
    fakeApi.fail(PATCH_CAMPAIGN, new ApiError("Request failed (500)", 500, null));
    await openCampaignTab(user);
    const limits = blockOf("Warband limits");
    const [maxHeroes, maxHiredSwords] = within(limits).getAllByRole("spinbutton");
    expect(maxHeroes).toHaveValue(6);
    expect(maxHiredSwords).toHaveValue(3);

    await user.clear(maxHeroes);
    await user.type(maxHeroes, "40000");
    await user.click(within(limits).getByRole("button", { name: "Save" }));

    expect(await within(limits).findByText("Request failed (500)")).toBeInTheDocument();
    expect(patches().map((request) => request.body)).toEqual([
      { max_heroes: 40000, max_hired_swords: 3 },
    ]);
  });
});

describe("Campaign features", () => {
  it("promises Marketplace trading, Infamous Haunts and Cursed Marshes on the Locations toggle (CAMP-UX-03, pinned; flips in PR C)", async () => {
    const user = setupUser();
    await openCampaignTab(user);

    expect(screen.getByText("Enable locations").parentElement).toHaveTextContent(
      "Show the Locations page and allow trading in the Marketplace, Infamous Haunts and Cursed Marshes."
    );
    expect(screen.getByText("Enable encampments").parentElement).toHaveTextContent(
      "Show the Encampments page and allow encampment ownership."
    );
  });

  it("PATCHes both toggles together, and the side rail gains Encampments from the answer", async () => {
    const user = setupUser();
    await openCampaignTab(user);
    const features = blockOf("Campaign features").parentElement!;
    expect(screen.queryByRole("link", { name: "Encampments" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: "Enable encampments" }));
    await user.click(within(features).getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("link", { name: "Encampments" })).toBeInTheDocument();
    expect(patches().map((request) => request.body)).toEqual([
      { enable_encampments: true, enable_locations: false },
    ]);
    expect(screen.queryByRole("link", { name: "Locations" })).not.toBeInTheDocument();
  });
});

describe("Delete campaign", () => {
  it("is headed Delete, opened by Close campaign, confirmed as CONFIRM CLOSURE and Erase campaign, then hard-deletes (CAMP-UX-06, pinned; flips in PR C)", async () => {
    const user = setupUser();
    fakeApi.on(`DELETE ${campaignApi()}`, undefined);
    await openCampaignTab(user);
    expect(screen.getByRole("heading", { name: "Delete campaign" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close campaign" }));

    const dialog = screen.getByRole("dialog", { name: "Confirm closure" });
    expect(dialog).toHaveTextContent("CONFIRM CLOSURE");
    // Nothing lists what goes with it: warbands, battles, trades, logs, house-rule items.
    expect(dialog).not.toHaveTextContent(/warband|battle|trade/i);
    const erase = within(dialog).getByRole("button", { name: "Erase campaign" });
    expect(erase).toBeDisabled();
    await user.type(within(dialog).getByPlaceholderText("Type delete"), "DELETE");
    expect(erase).toBeEnabled();
    await user.click(erase);

    expect(await screen.findByText("Campaigns page")).toBeInTheDocument();
    expect(fakeApi.calls().filter((call) => call.startsWith("DELETE"))).toEqual([
      `DELETE ${campaignApi()}`,
    ]);
  });
});

describe("Join code in Settings", () => {
  it("shows the join code in the header to the owner, with no way to regenerate it (CAMP-NEW-01, pinned; flips in PR C)", async () => {
    const user = setupUser();
    await openCampaignTab(user);

    expect(screen.getByRole("banner")).toHaveTextContent("Join CodeWYR123");
    expect(screen.queryByRole("button", { name: /new code|regenerate/i })).not.toBeInTheDocument();
  });

  it("shows the join code to a player too, on the personal settings they get", async () => {
    auth.user = { id: PLAYER.id, email: PLAYER.email };
    routeCampaignShell({ campaign: campaignFor("player"), viewer: PLAYER });

    renderCampaignRoute("/campaigns/1/settings");

    const header = await screen.findByRole("banner");
    expect(header).toHaveTextContent("Join CodeWYR123");
    expect(within(header).queryByRole("button", { name: "Campaign" })).not.toBeInTheDocument();
    expect(fakeApi.countOf(`GET ${campaignApi("members/")}`)).toBe(0);
  });
});
