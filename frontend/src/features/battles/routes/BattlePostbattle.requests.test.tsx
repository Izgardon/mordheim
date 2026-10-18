/**
 * What the postbattle page sends: the back chevron, draft saves, the kill floor, the finalise
 * summary and the finds picker, against a fake server that stores the draft as `postbattle/` does.
 */
import { act, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BattlePostbattleState, BattleState } from "@/features/battles/types/battle-types";
import {
  ME,
  OPPONENT,
  battleEvent,
  battlePath,
  battleRosters,
  battleState,
  deferred,
  statePath,
} from "@/test/battle-fixtures";
import { createQueryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";
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
const ROPE = { id: 77, name: "Rope & Hook", type: "Miscellaneous", availabilities: [] };
const SWORD = { id: 78, name: "Sword", type: "Hand-to-hand", availabilities: [] };
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

async function renderPostbattle(options: Parameters<typeof renderBattleRoute>[1] = {}) {
  const view = renderBattleRoute("postbattle", options);
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
    await screen.findByText("Captain Wolf");

    await user.click(screen.getByRole("button", { name: "More actions" }));
    expect(
      within(screen.getByRole("dialog", { name: "More actions" }))
        .getAllByRole("button")
        .map((button) => button.textContent)
    ).toEqual(["Skip postbattle"]);
    unmount();

    renderBattleRoute("postbattle", { campaign: { permissions: ["manage_battles"] } });
    await screen.findByText("Captain Wolf");
    await user.click(screen.getByRole("button", { name: "More actions" }));
    expect(
      within(screen.getByRole("dialog", { name: "More actions" })).getByRole("button", {
        name: "Close postbattle",
      })
    ).toBeEnabled();
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
    expect(draftBodies()[0].unit_results["hired_sword:4"].dead).toBe(false);
    expect(dead()).toBeChecked();
    expect(screen.getByRole("button", { name: "Finalise Postbattle" })).toBeDisabled();

    await act(async () => held[0].release());
    await waitFor(() => expect(draftBodies()).toHaveLength(2));
    expect(draftBodies()[1].unit_results["hired_sword:4"].dead).toBe(true);
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
      within(row("Captain Wolf")).getByText(/Stat changes this battle: WS 4 → 5/)
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

  it("shows the kills that still count: Minus undoes the latest, Plus records one in postbattle (BUG-11)", async () => {
    const user = setupUser();
    fakeApi.on(`POST ${battlePath("events/5/void/")}`, () => {
      server.events = server.events.map((event) =>
        event.id === 5 ? { ...event, voided_at: "2026-10-18T11:00:00Z" } : event
      );
      return answer();
    });
    fakeApi.on(`POST ${battlePath("unit-kill/")}`, () => {
      server.events = [...server.events, killBy(6, "hero:1")];
      return answer();
    });
    await renderPostbattle();
    const kills = () => screen.getByRole("status", { name: "Captain Wolf's kills" });
    expect(kills()).toHaveTextContent("2");

    await user.click(screen.getByRole("button", { name: "Undo Captain Wolf's latest kill" }));
    const confirm = screen.getByRole("dialog", { name: "Undo kill" });
    expect(confirm).toHaveAccessibleDescription(/marked undone/);
    await user.click(within(confirm).getByRole("button", { name: "Undo kill" }));
    await waitFor(() => expect(kills()).toHaveTextContent("1"));

    await user.click(screen.getByRole("button", { name: "Add a kill for Captain Wolf" }));
    const dialog = screen.getByRole("dialog", { name: "Record Kill" });
    await user.selectOptions(within(dialog).getByRole("combobox"), "hero:2");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(kills()).toHaveTextContent("2"));

    expect(fakeApi.requests()).toEqual([
      { method: "POST", path: battlePath("events/5/void/") },
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
