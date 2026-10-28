import { Input } from "@components/input";
import { Label } from "@components/label";

import { DRAMATIS_PERSONA_TERMS, HIRED_SWORD_TERMS } from "../../../../units/kinds/hireling-terms";

import type { HirelingTerms } from "../../../../types/warband-types";

type Choice<V extends string> = { value: V; label: string };

const KINDS: Choice<HirelingTerms["kind"]>[] = [
  { value: "hired_sword", label: "Hired sword" },
  { value: "dramatis_persona", label: "Dramatis persona" },
];
const INJURY_TABLES: Choice<HirelingTerms["injury_table"]>[] = [
  { value: "henchman", label: "Henchman (D6)" },
  { value: "hero", label: "Hero" },
];
const STAYS: Choice<HirelingTerms["stays"]>[] = [
  { value: "always", label: "Until dismissed" },
  { value: "one_battle", label: "One battle" },
];

const labelClassName = "text-sm font-semibold text-foreground";

function RadioChoice<V extends string>({
  legend,
  name,
  choices,
  value,
  onChange,
}: {
  legend: string;
  name: string;
  choices: Choice<V>[];
  value: V;
  onChange: (value: V) => void;
}) {
  return (
    <fieldset className="space-y-1.5">
      <legend className={labelClassName}>{legend}</legend>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {choices.map((choice) => (
          <label key={choice.value} className="flex items-center gap-1.5 text-sm">
            <input
              type="radio"
              name={name}
              value={choice.value}
              checked={value === choice.value}
              onChange={() => onChange(choice.value)}
              className="h-4 w-4"
            />
            {choice.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

type Props = {
  /** Tells one card's radio groups from another's. */
  idPrefix: string;
  terms: HirelingTerms;
  onChange: (patch: Partial<HirelingTerms>) => void;
  /** The add form picks the kind; a saved hireling keeps the one it was added as. */
  showKind: boolean;
  inputClassName?: string;
};

/**
 * What a hireling is and its terms: hired sword or dramatis persona (a new one only; a dramatis
 * persona starts on the hero injury table), the injury table (a house rule may change it), and a
 * dramatis persona's stay and pay.
 */
export default function HirelingTermsFields({
  idPrefix,
  terms,
  onChange,
  showKind,
  inputClassName,
}: Props) {
  const isPersona = terms.kind === "dramatis_persona";
  return (
    <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
      {showKind ? (
        <RadioChoice
          legend="Kind"
          name={`${idPrefix}-kind`}
          choices={KINDS}
          value={terms.kind}
          onChange={(kind) =>
            onChange({
              kind,
              injury_table: (kind === "dramatis_persona"
                ? DRAMATIS_PERSONA_TERMS
                : HIRED_SWORD_TERMS
              ).injury_table,
            })
          }
        />
      ) : null}
      <RadioChoice
        legend="Injury table"
        name={`${idPrefix}-injury-table`}
        choices={INJURY_TABLES}
        value={terms.injury_table}
        onChange={(injury_table) => onChange({ injury_table })}
      />
      {isPersona ? (
        <>
          <RadioChoice
            legend="Stays"
            name={`${idPrefix}-stays`}
            choices={STAYS}
            value={terms.stays}
            onChange={(stays) => onChange({ stays })}
          />
          <div className="min-w-[180px] flex-1 space-y-1.5">
            <Label htmlFor={`${idPrefix}-payment`} className={labelClassName}>
              Paid in
            </Label>
            <Input
              id={`${idPrefix}-payment`}
              value={terms.payment_note}
              onChange={(event) => onChange({ payment_note: event.target.value })}
              placeholder="e.g. 25 gc or 1 shard"
              className={inputClassName}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
