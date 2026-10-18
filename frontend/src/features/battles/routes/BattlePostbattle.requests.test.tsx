/**
 * What the postbattle page sends: the back chevron, draft saves, the kill floor, the finalise
 * summary and the finds picker, against a fake server that stores the draft as `postbattle/` does.
 */
import { act, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BattlePostbattleState, BattleState } from "@/features/battles/types/battle-types";
import {
  ME,
  battleEvent,
  battlePath,
  battleRosters,
  battleState,
  deferred,
  statePath,
} from "@/test/battle-fixtures";
import { renderBattleRoute } from "@/test/battle-routes";
import { fakeApi } from "@/test/fake-api";
import { setupUser } from "@/test/user-event";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/lib/realtime/client", async () => (await import("@/test/fake-realtime")).fakeClient);
vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: 7, email: "owner@example.com" } }),
}));
const media = vi.hoisted(() => ({ mobile: false }));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => media.mobile }));
vi.mock("@/features/realtime/components/CampaignDiceRollerMenu", () => ({ default: () => null }));

const DRAFT_ROUTE = `POST ${battlePath("postbattle/")}`;
const RESOURCES = [{ id: 9, warband_id: ME.warband.id, name: "Treasure", amount: 0 }];

const killBy = (id: number, killerKey: string) =>
  battleEvent(id, "unit_kill_recorded", ME.id, {
    killer: { warband_id: ME.warband.id, unit_key: killerKey },
    earned_xp: true,
  });

/** The server's copy of the battle: you won, Captain Wolf took two out, Rolf was taken out. */
let server: BattleState;
const answer = () => structuredClone(server);
const storeDraft = (body: unknown) => {
  const mine = server.participants.find((entry) => entry.user.id === ME.id)!;
  mine.postbattle_json = (body as { postbattle_json: BattlePostbattleState }).postbattle_json;
  return answer();
};

function routeServer() {
  server = battleState({
    status: "postbattle",
    winner_warband_ids_json: [ME.warband.id],
    me: {
      unit_information_json: {
        "hero:1": { kill_count: 2, stats_override: { weapon_skill: 5 } },
        "hero:3": { out_of_action: true },
      },
    },
    events: [
      battleEvent(3, "item_used", ME.id, {
        unit_key: "hero:1",
        item_id: 40,
        item_name: "Healing Draught",
      }),
      killBy(4, "hero:1"),
      killBy(5, "hero:1"),
    ],
  });
  fakeApi.on(`GET ${statePath("postbattle")}`, () => answer());
  fakeApi.on(`GET ${battlePath("rosters/")}`, battleRosters());
  fakeApi.on(`GET /warbands/${ME.warband.id}/resources/`, RESOURCES);
  fakeApi.on(DRAFT_ROUTE, storeDraft);
}

async function renderPostbattle() {
  const view = renderBattleRoute("postbattle");
  expect(await screen.findByText("Captain Wolf")).toBeInTheDocument();
  fakeApi.clearRequests();
  return view;
}

/** A unit's row in the Roster section (its name also shows under Upkeep for hired swords). */
const row = (unitName: string) =>
  screen.getAllByText(unitName)[0].closest(".battle-card") as HTMLElement;

const stepper = (unitName: string, label: "XP" | "Kills") =>
  within(row(unitName)).getByRole("spinbutton", { name: new RegExp(label) });

async function commit(user: ReturnType<typeof setupUser>, input: HTMLElement, value: string) {
  await user.clear(input);
  await user.type(input, value);
  // The stepper commits on blur; the save it starts settles inside act.
  await act(async () => input.blur());
}

const draftBodies = () =>
  fakeApi
    .requests()
    .filter((request) => `${request.method} ${request.path}` === DRAFT_ROUTE)
    .map((request) => (request.body as { postbattle_json: BattlePostbattleState }).postbattle_json);

const pause = (ms: number) => act(() => new Promise((resolve) => setTimeout(resolve, ms)));

describe("BattlePostbattle requests", () => {
  beforeEach(() => {
    fakeApi.reset();
    media.mobile = false;
    routeServer();
  });

  it("makes the phone's back chevron go to the overview and skip nothing (BUG-48, BATL-TEST-20)", async () => {
    media.mobile = true;
    const user = setupUser();
    await renderPostbattle();
    // The bottom bar offers only Finalise; nothing next to it leaves the postbattle.
    expect(screen.queryByRole("button", { name: /leave|skip/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(await screen.findByText("Campaign overview")).toBeInTheDocument();
    expect(screen.getByLabelText("Current path")).toHaveTextContent(/^\/campaigns\/1$/);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(fakeApi.requests()).toEqual([]);
  });

  it("skips postbattle only from More actions, after a confirm listing what won't be applied (BUG-48)", async () => {
    media.mobile = true;
    const user = setupUser();
    fakeApi.on(`POST ${battlePath("confirm/")}`, () =>
      battleState({ status: "postbattle", me: { status: "confirmed_postbattle" } })
    );
    await renderPostbattle();

    await user.click(screen.getByRole("button", { name: "More actions" }));
    const menu = screen.getByRole("dialog", { name: "More actions" });
    const skip = within(menu).getByRole("button", { name: "Skip postbattle" });
    expect(skip).toHaveClass("btn-destructive");
    await user.click(skip);

    const dialog = screen.getByRole("dialog", { name: "Skip postbattle" });
    expect(dialog).toHaveAccessibleDescription(
      "Iron Vultures leaves this battle without its postbattle. You can't come back to it, and nothing from this page will be applied."
    );
    expect(
      within(dialog)
        .getAllByRole("listitem")
        .map((item) => item.textContent)
    ).toEqual([
      "XP: Captain Wolf +3, Rolf +1, Youngblood A +1, Ogre Bodyguard +1",
      "Kills: Captain Wolf 2 kills",
      "Upkeep: 15 gc",
    ]);
    expect(fakeApi.requests()).toEqual([]);

    await user.click(within(dialog).getByRole("button", { name: "Skip postbattle" }));

    expect(await screen.findByLabelText("Current path")).toHaveTextContent("/campaigns/1/warband");
    expect(fakeApi.requests()).toEqual([{ method: "POST", path: battlePath("confirm/") }]);
  });

  it("keeps Skip postbattle out of the desktop action panel, beside Finalise (BUG-48)", async () => {
    await renderPostbattle();

    expect(screen.queryByRole("button", { name: /leave/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Skip postbattle" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Finalise Postbattle" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "More actions" })).toBeInTheDocument();
  });

  it("sends each draft edit at once, unqueued, and lets an older answer undo a newer edit (BUG-44, pinned; flips in PR A)", async () => {
    const user = setupUser();
    await renderPostbattle();
    const held: Array<{ body: unknown; release: () => void }> = [];
    fakeApi.on(DRAFT_ROUTE, (body: unknown) => {
      const stored = storeDraft(body);
      const answerLater = deferred<BattleState>();
      held.push({ body, release: () => answerLater.resolve(stored) });
      return answerLater.promise;
    });

    await commit(user, stepper("Captain Wolf", "XP"), "5");
    await user.click(within(row("Ogre Bodyguard")).getByRole("checkbox", { name: "Dead" }));

    // Both saves are out before either answers.
    expect(draftBodies().map((draft) => draft.unit_results["hired_sword:4"].dead)).toEqual([
      false,
      true,
    ]);
    await act(async () => held[1].release());
    expect(within(row("Ogre Bodyguard")).getByRole("checkbox", { name: "Dead" })).toBeChecked();

    await act(async () => held[0].release());
    await waitFor(() =>
      expect(
        within(row("Ogre Bodyguard")).getByRole("checkbox", { name: "Dead" })
      ).not.toBeChecked()
    );
  });

  it("saves drafts with the exploration emptied, so a reload loses the roll and allows another (BUG-71, pinned; flips in PR C)", async () => {
    const user = setupUser();
    const { unmount } = await renderPostbattle();

    await user.click(screen.getByRole("button", { name: "Roll" }));
    expect(
      screen.getAllByPlaceholderText("-").map((die) => (die as HTMLInputElement).value)
    ).toEqual(["3", "4"]);
    expect(screen.getByRole("button", { name: "Roll" })).toBeDisabled();

    await commit(user, stepper("Captain Wolf", "XP"), "4");
    await waitFor(() => expect(draftBodies()).toHaveLength(1));
    expect(draftBodies()[0].exploration).toEqual({ dice_values: [], resource_id: null });

    unmount();
    await renderPostbattle();

    expect(
      screen.getAllByPlaceholderText("-").map((die) => (die as HTMLInputElement).value)
    ).toEqual(["", ""]);
    expect(screen.getByRole("button", { name: "Roll" })).toBeEnabled();
    expect(stepper("Captain Wolf", "XP")).toHaveValue(4);
  });

  it("floors kills at the live count: lower values snap back and send nothing (BUG-11, pinned; flips in PR C)", async () => {
    const user = setupUser();
    await renderPostbattle();
    expect(stepper("Captain Wolf", "Kills")).toHaveValue(2);

    await commit(user, stepper("Captain Wolf", "Kills"), "0");
    expect(stepper("Captain Wolf", "Kills")).toHaveValue(2);
    expect(fakeApi.calls()).toEqual([]);

    await commit(user, stepper("Captain Wolf", "Kills"), "3");
    await waitFor(() => expect(draftBodies()).toHaveLength(1));
    expect(draftBodies()[0].unit_results["hero:1"].kill_count).toBe(3);
  });

  it("sums up exploration, finds, deaths, XP and upkeep only, then finalises with the rolled dice (BATL-UX-04, BATL-TEST-27 baseline, pinned; flips in PR C)", async () => {
    const user = setupUser();
    await renderPostbattle();
    fakeApi.on(`POST ${battlePath("finalize-postbattle/")}`, () =>
      battleState({ status: "postbattle", me: { status: "confirmed_postbattle" } })
    );
    await user.click(screen.getByRole("button", { name: "Roll" }));

    await user.click(screen.getByRole("button", { name: "Finalise Postbattle" }));
    const dialog = screen.getByRole("dialog", { name: "Finalise Postbattle" });

    expect(
      Array.from(dialog.querySelectorAll(".battle-section-title"), (title) => title.textContent)
    ).toEqual(["Exploration", "Finds", "Deaths", "XP Awards", "Upkeep"]);
    expect(dialog).toHaveTextContent("You will gain 2 Treasure.");
    expect(dialog).toHaveTextContent("No finds are currently set.");
    expect(dialog).toHaveTextContent("No units are marked dead.");
    expect(dialog).toHaveTextContent("Captain Wolf will gain 3 XP.");
    expect(dialog).toHaveTextContent("You will be paying 15gc in upkeep.");
    // Captain Wolf's WS 5, his two kills and the Healing Draught go unmentioned; nor do level-ups.
    expect(dialog).not.toHaveTextContent(/kill|weapon|WS|level|Healing Draught|injur/i);

    await user.click(within(dialog).getByRole("button", { name: "Confirm" }));

    expect(await screen.findByLabelText("Current path")).toHaveTextContent("/campaigns/1/warband");
    const finalised = fakeApi.bodyOf(`POST ${battlePath("finalize-postbattle/")}`) as {
      postbattle_json: BattlePostbattleState;
    };
    expect(finalised.postbattle_json.exploration).toEqual({
      dice_values: [3, 4],
      resource_id: 9,
      amount_override: undefined,
    });
    expect(finalised.postbattle_json.unit_results["hero:1"]).toMatchObject({
      kill_count: 2,
      xp_earned: 3,
      special_ids: [],
    });
  });

  it("requests the item catalogue when the finds picker opens and again after every keystroke (PERF-40, pinned; flips in PR A)", async () => {
    const user = setupUser();
    await renderPostbattle();
    const rope = { id: 77, name: "Rope & Hook", type: "Miscellaneous", availabilities: [] };
    for (const search of ["", "search=R&", "search=Ro&", "search=Rop&"]) {
      fakeApi.on(`GET /items/?${search}campaign_id=1`, [rope]);
    }
    const picker = screen.getByPlaceholderText("Search and add an item");

    await user.click(picker);
    await pause(200);
    for (const letter of ["R", "o", "p"]) {
      await user.type(picker, letter);
      await pause(200);
    }

    expect(fakeApi.calls()).toEqual([
      "GET /items/?campaign_id=1",
      "GET /items/?search=R&campaign_id=1",
      "GET /items/?search=Ro&campaign_id=1",
      "GET /items/?search=Rop&campaign_id=1",
    ]);
    expect(screen.getByRole("button", { name: /Rope & Hook/ })).toBeInTheDocument();
  });
});
