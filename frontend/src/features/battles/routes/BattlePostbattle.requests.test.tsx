/**
 * What the postbattle page sends: the back chevron, draft saves, the kill floor, the finalise
 * summary and the finds picker, against a fake server that stores the draft as `postbattle/` does.
 */
import { act, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BattlePostbattleState, BattleState } from "@/features/battles/types/battle-types";
import {
  BATTLE_CHANNEL,
  ME,
  OPPONENT,
  battleEvent,
  battlePath,
  battleRosters,
  battleState,
  deferred,
  mySheet,
  postbattleRules,
  socketMessage,
  statePath,
} from "@/test/battle-fixtures";
import { ApiError } from "@/lib/api-client";
import { createQueryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";
import { renderBattleRoute } from "@/test/battle-routes";
import { fakeApi } from "@/test/fake-api";
import { fakeRealtime } from "@/test/fake-realtime";
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
const ROPE = { id: 77, name: "Rope & Hook", type: "Miscellaneous", availabilities: [] };
const SWORD = { id: 78, name: "Sword", type: "Hand-to-hand", availabilities: [] };
const RESOURCES = [{ id: 9, warband_id: ME.warband.id, name: "Treasure", amount: 0 }];

const killBy = (
  id: number,
  killerKey: string,
  victim: Record<string, unknown> = { unit_key: "hero:2", warband_id: OPPONENT.warband.id },
  earnedXp = true
) =>
  battleEvent(id, "unit_kill_recorded", ME.id, {
    killer: { warband_id: ME.warband.id, unit_key: killerKey },
    victim,
    earned_xp: earnedXp,
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
      killBy(5, "hero:1", { unit_key: null, name: "Giant Rat" }, false),
    ],
  });
  // The postbattle view carries the server's rules and suggestions (IMP-52).
  server.rules = postbattleRules();
  server.suggested_postbattle = {
    unit_results: {
      "hero:1": { xp_earned: 3 },
      "hero:3": { xp_earned: 1 },
      "hireling:4": { xp_earned: 1 },
      "henchman:2": { xp_earned: 1 },
    },
    exploration: { dice_count: 2 },
    upkeep: { entries: { "hireling:4": { unit_name: "Ogre Bodyguard", cost: 15 } } },
  };
  fakeApi.on(`GET ${statePath("postbattle")}`, () => answer());
  fakeApi.on(`GET ${battlePath("rosters/")}`, battleRosters());
  fakeApi.on(`GET /warbands/${ME.warband.id}/sheet/`, mySheet(RESOURCES));
  fakeApi.on(DRAFT_ROUTE, storeDraft);
}

async function renderPostbattle(options: Parameters<typeof renderBattleRoute>[1] = {}) {
  const view = renderBattleRoute("postbattle", options);
  expect((await screen.findAllByText("Captain Wolf"))[0]).toBeInTheDocument();
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

  it("shows who is still in postbattle and who has finished or was skipped (BATL-NEW-08)", async () => {
    server.participants[1].status = "confirmed_postbattle";
    server.participants[1].skipped_postbattle = true;
    server.participants[1].last_seen_at = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
    await renderPostbattle();

    const strip = screen.getByRole("region", { name: "Battle status" });
    expect(
      within(strip)
        .getAllByRole("listitem")
        .map((item) => item.textContent)
    ).toEqual(["YouIn postbattle", "PlayerSkippedidle 5 hours"]);
  });

  it("nudges a player the battle waits for, then says when you can again (BATL-NEW-08)", async () => {
    const user = setupUser();
    server.capabilities = {
      start: false,
      cancel: false,
      close_postbattle: false,
      edit_record: false,
      nudge: true,
    };
    fakeApi.on(`POST ${battlePath("nudge/")}`, () => ({
      ...answer(),
      events: [
        {
          ...battleEvent(30, "participant_nudged", ME.id, {
            target_user_id: OPPONENT.id,
            nudged_by_user_id: ME.id,
          }),
          created_at: new Date().toISOString(),
        },
      ],
    }));
    await renderPostbattle();
    const strip = screen.getByRole("region", { name: "Battle status" });

    await user.click(within(strip).getByRole("button", { name: "Nudge Player" }));

    const again = await within(strip).findByRole("button", {
      name: "Player nudged; again in 10 min",
    });
    expect(again).toBeDisabled();
    expect(again).toHaveTextContent("Again in 10 min");
    expect(fakeApi.bodyOf(`POST ${battlePath("nudge/")}`)).toEqual({ user_id: OPPONENT.id });
    expect(await screen.findByText("Player has been nudged.")).toBeInTheDocument();
  });

  it("shows the wait the server answers when a nudge comes too soon (BATL-NEW-08)", async () => {
    const user = setupUser();
    server.capabilities = {
      start: false,
      cancel: false,
      close_postbattle: false,
      edit_record: false,
      nudge: true,
    };
    fakeApi.fail(
      `POST ${battlePath("nudge/")}`,
      new ApiError("Too soon", 429, {
        detail: "You nudged them a few minutes ago.",
        code: "nudged_recently",
        retry_after: 230,
      })
    );
    await renderPostbattle();
    const strip = screen.getByRole("region", { name: "Battle status" });

    await user.click(within(strip).getByRole("button", { name: "Nudge Player" }));

    expect(
      await within(strip).findByRole("button", { name: "Player nudged; again in 4 min" })
    ).toBeDisabled();
    expect(
      await screen.findByText("You nudged Player not long ago; you can again in 4 min.")
    ).toBeInTheDocument();
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
      "Iron Vultures leaves this battle without its postbattle. You can't come back to it, and nothing from this page will be applied. Single-use items used in the battle are still used up."
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

    expect(await screen.findByRole("region", { name: "Waiting for others" })).toBeInTheDocument();
    expect(screen.getByLabelText("Current path")).toHaveTextContent(/postbattle$/);
    expect(fakeApi.requests()).toEqual([{ method: "POST", path: battlePath("confirm/") }]);
    // Waiting, the phone bars offer no sections to jump to and nothing to finalise.
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Finalis/ })).toBeNull();
  });

  it("lets the creator close postbattle from More actions, naming who will be skipped (BUG-09)", async () => {
    const user = setupUser();
    fakeApi.on(`POST ${battlePath("close-postbattle/")}`, () => battleState({ status: "ended" }));
    await renderPostbattle();

    await user.click(screen.getByRole("button", { name: "More actions" }));
    const close = within(screen.getByRole("dialog", { name: "More actions" })).getByRole("button", {
      name: "Close postbattle",
    });
    expect(close).toHaveClass("btn-destructive");
    await user.click(close);

    const dialog = screen.getByRole("dialog", { name: "Close postbattle" });
    expect(dialog).toHaveAccessibleDescription(/records wins and losses.*skipped/);
    expect(
      within(dialog)
        .getAllByRole("listitem")
        .map((item) => item.textContent)
    ).toEqual(["You (Iron Vultures)", "Player (Night Razors)"]);
    expect(fakeApi.requests()).toEqual([]);
    await user.click(within(dialog).getByRole("button", { name: "Close postbattle" }));

    expect(await screen.findByText("Campaign overview")).toBeInTheDocument();
    expect(fakeApi.requests()).toEqual([{ method: "POST", path: battlePath("close-postbattle/") }]);
  });

  it("offers Close postbattle to a battle manager who didn't create the battle, and not to others (BUG-09)", async () => {
    const user = setupUser();
    server.battle.created_by_user_id = OPPONENT.id;
    const { unmount } = renderBattleRoute("postbattle");
    await screen.findAllByText("Captain Wolf");

    await user.click(screen.getByRole("button", { name: "More actions" }));
    expect(
      within(screen.getByRole("dialog", { name: "More actions" }))
        .getAllByRole("button")
        .map((button) => button.textContent)
    ).toEqual(["Skip postbattle"]);
    unmount();

    renderBattleRoute("postbattle", {
      campaign: { permissions: ["manage_battles"], capabilities: { manage_battles: true } },
    });
    await screen.findAllByText("Captain Wolf");
    await user.click(screen.getByRole("button", { name: "More actions" }));
    expect(
      within(screen.getByRole("dialog", { name: "More actions" })).getByRole("button", {
        name: "Close postbattle",
      })
    ).toBeEnabled();
  });

  it("offers Close postbattle as the server's capabilities say, whoever created the battle", async () => {
    const user = setupUser();
    server.battle.created_by_user_id = OPPONENT.id;
    server.capabilities = {
      start: false,
      end: false,
      cancel: false,
      close_postbattle: true,
      edit_record: false,
    };
    await renderPostbattle();

    await user.click(screen.getByRole("button", { name: "More actions" }));
    expect(
      within(screen.getByRole("dialog", { name: "More actions" })).getByRole("button", {
        name: "Close postbattle",
      })
    ).toBeEnabled();
  });

  it("shows a saved injury's server effect, ticked to apply, and saves the untick (BUG-47)", async () => {
    const user = setupUser();
    const mine = server.participants.find((entry) => entry.user.id === ME.id)!;
    mine.postbattle_json = {
      exploration: { dice_values: [], resource_id: null },
      finds: { gold_crowns: 0, items: [] },
      upkeep: { pay_upkeep: true, entries: {} },
      unit_results: {
        "hero:3": {
          serious_injury_rolls: [
            {
              roll_type: "d66",
              rolls: [3, 2],
              result_code: "32",
              result_label: "Nervous Condition",
              dead_suggestion: false,
              apply: true,
              effect: { kind: "stat", stat: "initiative", change: -1 },
            },
          ],
        },
      },
    } as unknown as BattlePostbattleState;
    await renderPostbattle();

    const apply = screen.getByRole("checkbox", { name: "Apply Nervous Condition to Rolf" });
    expect(apply).toBeChecked();
    expect(
      screen.getByText(/Apply at finalise: Nervous Condition \(-1 Initiative\)/)
    ).toBeInTheDocument();
    await user.click(apply);

    await waitFor(() => expect(draftBodies()).toHaveLength(1));
    expect(draftBodies()[0].unit_results["hero:3"].serious_injury_rolls[0]).toMatchObject({
      result_code: "32",
      apply: false,
    });
  });

  it("flags a complex injury result to apply by hand (BUG-47)", async () => {
    const user = setupUser();
    // The server fills in each roll's effect from its table: 34 is Arm Wound, applied by hand.
    fakeApi.on(DRAFT_ROUTE, (body: unknown) => {
      const draft = structuredClone(body) as { postbattle_json: BattlePostbattleState };
      for (const result of Object.values(draft.postbattle_json.unit_results)) {
        result.serious_injury_rolls = result.serious_injury_rolls.map((roll) => ({
          ...roll,
          result_label: "Arm Wound",
          effect: { kind: "manual" },
        }));
      }
      return storeDraft(draft);
    });
    await renderPostbattle();

    await user.click(within(row("Rolf")).getByRole("button", { name: "Serious Injury Roll" }));
    const dialog = screen.getByRole("dialog", { name: "Serious Injury Roll" });
    await user.click(within(dialog).getByRole("button", { name: /^Roll/ }));

    expect(
      await screen.findByText("Arm Wound: apply by hand on the warband sheet.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /^Apply Arm Wound/ })).toBeNull();
  });

  it("says why each XP is suggested, and counts the server's level-ups in the summary (BATL-NEW-09, -10)", async () => {
    const user = setupUser();
    server.suggested_postbattle = {
      unit_results: {
        "hero:1": {
          xp_earned: 4,
          reasons: [
            { label: "survived", xp: 1 },
            { label: "2 kills", xp: 2 },
            { label: "winning leader", xp: 1 },
          ],
          level_ups: 1,
        },
        "hireling:4": {
          xp_earned: 0,
          reasons: [{ label: "no level-ups", xp: 0 }],
          level_ups: 0,
        },
      },
      exploration: { dice_count: 2 },
      upkeep: { entries: {} },
    };
    await renderPostbattle();

    expect(
      within(row("Captain Wolf")).getByRole("img", {
        name: "Why 4 XP for Captain Wolf: survived +1, 2 kills +2, winning leader +1",
      })
    ).toBeInTheDocument();
    expect(
      within(row("Ogre Bodyguard")).getByRole("img", {
        name: "Why 0 XP for Ogre Bodyguard: no level-ups",
      })
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Finalise Postbattle" }));
    const dialog = screen.getByRole("dialog", { name: "Finalise Postbattle" });
    // The server's count (its high-water mark and tables), not a preview from the sheet.
    expect(dialog).toHaveTextContent("Captain Wolf reaches a level-up.");
  });

  it("seeds the exploration dice from the suggestion when it arrives after the page opened", async () => {
    // Reached from Active, the cache had no suggestion; the read that follows brings it.
    const suggestion = server.suggested_postbattle;
    delete server.suggested_postbattle;
    const later = deferred<BattleState>();
    fakeApi.on(`GET ${statePath("postbattle", 5)}`, () => later.promise);
    await renderPostbattle();
    expect(screen.queryAllByPlaceholderText("-")).toHaveLength(0);

    await act(async () => later.resolve({ ...answer(), suggested_postbattle: suggestion }));

    await waitFor(() => expect(screen.getAllByPlaceholderText("-")).toHaveLength(2));
    expect(screen.getByRole("button", { name: "Roll" })).toBeEnabled();
  });

  it("uses the campaign's cached rules when the battle came without them, reading nothing (item 8)", async () => {
    delete server.rules;
    const queryClient = createQueryClient();
    queryClient.setQueryData(queryKeys.campaign.battleRules(1), postbattleRules("d100"));
    renderBattleRoute("postbattle", { queryClient });
    expect((await screen.findAllByText("Captain Wolf"))[0]).toBeInTheDocument();
    await pause(50);

    expect(fakeApi.calls().filter((call) => call.includes("state/"))).toEqual([
      `GET ${statePath("postbattle")}`,
    ]);
  });

  it("reads the warband's resources from its cached sheet, with no request of its own (BUG-127)", async () => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(queryKeys.campaign.warbandSheet(1, ME.warband.id), mySheet(RESOURCES));
    renderBattleRoute("postbattle", { queryClient });

    expect((await screen.findAllByText("Captain Wolf"))[0]).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Treasure" })).toBeInTheDocument();
    expect(fakeApi.calls().filter((call) => call.includes("/warbands/"))).toEqual([]);
  });

  it("keeps Skip postbattle out of the desktop action panel, beside Finalise (BUG-48)", async () => {
    await renderPostbattle();

    expect(screen.queryByRole("button", { name: /leave/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Skip postbattle" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Finalise Postbattle" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "More actions" })).toBeInTheDocument();
  });

  it("queues draft saves behind the one in flight, so an older answer can't undo a newer edit (BUG-44)", async () => {
    const user = setupUser();
    await renderPostbattle();
    const held: Array<{ body: unknown; release: () => void }> = [];
    fakeApi.on(DRAFT_ROUTE, (body: unknown) => {
      const stored = storeDraft(body);
      const answerLater = deferred<BattleState>();
      held.push({ body, release: () => answerLater.resolve(stored) });
      return answerLater.promise;
    });
    const dead = () => within(row("Ogre Bodyguard")).getByRole("checkbox", { name: "Dead" });

    await commit(user, stepper("Captain Wolf", "XP"), "5");
    await user.click(dead());

    // The Dead tick waits for the XP save; Finalise waits for both.
    expect(draftBodies()).toHaveLength(1);
    expect(draftBodies()[0].unit_results["hireling:4"].dead).toBe(false);
    expect(dead()).toBeChecked();
    expect(screen.getByRole("button", { name: "Finalise Postbattle" })).toBeDisabled();

    await act(async () => held[0].release());
    await waitFor(() => expect(draftBodies()).toHaveLength(2));
    expect(draftBodies()[1].unit_results["hireling:4"].dead).toBe(true);
    expect(draftBodies()[1].unit_results["hero:1"].xp_earned).toBe(5);
    expect(dead()).toBeChecked();

    await act(async () => held[1].release());
    expect(dead()).toBeChecked();
    expect(stepper("Captain Wolf", "XP")).toHaveValue(5);
    expect(screen.getByRole("button", { name: "Finalise Postbattle" })).toBeEnabled();
  });

  it("says what a dead unit loses once its Dead tick is on (pass 2 decision 7)", async () => {
    const user = setupUser();
    await renderPostbattle();
    // A unit's Dead tick sits in the same block as its name, for heroes, hired swords and henchmen.
    const deadTick = (unitName: string) =>
      within(screen.getAllByText(unitName)[0].closest(".space-y-3") as HTMLElement).getByRole(
        "checkbox",
        { name: "Dead" }
      );
    expect(screen.queryByText(/items are lost|items is lost/)).not.toBeInTheDocument();

    await user.click(deadTick("Ogre Bodyguard"));
    expect(deadTick("Ogre Bodyguard")).toHaveAccessibleDescription(
      "All carried items are lost; move them to the stash first to keep them."
    );

    await user.click(deadTick("Youngblood A"));
    expect(deadTick("Youngblood A")).toHaveAccessibleDescription(
      "One of each of the group's items is lost with him; move them to the stash first to keep them."
    );
    expect(deadTick("Captain Wolf")).not.toHaveAccessibleDescription();
  });

  it("saves the roll with the draft, so a reload shows it and allows no second roll (BUG-71)", async () => {
    const user = setupUser();
    const { unmount } = await renderPostbattle();
    const dice = () =>
      screen.getAllByPlaceholderText("-").map((die) => (die as HTMLInputElement).value);

    await user.click(screen.getByRole("button", { name: "Roll" }));
    expect(dice()).toEqual(["3", "4"]);
    await waitFor(() => expect(draftBodies()).toHaveLength(1));
    expect(draftBodies()[0].exploration).toEqual({
      dice_values: [3, 4],
      resource_id: 9,
      amount_override: undefined,
    });

    await commit(user, stepper("Captain Wolf", "XP"), "4");
    await waitFor(() => expect(draftBodies()).toHaveLength(2));
    expect(draftBodies()[1].exploration.dice_values).toEqual([3, 4]);

    unmount();
    await renderPostbattle();

    expect(dice()).toEqual(["3", "4"]);
    expect(screen.getByRole("button", { name: "Roll" })).toBeDisabled();
    expect(stepper("Captain Wolf", "XP")).toHaveValue(4);
  });

  it("shows the warning a draft answers when a saved roll is rolled again (BUG-71, decision 9)", async () => {
    const user = setupUser();
    fakeApi.on(DRAFT_ROUTE, (body: unknown) => {
      const before = server.participants.find((entry) => entry.user.id === ME.id)!.postbattle_json;
      const stored = storeDraft(body);
      const previous =
        (before as BattlePostbattleState | undefined)?.exploration?.dice_values ?? [];
      const next = (body as { postbattle_json: BattlePostbattleState }).postbattle_json.exploration;
      return previous.length > 0 && previous.join() !== next.dice_values.join()
        ? {
            ...stored,
            warnings: [
              {
                code: "exploration_rerolled",
                message: "You rolled exploration again; the earlier roll is logged.",
              },
            ],
          }
        : stored;
    });
    await renderPostbattle();

    await user.click(screen.getByRole("button", { name: "Roll" }));
    await waitFor(() => expect(draftBodies()).toHaveLength(1));
    // The test dice roll 3 then 4, so a single die comes up 3: die 2 changes from 4.
    await user.click(screen.getByRole("button", { name: "Reroll die 2" }));

    await waitFor(() => expect(draftBodies()).toHaveLength(2));
    expect(
      await screen.findByText("You rolled exploration again; the earlier roll is logged.")
    ).toBeInTheDocument();
  });

  it("keeps battle stat changes only when ticked, and shows what finalise warns about (SEC-10)", async () => {
    const user = setupUser();
    fakeApi.on(`POST ${battlePath("finalize-postbattle/")}`, () => ({
      ...battleState({ status: "postbattle", me: { status: "confirmed_postbattle" } }),
      warnings: [
        {
          code: "unit_left_warband",
          message: "Rolf has left the warband, so his results were not applied.",
          unit_key: "hero:3",
        },
      ],
    }));
    await renderPostbattle();

    // Captain Wolf fought with WS 5 (his profile says 4); kept only if ticked.
    expect(
      within(screen.getByRole("list", { name: "Units with stat changes" })).getByText("WS 4 → 5")
    ).toBeInTheDocument();
    const keep = screen.getByRole("checkbox", { name: "Keep Captain Wolf's stat changes" });
    expect(keep).not.toBeChecked();
    expect(screen.queryByRole("checkbox", { name: "Keep Rolf's stat changes" })).toBeNull();
    await user.click(keep);
    await waitFor(() => expect(draftBodies()).toHaveLength(1));
    expect(draftBodies()[0].unit_results["hero:1"].keep_stats).toBe(true);

    await user.click(screen.getByRole("button", { name: "Finalise Postbattle" }));
    await user.click(
      within(screen.getByRole("dialog", { name: "Finalise Postbattle" })).getByRole("button", {
        name: "Confirm",
      })
    );

    expect(
      await screen.findByText("Rolf has left the warband, so his results were not applied.")
    ).toBeInTheDocument();
    const finalised = fakeApi.bodyOf(`POST ${battlePath("finalize-postbattle/")}`) as {
      postbattle_json: BattlePostbattleState;
    };
    expect(finalised.postbattle_json.unit_results["hero:1"].keep_stats).toBe(true);
  });

  it("lists every unit with a stat change, each with a Keep tick that is off, one per henchmen group (BATL-TWEAK-04)", async () => {
    const user = setupUser();
    const mine = server.participants.find((entry) => entry.user.id === ME.id)!;
    mine.unit_information_json = {
      ...mine.unit_information_json,
      "henchman:2": { stats_override: { toughness: 4 }, out_of_action: false, kill_count: 0 },
      "hireling:4": {
        stats_override: { strength: 4, attacks: 2 },
        out_of_action: false,
        kill_count: 0,
      },
    };
    await renderPostbattle();

    const list = screen.getByRole("list", { name: "Units with stat changes" });
    expect(
      within(list)
        .getAllByRole("listitem")
        .map((item) => item.textContent)
    ).toEqual([
      "Captain WolfWS 4 → 5Keep",
      "YoungbloodsT 3 → 4Keep",
      "Ogre BodyguardS 3 → 4, A 1 → 2Keep",
    ]);
    for (const checkbox of within(list).getAllByRole("checkbox")) {
      expect(checkbox).not.toBeChecked();
    }
    // Rolf fought on his profile: nothing to keep.
    expect(screen.queryByRole("checkbox", { name: "Keep Rolf's stat changes" })).toBeNull();

    await user.click(screen.getByRole("checkbox", { name: "Keep Youngbloods's stat changes" }));
    await waitFor(() => expect(draftBodies()).toHaveLength(1));
    expect(draftBodies()[0].unit_results["henchman:2"].keep_stats).toBe(true);
    expect(draftBodies()[0].unit_results["hero:1"].keep_stats).toBeFalsy();
    expect(screen.getByRole("checkbox", { name: "Keep Youngbloods's stat changes" })).toBeChecked();
  });

  it("lists each unit's kills by victim; removes the one picked and adds one with a victim from the other roster (BATL-NEW-06)", async () => {
    const user = setupUser();
    // The answer carries only the new undo event, as the server's does.
    fakeApi.on(`POST ${battlePath("events/4/void/")}`, () => ({
      ...answer(),
      events: [
        battleEvent(6, "unit_kill_voided", ME.id, { voided_event_id: 4, unit_key: "hero:1" }),
      ],
    }));
    fakeApi.on(`POST ${battlePath("unit-kill/")}`, () => ({
      ...answer(),
      events: [killBy(7, "hero:1", { unit_key: "hero:2", warband_id: OPPONENT.warband.id })],
    }));
    await renderPostbattle();
    const kills = () =>
      within(screen.getByRole("list", { name: "Kills by Captain Wolf" }))
        .getAllByRole("listitem")
        .map((item) => item.textContent);
    expect(kills()).toEqual(["took out Player's Black Fang", "took out Giant Rat (no XP)"]);
    expect(screen.getByRole("status", { name: "Captain Wolf's kills" })).toHaveTextContent("2");

    // The first kill, not just the latest, can be removed.
    await user.click(
      screen.getByRole("button", { name: "Remove Captain Wolf's kill of Player's Black Fang" })
    );
    const confirm = screen.getByRole("dialog", { name: "Remove kill" });
    expect(confirm).toHaveAccessibleDescription(
      "Remove Captain Wolf's kill of Player's Black Fang? It stays in the battle log, marked undone."
    );
    await user.click(within(confirm).getByRole("button", { name: "Remove kill" }));
    await waitFor(() => expect(kills()).toEqual(["took out Giant Rat (no XP)"]));

    await user.click(screen.getByRole("button", { name: "Add a kill for Captain Wolf" }));
    const dialog = screen.getByRole("dialog", { name: "Record Kill" });
    await user.selectOptions(within(dialog).getByRole("combobox"), "hero:2");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(kills()).toEqual(["took out Giant Rat (no XP)", "took out Player's Black Fang"])
    );
    expect(screen.getByRole("status", { name: "Captain Wolf's kills" })).toHaveTextContent("2");

    expect(fakeApi.requests()).toEqual([
      { method: "POST", path: battlePath("events/4/void/") },
      {
        method: "POST",
        path: battlePath("unit-kill/"),
        body: {
          killer_unit_key: "hero:1",
          victim_unit_key: "hero:2",
          victim_name: undefined,
          notes: undefined,
          earned_xp: true,
          source: "postbattle",
        },
      },
    ]);
  });

  it("adds a kill of a unit on no roster by its typed name (BATL-NEW-06)", async () => {
    const user = setupUser();
    fakeApi.on(`POST ${battlePath("unit-kill/")}`, () => ({
      ...answer(),
      events: [killBy(7, "hero:3", { unit_key: null, name: "Dire Wolf" })],
    }));
    await renderPostbattle();
    expect(screen.queryByRole("list", { name: "Kills by Rolf" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Add a kill for Rolf" }));
    const dialog = screen.getByRole("dialog", { name: "Record Kill" });
    await user.type(within(dialog).getByPlaceholderText("Non-recorded unit name"), "Dire Wolf");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(
      await within(await screen.findByRole("list", { name: "Kills by Rolf" })).findByText(
        "took out Dire Wolf"
      )
    ).toBeInTheDocument();
    expect(fakeApi.bodyOf(`POST ${battlePath("unit-kill/")}`)).toMatchObject({
      killer_unit_key: "hero:3",
      victim_unit_key: undefined,
      victim_name: "Dire Wolf",
      source: "postbattle",
    });
  });

  it("lists every permanent change before finalising, then finalises with the rolled dice (BATL-NEW-10, BATL-TEST-27)", async () => {
    const user = setupUser();
    const mine = server.participants.find((entry) => entry.user.id === ME.id)!;
    mine.postbattle_json = {
      exploration: { dice_values: [], resource_id: null },
      finds: { gold_crowns: 0, items: [] },
      upkeep: { pay_upkeep: true, entries: {} },
      unit_results: {
        "hero:1": { keep_stats: true },
        "hero:3": {
          serious_injury_rolls: [
            {
              roll_type: "d66",
              rolls: [3, 4],
              result_code: "34",
              result_label: "Arm Wound",
              dead_suggestion: false,
              effect: { kind: "manual" },
            },
          ],
        },
        "henchman:2": {
          dead: true,
          serious_injury_rolls: [
            {
              roll_type: "d6",
              rolls: [1],
              result_code: "1",
              result_label: "Dead",
              dead_suggestion: true,
              apply: true,
              effect: { kind: "dead" },
            },
          ],
        },
      },
    } as unknown as BattlePostbattleState;
    const rosters = battleRosters();
    rosters[String(ME.id)].henchmenGroups[0].members[0].items = [
      { id: 51, name: "Club", count: 1, singleUse: false },
    ];
    fakeApi.on(`GET ${battlePath("rosters/")}`, rosters);
    fakeApi.on(`GET /warbands/${ME.warband.id}/sheet/`, {
      ...mySheet(RESOURCES),
      warband: { id: ME.warband.id, name: ME.warband.name, gold: 10 },
      heroes: [{ id: 1, xp: 3, half_rate: false }],
      hirelings: [{ id: 4, xp: 0, half_rate: false, no_level_ups: false }],
      henchmen_groups: [
        { id: 11, name: "Youngbloods", xp: 1, half_rate: false, henchmen: [{ id: 2 }] },
      ],
    });
    fakeApi.on(`POST ${battlePath("finalize-postbattle/")}`, () =>
      battleState({ status: "postbattle", me: { status: "confirmed_postbattle" } })
    );
    await renderPostbattle();
    await user.click(screen.getByRole("button", { name: "Roll" }));

    await user.click(screen.getByRole("button", { name: "Finalise Postbattle" }));
    const dialog = screen.getByRole("dialog", { name: "Finalise Postbattle" });
    const panel = (title: string) =>
      Array.from(dialog.querySelectorAll(".battle-section-title"))
        .find((element) => element.textContent === title)!
        .closest(".battle-inline-panel") as HTMLElement;
    const lines = (title: string) =>
      Array.from(panel(title).querySelectorAll("p:not(.battle-section-title)"), (line) =>
        line.textContent?.trim()
      );

    expect(
      Array.from(dialog.querySelectorAll(".battle-section-title"), (title) => title.textContent)
    ).toEqual([
      "Exploration",
      "Finds",
      "Deaths",
      "Items lost",
      "Serious injuries",
      "XP Awards",
      "Level-ups",
      "Kills",
      "Stat changes",
      "Items used",
      "Upkeep",
      "Gold",
    ]);
    expect(lines("Exploration")).toEqual(["You will gain 2 Treasure."]);
    expect(lines("Deaths")).toEqual(["Youngblood A will be marked dead."]);
    expect(lines("Items lost")).toEqual([
      "Youngblood A takes one of each of his group's items with him: Club.",
    ]);
    expect(lines("Serious injuries")).toEqual([
      "Rolf: Arm Wound: apply by hand on the warband sheet.",
      "Youngblood A: Dead (He dies).",
    ]);
    expect(lines("XP Awards")).toEqual([
      "Captain Wolf will gain 3 XP.",
      "Rolf will gain 1 XP.",
      "Youngblood A will gain 1 XP.",
      "Ogre Bodyguard will gain 1 XP.",
    ]);
    // The campaign's default thresholds: heroes level at 2, 4, 6...; henchmen at 2, 5, 9, 14.
    expect(lines("Level-ups")).toEqual([
      "Captain Wolf reaches 2 level-ups (XP 3 → 6).",
      "Youngbloods reaches a level-up (XP 1 → 2).",
    ]);
    expect(lines("Kills")).toEqual(["Captain Wolf took out Player's Black Fang, Giant Rat."]);
    expect(lines("Stat changes")).toEqual(["Captain Wolf keeps WS 4 → 5."]);
    expect(lines("Items used")).toEqual(["Captain Wolf's Healing Draught is used up."]);
    expect(lines("Upkeep")).toEqual(["You will be paying 15gc in upkeep."]);
    expect(lines("Gold")).toEqual(["10 gc now, -15 gc upkeep: -5 gc after this battle."]);
    // Gold below zero shows in red (pass 2 decision 2).
    expect(within(panel("Gold")).getByText("-5 gc")).toHaveClass("text-red-500");

    await user.click(within(dialog).getByRole("button", { name: "Confirm" }));

    expect(await screen.findByRole("region", { name: "Waiting for others" })).toBeInTheDocument();
    const finalised = fakeApi.bodyOf(`POST ${battlePath("finalize-postbattle/")}`) as {
      postbattle_json: BattlePostbattleState;
    };
    expect(finalised.postbattle_json.exploration).toEqual({
      dice_values: [3, 4],
      resource_id: 9,
      amount_override: undefined,
    });
    expect(finalised.postbattle_json.unit_results["hero:1"]).toMatchObject({
      keep_stats: true,
      xp_earned: 3,
      special_ids: [],
    });
  });

  it("leaves out the kinds of change a battle didn't have, and counts found gold in the gold", async () => {
    const user = setupUser();
    const mine = server.participants.find((entry) => entry.user.id === ME.id)!;
    mine.unit_information_json = {};
    server.events = [];
    mine.postbattle_json = {
      exploration: { dice_values: [], resource_id: null },
      finds: { gold_crowns: 30, items: [] },
      upkeep: { pay_upkeep: false, entries: {} },
      unit_results: {},
    } as unknown as BattlePostbattleState;
    fakeApi.on(`GET /warbands/${ME.warband.id}/sheet/`, {
      ...mySheet(RESOURCES),
      warband: { id: ME.warband.id, name: ME.warband.name, gold: 10 },
    });
    await renderPostbattle();

    await user.click(screen.getByRole("button", { name: "Finalise Postbattle" }));
    const dialog = screen.getByRole("dialog", { name: "Finalise Postbattle" });
    expect(
      Array.from(dialog.querySelectorAll(".battle-section-title"), (title) => title.textContent)
    ).toEqual(["Exploration", "Finds", "Deaths", "XP Awards", "Upkeep", "Gold"]);
    expect(dialog).toHaveTextContent("10 gc now, +30 gc found: 40 gc after this battle.");
    expect(within(dialog).getByText("40 gc")).not.toHaveClass("text-red-500");
  });

  it("waits for the others after finalising instead of leaving the page (BATL-NEW-08)", async () => {
    const user = setupUser();
    fakeApi.on(`POST ${battlePath("finalize-postbattle/")}`, () =>
      battleState({ status: "postbattle", me: { status: "confirmed_postbattle" } })
    );
    await renderPostbattle();

    await user.click(screen.getByRole("button", { name: "Finalise Postbattle" }));
    await user.click(
      within(screen.getByRole("dialog", { name: "Finalise Postbattle" })).getByRole("button", {
        name: "Confirm",
      })
    );

    const panel = await screen.findByRole("region", { name: "Waiting for others" });
    expect(panel).toHaveTextContent("Still in postbattle: Player (Night Razors).");
    expect(screen.getByLabelText("Current path")).toHaveTextContent(/postbattle$/);
    // The draft is done with: no sections to edit, no second Finalise.
    expect(screen.queryByRole("button", { name: "Roll" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Finalise Postbattle" })).toBeNull();
    expect(
      within(screen.getByRole("region", { name: "Battle status" }))
        .getAllByRole("listitem")
        .map((item) => item.textContent)
    ).toEqual(["YouFinished", "PlayerIn postbattle"]);

    await user.click(within(panel).getByRole("button", { name: "Go to your warband" }));
    expect(screen.getByLabelText("Current path")).toHaveTextContent("/campaigns/1/warband");
  });

  it("asks the last player to finish to confirm the results, then sends them (decision 4)", async () => {
    const user = setupUser();
    server.battle.results_pending = true;
    server.battle.results_confirmer_user_id = ME.id;
    server.participants[0].declared_result = "undecided";
    server.participants[1].declared_result = "won";
    server.confirm_results = {
      winners: [OPPONENT.warband.id],
      losers: [],
      undecided: [ME.warband.id],
    };
    server.capabilities = {
      start: false,
      cancel: false,
      close_postbattle: true,
      edit_record: false,
      confirm_results: true,
    };
    fakeApi.on(`POST ${battlePath("results/")}`, () => {
      server.battle.results_pending = false;
      server.battle.winner_warband_ids_json = [ME.warband.id];
      return answer();
    });
    await renderPostbattle();

    // The modal opens by itself, each warband on the side its player declared.
    const dialog = await screen.findByRole("dialog", { name: "Confirm results" });
    const side = (name: string) =>
      within(within(dialog).getByRole("region", { name }))
        .queryAllByRole("listitem")
        .map((item) => item.querySelector("p")?.textContent);
    expect(side("Winners")).toEqual(["Night Razors"]);
    expect(side("Losers")).toEqual(["Iron Vultures"]);
    await user.click(within(dialog).getByRole("button", { name: "Move Iron Vultures to Winners" }));
    await user.click(within(dialog).getByRole("button", { name: "Move Night Razors to Losers" }));
    await user.click(within(dialog).getByRole("button", { name: "Confirm results" }));

    expect(
      await screen.findByText(
        "Results confirmed: Iron Vultures won. You can change them until the battle ends."
      )
    ).toBeInTheDocument();
    expect(fakeApi.bodyOf(`POST ${battlePath("results/")}`)).toEqual({
      winners: [ME.warband.id],
      losers: [OPPONENT.warband.id],
    });
  });

  it("tells the others who the results wait for", async () => {
    server.battle.results_pending = true;
    server.battle.results_confirmer_user_id = OPPONENT.id;
    server.capabilities = {
      start: false,
      cancel: false,
      close_postbattle: false,
      edit_record: false,
    };
    await renderPostbattle();

    expect(
      within(screen.getByRole("region", { name: "Results" })).getByText(
        "Waiting for Player to confirm the results."
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Confirm results" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Confirm results" })).toBeNull();
  });

  it("names who is still fighting while you wait, in a battle others play on (decision 4)", async () => {
    const user = setupUser();
    server.battle.status = "active";
    server.participants[1].status = "in_battle";
    fakeApi.on(`POST ${battlePath("finalize-postbattle/")}`, () =>
      battleState({
        status: "active",
        me: { status: "confirmed_postbattle" },
        opponent: { status: "in_battle" },
      })
    );
    await renderPostbattle();

    await user.click(screen.getByRole("button", { name: "Finalise Postbattle" }));
    await user.click(
      within(screen.getByRole("dialog", { name: "Finalise Postbattle" })).getByRole("button", {
        name: "Confirm",
      })
    );

    const panel = await screen.findByRole("region", { name: "Waiting for others" });
    expect(panel).toHaveTextContent("Still fighting: Player (Night Razors).");
    expect(panel).not.toHaveTextContent("Still in postbattle");
  });

  it("sends the last player to finish to his warband: his finalise ended the battle (BATL-NEW-08)", async () => {
    const user = setupUser();
    fakeApi.on(`POST ${battlePath("finalize-postbattle/")}`, () =>
      battleState({ status: "ended", me: { status: "confirmed_postbattle" } })
    );
    await renderPostbattle();

    await user.click(screen.getByRole("button", { name: "Finalise Postbattle" }));
    await user.click(
      within(screen.getByRole("dialog", { name: "Finalise Postbattle" })).getByRole("button", {
        name: "Confirm",
      })
    );

    expect(await screen.findByText("Warband page")).toBeInTheDocument();
    expect(screen.getByText("Street Fight has ended.")).toBeInTheDocument();
  });

  it("says the battle has ended when the last player finishes while you wait (BATL-NEW-08)", async () => {
    const user = setupUser();
    fakeApi.on(`POST ${battlePath("finalize-postbattle/")}`, () =>
      battleState({ status: "postbattle", me: { status: "confirmed_postbattle" } })
    );
    const ended = battleEvent(20, "battle_ended", OPPONENT.id, {});
    fakeApi.on(
      `GET ${statePath("postbattle", 5)}`,
      battleState({ status: "ended", me: { status: "confirmed_postbattle" }, events: [ended] })
    );
    await renderPostbattle();
    await user.click(screen.getByRole("button", { name: "Finalise Postbattle" }));
    await user.click(
      within(screen.getByRole("dialog", { name: "Finalise Postbattle" })).getByRole("button", {
        name: "Confirm",
      })
    );
    await screen.findByRole("region", { name: "Waiting for others" });

    act(() => fakeRealtime.emit(BATTLE_CHANNEL, "battle.event", socketMessage(ended)));

    expect(await screen.findByText("Campaign overview")).toBeInTheDocument();
    expect(screen.getByText("Street Fight has ended.")).toBeInTheDocument();
  });

  it("loads the campaign's items once when the finds picker opens and filters them as you type (PERF-40)", async () => {
    const user = setupUser();
    await renderPostbattle({ queryClient: createQueryClient() });
    fakeApi.on("GET /items/?campaign_id=1", [ROPE, SWORD]);
    const picker = screen.getByPlaceholderText("Search and add an item");

    await user.click(picker);
    expect(await screen.findByRole("button", { name: /Sword/ })).toBeInTheDocument();
    for (const letter of ["R", "o", "p"]) {
      await user.type(picker, letter);
      await pause(200);
    }

    expect(fakeApi.calls()).toEqual(["GET /items/?campaign_id=1"]);
    expect(screen.getByRole("button", { name: /Rope & Hook/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Sword/ })).not.toBeInTheDocument();
  });

  it("sends no request at all when the campaign's items are already cached (PERF-40)", async () => {
    const user = setupUser();
    const queryClient = createQueryClient();
    queryClient.setQueryData(queryKeys.campaign.catalogue(1, "items"), [ROPE, SWORD]);
    await renderPostbattle({ queryClient });

    await user.type(screen.getByPlaceholderText("Search and add an item"), "sw");

    expect(screen.getByRole("button", { name: /Sword/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Rope & Hook/ })).not.toBeInTheDocument();
    expect(fakeApi.calls()).toEqual([]);
  });
});
