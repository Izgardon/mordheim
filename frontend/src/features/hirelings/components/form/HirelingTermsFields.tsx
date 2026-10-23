import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OptionField } from "@/features/bestiary/components/form/bestiary-core-fields";

import { HIRELING_SKILL_TYPES } from "../../utils/hireling-form";

import type { HirelingProfileFormState } from "../../hooks/useHirelingProfileForm";
import type { HirelingProfileValues } from "../../utils/hireling-form";
import type { HirelingStays } from "../../types/hireling-catalogue-types";

type TextKey = keyof Pick<
  HirelingProfileValues,
  | "hire_cost"
  | "hire_cost_expression"
  | "upkeep_cost"
  | "upkeep_cost_expression"
  | "rating"
  | "payment_note"
>;

/** One labelled input of the terms, with the server's refusal under it. */
function TermField({
  form,
  field,
  label,
  placeholder,
  numeric = false,
}: {
  form: HirelingProfileFormState;
  field: TextKey;
  label: string;
  placeholder: string;
  numeric?: boolean;
}) {
  const id = `hireling-${field.replace(/_/g, "-")}`;
  const error = form.fieldErrors[field];
  return (
    <div className="flex min-w-[140px] flex-1 flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={numeric ? "number" : "text"}
        min={numeric ? 0 : undefined}
        value={form.values[field]}
        onChange={(event) => form.change({ [field]: event.target.value })}
        aria-invalid={Boolean(error)}
        placeholder={placeholder}
      />
      <FieldError message={error} />
    </div>
  );
}

const STAYS: { value: HirelingStays; label: string }[] = [
  { value: "always", label: "Until dismissed" },
  { value: "one_battle", label: "One battle" },
];

/** A dramatis persona's terms: how long he stays, and what he is paid in. */
function PersonaTerms({ form }: { form: HirelingProfileFormState }) {
  const stays = STAYS.find((option) => option.value === form.values.stays) ?? STAYS[0];
  return (
    <div className="flex flex-wrap gap-3">
      <OptionField
        label="Stays"
        value={stays.label}
        options={STAYS.map((option) => option.label)}
        onChange={(label) =>
          form.change({ stays: STAYS.find((option) => option.label === label)?.value })
        }
        className="flex min-w-[140px] flex-1 flex-col gap-1.5"
      />
      <TermField
        form={form}
        field="payment_note"
        label="Paid in"
        placeholder="e.g. 25 gc or 1 shard"
      />
    </div>
  );
}

/**
 * The hire terms: the fee and the upkeep, each in gold or as a formula ("2D6x10", "1 piece of
 * wyrdstone"), the rating, the skill lists, and a dramatis persona's terms.
 */
export default function HirelingTermsFields({ form }: { form: HirelingProfileFormState }) {
  const { values } = form;
  // The usual lists, and any the entry already learns from (a hired sword's special skills).
  const skillTypes = [
    ...HIRELING_SKILL_TYPES,
    ...values.available_skill_types.filter((type) => !HIRELING_SKILL_TYPES.includes(type)),
  ];
  return (
    <>
      <div className="flex flex-wrap gap-3">
        <TermField
          form={form}
          field="hire_cost"
          label="Hire cost (gc)"
          placeholder="e.g. 80"
          numeric
        />
        <TermField
          form={form}
          field="hire_cost_expression"
          label="or hire formula"
          placeholder="e.g. 2D6x10"
        />
      </div>
      <div className="flex flex-wrap gap-3">
        <TermField
          form={form}
          field="upkeep_cost"
          label="Upkeep (gc)"
          placeholder="e.g. 30"
          numeric
        />
        <TermField
          form={form}
          field="upkeep_cost_expression"
          label="or upkeep formula"
          placeholder="e.g. 1 piece of wyrdstone"
        />
        <TermField form={form} field="rating" label="Rating" placeholder="e.g. 25" numeric />
      </div>
      {form.config.hasPersonaTerms ? <PersonaTerms form={form} /> : null}
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">Skill lists</legend>
        <div className="flex flex-wrap gap-3">
          {skillTypes.map((type) => (
            <label key={type} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={values.available_skill_types.includes(type)}
                onChange={(event) => form.toggleSkillType(type, event.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              {type}
            </label>
          ))}
        </div>
      </fieldset>
    </>
  );
}
