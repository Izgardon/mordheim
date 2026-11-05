import type { BasicsInput } from "../types/editor-types";
import type { WarbandTemplate } from "../types/template-types";
import { numberOrNull, textOf } from "./editor-ui";

/** A variant as Basics edits it: its terms as typed, and whether it is new (its key still free). */
export type VariantDraft = {
  key: string;
  name: string;
  gold: string;
  size: string;
  bonus: string;
  /** The terms Basics doesn't edit, kept as they are (the Kurgan's items spared the -1). */
  rest: { rare_bonus_except?: string[] };
  isNew: boolean;
};

export type TypeDraft = { id: number; name: string; variant: string };

export type BasicsDraft = {
  name: string;
  settingId: number | null;
  gold: string;
  size: string;
  variants: VariantDraft[];
  types: TypeDraft[];
};

export function basicsDraft(template: WarbandTemplate): BasicsDraft {
  return {
    name: template.name,
    settingId: template.setting_id,
    gold: textOf(template.starting_gold),
    size: textOf(template.max_models),
    variants: template.variants.map((variant) => ({
      key: variant.key,
      name: variant.name,
      gold: textOf(variant.starting_gold),
      size: textOf(variant.max_models),
      bonus: textOf(variant.rare_bonus),
      rest: variant.rare_bonus_except ? { rare_bonus_except: variant.rare_bonus_except } : {},
      isNew: false,
    })),
    types: template.types.map((type) => ({ id: type.id, name: type.name, variant: type.variant })),
  };
}

/** A new variant's key from its name ("The Hung" → "the-hung"). */
export const variantKey = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

/** What Basics' Save sends; a type presetting a variant taken out is picked when raising. */
export function basicsInput(draft: BasicsDraft): BasicsInput {
  const variants = draft.variants
    .map((variant) => ({
      ...variant,
      key: variant.isNew ? variantKey(variant.key || variant.name) : variant.key,
    }))
    .filter((variant) => variant.key && variant.name.trim());
  const keys = new Set(variants.map((variant) => variant.key));
  return {
    name: draft.name.trim(),
    setting_id: draft.settingId,
    starting_gold: numberOrNull(draft.gold),
    max_models: numberOrNull(draft.size),
    variants: variants.map((variant) => {
      const gold = numberOrNull(variant.gold);
      const size = numberOrNull(variant.size);
      const bonus = numberOrNull(variant.bonus);
      return {
        key: variant.key,
        name: variant.name.trim(),
        ...(gold !== null ? { starting_gold: gold } : {}),
        ...(size !== null ? { max_models: size } : {}),
        ...(bonus !== null && bonus !== 0 ? { rare_bonus: bonus } : {}),
        ...variant.rest,
      };
    }),
    types: draft.types.map((type) => ({
      id: type.id,
      variant: keys.has(type.variant) ? type.variant : "",
    })),
  };
}

/** What a variant taken out takes with it: its own rules and list lines. */
export function variantLoss(template: WarbandTemplate, key: string) {
  const rules = template.rules.filter((rule) => rule.variant === key).length;
  const lines = template.lists.flatMap((list) => list.lines).filter((line) => line.variant === key);
  return { rules, lines: lines.length };
}

const counted = (count: number, noun: string) =>
  count === 1 ? noun : count ? `${count} ${noun}s` : "";

/** "Its own rule goes with it.", "Its own 2 rules and list line go with it.", or "" for none. */
export function lossNote(loss: { rules: number; lines: number }) {
  const parts = [counted(loss.rules, "rule"), counted(loss.lines, "list line")].filter(Boolean);
  const one = loss.rules + loss.lines === 1;
  return parts.length ? `Its own ${parts.join(" and ")} ${one ? "goes" : "go"} with it.` : "";
}
