/**
 * Settings → Campaign's owner cards as the app mounts them (layout, fake server): starting gold
 * and the warband caps, the campaign feature toggles, the delete card, and the join code.
 */
import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { createTestQueryClient } from "@/test/query-test-utils";
import {
  ADMIN,
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

import type { CampaignSummary } from "../types/campaign-types";

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
const JOIN_CODE = `POST ${campaignApi("join-code/")}`;

const patches = () => fakeApi.requests().filter((request) => request.method === "PATCH");

/** The block under a card's label (label, inputs and its Save). */
const blockOf = (label: string) => screen.getByText(label).parentElement!;

/** Opens Settings and its Campaign tab as the owner, and waits for the owner's cards. */
async function openCampaignTab(
  user: ReturnType<typeof setupUser>,
  queryClient = createTestQueryClient()
) {
  renderCampaignRoute("/campaigns/1/settings", { queryClient });
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
  fakeApi.on(PATCH_CAMPAIGN, (body: unknown) => {
    // The server keeps the change: a later read of the campaign has it, with its capabilities.
    fakeApi.on(`GET ${campaignApi()}`, campaignSummary(body as Partial<CampaignSummary>));
    return patchedCampaign(campaign, body);
  });
  fakeApi.on(`GET ${campaignApi("members/")}`, campaignMembers());
  fakeApi.on(`GET ${campaignApi("active-battles/")}`, []);
  fakeApi.on("GET /restrictions/?type=Setting", []);
});

describe("Starting gold and warband caps", () => {
  it("asks whether existing warbands get the difference, unticked after the start; ticked, the PATCH says so and your sheet and treasury are read again (BUG-78, decision 6)", async () => {
    const user = setupUser();
    const queryClient = createTestQueryClient();
    const treasury = queryKeys.campaign.warbandTreasury(1, OWNER.warband!.id);
    queryClient.setQueryData(treasury, { pages: [], pageParams: [] });
    await openCampaignTab(user, queryClient);
    const gold = blockOf("Starting gold");
    const input = within(gold).getByRole("spinbutton");
    expect(input).toHaveValue(500);
    const sheetReads = fakeApi.countOf(MY_SHEET);

    await user.clear(input);
    await user.type(input, "600");
    await user.click(within(gold).getByRole("button", { name: "Save" }));

    const dialog = screen.getByRole("dialog", { name: "Change starting gold" });
    expect(dialog).toHaveTextContent("Change the starting gold from 500 to 600 gc?");
    const adjust = within(dialog).getByRole("checkbox", {
      name: "Adjust existing warbands by +100 gc",
    });
    expect(adjust).not.toBeChecked();
    expect(dialog).toHaveTextContent("Existing warbands keep their gold");
    expect(patches()).toHaveLength(0);
    await user.click(adjust);
    expect(dialog).toHaveTextContent("Each warband gets an Adjustment of +100 gc in its treasury.");
    await user.click(within(dialog).getByRole("button", { name: "Save starting gold" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(patches().map((request) => request.body)).toEqual([
      { starting_gold: 600, adjust_existing_warbands: true },
    ]);
    // The answer becomes the campaign: the field keeps 600 and Save has nothing left to save.
    await waitFor(() => expect(within(gold).getByRole("button", { name: "Save" })).toBeDisabled());
    expect(input).toHaveValue(600);
    await waitFor(() => expect(fakeApi.countOf(MY_SHEET)).toBe(sheetReads + 1));
    expect(queryClient.getQueryState(treasury)?.isInvalidated).toBe(true);
  });

  it("ticks the adjustment before the start; unticked, only new warbands get the new amount and nothing is read again (decision 6)", async () => {
    const user = setupUser();
    const campaign = campaignSummary({ in_progress: false });
    routeCampaignShell({ campaign });
    fakeApi.on(PATCH_CAMPAIGN, (body: unknown) => patchedCampaign(campaign, body));
    await openCampaignTab(user);
    const gold = blockOf("Starting gold");
    const sheetReads = fakeApi.countOf(MY_SHEET);

    await user.clear(within(gold).getByRole("spinbutton"));
    await user.type(within(gold).getByRole("spinbutton"), "450");
    await user.click(within(gold).getByRole("button", { name: "Save" }));

    const dialog = screen.getByRole("dialog", { name: "Change starting gold" });
    const adjust = within(dialog).getByRole("checkbox", {
      name: "Adjust existing warbands by -50 gc",
    });
    expect(adjust).toBeChecked();
    await user.click(adjust);
    await user.click(within(dialog).getByRole("button", { name: "Save starting gold" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(patches().map((request) => request.body)).toEqual([
      { starting_gold: 450, adjust_existing_warbands: false },
    ]);
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

    expect(
      await within(limits).findByText("The server ran into a problem. Please try again.")
    ).toBeInTheDocument();
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

  it("reads the campaign again when a page is switched on, so its capability follows: the owner can add an encampment", async () => {
    const user = setupUser();
    fakeApi.on(`GET ${campaignApi("encampments/")}`, []);
    fakeApi.on(`GET ${campaignApi("players/?fields=basic")}`, []);
    await openCampaignTab(user);
    const features = blockOf("Campaign features").parentElement!;

    await user.click(screen.getByRole("checkbox", { name: "Enable encampments" }));
    await user.click(within(features).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(fakeApi.countOf(`GET ${campaignApi()}`)).toBe(2));
    await user.click(await screen.findByRole("link", { name: "Encampments" }));

    expect(await screen.findByRole("button", { name: "Add encampment" })).toBeInTheDocument();
  });
});

describe("Delete campaign", () => {
  it("is gone from a live campaign: the owner archives it instead, and deleting for good waits for the archive (CAMP-UX-06, CAMP-NEW-04, CAMP-TWEAK-04)", async () => {
    const user = setupUser();
    await openCampaignTab(user);

    expect(screen.getByRole("heading", { name: "Archive campaign" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Delete campaign" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Close campaign" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete for good" })).toBeNull();
  });
});

describe("Settings dialogs", () => {
  it("describe the campaign archive and warband delete confirms to screen readers (BUG-142)", async () => {
    const user = setupUser();
    await openCampaignTab(user);

    await user.click(screen.getByRole("button", { name: "Archive campaign" }));
    expect(screen.getByRole("dialog", { name: "Archive campaign" })).toHaveAccessibleDescription(
      /^Archive Shards of the Comet\?/
    );
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await user.click(within(screen.getByRole("banner")).getByRole("button", { name: "Personal" }));
    await user.click(await screen.findByRole("button", { name: "Delete warband" }));
    expect(screen.getByRole("dialog", { name: "Confirm deletion" })).toHaveAccessibleDescription(
      "This will permanently delete Iron Vultures and all its units."
    );
  });
});

describe("Join code in Settings", () => {
  it("lets the owner regenerate it after a confirm that says the old code stops working; the header shows the new code (decision 1, CAMP-NEW-01)", async () => {
    const user = setupUser();
    fakeApi.on(JOIN_CODE, () => patchedCampaign(campaignSummary(), { join_code: "NEW456" }));
    await openCampaignTab(user);
    const header = screen.getByRole("banner");
    expect(header).toHaveTextContent("Join CodeWYR123");

    await user.click(within(header).getByRole("button", { name: "New code" }));

    const dialog = screen.getByRole("dialog", { name: "Regenerate join code" });
    expect(dialog).toHaveTextContent("The old code, WYR123, stops working at once.");
    expect(dialog).toHaveAccessibleDescription(expect.stringContaining("stops working at once"));
    expect(fakeApi.countOf(JOIN_CODE)).toBe(0);
    await user.click(within(dialog).getByRole("button", { name: "Regenerate join code" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("banner")).toHaveTextContent("Join CodeNEW456");
    expect(fakeApi.calls().filter((call) => !call.startsWith("GET"))).toEqual([JOIN_CODE]);
    // The answer carries no permissions; the owner's cards stay.
    expect(screen.getByRole("heading", { name: "Campaign Systems" })).toBeInTheDocument();
  });

  it("lets an admin regenerate it too, and keeps a refusal in the dialog", async () => {
    const user = setupUser();
    auth.user = { id: ADMIN.id, email: ADMIN.email };
    routeCampaignShell({ campaign: campaignFor("admin"), viewer: ADMIN });
    fakeApi.fail(JOIN_CODE, new ApiError("Forbidden", 403, { detail: "Forbidden" }));
    renderCampaignRoute("/campaigns/1/settings");
    const header = await screen.findByRole("banner");

    await user.click(within(header).getByRole("button", { name: "New code" }));
    const dialog = screen.getByRole("dialog", { name: "Regenerate join code" });
    await user.click(within(dialog).getByRole("button", { name: "Regenerate join code" }));

    expect(await within(dialog).findByText("Forbidden")).toBeVisible();
    expect(screen.getByRole("banner", { hidden: true })).toHaveTextContent("Join CodeWYR123");
  });

  it("shows the join code to a player too, on the personal settings they get, with no way to regenerate it", async () => {
    auth.user = { id: PLAYER.id, email: PLAYER.email };
    routeCampaignShell({ campaign: campaignFor("player"), viewer: PLAYER });

    renderCampaignRoute("/campaigns/1/settings");

    const header = await screen.findByRole("banner");
    expect(header).toHaveTextContent("Join CodeWYR123");
    expect(within(header).queryByRole("button", { name: "New code" })).not.toBeInTheDocument();
    expect(within(header).queryByRole("button", { name: "Campaign" })).not.toBeInTheDocument();
    expect(fakeApi.countOf(`GET ${campaignApi("members/")}`)).toBe(0);
  });
});
