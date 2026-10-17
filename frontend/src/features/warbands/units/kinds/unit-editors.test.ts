import { describe, expect, it } from "vitest";

import { heroKind, henchmenKind, hiredSwordKind } from "../unit-kinds";
import { isSet } from "./editor-helpers";

import type { RosterLimits } from "../unit-kind-types";
import {
  makeVeteranHenchmenGroup,
  makeVeteranHero,
  makeVeteranHiredSword,
} from "@/test/warband-fixtures";

const roster = (overrides: Partial<RosterLimits> = {}): RosterLimits => ({
  maxHeroes: 6,
  maxHiredSwords: 3,
  heroCount: 0,
  hiredSwordCount: 0,
  ...overrides,
});

describe("isSet", () => {
  it("treats blank and the empty value as unset", () => {
    expect(isSet("")).toBe(false);
    expect(isSet(" 0 ")).toBe(false);
    expect(isSet("5")).toBe(true);
    expect(isSet("5", "5")).toBe(false);
    expect(isSet("4", "5")).toBe(true);
  });
});

describe("hero editor limits", () => {
  const heroes = [makeVeteranHero(), makeVeteranHero({ id: 13 })];
  const forms = heroes.map(heroKind.mapToForm);
  const newForm = heroKind.editor.creation.initialForm;

  it("titles the section with the server's count outside an edit, and leaves Add enabled below the cap", () => {
    const limits = heroKind.editor.limits({
      units: heroes,
      forms: [],
      isEditing: false,
      newForm,
      roster: roster({ heroCount: 5 }),
    });

    expect(limits).toEqual({
      titleSuffix: "[5/6]",
      isCreateBlocked: false,
      isAddDisabled: false,
      addButtonNotice: undefined,
      addFormNotices: [],
      duplicateBlockedReason: expect.any(Function),
    });
  });

  it("disables Add hero and Duplicate at the cap, counting the forms in an edit (decision 12, UX-06)", () => {
    const limits = heroKind.editor.limits({
      units: heroes,
      forms,
      isEditing: true,
      newForm,
      roster: roster({ maxHeroes: 2, heroCount: 0 }),
    });

    expect(limits.titleSuffix).toBe("[2/2]");
    expect(limits.isCreateBlocked).toBe(true);
    expect(limits.isAddDisabled).toBe(true);
    expect(limits.addButtonNotice).toBe(
      "Maximum of 2 heroes reached. Dismiss one to recruit another."
    );
    expect(limits.addFormNotices).toEqual(["Maximum of 2 heroes reached."]);
    expect(limits.duplicateBlockedReason(forms[0])).toBe("Maximum of 2 heroes reached.");
  });
});

describe("henchmen editor limits", () => {
  const groups = [makeVeteranHenchmenGroup()];
  const newForm = henchmenKind.editor.creation.initialForm;
  const henchmen = groups[0].henchmen.length;

  it("counts henchmen and never blocks adding: the warband size only warns (decision 12)", () => {
    const limits = henchmenKind.editor.limits({
      units: groups,
      forms: [],
      isEditing: false,
      newForm,
      roster: roster(),
    });

    expect(limits).toEqual({
      titleSuffix: `[${henchmen}]`,
      isCreateBlocked: false,
      isAddDisabled: false,
      addFormNotices: [],
      duplicateBlockedReason: expect.any(Function),
    });
    expect(limits.duplicateBlockedReason(henchmenKind.mapToForm(groups[0]))).toBeNull();
  });
});

describe("hired-sword editor limits", () => {
  const hired = makeVeteranHiredSword();
  const pacted = makeVeteranHiredSword({ id: 32, blood_pacted: true });
  const forms = [hired, pacted].map(hiredSwordKind.mapToForm);
  const newForm = hiredSwordKind.editor.creation.initialForm;

  it("leaves blood-pacted hired swords out of the cap", () => {
    const limits = hiredSwordKind.editor.limits({
      units: [hired, pacted],
      forms,
      isEditing: true,
      newForm,
      roster: roster({ maxHiredSwords: 1, hiredSwordCount: 5 }),
    });

    expect(limits).toEqual({
      titleSuffix: "[1/1]",
      isCreateBlocked: true,
      // The form still opens: a blood-pacted hire doesn't count (BUG-102).
      isAddDisabled: false,
      addButtonNotice: "Maximum of 1 hired swords reached; a blood-pacted one can still join.",
      addFormNotices: [
        "Maximum of 1 hired swords reached. Tick Bloodpacted to add one that doesn't count.",
      ],
      duplicateBlockedReason: expect.any(Function),
    });
    // Copying a hire at the cap is refused, unless the copy is blood-pacted (ROST-NEW-01).
    expect(limits.duplicateBlockedReason(forms[0])).toMatch(/Maximum of 1 hired swords/);
    expect(limits.duplicateBlockedReason(forms[1])).toBeNull();
  });

  it("lets a blood-pacted hire through at the cap", () => {
    const limits = hiredSwordKind.editor.limits({
      units: [hired],
      forms: [hiredSwordKind.mapToForm(hired)],
      isEditing: true,
      newForm: { ...newForm, blood_pacted: true },
      roster: roster({ maxHiredSwords: 1 }),
    });

    expect(limits.isCreateBlocked).toBe(false);
    expect(limits.addFormNotices).toEqual([]);
  });
});

describe("add form draft detection", () => {
  it("ignores the add form's defaults", () => {
    expect(heroKind.editor.creation.isDraftDirty(heroKind.editor.creation.initialForm, "")).toBe(
      false
    );
    expect(
      henchmenKind.editor.creation.isDraftDirty(henchmenKind.editor.creation.initialForm, "")
    ).toBe(false);
    expect(
      hiredSwordKind.editor.creation.isDraftDirty(hiredSwordKind.editor.creation.initialForm, "")
    ).toBe(false);
  });

  it("notices typed values, a race search and a hired sword's chosen loadout", () => {
    const hero = heroKind.editor.creation.initialForm;
    expect(heroKind.editor.creation.isDraftDirty(hero, "Hum")).toBe(true);
    expect(heroKind.editor.creation.isDraftDirty({ ...hero, price: "20" }, "")).toBe(true);

    const group = henchmenKind.editor.creation.initialForm;
    expect(henchmenKind.editor.creation.isDraftDirty({ ...group, max_size: "4" }, "")).toBe(true);
    expect(
      henchmenKind.editor.creation.isDraftDirty({ ...group, firstHenchmanName: "Bolt" }, "")
    ).toBe(true);

    const hired = hiredSwordKind.editor.creation.initialForm;
    const withItem = { ...hired, items: makeVeteranHiredSword().items };
    expect(hiredSwordKind.editor.creation.isDraftDirty(withItem, "")).toBe(true);
  });
});

describe("queued recruits (decision 1)", () => {
  it("queue as forms without an id, each with its own draft key", () => {
    const hero = heroKind.editor.creation.toFormEntry(
      { ...heroKind.editor.creation.initialForm, price: "35" },
      "Gunther",
      "Champion"
    );
    const second = heroKind.editor.creation.toFormEntry(
      heroKind.editor.creation.initialForm,
      "Otto",
      "Champion"
    );

    expect(hero.id).toBeUndefined();
    expect(hero.draftKey).toMatch(/^draft-heroes-/);
    expect(second.draftKey).not.toBe(hero.draftKey);
  });

  it("cost their price, and a new group its price per member", () => {
    const group = henchmenKind.editor.creation.toFormEntry(
      { ...henchmenKind.editor.creation.initialForm, price: "25", firstHenchmanName: "Bolt" },
      "Crossbowmen",
      "Marksmen"
    );
    const twoMembers = {
      ...group,
      henchmen: [...group.henchmen, { id: 0, name: "Quarrel", kills: 0, dead: false }],
    };

    expect(henchmenKind.editor.creation.recruitCost(group)).toBe(25);
    expect(henchmenKind.editor.creation.recruitCost(twoMembers)).toBe(50);
    expect(
      heroKind.editor.creation.recruitCost(
        heroKind.editor.creation.toFormEntry(
          { ...heroKind.editor.creation.initialForm, price: "35" },
          "Gunther",
          "Champion"
        )
      )
    ).toBe(35);
  });
});
