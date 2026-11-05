import type { SpecialKind } from "@/components/ui/game-icons";

import type { UpgradeInput } from "../types/editor-types";
import type { TemplateUpgrade, TemplateWho } from "../types/template-types";
import { numberOrNull, textOf } from "./editor-ui";
import type { RuleDraft } from "./rule-draft";

/** An upgrade as its form edits it: its special picked or written, its numbers as typed. */
export type UpgradeDraft = {
  id?: number;
  group: string;
  rule: RuleDraft | null;
  cost: string;
  costNote: string;
  note: string;
  who: TemplateWho;
  whoText: string;
  most: string;
  laterDouble: boolean;
  atRecruit: boolean;
};

export const upgradeDraft = (upgrade: TemplateUpgrade | null, group = ""): UpgradeDraft =>
  upgrade
    ? {
        id: upgrade.id,
        group: upgrade.group,
        rule: {
          special_id: upgrade.special_id,
          name: upgrade.name,
          kind: upgrade.kind as SpecialKind,
          category: upgrade.category,
          description: upgrade.description,
        },
        cost: textOf(upgrade.cost),
        costNote: upgrade.cost_note,
        note: upgrade.note,
        who: upgrade.who,
        whoText: upgrade.who_text,
        most: textOf(upgrade.max_per_fighter),
        laterDouble: upgrade.later_double,
        atRecruit: upgrade.at_recruit,
      }
    : {
        group,
        rule: null,
        cost: "",
        costNote: "",
        note: "",
        who: {},
        whoText: "",
        most: "",
        laterDouble: false,
        atRecruit: false,
      };

/**
 * The draft with `rule` picked: a priced special's price becomes the cost, unless a cost of
 * another was typed (an empty one, or the last pick's own, is the default the pick replaces).
 */
export function withRule(draft: UpgradeDraft, rule: RuleDraft | null): UpgradeDraft {
  const defaulted = draft.cost.trim() === "" || draft.cost === textOf(draft.rule?.cost);
  const cost = rule?.cost;
  return {
    ...draft,
    rule,
    ...(defaulted && cost !== null && cost !== undefined ? { cost: String(cost) } : {}),
  };
}

/** What an upgrade sends: its cost empty for none in the book, 0 for free. */
export function upgradeInput(draft: UpgradeDraft): UpgradeInput | null {
  const { rule } = draft;
  if (!rule) return null;
  return {
    ...(draft.id !== undefined ? { id: draft.id } : {}),
    group: draft.group.trim(),
    rule:
      rule.special_id !== null
        ? { special_id: rule.special_id }
        : {
            name: rule.name.trim(),
            description: rule.description.trim(),
            kind: rule.kind,
            category: rule.category,
          },
    cost: numberOrNull(draft.cost),
    cost_note: draft.costNote.trim(),
    note: draft.note.trim(),
    who: draft.who,
    max_per_fighter: numberOrNull(draft.most),
    later_double: draft.laterDouble,
    at_recruit: draft.atRecruit,
  };
}

/** The saved upgrades as a save resends them (each keeping its row). */
export const savedUpgrades = (upgrades: TemplateUpgrade[]) =>
  upgrades
    .map((upgrade) => upgradeInput(upgradeDraft(upgrade)))
    .filter((row): row is UpgradeInput => row !== null);
