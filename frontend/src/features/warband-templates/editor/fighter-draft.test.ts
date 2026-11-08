import { describe, expect, it } from "vitest";

import { makeEditorFighter, makeEditorTemplate } from "@/test/template-editor-fixtures";

import { fighterDraft, fighterInput } from "./fighter-draft";

describe("a fighter's save", () => {
  it("sends his profile as typed, an empty most as any, and his rules picked or written", () => {
    const [champion] = makeEditorTemplate().fighters;
    const draft = fighterDraft(champion);
    draft.stats = { ...draft.stats, attacks: "1(2)", movement: "D6" };
    draft.max = "";
    draft.rules = [
      ...draft.rules,
      {
        special_id: null,
        name: " Lantern Bearer ",
        kind: "boon",
        category: "body",
        description: "Sees far.",
      },
    ];
    const sent = fighterInput(draft);
    expect([sent.attacks, sent.movement, sent.strength]).toEqual(["1(2)", "D6", "3"]);
    expect(sent.max_count).toBeNull();
    expect(sent.group_min).toBeNull(); // a hero is never a group
    expect(sent.rules).toEqual([
      { special_id: 40 },
      { name: "Lantern Bearer", description: "Sees far.", kind: "boon", category: "body" },
    ]);
  });

  it("sends the skills he starts with by id, none for a new fighter", () => {
    const champion = makeEditorFighter({ skills: [{ id: 5, name: "Hunter", description: "" }] });
    expect(fighterInput(fighterDraft(champion)).skill_ids).toEqual([5]);
    expect(fighterInput(fighterDraft(null)).skill_ids).toEqual([]);
  });

  it("starts a new henchman in groups of 1–5", () => {
    const sent = fighterInput({ ...fighterDraft(null, "henchman"), name: "Hound", cost: "15" });
    expect([sent.kind, sent.cost, sent.group_min, sent.group_max, sent.max_count]).toEqual([
      "henchman",
      15,
      1,
      5,
      null,
    ]);
  });
});
