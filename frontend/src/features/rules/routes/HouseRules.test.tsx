/**
 * House Rules' Common Rules sheet as the app mounts it (layout, fake server): what it sends for
 * several rules at once, what happens to the ones created when another fails, and the warning
 * when a rule skips the campaign's own versions of book items (`house_rule_skipped`).
 */
import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";
import { deferred } from "@/test/battle-fixtures";
import {
  CAMPAIGN_ID,
  COMMON_RULES,
  campaignApi,
  routeCampaignShell,
} from "@/test/campaign-fixtures";
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
  fakeApi.on(`GET ${campaignApi("rules/common/")}`, COMMON_RULES);
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

  it("posts every picked rule at once; when one fails, the one created joins the list, only the failure is reported, and a retry posts just that one (BUG-52, CAMP-TEST-19)", async () => {
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
    answers.get("Half Price Armour")!.resolve(
      createdRule({
        title: "Half Price Armour",
        description: "",
        effect_key: "half_price_armour",
      })
    );
    answers.get("Improved Shields")!.reject(new ApiError("Request failed (500)", 500, null));

    expect(
      await within(sheet).findByText(
        "Couldn't add Improved Shields: The server ran into a problem. Please try again."
      )
    ).toBeInTheDocument();
    // The created rule is listed and marked Applied; only the failure stays picked.
    expect(screen.queryByText("No house rules logged yet.")).not.toBeInTheDocument();
    expect(screen.getAllByText("Half Price Armour")).toHaveLength(2); // the list, and the sheet
    expect(within(sheet).getByRole("checkbox", { name: /^Half Price Armour/ })).toBeDisabled();
    expect(within(sheet).getByText("Applied")).toBeInTheDocument();
    expect(within(sheet).getByRole("checkbox", { name: /^Improved Shields/ })).toBeChecked();

    fakeApi.on(`POST ${RULES}`, (body: unknown) => createdRule(body as HouseRulePayload));
    await user.click(within(sheet).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(postedTitles()).toEqual(["Half Price Armour", "Improved Shields", "Improved Shields"]);
    expect(screen.getAllByText("Half Price Armour")).toHaveLength(1);
    expect(screen.getAllByText("Improved Shields")).toHaveLength(1);
    // Everything applied: the new-rule form closes too.
    expect(screen.getByRole("button", { name: "Add rule" })).toBeInTheDocument();
  });

  it("shows a house_rule_skipped warning when a rule leaves the campaign's own versions alone, and lists the rule without it (PR C's Calls)", async () => {
    const user = setupUser();
    const message =
      "The campaign's own versions of Heavy Armour were left alone; revert them for the rule to change them.";
    fakeApi.on(`POST ${RULES}`, (body: unknown) => ({
      ...createdRule(body as HouseRulePayload),
      warnings: [
        {
          code: "house_rule_skipped",
          message,
          items: [{ id: 41, name: "Heavy Armour", replaces: 7 }],
        },
      ],
    }));
    const { queryClient } = renderCampaignRoute("/campaigns/1/house-rules");
    expect(await screen.findByText("No house rules logged yet.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add rule" }));
    await user.click(screen.getByRole("button", { name: "Common Rules" }));
    const sheet = screen.getByRole("dialog", { name: "Common Rules" });
    await user.click(within(sheet).getByRole("checkbox", { name: /^Half Price Armour/ }));
    await user.click(within(sheet).getByRole("button", { name: "Save" }));

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.getByText("Half Price Armour")).toBeInTheDocument();
    const cached = queryClient.getQueryData<HouseRule[]>(["campaign", 1, "rules"]) ?? [];
    expect(cached).toHaveLength(1);
    expect(cached[0]).not.toHaveProperty("warnings");
  });

  it("shows the warning an edit of a rule answers with too", async () => {
    const user = setupUser();
    const rule = createdRule({
      title: "Half Price Armour",
      description: "Armour costs half.",
      effect_key: "half_price_armour",
    });
    const message =
      "The campaign's own versions of Shield were left alone; revert them for the rule to change them.";
    fakeApi.on(`GET ${RULES}`, [rule]);
    fakeApi.on(`PATCH ${RULES}${rule.id}/`, (body: unknown) => ({
      ...rule,
      ...(body as object),
      warnings: [{ code: "house_rule_skipped", message, items: [] }],
    }));
    renderCampaignRoute("/campaigns/1/house-rules");
    expect(await screen.findByText("Half Price Armour")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(fakeApi.bodyOf(`PATCH ${RULES}${rule.id}/`)).toMatchObject({
      effect_key: "half_price_armour",
    });
  });

  it("lists a rule the server already had (answered with the existing rule) once", async () => {
    const user = setupUser();
    const existing = createdRule({
      title: "Half Price Armour",
      description: "",
      effect_key: "half_price_armour",
    });
    fakeApi.on(`GET ${RULES}`, [{ ...existing, title: "Cheap armour" }]);
    fakeApi.on(`POST ${RULES}`, () => existing);
    renderCampaignRoute("/campaigns/1/house-rules");
    expect(await screen.findByText("Cheap armour")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add rule" }));
    await user.click(screen.getByRole("button", { name: "Common Rules" }));
    const sheet = screen.getByRole("dialog", { name: "Common Rules" });
    await user.click(within(sheet).getByRole("checkbox", { name: /^Half Price Armour/ }));
    await user.click(within(sheet).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getAllByText("Half Price Armour")).toHaveLength(1);
    expect(screen.queryByText("Cheap armour")).not.toBeInTheDocument();
  });
});
