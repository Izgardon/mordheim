/**
 * House Rules' Common Rules sheet as the app mounts it (layout, fake server): what it sends for
 * several rules at once, and what happens to the ones created when another fails.
 */
import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";
import { deferred } from "@/test/battle-fixtures";
import { CAMPAIGN_ID, campaignApi, routeCampaignShell } from "@/test/campaign-fixtures";
import { renderCampaignRoute } from "@/test/campaign-routes";
import { fakeApi } from "@/test/fake-api";
import { fakeRealtime } from "@/test/fake-realtime";
import { setupUser } from "@/test/user-event";

import type { HouseRule, HouseRulePayload } from "../types/rule-types";

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

const RULES = campaignApi("rules/");

let nextRuleId = 30;
const createdRule = (payload: HouseRulePayload): HouseRule => ({
  id: nextRuleId++,
  campaign_id: CAMPAIGN_ID,
  title: payload.title,
  description: payload.description,
  effect_key: payload.effect_key ?? null,
  created_at: "2026-10-19T10:00:00Z",
  updated_at: "2026-10-19T10:00:00Z",
});

const postedTitles = () =>
  fakeApi
    .requests()
    .filter((request) => request.method === "POST" && request.path === RULES)
    .map((request) => (request.body as HouseRulePayload).title);

/** Opens House Rules, then Add rule → Common Rules, and ticks the two rules with item effects. */
async function pickArmourAndShields(user: ReturnType<typeof setupUser>) {
  await user.click(screen.getByRole("button", { name: "Add rule" }));
  await user.click(screen.getByRole("button", { name: "Common Rules" }));
  const sheet = screen.getByRole("dialog", { name: "Common Rules" });
  await user.click(within(sheet).getByRole("checkbox", { name: /^Half Price Armour/ }));
  await user.click(within(sheet).getByRole("checkbox", { name: /^Improved Shields/ }));
  return sheet;
}

beforeEach(() => {
  fakeApi.reset();
  fakeRealtime.reset();
  routeCampaignShell();
  fakeApi.on(`GET ${RULES}`, []);
});

describe("Common Rules", () => {
  it("describes the sheet to screen readers (BUG-142)", async () => {
    const user = setupUser();
    renderCampaignRoute("/campaigns/1/house-rules");
    await screen.findByText("No house rules logged yet.");

    await user.click(screen.getByRole("button", { name: "Add rule" }));
    await user.click(screen.getByRole("button", { name: "Common Rules" }));

    expect(screen.getByRole("dialog", { name: "Common Rules" })).toHaveAccessibleDescription(
      "Choose from a small list of commonly used campaign house rules."
    );
  });

  it("posts every picked rule at once; when one fails, the rule the server did create stays off the list and a retry posts it again (BUG-52, CAMP-TEST-19, pinned; flips in PR A)", async () => {
    const user = setupUser();
    const answers = new Map<string, ReturnType<typeof deferred<HouseRule>>>();
    fakeApi.on(`POST ${RULES}`, (body: unknown) => {
      const answer = deferred<HouseRule>();
      answers.set((body as HouseRulePayload).title, answer);
      return answer.promise;
    });
    renderCampaignRoute("/campaigns/1/house-rules");
    expect(await screen.findByText("No house rules logged yet.")).toBeInTheDocument();

    const sheet = await pickArmourAndShields(user);
    await user.click(within(sheet).getByRole("button", { name: "Save" }));

    // Both are in flight together.
    expect(postedTitles()).toEqual(["Half Price Armour", "Improved Shields"]);
    expect(fakeApi.bodyOf(`POST ${RULES}`)).toMatchObject({ effect_key: "improved_shields" });
    answers.get("Half Price Armour")!.resolve(
      createdRule({
        title: "Half Price Armour",
        description: "",
        effect_key: "half_price_armour",
      })
    );
    answers.get("Improved Shields")!.reject(new ApiError("Request failed (500)", 500, null));

    expect(await within(sheet).findByText("Request failed (500)")).toBeInTheDocument();
    await user.click(within(sheet).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    // The server has Half Price Armour; the page doesn't show it.
    expect(screen.getByText("No house rules logged yet.")).toBeInTheDocument();

    fakeApi.on(`POST ${RULES}`, (body: unknown) => createdRule(body as HouseRulePayload));
    await user.click(screen.getByRole("button", { name: "Common Rules" }));
    const retry = screen.getByRole("dialog", { name: "Common Rules" });
    expect(within(retry).queryByText("Applied")).not.toBeInTheDocument();
    await user.click(within(retry).getByRole("checkbox", { name: /^Half Price Armour/ }));
    await user.click(within(retry).getByRole("checkbox", { name: /^Improved Shields/ }));
    await user.click(within(retry).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(postedTitles()).toEqual([
      "Half Price Armour",
      "Improved Shields",
      "Half Price Armour",
      "Improved Shields",
    ]);
    expect(screen.getAllByText("Half Price Armour")).toHaveLength(1);
  });
});
