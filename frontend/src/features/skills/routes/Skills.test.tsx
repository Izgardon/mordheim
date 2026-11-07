/**
 * The Skills page (William, 5 Nov 2026: "change the skills page to be grouped in their skill group
 * just like the spells page does with a list when expanded with full description"), on the real
 * routes over the fake API server: a row per skill group with who learns from it opens to its
 * skills, each with its rules and Edit skill; a search opens the groups holding a match; `?open=`
 * lands on a skill in its group, scrolled into view.
 */
import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RAIDER, storeSession } from "@/test/auth-fixtures";
import { cleanupApps, renderApp } from "@/test/app-routes";
import { CAMPAIGN_ID, campaignSummary } from "@/test/campaign-fixtures";
import { skill, skillGroup } from "@/test/catalogue-fixtures";
import { fakeApi } from "@/test/fake-api";
import { fakeRealtime } from "@/test/fake-realtime";
import { setupUser } from "@/test/user-event";

// The campaign's routes load on demand; importing them first lets each lazy() resolve at once.
import "@/features/campaigns/routes/CampaignLayout";
import "@/features/skills/routes/Skills";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/lib/realtime/client", async () => (await import("@/test/fake-realtime")).fakeClient);
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));

const PAGE = `/campaigns/${CAMPAIGN_ID}/skills`;
const strike = skill({ id: 1, name: "Strike to Injure", description: "Add +1 to injury rolls." });
const web = skill({ id: 2, name: "Web of Steel", description: "+1 to critical hits." });
const leap = skill({ id: 3, name: "Leap", description: "Leaps D6 inches." });
const tomb = skill({ id: 4, name: "Tomb Guardian", in_play: false }); // Khemri's, not ticked
const combat = skillGroup({ id: 10, name: "Combat", skill_ids: [1, 2, 4] });
const speed = skillGroup({ id: 11, name: "Speed", skill_ids: [3, 2] });
const brutes = skillGroup({
  id: 12,
  name: "Brutes",
  for_everyone: false,
  warbands: [{ warband_type_id: 5, warband_group_id: null, name: "Orcs", excluded: false }],
  large_only: true,
  learn_note: "Leader only",
  skill_ids: [],
});

/** A group's row: its name, then its cells. */
const groupRow = (name: string) =>
  screen.findByRole("button", { name: (label) => label.startsWith(name) });
const queryGroupRow = (name: string) =>
  screen.queryByRole("button", { name: (label) => label.startsWith(name) });
const param = (app: ReturnType<typeof renderApp>, name: string) =>
  new URLSearchParams(app.location().search).get(name);

let scrolledTo: string[] = [];

beforeEach(() => {
  localStorage.clear();
  fakeApi.reset();
  fakeRealtime.reset();
  storeSession(RAIDER);
  fakeApi.on("GET /auth/me/", RAIDER);
  fakeApi.on("GET /notifications/", []);
  fakeApi.on(`GET /campaigns/${CAMPAIGN_ID}/`, campaignSummary());
  fakeApi.on(`GET /skills/?campaign_id=${CAMPAIGN_ID}`, [strike, web, leap, tomb]);
  fakeApi.on(`GET /skill-groups/?campaign_id=${CAMPAIGN_ID}`, [combat, speed, brutes]);
  scrolledTo = [];
  vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(function (this: Element) {
    scrolledTo.push(this.id);
  });
});

afterEach(() => {
  cleanupApps();
  vi.restoreAllMocks();
});

describe("The Skills page", () => {
  it("is a row per skill group with who learns from it, opening to its skills' rules", async () => {
    const user = setupUser();
    const app = renderApp(PAGE);

    expect(await groupRow("Combat")).toHaveTextContent("Combat2For everyone");
    expect(await groupRow("Brutes")).toHaveTextContent(
      "Brutes0For Orcs · Large units only · Leader only"
    );
    expect(screen.getByText("3 groups, 3 skills")).toBeInTheDocument();
    expect(screen.queryByText("Tomb Guardian")).toBeNull();

    await user.click(await groupRow("Combat"));
    expect(await groupRow("Combat")).toHaveAttribute("aria-expanded", "true");
    expect(param(app, "group")).toBe("10");
    expect(screen.getByText("Add +1 to injury rolls.")).toBeInTheDocument();
    expect(screen.getByText("+1 to critical hits.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit skill Web of Steel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit skill group" })).toBeInTheDocument();
    // each skill's setting in the open row (William, 7 Nov 2026: "others should exist in the
    // expanded part"): the book's not graded yet are Mordheim's
    expect(screen.getByRole("heading", { name: "Web of Steel" }).parentElement).toHaveTextContent(
      "Web of SteelMordheim"
    );

    // a skill in several groups shows under each
    await user.click(await groupRow("Speed"));
    expect(await groupRow("Combat")).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Leaps D6 inches.")).toBeInTheDocument();
    expect(screen.getByText("+1 to critical hits.")).toBeInTheDocument();

    await user.click(await groupRow("Speed"));
    expect(screen.queryByText("Leaps D6 inches.")).toBeNull();
    expect(app.location().search).toBe("");
  });

  it("searches names, groups and rules, opening the groups that hold a match", async () => {
    const user = setupUser();
    renderApp(PAGE);
    await groupRow("Combat");
    const search = screen.getByRole("searchbox", { name: "Search skills" });

    await user.type(search, "critical");
    expect(await groupRow("Combat")).toHaveAttribute("aria-expanded", "true");
    expect(await groupRow("Speed")).toHaveAttribute("aria-expanded", "true");
    expect(await groupRow("Combat")).toHaveTextContent("Combat1 of 2");
    expect(queryGroupRow("Brutes")).toBeNull();
    expect(screen.getAllByText("+1 to critical hits.")).toHaveLength(2);
    expect(screen.queryByText("Add +1 to injury rolls.")).toBeNull();
    expect(screen.getByText("1 skill in 2 groups")).toBeInTheDocument();

    // a group the search opened closes on its row
    await user.click(await groupRow("Combat"));
    expect(await groupRow("Combat")).toHaveAttribute("aria-expanded", "false");
    expect(screen.getAllByText("+1 to critical hits.")).toHaveLength(1);

    await user.clear(search);
    await user.type(search, "speed");
    expect(await groupRow("Speed")).toHaveTextContent("Speed2");
    expect(queryGroupRow("Combat")).toBeNull();

    await user.type(search, " nothing");
    expect(screen.getByText("No skills match.")).toBeInTheDocument();
  });

  it("lands a link's ?open= on the skill in its first group, scrolled to", async () => {
    renderApp(`${PAGE}?open=${web.id}`);

    expect(await groupRow("Combat")).toHaveAttribute("aria-expanded", "true");
    expect(await groupRow("Speed")).toHaveAttribute("aria-expanded", "false");
    await waitFor(() => expect(scrolledTo).toEqual([`ref-${web.id}`]));
  });

  it("lands an edit on the saved skill in the group it was edited in", async () => {
    // a book skill's first edit makes the campaign's version of it, which its groups then hold
    const version = { ...web, id: 40, campaign_id: CAMPAIGN_ID, replaces: web.id };
    fakeApi.on(`PATCH /skills/${web.id}/`, () => {
      fakeApi.on(`GET /skills/?campaign_id=${CAMPAIGN_ID}`, [strike, version, leap]);
      fakeApi.on(`GET /skill-groups/?campaign_id=${CAMPAIGN_ID}`, [
        { ...combat, skill_ids: [1, 40] },
        { ...speed, skill_ids: [3, 40] },
      ]);
      return version;
    });
    const user = setupUser();
    const app = renderApp(`${PAGE}?group=${speed.id}`);

    await user.click(await screen.findByRole("button", { name: "Edit skill Web of Steel" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit Skill" });
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(param(app, "open")).toBe("40"));
    await waitFor(() => expect(scrolledTo).toEqual(["ref-40"]));
    expect(param(app, "group")).toBe(String(speed.id));
    expect(await groupRow("Speed")).toHaveAttribute("aria-expanded", "true");
  });
});
