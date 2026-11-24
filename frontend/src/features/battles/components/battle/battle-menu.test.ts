import { describe, expect, it } from "vitest";

import { battleMenu, type BattleMenuFlags } from "./battle-menu";

const flags = (over: Partial<BattleMenuFlags> = {}): BattleMenuFlags => ({
  canFinishMine: false,
  canAct: true,
  fighting: true,
  canEndForEveryone: false,
  canCancel: false,
  ...over,
});

describe("battleMenu", () => {
  it("offers no chat and no notifications (William, 18 Nov 2026)", () => {
    const labels = battleMenu(
      flags({ canFinishMine: true, canEndForEveryone: true, canCancel: true })
    ).map((row) => row.label);
    expect(labels).not.toContain("Chat");
    expect(labels).not.toContain("Notifications");
  });

  it("puts Leave battle above the rows that end it for everyone, and ends last", () => {
    const rows = battleMenu(flags({ canEndForEveryone: true }));
    expect(rows.map((row) => row.label)).toEqual([
      "Edit stats",
      "Add a unit",
      "Add a neutral group",
      "Battle notes",
      "Leave battle",
      "End the fight for everyone",
    ]);
  });

  it("leaves Leave battle its subtitle and takes its red, which End the fight takes on", () => {
    const rows = battleMenu(flags({ canEndForEveryone: true }));
    expect(rows.find((row) => row.action === "leave")).toEqual({
      action: "leave",
      label: "Leave battle",
      detail: "Back to the campaign; Rejoin brings you back",
    });
    expect(rows.find((row) => row.action === "end")?.danger).toBe(true);
  });

  it("keeps the manager's Cancel between them, red as it was", () => {
    const rows = battleMenu(flags({ canCancel: true, canEndForEveryone: true }));
    expect(rows.slice(-3).map((row) => [row.label, row.danger ?? false])).toEqual([
      ["Leave battle", false],
      ["Cancel the battle", true],
      ["End the fight for everyone", true],
    ]);
  });

  it("gives every row a line saying what it does (William, 24 Nov 2026)", () => {
    const rows = battleMenu(
      flags({ canFinishMine: true, canEndForEveryone: true, canCancel: true })
    );
    expect(rows.map((row) => [row.label, row.detail])).toEqual([
      ["End my battle", "Say how it went and go to your Aftermath; the others play on"],
      ["Edit stats", "Temporary stat changes to one of your units or groups"],
      ["Add a unit", "A temporary unit for your warband, or a creature for a neutral group"],
      ["Add a neutral group", "Monsters or bystanders nobody plays, from the bestiary or typed in"],
      ["Battle notes", "Your own notes for this fight; only you see them"],
      ["Leave battle", "Back to the campaign; Rejoin brings you back"],
      ["Cancel the battle", "For everyone; nothing is kept"],
      [
        "End the fight for everyone",
        "Pick the winners and send everyone still fighting to the Aftermath",
      ],
    ]);
  });

  it("drops what the player can't do and still offers Leave battle", () => {
    expect(battleMenu(flags({ canAct: false, fighting: false })).map((row) => row.action)).toEqual([
      "leave",
    ]);
  });
});
