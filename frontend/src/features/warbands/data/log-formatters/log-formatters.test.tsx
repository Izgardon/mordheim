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
  it("cover the same entries as before the split", () => {
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
});
