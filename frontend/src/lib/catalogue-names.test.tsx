/**
 * A taken name (400 `name_taken`, decisions 1 and 2, CAT-TWEAK-02) on the catalogue pages and in
 * the warband pages' dialogs: the form stays open, the message is the name field's description,
 * and every entry the name collided with is listed, with "Edit this instead" (on the pages, which
 * can open the edit form) or Restore (an archived match, or a book entry removed for the campaign).
 */
import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CreateRaceDialog from "@/features/races/components/CreateRaceDialog";
import { routeCampaignShell } from "@/test/campaign-fixtures";
import { LIST, SKILLS, routeCatalogue, skill, sword } from "@/test/catalogue-fixtures";
import { renderCatalogueRoute } from "@/test/catalogue-routes";
import { fakeApi } from "@/test/fake-api";
import { fakeRealtime } from "@/test/fake-realtime";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { nameMatch, nameTaken } from "@/test/refusals";
import { chooseOption } from "@/test/select-option";
import { setupUser } from "@/test/user-event";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/lib/realtime/client", async () => (await import("@/test/fake-realtime")).fakeClient);
vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: 7, email: "aldric@example.com" }, signOut: () => undefined }),
}));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));
vi.mock("@/features/realtime/components/CampaignDiceRollerMenu", () => ({ default: () => null }));

const matchesList = () => screen.getByRole("list", { name: "Entries with this name" });

/** The campaign's own "Strike to Injure" in Speed, archived since. */
const archivedStrike = skill({
  id: 951,
  campaign_id: 1,
  name: "Strike to Injure",
  type: "Speed",
  description: "Quick strikes.",
});
const taken = nameTaken("Strike to Injure", [
  nameMatch({ id: 205, name: "Strike to Injure", type: "Combat" }),
  nameMatch({
    id: 951,
    name: "Strike to Injure",
    type: "Speed",
    source: "campaign",
    archived: true,
  }),
]);

beforeEach(() => {
  fakeApi.reset();
  fakeRealtime.reset();
  routeCampaignShell();
  routeCatalogue();
});

/** Skills → Add skill, a new "Strike to Injure" in Speed, Save. */
async function addTakenSkill(user: ReturnType<typeof setupUser>) {
  fakeApi.fail("POST /skills/", taken.error);
  renderCatalogueRoute("/campaigns/1/skills");
  await screen.findByRole("row", { name: /^Quick Hands/ });
  await user.click(screen.getByRole("button", { name: "Add skill" }));
  await user.type(screen.getByPlaceholderText("Quick Hands"), "Strike to Injure");
  await user.click(screen.getByPlaceholderText("Search or add a list"));
  await user.click(screen.getByRole("button", { name: "Speed" }));
  await user.type(screen.getByPlaceholderText("Describe the skill."), "Quick strikes.");
  await user.click(screen.getByRole("button", { name: "Save" }));
  await screen.findByRole("list", { name: "Entries with this name" });
}

describe("Skills: a taken name", () => {
  it("keeps the form open and lists every match, with Edit this instead on a live one and Restore on an archived one", async () => {
    const user = setupUser();
    await addTakenSkill(user);

    const name = screen.getByPlaceholderText("Quick Hands");
    expect(name).toHaveAccessibleDescription(expect.stringContaining(taken.detail));
    const [book, archived] = within(matchesList()).getAllByRole("listitem");
    expect(book).toHaveTextContent("Strike to Injure (Combat) · book");
    expect(
      within(book).getByRole("button", { name: "Edit Strike to Injure (Combat) instead" })
    ).toBeVisible();
    expect(archived).toHaveTextContent("Strike to Injure (Speed) · this campaign · archived");
    expect(
      within(archived).getByRole("button", { name: "Restore Strike to Injure (Speed)" })
    ).toBeVisible();
    expect(within(archived).queryByRole("button", { name: /instead/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Save" })).toBeVisible();
  });

  it("opens the edit form on the book skill from Edit this instead", async () => {
    const user = setupUser();
    await addTakenSkill(user);

    await user.click(
      screen.getByRole("button", { name: "Edit Strike to Injure (Combat) instead" })
    );

    expect(screen.getByRole("button", { name: "Save changes" })).toBeVisible();
    expect(screen.getByDisplayValue("Add +1 to injury rolls.")).toBeVisible();
    expect(screen.queryByRole("list", { name: "Entries with this name" })).toBeNull();
  });

  it("restores an archived match into the list, after which it can be edited instead", async () => {
    const user = setupUser();
    fakeApi.on("POST /skills/951/restore/", () => {
      // The server lists it again from now on.
      fakeApi.on(LIST.skills, [archivedStrike, ...SKILLS]);
      return archivedStrike;
    });
    await addTakenSkill(user);

    await user.click(screen.getByRole("button", { name: "Restore Strike to Injure (Speed)" }));

    const edit = await screen.findByRole("button", {
      name: "Edit Strike to Injure (Speed) instead",
    });
    expect(fakeApi.requests().filter((request) => request.path.includes("restore"))).toEqual([
      { method: "POST", path: "/skills/951/restore/" },
    ]);
    expect(screen.getAllByRole("row", { name: /^Strike to Injure/ })).toHaveLength(2);

    await user.click(edit);
    expect(screen.getByDisplayValue("Quick strikes.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeVisible();
  });
});

describe("Wargear: a taken name", () => {
  it("opens the edit form on the book item the name belongs to", async () => {
    const user = setupUser();
    fakeApi.fail(
      "POST /items/",
      nameTaken("Sword", [nameMatch({ kind: "items", id: 2, name: "Sword", type: "Weapon" })]).error
    );
    renderCatalogueRoute("/campaigns/1/items");
    await screen.findByRole("button", { name: /^Rusty Cleaver/ });

    await user.click(screen.getByRole("button", { name: "Add item" }));
    await user.type(screen.getByPlaceholderText("Gutterblade"), "sword");
    await chooseOption(user, screen.getByText("Select a type").closest("button")!, "Weapon");
    await user.type(screen.getByPlaceholderText("25"), "12");
    await user.type(screen.getByPlaceholderText("2"), "2");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.click(await screen.findByRole("button", { name: "Edit Sword (Weapon) instead" }));

    expect(screen.getByRole("button", { name: "Save changes" })).toBeVisible();
    expect(screen.getByDisplayValue("Sword")).toBeVisible();
    expect(screen.getByDisplayValue(String(sword.availabilities[0].cost))).toBeVisible();
  });
});

describe("a warband page's dialog: a taken name", () => {
  it("lists the matches with no Edit (the dialog can't open one), and restores a book race removed for the campaign", async () => {
    const user = setupUser();
    fakeApi.fail(
      "POST /races/",
      nameTaken("Ogre", [nameMatch({ kind: "races", id: 12, name: "Ogre", archived: true })]).error
    );
    fakeApi.on("POST /races/12/restore/", { id: 12, campaign_id: null, name: "Ogre" });
    renderWithQueryClient(
      <CreateRaceDialog
        campaignId={1}
        open
        onOpenChange={vi.fn()}
        onCreated={vi.fn()}
        trigger={null}
      />
    );

    await user.type(screen.getByPlaceholderText("Human"), "Ogre");
    await user.click(screen.getByRole("button", { name: "Add race" }));
    const [match] = within(
      await screen.findByRole("list", { name: "Entries with this name" })
    ).getAllByRole("listitem");
    expect(match).toHaveTextContent("Ogre · book · archived");
    await user.click(within(match).getByRole("button", { name: "Restore Ogre" }));

    await waitFor(() => expect(match).not.toHaveTextContent("archived"));
    expect(fakeApi.bodyOf("POST /races/12/restore/")).toEqual({ campaign_id: 1 });
    expect(within(match).queryByRole("button")).toBeNull();
  });
});
