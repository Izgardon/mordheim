/**
 * The Campaign rules page (William, 7 Nov 2026: "campaign wide rules that are not house rules ...
 * admin only"), on the real routes over the fake API server: every member reads the rules in
 * their order, each row opening to its text; the owner and admins add, edit, move and delete them.
 */
import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RAIDER, storeSession } from "@/test/auth-fixtures";
import { cleanupApps, renderApp } from "@/test/app-routes";
import { CAMPAIGN_ID, campaignFor } from "@/test/campaign-fixtures";
import { fakeApi } from "@/test/fake-api";
import { fakeRealtime } from "@/test/fake-realtime";
import { setupUser } from "@/test/user-event";

import type { CampaignRule } from "../types/rule-types";

// The campaign's routes load on demand; importing them first lets each lazy() resolve at once.
import "@/features/campaigns/routes/CampaignLayout";
import "@/features/rules/routes/CampaignRules";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/lib/realtime/client", async () => (await import("@/test/fake-realtime")).fakeClient);
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));

const PAGE = `/campaigns/${CAMPAIGN_ID}/campaign-rules`;
const RULES = `/campaigns/${CAMPAIGN_ID}/campaign-rules/`;
const rule = (id: number, title: string, body: string, order: number): CampaignRule => ({
  id,
  campaign_id: CAMPAIGN_ID,
  title,
  body,
  order,
});
const comet = rule(3, "The Comet's Fall", "Each night a shard falls on the city.", 0);
const curfew = rule(4, "Curfew", "No warband leaves after the bell.", 1);

/** The rows' titles, in the list's order. */
const rowNames = () =>
  screen
    .getAllByRole("button", { name: /^(Curfew|The Comet's Fall)$/ })
    .map((row) => row.textContent);

beforeEach(() => {
  localStorage.clear();
  fakeApi.reset();
  fakeRealtime.reset();
  storeSession(RAIDER);
  fakeApi.on("GET /auth/me/", RAIDER);
  fakeApi.on("GET /notifications/", []);
  fakeApi.on(`GET ${RULES}`, [comet, curfew]);
  vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanupApps();
  vi.restoreAllMocks();
});

describe("The Campaign rules page", () => {
  it("shows a player the rules in their order, each opening to its text, with nothing to change", async () => {
    fakeApi.on(`GET /campaigns/${CAMPAIGN_ID}/`, campaignFor("player"));
    const user = setupUser();
    renderApp(PAGE);

    await user.click(await screen.findByRole("button", { name: "Curfew" }));

    expect(screen.getByText(curfew.body)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: comet.title })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
    expect(screen.queryByRole("button", { name: "Add campaign rule" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit campaign rule" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Move up" })).toBeNull();
  });

  it("lets an admin add a rule, which lands at the end, open", async () => {
    fakeApi.on(`GET /campaigns/${CAMPAIGN_ID}/`, campaignFor("admin"));
    fakeApi.on(`POST ${RULES}`, (body: { title: string; body: string }) =>
      rule(5, body.title, body.body, 2)
    );
    const user = setupUser();
    renderApp(PAGE);

    await user.click(await screen.findByRole("button", { name: "Add campaign rule" }));
    const form = screen.getByRole("form", { name: "Add a campaign rule" });
    await user.type(within(form).getByLabelText("Title"), " Black Market ");
    await user.type(within(form).getByLabelText("Rule"), "Rare items cost double.");
    await user.click(within(form).getByRole("button", { name: "Add rule" }));

    expect(await screen.findByText("Rare items cost double.")).toBeInTheDocument();
    expect(fakeApi.bodyOf(`POST ${RULES}`)).toEqual({
      title: "Black Market",
      body: "Rare items cost double.",
    });
    expect(screen.queryByRole("form", { name: "Add a campaign rule" })).toBeNull();
  });

  it("lets an admin move a rule and edit it", async () => {
    fakeApi.on(`GET /campaigns/${CAMPAIGN_ID}/`, campaignFor("admin"));
    fakeApi.on(`PUT ${RULES}order/`, () => [
      { ...curfew, order: 0 },
      { ...comet, order: 1 },
    ]);
    fakeApi.on(`PATCH ${RULES}4/`, (body: { title: string; body: string }) => ({
      ...curfew,
      ...body,
      order: 0,
    }));
    const user = setupUser();
    renderApp(PAGE);

    await user.click(await screen.findByRole("button", { name: "Curfew" }));
    expect(screen.getByRole("button", { name: "Move down" })).toBeDisabled();
    expect(rowNames()).toEqual([comet.title, curfew.title]);
    await user.click(screen.getByRole("button", { name: "Move up" }));

    await waitFor(() => expect(rowNames()).toEqual([curfew.title, comet.title]));
    expect(fakeApi.bodyOf(`PUT ${RULES}order/`)).toEqual({ ids: [4, 3] });

    await user.click(screen.getByRole("button", { name: "Edit campaign rule" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit the campaign rule" });
    await user.clear(within(dialog).getByLabelText("Title"));
    await user.type(within(dialog).getByLabelText("Title"), "Curfew Bell");
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    expect(await screen.findByRole("button", { name: "Curfew Bell" })).toBeInTheDocument();
    expect(fakeApi.bodyOf(`PATCH ${RULES}4/`)).toEqual({
      title: "Curfew Bell",
      body: curfew.body,
    });
  });

  it("is under the Rules eyebrow, and hides its empty line while the first rule is added", async () => {
    fakeApi.on(`GET /campaigns/${CAMPAIGN_ID}/`, campaignFor("admin"));
    fakeApi.on(`GET ${RULES}`, []);
    const user = setupUser();
    renderApp(PAGE);

    const heading = await screen.findByRole("heading", { level: 1, name: "Campaign rules" });
    expect(heading.previousElementSibling).toHaveTextContent(/^Rules$/);
    expect(await screen.findByText("No campaign rules yet.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add campaign rule" }));

    expect(screen.getByRole("form", { name: "Add a campaign rule" })).toBeInTheDocument();
    expect(screen.queryByText("No campaign rules yet.")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("No campaign rules yet.")).toBeInTheDocument();
  });
});
