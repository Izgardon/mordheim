import type { SpecialKind } from "@/components/ui/game-icons";
import { profileInputs, statsToSend, type StatInputs } from "@/features/catalogue/utils/statblock";

import type { FighterInput } from "../types/editor-types";
import type { TemplateFighter, TemplateSpellType } from "../types/template-types";
import { numberOrNull, textOf } from "./editor-ui";
import type { RuleDraft } from "./rule-draft";

/** A fighter as his form edits him: numbers as typed, his profile as written. */
export type FighterDraft = {
  kind: "hero" | "henchman";
  name: string;
  plural: string;
  raceId: number | null;
  cost: string;
  xp: string;
  min: string;
  max: string;
  groupMin: string;
  groupMax: string;
  stats: StatInputs;
  skillTypes: string[];
  spellTypes: TemplateSpellType[];
  caster: string;
  isLeader: boolean;
  large: boolean;
  gainsXp: boolean;
  promotable: boolean;
  fixedKit: string;
  lists: string[];
  rules: RuleDraft[];
};

const BLANK_STATS = profileInputs({
  movement: 4,
  weapon_skill: 3,
  ballistic_skill: 3,
  strength: 3,
  toughness: 3,
  wounds: 1,
  initiative: 3,
  attacks: 1,
  leadership: 7,
});

/** A saved fighter's draft, or a new hero's or henchman's (a human's profile to start from). */
export function fighterDraft(
  fighter: TemplateFighter | null,
  kind: "hero" | "henchman" = "hero"
): FighterDraft {
  if (!fighter) {
    return {
      kind,
      name: "",
      plural: "",
      raceId: null,
      cost: "",
      xp: kind === "hero" ? "0" : "0",
      min: "0",
      max: kind === "hero" ? "1" : "",
      groupMin: kind === "henchman" ? "1" : "",
      groupMax: kind === "henchman" ? "5" : "",
      stats: { ...BLANK_STATS },
      skillTypes: [],
      spellTypes: [],
      caster: "No",
      isLeader: false,
      large: false,
      gainsXp: true,
      promotable: true,
      fixedKit: "",
      lists: [],
      rules: [],
    };
  }
  return {
    kind: fighter.kind,
    name: fighter.name,
    plural: fighter.plural,
    raceId: fighter.race_id,
    cost: String(fighter.cost),
    xp: String(fighter.starting_xp),
    min: String(fighter.min_count),
    max: textOf(fighter.max_count),
    groupMin: textOf(fighter.group_min),
    groupMax: textOf(fighter.group_max),
    stats: profileInputs(fighter),
    skillTypes: [...fighter.skill_types],
    spellTypes: fighter.spell_types.map((spell) => ({ ...spell })),
    caster: fighter.caster,
    isLeader: fighter.is_leader,
    large: fighter.large,
    gainsXp: fighter.gains_xp,
    promotable: fighter.promotable,
    fixedKit: fighter.fixed_kit,
    lists: [...fighter.lists],
    rules: fighter.rules.map((rule) => ({
      special_id: rule.id,
      name: rule.name,
      kind: rule.kind as SpecialKind,
      category: rule.category,
      description: rule.description,
    })),
  };
}

/** What the fighter's Save sends: an empty count is "any" (most) or 0 (least), an empty cost 0. */
export function fighterInput(draft: FighterDraft): FighterInput {
  const henchman = draft.kind === "henchman";
  return {
    kind: draft.kind,
    name: draft.name.trim(),
    plural: draft.plural.trim(),
    race_id: draft.raceId,
    cost: numberOrNull(draft.cost) ?? 0,
    starting_xp: numberOrNull(draft.xp) ?? 0,
    min_count: numberOrNull(draft.min) ?? 0,
    max_count: numberOrNull(draft.max),
    group_min: henchman ? numberOrNull(draft.groupMin) : null,
    group_max: henchman ? numberOrNull(draft.groupMax) : null,
    ...statsToSend(draft.stats),
    skill_types: draft.skillTypes,
    spell_types: draft.spellTypes,
    caster: draft.caster,
    is_leader: draft.isLeader,
    large: draft.large,
    gains_xp: henchman ? draft.gainsXp : true,
    promotable: henchman ? draft.promotable : true,
    fixed_kit: draft.fixedKit.trim(),
    lists: draft.lists,
    rules: draft.rules.map((rule) =>
      rule.special_id !== null
        ? { special_id: rule.special_id }
        : {
            name: rule.name.trim(),
            description: rule.description.trim(),
            kind: rule.kind,
            category: rule.category,
          }
    ),
  };
}
