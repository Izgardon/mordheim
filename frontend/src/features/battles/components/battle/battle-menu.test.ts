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

const everything = flags({ canFinishMine: true, canEndForEveryone: true, canCancel: true });

const labels = (sections: ReturnType<typeof battleMenu>) =>
  sections.map((section) => [section.label ?? "", section.items.map((item) => item.label)]);

describe("battleMenu", () => {
  it("puts the fight's rows first, then the ones that end it under End, Cancel last (William, 25 Nov 2026)", () => {
    expect(labels(battleMenu(everything))).toEqual([
      ["", ["Edit stats", "Add a unit", "Add a creature group", "Battle notes"]],
      ["End", ["End my battle", "End the fight for everyone", "Cancel the battle"]],
    ]);
  });

  it("offers no Leave battle, chat or notifications: the back arrow leaves", () => {
    const rows = battleMenu(everything).flatMap((section) => section.items);
    const names = rows.map((row) => row.label);
    expect(names).not.toContain("Leave battle");
    expect(names).not.toContain("Chat");
    expect(names).not.toContain("Notifications");
  });

  it("gives every row a short line, calling the Aftermath Post battle", () => {
    const rows = battleMenu(everything).flatMap((section) => section.items);
    expect(rows.map((row) => [row.label, row.detail])).toEqual([
      ["Edit stats", "This battle only"],
      ["Add a unit", "Your warband or a creature group"],
      ["Add a creature group", "Monsters or bystanders"],
      ["Battle notes", "Only you see them"],
      ["End my battle", "To your Post battle; others play on"],
      ["End the fight for everyone", "Pick winners; all go to Post battle"],
      ["Cancel the battle", "For everyone; nothing is kept"],
    ]);
    expect(rows.every((row) => !/Aftermath/.test(row.detail))).toBe(true);
  });

  it("reds only the rows that end it for everyone", () => {
    const rows = battleMenu(everything).flatMap((section) => section.items);
    expect(rows.filter((row) => row.danger).map((row) => row.action)).toEqual(["end", "cancel"]);
  });

  it("leaves out a part with nothing the player can do", () => {
    expect(labels(battleMenu(flags()))).toEqual([
      ["", ["Edit stats", "Add a unit", "Add a creature group", "Battle notes"]],
    ]);
    expect(labels(battleMenu(flags({ canAct: false, fighting: false, canCancel: true })))).toEqual([
      ["End", ["Cancel the battle"]],
    ]);
    expect(battleMenu(flags({ canAct: false, fighting: false }))).toEqual([]);
  });
});
