import type { Dice } from "@/lib/dice";

import { CatalogueField, TEXTAREA_CLASS, fieldId, type FormLayout } from "./form-layout";

/** The dice a pre-battle roll may throw: the ones the server takes (core/models.py). */
export const PREBATTLE_DICE: Dice[] = ["D3", "D6", "2D6", "3D6", "D66"];

/** A rule's pre-battle roll as a form holds it: its dice ("" for none) and what the roll does. */
export type PrebattleRollValues = { prebattleRoll: string; prebattleText: string };

export const prebattleValuesOf = (entry?: {
  prebattle_roll?: string;
  prebattle_text?: string;
}): PrebattleRollValues => ({
  prebattleRoll: entry?.prebattle_roll ?? "",
  prebattleText: entry?.prebattle_text ?? "",
});

/** What a save sends: the dice and the trimmed text. */
export const prebattlePayload = (values: PrebattleRollValues) => ({
  prebattle_roll: values.prebattleRoll,
  prebattle_text: values.prebattleText.trim(),
});

type PrebattleRollFieldsProps = {
  layout: FormLayout;
  /** Tells one form's ids from another's ("skill-5"). */
  idPrefix: string;
  values: PrebattleRollValues;
  onChange: (values: PrebattleRollValues) => void;
};

/**
 * A skill's (or special's, or item rule's) pre-battle roll: the dice, and the rule's words on
 * what the roll does. The pre-battle step shows them under each unit holding the rule.
 */
export default function PrebattleRollFields({
  layout,
  idPrefix,
  values,
  onChange,
}: PrebattleRollFieldsProps) {
  const rollId = `${idPrefix}-prebattle-roll`;
  const textId = `${idPrefix}-prebattle-text`;
  const current = { prebattleRoll: values.prebattleRoll, prebattleText: values.prebattleText };
  return (
    <>
      <CatalogueField layout={layout} label="Pre-battle roll" htmlFor={rollId}>
        <select
          id={fieldId(layout, rollId)}
          value={values.prebattleRoll}
          onChange={(event) => onChange({ ...current, prebattleRoll: event.target.value })}
          className="h-9 w-full max-w-[160px] border border-strong bg-page px-2 text-sm text-ink md:h-11"
        >
          <option value="">None</option>
          {PREBATTLE_DICE.map((dice) => (
            <option key={dice} value={dice}>
              {dice}
            </option>
          ))}
        </select>
      </CatalogueField>
      <CatalogueField layout={layout} label="What the roll does" htmlFor={textId}>
        <textarea
          id={fieldId(layout, textId)}
          value={values.prebattleText}
          onChange={(event) => onChange({ ...current, prebattleText: event.target.value })}
          rows={3}
          maxLength={2000}
          className={TEXTAREA_CLASS[layout].replace(/min-h-\[\d+px\]/, "min-h-[72px]")}
        />
      </CatalogueField>
    </>
  );
}
