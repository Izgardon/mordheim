/**
 * What the active page sends for End battle, out of action, kills and wounds, against a fake
 * server that keeps the participant's blob the way `/config/` does today (whole-blob replace).
 */
import { act, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BattleState } from "@/features/battles/types/battle-types";
import {
  ME,
  OPPONENT,
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
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));
vi.mock("@/features/realtime/components/CampaignDiceRollerMenu", () => ({ default: () => null }));

type UnitInformation = BattleState["participants"][number]["unit_information_json"];

/** The server's copy of the battle; writes change it as the backend does. */
let server: BattleState;
const answer = () => structuredClone(server);
const myRow = () => server.participants.find((entry) => entry.user.id === ME.id)!;
const setMyUnitInformation = (next: UnitInformation) => {
  myRow().unit_information_json = next;
};
const myUnit = (unitKey: string) =>
  myRow().unit_information_json[unitKey] ?? {
    stats_override: {},
    notes: "",
    current_wounds: null,
    out_of_action: false,
    kill_count: 0,
  };

/** `/config/` replaces the whole blob with the one sent (`lifecycle.py:564-568`). */
const storeConfig = (body: unknown) => {
  setMyUnitInformation((body as { unit_information_json: UnitInformation }).unit_information_json);
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
    return answer();
  });
}

/** A unit's card on the page, found by the unit's name. */
const card = (unitName: string) =>
  screen.getByText(unitName).closest(".battle-card") as HTMLElement;

/** Cards render a phone row and a desktop row of the same buttons; both are in jsdom's DOM. */
const firstButton = (unitName: string, name: string | RegExp) =>
  within(card(unitName)).getAllByRole("button", { name })[0];

const killCountOn = (unitName: string) => firstButton(unitName, "Record kill").textContent;

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

  it("can't end the battle without a winner: no 'No winner', Confirm disabled until one is ticked (decision 8, pinned; flips in PR A)", async () => {
    const user = setupUser();
    await renderActive();
    fakeApi.on(`POST ${battlePath("finish/")}`, () =>
      battleState({ status: "postbattle", winner_warband_ids_json: [OPPONENT.warband.id] })
    );

    await user.click(screen.getByRole("button", { name: "End Battle" }));
    const dialog = screen.getByRole("dialog", { name: "End Active Battle" });
    const confirm = within(dialog).getByRole("button", { name: "End battle" });

    expect(
      within(dialog)
        .getAllByRole("checkbox")
        .map((box) => box.closest("label")?.textContent)
    ).toEqual(["Iron Vultures", "Night Razors"]);
    expect(within(dialog).queryByText(/no winner/i)).not.toBeInTheDocument();
    expect(confirm).toBeDisabled();

    await user.click(within(dialog).getByRole("checkbox", { name: "Night Razors" }));
    expect(confirm).toBeEnabled();
    await user.click(confirm);

    expect(fakeApi.requests()[0]).toEqual({
      method: "POST",
      path: battlePath("finish/"),
      body: { winner_warband_ids: [OPPONENT.warband.id] },
    });
    expect(await screen.findByLabelText("Current path")).toHaveTextContent(
      "/campaigns/1/battles/5/postbattle"
    );
  });

  it("sends out of action and kills straight to their own endpoints, outside the config queue", async () => {
    const user = setupUser();
    await renderActive();

    await user.click(firstButton("Captain Wolf", "Set unit out of action"));
    await user.click(firstButton("Rolf", "Record kill"));
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
      within(card("Captain Wolf")).getByRole("button", { name: "Set unit back in action" })
    ).toBeInTheDocument();
  });

  it("queues wound saves: one config POST at a time, then only the latest whole blob", async () => {
    const user = setupUser();
    await renderActive();
    // The server stores the first save at once; its answer is held back.
    const firstSave = deferred<void>();
    fakeApi.on(`POST ${battlePath("config/")}`, (body: unknown) => {
      const stored = storeConfig(body);
      return firstSave.promise.then(() => stored);
    });

    await user.click(firstButton("Captain Wolf", "Decrease wounds"));
    fakeApi.on(`POST ${battlePath("config/")}`, storeConfig);
    await user.click(firstButton("Rolf", "Decrease wounds"));
    await user.click(screen.getByRole("button", { name: "Increase wounds for Youngblood A" }));

    expect(fakeApi.countOf(`POST ${battlePath("config/")}`)).toBe(1);
    expect(fakeApi.bodyOf(`POST ${battlePath("config/")}`)).toEqual({
      selected_unit_keys_json: ["hero:1", "hero:3", "henchman:2", "hired_sword:4"],
      unit_information_json: {
        "hero:1": {
          stats_override: {},
          notes: "",
          current_wounds: 1,
          out_of_action: false,
          kill_count: 0,
        },
      },
      custom_units_json: [],
      battle_notes: "",
    });

    await act(async () => firstSave.resolve());

    // Rolf's save was replaced by the henchman's, which carries both changes.
    await waitFor(() => expect(fakeApi.countOf(`POST ${battlePath("config/")}`)).toBe(2));
    const latest = fakeApi.bodyOf(`POST ${battlePath("config/")}`) as {
      unit_information_json: UnitInformation;
    };
    expect(
      Object.fromEntries(
        Object.entries(latest.unit_information_json).map(([key, entry]) => [
          key,
          entry.current_wounds,
        ])
      )
    ).toEqual({ "hero:1": 1, "hero:3": 0, "henchman:2": 2 });
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
    const rolfWounds = () => firstButton("Rolf", "Decrease wounds").nextElementSibling?.textContent;

    await user.click(firstButton("Captain Wolf", "Decrease wounds"));
    // Queued behind Captain Wolf's save, built from Rolf's blob as it is now.
    await user.click(firstButton("Rolf", "Decrease wounds"));

    expect(fakeApi.countOf(`POST ${battlePath("config/")}`)).toBe(1);
    for (const action of ["Record kill", "Set unit out of action", "Increase wounds"]) {
      expect(firstButton("Rolf", action)).toBeDisabled();
    }
    expect(rolfWounds()).toBe("0");

    // Captain Wolf's answer predates Rolf's change, so it doesn't put his wound back.
    await act(async () => answers[0]());
    await waitFor(() => expect(fakeApi.countOf(`POST ${battlePath("config/")}`)).toBe(2));
    expect(rolfWounds()).toBe("0");
    expect(firstButton("Rolf", "Record kill")).toBeDisabled();

    await act(async () => answers[1]());
    await waitFor(() => expect(firstButton("Rolf", "Record kill")).toBeEnabled());
    await user.click(firstButton("Rolf", "Record kill"));
    const dialog = screen.getByRole("dialog", { name: "Record Kill" });
    await user.selectOptions(within(dialog).getByRole("combobox"), "hero:2");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(killCountOn("Rolf")).toBe("1"));
    expect(myUnit("hero:3")).toMatchObject({ current_wounds: 0, kill_count: 1 });
  });
});
