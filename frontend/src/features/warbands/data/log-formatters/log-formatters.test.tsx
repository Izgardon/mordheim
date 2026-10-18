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
  it("cover every entry that has its own formatter", () => {
    expect(Object.keys(LOG_FORMATTERS).sort()).toEqual(
      [
        "advance:hero",
        "advance:henchmen",
        "advance:hired_sword",
        "trading_action:rarity roll",
        "trading_action:custom_dice_roll",
        "dice_roll:dice_roll",
        "personnel:serious_injury",
        "personnel:new_hired_sword",
        "personnel:remove_hired_sword",
        "battle:complete",
        "battle:exploration",
        "battle:finds",
        "loadout:hero_item",
        "loadout:henchmen_item",
        "loadout:stash_item",
        "loadout:hired_sword_item",
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
    expect(textOf(log("advance", "hired_sword", advance))).toBe(
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
    expect(textOf(log("personnel", "new_hired_sword", { name: "Hal" }))).toBe(
      "Hired Hal the Hired Sword"
    );
    expect(textOf(log("personnel", "remove_hired_sword", {}))).toBe(
      "Dismissed Unknown the Hired Sword"
    );
    expect(textOf(log("battle", "complete", { result: "lost", against: ["Rats"] }))).toBe(
      "Lost the battle against Rats."
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
