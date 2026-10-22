import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { skillAbbrevToType } from "@/features/warbands/utils/warband-utils";

import BestiaryLinksFields from "./BestiaryLinksFields";
import {
  CasterField,
  DescriptionField,
  LargeTargetField,
  StatsField,
} from "./bestiary-core-fields";

import type { HiredSwordFormState } from "../../hooks/useHiredSwordForm";

const SKILL_TYPES = Object.values(skillAbbrevToType);

type CostKey = "hire_cost" | "upkeep_cost";
type ExpressionKey = "hire_cost_expression" | "upkeep_cost_expression";

/** A cost in gold crowns, or a dice expression for it (2D6x10). */
function CostField({
  form,
  cost,
  expression,
  label,
  idPrefix,
  costPlaceholder,
  expressionPlaceholder,
}: {
  form: HiredSwordFormState;
  cost: CostKey;
  expression: ExpressionKey;
  label: string;
  idPrefix: string;
  costPlaceholder: string;
  expressionPlaceholder: string;
}) {
  const error = form.fieldErrors[cost];
  return (
    <div className="flex gap-3">
      <div className="flex flex-1 flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-cost`}>{label}</Label>
        <Input
          id={`${idPrefix}-cost`}
          type="number"
          min={0}
          value={form.values[cost]}
          onChange={(e) => form.change({ [cost]: e.target.value })}
          aria-invalid={Boolean(error)}
          placeholder={costPlaceholder}
        />
        <FieldError message={error} />
      </div>
      <div className="flex flex-1 flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-expr`}>or Expression</Label>
        <Input
          id={`${idPrefix}-expr`}
          value={form.values[expression]}
          onChange={(e) => form.change({ [expression]: e.target.value })}
          placeholder={expressionPlaceholder}
        />
      </div>
    </div>
  );
}

/** A hired sword's fields: the entry's, its hire and upkeep costs and the skill lists it uses. */
export default function HiredSwordFormFields({ form }: { form: HiredSwordFormState }) {
  const { values, change } = form;
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="hs-name">Name</Label>
        <Input
          id="hs-name"
          value={values.name}
          onChange={(e) => change({ name: e.target.value })}
          aria-invalid={Boolean(form.fieldErrors.name)}
          placeholder="e.g. Ogre Bodyguard"
          required
        />
        <FieldError message={form.fieldErrors.name} />
      </div>

      <div className="flex gap-3">
        <CasterField values={values} onChange={change} className="flex flex-1 flex-col gap-1.5" />
      </div>

      <DescriptionField values={values} onChange={change} id="hs-desc" />

      <CostField
        form={form}
        cost="hire_cost"
        expression="hire_cost_expression"
        label="Hire Cost (gc)"
        idPrefix="hs-hire"
        costPlaceholder="e.g. 80"
        expressionPlaceholder="e.g. 2D6x10"
      />
      <CostField
        form={form}
        cost="upkeep_cost"
        expression="upkeep_cost_expression"
        label="Upkeep Cost (gc)"
        idPrefix="hs-upkeep"
        costPlaceholder="e.g. 30"
        expressionPlaceholder="e.g. D6x5"
      />

      <div className="flex flex-col gap-1.5">
        <Label>Available Skill Types</Label>
        <div className="flex flex-wrap gap-3">
          {SKILL_TYPES.map((label) => (
            <label key={label} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={values.available_skill_types.includes(label)}
                onChange={(e) => form.toggleSkillType(label, e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      <StatsField values={values} onChange={change} />
      <BestiaryLinksFields links={form.links} />
      <LargeTargetField values={values} onChange={change} />
    </>
  );
}
