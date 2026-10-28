import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LOG_FORMATTERS } from ".";

import type { WarbandLog } from "../../types/warband-types";

const log = (feature: string, entryType: string, payload: Record<string, unknown>): WarbandLog => ({
  id: 1,
  warband_id: 9,
  parent_id: null,
  feature,
  entry_type: entryType,
  payload,
  created_at: "2026-10-01T10:00:00Z",
});

/** The text a log entry renders. */
const textOf = (entry: WarbandLog) => {
  const formatter = LOG_FORMATTERS[`${entry.feature}:${entry.entry_type}`];
  const { container } = render(<p>{formatter(entry)}</p>);
  return container.textContent;
};

describe("log formatters, by feature", () => {
  it("say what pass 3's battle entries record: no winner, kept stats, lost items, warnings", () => {
    expect(
      textOf(log("battle", "complete", { result: "no_winner", with: [], against: ["Rats"] }))
    ).toBe("The battle against Rats ended with no winner.");
    expect(
      textOf(
        log("personnel", "stats_kept", {
          unit_name: "Captain Wolf",
          changes: {
            weapon_skill: { before: 4, after: 5 },
            armour_save: { before: null, after: "4+" },
          },
        })
      )
    ).toBe("Captain Wolf kept the battle's stat changes: WS 4 → 5, AS - → 4+.");
    expect(
      textOf(
        log("battle", "items_lost", {
          units: [
            { unit_name: "Rolf", items: ["Sword", "Shield"] },
            { unit_name: "Youngblood A", items: ["Club"] },
          ],
        })
      )
    ).toBe("Lost with the dead: Rolf (Sword, Shield); Youngblood A (Club).");
    expect(
      textOf(
        log("battle", "mounts_lost", {
          mounts: [
            { unit_name: "Aldric", mount: "Warhorse", roll: 2 },
            { unit_name: "Outrider", mount: "Horse", roll: null },
          ],
        })
      )
    ).toBe("Mounts lost after the battle: Aldric's Warhorse (rolled 2); Outrider's Horse.");
    expect(
      textOf(
        log("battle", "warnings", {
          warnings: [{ code: "unusual_xp", message: "Captain Wolf earned 14 XP in one battle." }],
        })
      )
    ).toBe("Went ahead despite: Captain Wolf earned 14 XP in one battle.");
    expect(
      textOf(
        log("battle", "exploration", {
          dice: [3, 4],
          amount: 2,
          resource: "Treasure",
          rerolls: [[1, 2]],
        })
      )
    ).toBe("Exploration rolls: 3, 4, finding 2 Treasure (rolled again once).");
    expect(
      textOf(
        log("personnel", "serious_injury", {
          unit_name: "Rolf",
          roll_type: "d66",
          rolls: [3, 4],
          result_code: "34",
          result_label: "Arm Wound",
          apply_by_hand: true,
        })
      )
    ).toContain("(apply by hand)");
  });

  it("cover every entry that has its own formatter", () => {
    expect(Object.keys(LOG_FORMATTERS).sort()).toEqual(
      [
        "advance:hero",
        "advance:henchmen",
        "advance:hireling",
        "trading_action:rarity roll",
        "trading_action:custom_dice_roll",
        "dice_roll:dice_roll",
        "personnel:serious_injury",
        "personnel:stats_kept",
        "personnel:new_hireling",
        "personnel:remove_hireling",
        "battle:complete",
        "battle:exploration",
        "battle:finds",
        "battle:items_lost",
        "battle:mounts_lost",
        "battle:warnings",
        "loadout:hero_item",
        "loadout:henchmen_item",
        "loadout:stash_item",
        "loadout:hireling_item",
        "items:sold",
        "items:moved",
        "items:discarded",
        "trade:completed",
      ].sort()
    );
  });

  it("name a missing hero or hired sword by kind in a level-up", () => {
    const advance = { advance: { id: "ws", label: "+1 WS" } };
    expect(textOf(log("advance", "hero", advance))).toBe(
      "Unknown Hero levelled up and gained a +1 WS"
    );
    expect(textOf(log("advance", "hireling", advance))).toBe(
      "Unknown Hired Sword levelled up and gained a +1 WS"
    );
    expect(textOf(log("advance", "henchmen", { group: "Knives", advance: "+1 BS" }))).toBe(
      "Knives levelled up and gained +1 BS"
    );
  });

  it("read the dice roller's and a custom trading roll's entries alike", () => {
    const roll = { warband: "Wolves", dice: "d6", rolls: [3, 4], reason: "Wyrdstone" };
    const expected = "Wolves rolled 3, 4 (D6) = 7 (Wyrdstone)";
    expect(textOf(log("dice_roll", "dice_roll", roll))).toBe(expected);
    expect(textOf(log("trading_action", "custom_dice_roll", roll))).toBe(expected);
  });

  it("say who joined or left, and how a battle went", () => {
    expect(textOf(log("personnel", "new_hireling", { name: "Hal" }))).toBe(
      "Hired Hal the Hired Sword"
    );
    expect(textOf(log("personnel", "remove_hireling", {}))).toBe(
      "Dismissed Unknown the Hired Sword"
    );
    expect(textOf(log("battle", "complete", { result: "lost", against: ["Rats"] }))).toBe(
      "Lost the battle against Rats."
    );
  });

  it('name a hire that kept its type as its name once (step 2 browser check: "Hired Old Prospector the Old Prospector")', () => {
    const prospector = { name: "Old Prospector", type: "Old Prospector" };
    expect(textOf(log("personnel", "new_hireling", prospector))).toBe("Hired Old Prospector");
    expect(textOf(log("personnel", "remove_hireling", prospector))).toBe(
      "Dismissed Old Prospector"
    );
    expect(textOf(log("personnel", "new_hireling", { name: "Grukk", type: "Ogre" }))).toBe(
      "Hired Grukk the Ogre"
    );
  });

  it("read the server's entries for item sales, moves and discards", () => {
    const sale = { item: "Sword", quantity: 2, price: 10, source_type: "stash", source_name: null };
    expect(textOf(log("items", "sold", sale))).toBe("Sold Sword x 2 from the stash(10 gc)");
    expect(
      textOf(
        log("items", "sold", { ...sale, quantity: 1, source_type: "hero", source_name: "Aldric" })
      )
    ).toBe("Sold Sword from Aldric(10 gc)");
    const move = {
      item: "Rope",
      quantity: 1,
      source_type: "stash",
      source_name: null,
      target_type: "henchmen_group",
      target_name: null,
    };
    expect(textOf(log("items", "moved", move))).toBe(
      "Moved Rope from the stash to a henchmen group"
    );
    expect(textOf(log("items", "discarded", { item: "Rope", quantity: 3 }))).toBe(
      "Discarded Rope x 3"
    );
  });

  it("say what a completed trade sent and received", () => {
    const trade = {
      partner: "Rats",
      sent: { gold: 30, items: [{ item: "Sword", quantity: 2 }] },
      received: { gold: 0, items: [] },
    };
    expect(textOf(log("trade", "completed", trade))).toBe(
      "Traded with Rats: sent 30 gc, Sword x 2; received nothing"
    );
  });
});
