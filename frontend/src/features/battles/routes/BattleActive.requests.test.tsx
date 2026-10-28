/**
 * What the active page sends for End battle, out of action, kills and wounds, against a fake
 * server that keeps the participant's blob the way `/config/` does: `unit_information_patch`
 * changes only the units and fields it names, and never a kill or out of action (BUG-44).
 */
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BattleParticipant, BattleState } from "@/features/battles/types/battle-types";
import {
  BATTLE_CHANNEL,
  CAMPAIGN_ID,
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
  versionedMessage,
} from "@/test/battle-fixtures";
import { bestiaryEntry } from "@/test/catalogue-fixtures";
import { ApiError } from "@/lib/api-client";
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
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));
vi.mock("@/features/realtime/components/CampaignDiceRollerMenu", () => ({ default: () => null }));

type UnitInformation = BattleState["participants"][number]["unit_information_json"];

/** A temporary creature's profile (a Giant Rat with no profile in the bestiary yet). */
const RAT_STATS = {
  movement: 0,
  weapon_skill: 0,
  ballistic_skill: 0,
  strength: 0,
  toughness: 0,
  wounds: 0,
  initiative: 0,
  attacks: 0,
  leadership: 0,
  armour_save: null,
};

/** The server's copy of the battle; writes change it as the backend does. */
let server: BattleState;
const answer = () => structuredClone(server);
const myRow = () => server.participants.find((entry) => entry.user.id === ME.id)!;
const setMyUnitInformation = (next: UnitInformation) => {
  myRow().unit_information_json = next;
};
const myUnitWith = (killCount: number) => ({
  stats_override: {},
  notes: "",
  current_wounds: null,
  out_of_action: false,
  kill_count: killCount,
});
const myUnit = (unitKey: string) =>
  myRow().unit_information_json[unitKey] ?? {
    stats_override: {},
    notes: "",
    current_wounds: null,
    out_of_action: false,
    kill_count: 0,
  };

/** `/config/` merges each named unit's fields (`services/unit_information.py`). */
const storeConfig = (body: unknown) => {
  const patch = (body as { unit_information_patch?: Record<string, object> })
    .unit_information_patch;
  const next = { ...myRow().unit_information_json };
  for (const [unitKey, fields] of Object.entries(patch ?? {})) {
    next[unitKey] = { ...myUnit(unitKey), ...fields };
  }
  setMyUnitInformation(next);
  return answer();
};

function routeServer() {
  server = battleState({ status: "active" });
  fakeApi.on(`GET ${statePath("active")}`, () => answer());
  fakeApi.on(`GET ${battlePath("rosters/")}`, battleRosters());
  fakeApi.on(`POST ${battlePath("config/")}`, storeConfig);
  fakeApi.on(`POST ${battlePath("unit-ooa/")}`, (body: unknown) => {
    const { unit_key, out_of_action } = body as { unit_key: string; out_of_action: boolean };
    setMyUnitInformation({
      ...myRow().unit_information_json,
      [unit_key]: { ...myUnit(unit_key), out_of_action },
    });
    return answer();
  });
  fakeApi.on(`POST ${battlePath("unit-kill/")}`, (body: unknown) => {
    const { killer_unit_key } = body as { killer_unit_key: string };
    const unit = myUnit(killer_unit_key);
    setMyUnitInformation({
      ...myRow().unit_information_json,
      [killer_unit_key]: { ...unit, kill_count: unit.kill_count + 1 },
    });
    server.events = [
      ...server.events,
      battleEvent(100 + server.events.length, "unit_kill_recorded", ME.id, {
        killer: { unit_key: killer_unit_key },
      }),
    ];
    return answer();
  });
}

/** A unit's card on the page, found by the unit's name. */
const card = (unitName: string) =>
  screen.getByText(unitName).closest(".battle-card") as HTMLElement;

/** Cards render a phone row and a desktop row of the same buttons; both are in jsdom's DOM. */
const firstButton = (unitName: string, name: string | RegExp) =>
  within(card(unitName)).getAllByRole("button", { name })[0];

/** "Record kill for Rolf, 1 so far": the label names the unit and the kills (BATL-UX-05). */
const killButton = (unitName: string) =>
  firstButton(unitName, new RegExp(`^Record kill for ${unitName}, \\d+ so far$`));

const killCountOn = (unitName: string) => killButton(unitName).textContent;

async function renderActive() {
  routeServer();
  renderBattleRoute("active");
  expect(await screen.findByText("Captain Wolf")).toBeInTheDocument();
  fakeApi.clearRequests();
}

describe("BattleActive requests", () => {
  beforeEach(() => {
    fakeApi.reset();
  });

  it("marks a rider dismounted in one request and shows the answer's state (step 5)", async () => {
    const user = setupUser();
    routeServer();
    const rosters = battleRosters();
    const [wolf] = rosters[String(ME.id)].heroes;
    rosters[String(ME.id)].heroes[0] = {
      ...wolf,
      mount: {
        itemId: 140,
        name: "Warhorse",
        hasProfile: true,
        stats: null,
        movement: 8,
        ratingBonus: 5,
      },
      effectiveStats: { movement: 8, armour_save: 4 },
    };
    fakeApi.on(`GET ${battlePath("rosters/")}`, rosters);
    fakeApi.on(`POST ${battlePath("unit-dismount/")}`, (body: unknown) => {
      const { unit_key, dismounted } = body as { unit_key: string; dismounted: boolean };
      setMyUnitInformation({
        ...myRow().unit_information_json,
        [unit_key]: { ...myUnit(unit_key), dismounted },
      });
      return answer();
    });
    renderBattleRoute("active");
    expect(await screen.findByText("Captain Wolf")).toBeInTheDocument();
    fakeApi.clearRequests();

    await user.click(firstButton("Captain Wolf", "Captain Wolf: Dismounted"));

    await waitFor(() =>
      expect(firstButton("Captain Wolf", "Captain Wolf: Dismounted")).toHaveAttribute(
        "aria-pressed",
        "true"
      )
    );
    expect(fakeApi.calls()).toEqual([`POST ${battlePath("unit-dismount/")}`]);
    expect(fakeApi.bodyOf(`POST ${battlePath("unit-dismount/")}`)).toEqual({
      unit_key: "hero:1",
      dismounted: true,
    });
  });

  it("adds a creature from the bestiary mid-battle, and shows another player's as it arrives (step 5)", async () => {
    const user = setupUser();
    await renderActive();
    fakeApi.on(`GET /bestiary/?campaign_id=${CAMPAIGN_ID}`, [
      bestiaryEntry({ id: 40, name: "Wild Dog" }),
      bestiaryEntry({ id: 41, name: "Warhorse", kind: "mount" }),
    ]);
    fakeApi.on(`POST ${battlePath("config/")}`, (body: unknown) => {
      const sent = body as Pick<BattleParticipant, "custom_units_json" | "selected_unit_keys_json">;
      Object.assign(myRow(), sent);
      return answer();
    });

    await user.click(screen.getByRole("button", { name: "Add Temporary Unit" }));
    await user.click(screen.getByRole("button", { name: "Load from Bestiary" }));
    expect(await screen.findByRole("button", { name: /^Wild Dog/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Warhorse/ })).toBeNull(); // creatures only
    await user.click(screen.getByRole("button", { name: /^Wild Dog/ }));
    await user.click(screen.getByRole("button", { name: "Save temporary unit" }));

    expect(await screen.findByText("Wild Dog")).toBeInTheDocument();
    const sent = fakeApi.bodyOf(`POST ${battlePath("config/")}`) as Pick<
      BattleParticipant,
      "custom_units_json" | "selected_unit_keys_json"
    >;
    expect(sent.custom_units_json).toEqual([
      expect.objectContaining({ name: "Wild Dog", unit_type: "Creature" }),
    ]);
    expect(sent.selected_unit_keys_json).toContain(sent.custom_units_json[0].key);

    const theirs = server.participants.find((entry) => entry.user.id === OPPONENT.id)!;
    theirs.custom_units_json = [
      { key: "custom:rat", name: "Giant Rat", unit_type: "Creature", stats: RAT_STATS },
    ];
    theirs.selected_unit_keys_json = ["hero:2", "custom:rat"];
    act(() =>
      fakeRealtime.emit(
        BATTLE_CHANNEL,
        "battle.event",
        versionedMessage(null, 1, { participants: [structuredClone(theirs)] })
      )
    );
    await user.click(screen.getByRole("button", { name: "Night Razors" }));
    expect(await screen.findByText("Giant Rat")).toBeInTheDocument();
  });

  it("shows each player's place in the battle on the active page too (BATL-NEW-08)", async () => {
    await renderActive();

    const strip = screen.getByRole("region", { name: "Battle status" });
    expect(
      within(strip)
        .getAllByRole("listitem")
        .map((item) => item.textContent)
    ).toEqual(["YouIn battle", "PlayerIn battle"]);
  });

  it("says who cancelled the battle when it is cancelled under you (BATL-NEW-08)", async () => {
    await renderActive();
    const canceled = battleEvent(30, "battle_canceled", OPPONENT.id, {
      canceled_by_user_id: OPPONENT.id,
    });
    server.battle.status = "canceled";
    server.events = [canceled];

    act(() => fakeRealtime.emit(BATTLE_CHANNEL, "battle.event", socketMessage(canceled)));

    expect(await screen.findByText("Campaign overview")).toBeInTheDocument();
    expect(screen.getByText("Player cancelled Street Fight.")).toBeInTheDocument();
  });

  it("offers Finish my battle as the server's capabilities say, to the creator or not (decision 4)", async () => {
    routeServer();
    server.battle.created_by_user_id = OPPONENT.id;
    server.capabilities = {
      start: false,
      cancel: false,
      close_postbattle: false,
      edit_record: false,
      finish_mine: true,
    };
    const { unmount } = renderBattleRoute("active");
    expect(await screen.findByRole("button", { name: "Finish my battle" })).toBeInTheDocument();
    // Nobody ends the battle for everyone any more.
    expect(screen.queryByRole("button", { name: "End Battle" })).toBeNull();
    unmount();

    server.capabilities = { ...server.capabilities, finish_mine: false };
    renderBattleRoute("active");
    expect((await screen.findAllByText("Captain Wolf"))[0]).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Finish my battle" })).toBeNull();
  });

  it("finishes your fight as lost and opens your postbattle while the others play on (decision 4)", async () => {
    const user = setupUser();
    await renderActive();
    fakeApi.on(`POST ${battlePath("finish-mine/")}`, () => ({
      ...battleState({
        status: "active",
        me: { status: "finished_battle", declared_result: "lost" },
        opponent: { status: "in_battle" },
        events: [
          battleEvent(40, "participant_finished_battle", ME.id, { declared_result: "lost" }),
        ],
      }),
      rules: postbattleRules(),
      suggested_postbattle: {
        unit_results: { "hero:1": { xp_earned: 1 } },
        exploration: { dice_count: 2 },
        upkeep: { entries: {} },
      },
    }));
    fakeApi.on(`GET /warbands/${ME.warband.id}/sheet/`, mySheet());

    await user.click(screen.getByRole("button", { name: "Finish my battle" }));
    const dialog = screen.getByRole("dialog", { name: "Finish my battle" });
    expect(dialog).toHaveAccessibleDescription(/while the others play on. You can't go back/);
    const confirm = within(dialog).getByRole("button", { name: "Finish my battle" });
    expect(confirm).toBeDisabled();
    expect(
      within(dialog)
        .getAllByRole("radio")
        .map((radio) => radio.textContent)
    ).toEqual([
      "I wonYou start on the winners' side.",
      "I lostOut first, routed, or beaten.",
      "Decide when the battle endsThe last player to finish places you.",
    ]);
    await user.click(within(dialog).getByRole("radio", { name: /I lost/ }));
    await user.click(confirm);

    expect(await screen.findByLabelText("Current path")).toHaveTextContent(
      "/campaigns/1/battles/5/postbattle"
    );
    expect(fakeApi.bodyOf(`POST ${battlePath("finish-mine/")}`)).toEqual({ result: "lost" });
    // Its answer brought the suggestions and rules: two dice, and no state read for them.
    await waitFor(() => expect(screen.getAllByPlaceholderText("-")).toHaveLength(2));
    expect(fakeApi.calls().filter((call) => call.includes("state/"))).toEqual([]);
    expect(
      within(screen.getByRole("region", { name: "Battle status" }))
        .getAllByRole("listitem")
        .map((item) => item.textContent)
    ).toEqual(["YouFinished: lost", "PlayerIn battle"]);
  });

  it("makes Finish my battle the default action and keeps Cancel battle in More actions (BATL-UX-05)", async () => {
    const user = setupUser();
    await renderActive();

    // The action panel offers Finish my battle alone, as the normal path.
    expect(screen.getByRole("button", { name: "Finish my battle" })).toHaveClass("btn-primary");
    expect(screen.queryByRole("button", { name: "Cancel battle" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "More actions" }));
    const cancel = within(screen.getByRole("dialog", { name: "More actions" })).getByRole(
      "button",
      { name: "Cancel battle" }
    );
    expect(cancel).toHaveClass("btn-destructive");
    await user.click(cancel);

    expect(screen.getByRole("dialog", { name: "Cancel Battle" })).toBeInTheDocument();
    expect(fakeApi.requests()).toEqual([]);
  });

  it("describes the Record Kill, Cancel Battle and helper dialogs to screen readers (BUG-126)", async () => {
    const user = setupUser();
    await renderActive();
    const describedAs = async (opener: HTMLElement, dialogName: string, description: string) => {
      await user.click(opener);
      const dialog = screen.getByRole("dialog", { name: dialogName });
      expect(dialog).toHaveAccessibleDescription(description);
      await user.keyboard("{Escape}");
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    };

    await describedAs(
      killButton("Rolf"),
      "Record Kill",
      "Pick the enemy unit Rolf took out, or type a name."
    );
    await user.click(screen.getByRole("button", { name: "More actions" }));
    await describedAs(
      screen.getByRole("button", { name: "Cancel battle" }),
      "Cancel Battle",
      "Cancel this battle for all participants?"
    );
    await describedAs(
      screen.getByRole("button", { name: "Open melee helper" }),
      "Melee",
      "Pick your unit and an enemy unit to see the rolls needed to hit, to wound and to save in close combat."
    );
    await describedAs(
      screen.getByRole("button", { name: "Open ranged helper" }),
      "Ranged",
      "Pick your unit and the shot's modifiers to see the roll needed to hit."
    );
    await describedAs(
      screen.getByRole("button", { name: "Open critical hit reference" }),
      "Critical Hits",
      "The critical hit tables, one per weapon type."
    );
  });

  it("names the unit in every card action (BATL-UX-05)", async () => {
    await renderActive();

    for (const name of [
      "Decrease wounds for Captain Wolf",
      "Increase wounds for Captain Wolf",
      "Set Captain Wolf out of action",
      "Record kill for Captain Wolf, 0 so far",
      "Details for Captain Wolf",
      "Set Youngblood A out of action",
      "Record kill for Youngblood A, 0 so far",
      "Details for Youngbloods",
    ]) {
      expect(screen.getAllByRole("button", { name }).length).toBeGreaterThan(0);
    }
    expect(screen.queryByRole("button", { name: /^(Record kill|Set unit .*)$/ })).toBeNull();
  });

  it("offers to undo a kill just recorded, through void/ (BUG-11)", async () => {
    const user = setupUser();
    await renderActive();
    fakeApi.on(`POST ${battlePath("events/100/void/")}`, () => {
      server.events = server.events.map((event) =>
        event.id === 100 ? { ...event, voided_at: "2026-10-18T11:00:00Z" } : event
      );
      setMyUnitInformation({ ...myRow().unit_information_json, "hero:3": myUnitWith(0) });
      return answer();
    });

    await user.click(killButton("Rolf"));
    const dialog = screen.getByRole("dialog", { name: "Record Kill" });
    await user.selectOptions(within(dialog).getByRole("combobox"), "hero:2");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(killCountOn("Rolf")).toBe("1"));

    expect(await screen.findByText("Kill recorded.")).toBeInTheDocument();
    // A plain click: sonner captures the pointer on press, which jsdom lacks.
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));

    await waitFor(() => expect(killCountOn("Rolf")).toBe("0"));
    expect(fakeApi.calls()).toContain(`POST ${battlePath("events/100/void/")}`);
  });

  it("undoes your latest use of a single-use item from the unit's details (BUG-11)", async () => {
    const user = setupUser();
    routeServer();
    const rosters = battleRosters();
    rosters[String(ME.id)].heroes[0].items = [
      { id: 40, name: "Healing Draught", count: 1, singleUse: true },
    ];
    fakeApi.on(`GET ${battlePath("rosters/")}`, rosters);
    server.events = [
      battleEvent(3, "item_used", ME.id, {
        unit_key: "hero:1",
        item_id: 40,
        item_name: "Healing Draught",
      }),
    ];
    // The answer carries only the new undo event, as the server's does.
    fakeApi.on(`POST ${battlePath("events/3/void/")}`, () => ({
      ...answer(),
      events: [
        battleEvent(4, "item_used_voided", ME.id, { voided_event_id: 3, unit_key: "hero:1" }),
      ],
    }));
    renderBattleRoute("active");
    await screen.findByText("Captain Wolf");

    await user.click(firstButton("Captain Wolf", "Details for Captain Wolf"));
    expect(screen.getByText("0/1")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Undo using Healing Draught" }));

    await waitFor(() => expect(screen.getByText("1/1")).toBeInTheDocument());
    expect(fakeApi.calls()).toContain(`POST ${battlePath("events/3/void/")}`);
    expect(
      screen.queryByRole("button", { name: "Undo using Healing Draught" })
    ).not.toBeInTheDocument();
  });

  it("follows the battle to postbattle when a write is refused because it moved on (BUG-19)", async () => {
    const user = setupUser();
    await renderActive();
    // This phone slept through End battle: the server has moved on and refuses the write.
    server.battle.status = "postbattle";
    fakeApi.fail(
      `POST ${battlePath("unit-ooa/")}`,
      new ApiError("Battle is not active", 400, {
        detail: "Battle is not active",
        code: "battle_status_changed",
        status: "postbattle",
      })
    );

    await user.click(firstButton("Captain Wolf", "Set Captain Wolf out of action"));

    await waitFor(() =>
      expect(screen.getByLabelText("Current path")).toHaveTextContent(
        "/campaigns/1/battles/5/postbattle"
      )
    );
    expect(fakeApi.calls().slice(0, 2)).toEqual([
      `POST ${battlePath("unit-ooa/")}`,
      `GET ${statePath("active")}`,
    ]);
  });

  it("sends out of action and kills straight to their own endpoints, outside the config queue", async () => {
    const user = setupUser();
    await renderActive();

    await user.click(firstButton("Captain Wolf", "Set Captain Wolf out of action"));
    await user.click(killButton("Rolf"));
    const dialog = screen.getByRole("dialog", { name: "Record Kill" });
    await user.selectOptions(within(dialog).getByRole("combobox"), "hero:2");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(fakeApi.requests()).toHaveLength(2));
    expect(fakeApi.requests()).toEqual([
      {
        method: "POST",
        path: battlePath("unit-ooa/"),
        body: { unit_key: "hero:1", out_of_action: true },
      },
      {
        method: "POST",
        path: battlePath("unit-kill/"),
        body: {
          killer_unit_key: "hero:3",
          victim_unit_key: "hero:2",
          victim_name: undefined,
          notes: undefined,
          earned_xp: true,
        },
      },
    ]);
    expect(killCountOn("Rolf")).toBe("1");
    expect(
      within(card("Captain Wolf")).getByRole("button", { name: "Set Captain Wolf back in action" })
    ).toBeInTheDocument();
  });

  it("queues wound saves: one config POST at a time, then one patch with the changes made meanwhile", async () => {
    const user = setupUser();
    await renderActive();
    // The server stores the first save at once; its answer is held back.
    const firstSave = deferred<void>();
    fakeApi.on(`POST ${battlePath("config/")}`, (body: unknown) => {
      const stored = storeConfig(body);
      return firstSave.promise.then(() => stored);
    });

    await user.click(firstButton("Captain Wolf", "Decrease wounds for Captain Wolf"));
    fakeApi.on(`POST ${battlePath("config/")}`, storeConfig);
    await user.click(firstButton("Rolf", "Decrease wounds for Rolf"));
    await user.click(screen.getByRole("button", { name: "Increase wounds for Youngblood A" }));

    expect(fakeApi.countOf(`POST ${battlePath("config/")}`)).toBe(1);
    expect(fakeApi.bodyOf(`POST ${battlePath("config/")}`)).toEqual({
      unit_information_patch: { "hero:1": { current_wounds: 1 } },
    });

    await act(async () => firstSave.resolve());

    // Rolf's and the henchman's saves were merged into one patch.
    await waitFor(() => expect(fakeApi.countOf(`POST ${battlePath("config/")}`)).toBe(2));
    expect(fakeApi.bodyOf(`POST ${battlePath("config/")}`)).toEqual({
      unit_information_patch: {
        "hero:3": { current_wounds: 0 },
        "henchman:2": { current_wounds: 2 },
      },
    });
  });

  it("sends only the changed unit's fields, so a kill landing while a save waits survives (BUG-44)", async () => {
    const user = setupUser();
    await renderActive();
    const answers: Array<() => void> = [];
    fakeApi.on(`POST ${battlePath("config/")}`, (body: unknown) => {
      const stored = storeConfig(body);
      const answerLater = deferred<void>();
      answers.push(answerLater.resolve);
      return answerLater.promise.then(() => stored);
    });

    await user.click(firstButton("Captain Wolf", "Decrease wounds for Captain Wolf"));
    // Queued behind Captain Wolf's save; then the henchman, who isn't locked, takes a kill.
    await user.click(firstButton("Rolf", "Decrease wounds for Rolf"));
    await user.click(killButton("Youngblood A"));
    const dialog = screen.getByRole("dialog", { name: "Record Kill" });
    await user.selectOptions(within(dialog).getByRole("combobox"), "hero:2");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(killCountOn("Youngblood A")).toBe("1"));

    await act(async () => answers[0]());
    await waitFor(() => expect(fakeApi.countOf(`POST ${battlePath("config/")}`)).toBe(2));
    await act(async () => answers[1]());

    const configBodies = fakeApi
      .requests()
      .filter((request) => request.path === battlePath("config/"))
      .map((request) => request.body);
    expect(configBodies).toEqual([
      { unit_information_patch: { "hero:1": { current_wounds: 1 } } },
      { unit_information_patch: { "hero:3": { current_wounds: 0 } } },
    ]);
    expect(myUnit("henchman:2").kill_count).toBe(1);
    expect(killCountOn("Youngblood A")).toBe("1");
  });

  it("saves a unit's notes as that unit's patch alone, without the global saving line", async () => {
    const user = setupUser();
    await renderActive();

    await user.click(firstButton("Rolf", "Details for Rolf"));
    await user.type(screen.getByLabelText("Notes for Rolf"), "Limping");

    await waitFor(
      () =>
        expect(fakeApi.bodyOf(`POST ${battlePath("config/")}`)).toEqual({
          unit_information_patch: { "hero:3": { notes: "Limping" } },
        }),
      { timeout: 3000 }
    );
    expect(myUnit("hero:3").notes).toBe("Limping");
  });

  it("edits a unit's battle stats from its details and saves them as that unit's patch (BATL-NEW-07)", async () => {
    const user = setupUser();
    await renderActive();

    await user.click(firstButton("Captain Wolf", "Details for Captain Wolf"));
    await user.click(within(card("Captain Wolf")).getByRole("button", { name: "Edit stats" }));
    // The editor's fields follow the profile: M, WS, BS, ...
    const weaponSkill = within(card("Captain Wolf")).getAllByRole("spinbutton")[1];
    await user.clear(weaponSkill);
    await user.type(weaponSkill, "5");
    await user.click(
      within(card("Captain Wolf")).getByRole("button", { name: "Apply stat changes" })
    );

    await waitFor(() =>
      expect(fakeApi.bodyOf(`POST ${battlePath("config/")}`)).toEqual({
        unit_information_patch: { "hero:1": { stats_override: { weapon_skill: 5 } } },
      })
    );
    expect(myUnit("hero:1").stats_override).toEqual({ weapon_skill: 5 });
    expect(within(card("Captain Wolf")).getByText("Temp")).toBeInTheDocument();
  });

  it("locks a unit while its wound save waits in the queue, so no kill lands before it is sent (BUG-44)", async () => {
    const user = setupUser();
    await renderActive();
    // The server stores each save at once; the test releases the answers.
    const answers: Array<() => void> = [];
    fakeApi.on(`POST ${battlePath("config/")}`, (body: unknown) => {
      const stored = storeConfig(body);
      const answer = deferred<void>();
      answers.push(answer.resolve);
      return answer.promise.then(() => stored);
    });
    const rolfWounds = () =>
      firstButton("Rolf", "Decrease wounds for Rolf").nextElementSibling?.textContent;

    await user.click(firstButton("Captain Wolf", "Decrease wounds for Captain Wolf"));
    // Queued behind Captain Wolf's save, built from Rolf's blob as it is now.
    await user.click(firstButton("Rolf", "Decrease wounds for Rolf"));

    expect(fakeApi.countOf(`POST ${battlePath("config/")}`)).toBe(1);
    expect(killButton("Rolf")).toBeDisabled();
    expect(firstButton("Rolf", "Set Rolf out of action")).toBeDisabled();
    expect(firstButton("Rolf", "Increase wounds for Rolf")).toBeDisabled();
    expect(rolfWounds()).toBe("0");

    // Captain Wolf's answer predates Rolf's change, so it doesn't put his wound back.
    await act(async () => answers[0]());
    await waitFor(() => expect(fakeApi.countOf(`POST ${battlePath("config/")}`)).toBe(2));
    expect(rolfWounds()).toBe("0");
    expect(killButton("Rolf")).toBeDisabled();

    await act(async () => answers[1]());
    await waitFor(() => expect(killButton("Rolf")).toBeEnabled());
    await user.click(killButton("Rolf"));
    const dialog = screen.getByRole("dialog", { name: "Record Kill" });
    await user.selectOptions(within(dialog).getByRole("combobox"), "hero:2");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(killCountOn("Rolf")).toBe("1"));
    expect(myUnit("hero:3")).toMatchObject({ current_wounds: 0, kill_count: 1 });
  });
});
