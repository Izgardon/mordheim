import { CheckboxField } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatBoxes } from "@/components/ui/stat-boxes";

import { STAT_FIELDS } from "@/features/catalogue/utils/statblock";

import { CASTER_OPTIONS, type BestiaryCoreValues } from "../../utils/bestiary-form";

type CoreFieldProps = {
  values: BestiaryCoreValues;
  onChange: (patch: Partial<BestiaryCoreValues>) => void;
};

/** A labelled select of `options` (an entry's type, its caster). */
export function OptionField({
  label,
  value,
  options,
  onChange,
  className = "flex flex-col gap-1.5",
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Whether the entry casts, and as what. */
export function CasterField({
  values,
  onChange,
  className,
}: CoreFieldProps & { className?: string }) {
  return (
    <OptionField
      label="Caster"
      value={values.caster}
      options={CASTER_OPTIONS}
      onChange={(caster) => onChange({ caster })}
      className={className}
    />
  );
}

export function DescriptionField({ values, onChange, id }: CoreFieldProps & { id: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>Description</Label>
      <textarea
        id={id}
        value={values.description}
        onChange={(e) => onChange({ description: e.target.value })}
        rows={3}
        className="min-h-[120px] w-full border border-strong bg-page px-3 py-2 text-sm text-ink placeholder:text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      />
    </div>
  );
}

/** The nine characteristics, then the armour save. */
const PROFILE_BOXES = [...STAT_FIELDS, { key: "armour_save", label: "Sv" }] as const;

/**
 * The nine characteristics and the armour save, a type box each: a number or the value as the
 * book writes it ("2D6", "-"), which the server reads.
 */
export function StatsField({ values, onChange }: CoreFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>Stats</Label>
      <StatBoxes
        fields={PROFILE_BOXES}
        values={{ ...values.stats, armour_save: values.armour_save }}
        name={(label) => (label === "Sv" ? "Armour save" : label)}
        onChange={({ armour_save, ...stats }) =>
          onChange({
            stats: { ...values.stats, ...stats },
            ...(armour_save === undefined ? {} : { armour_save }),
          })
        }
      />
    </div>
  );
}

/** Large target, beside the caster's select in the row and lined up with it. */
export function LargeTargetField({ values, onChange }: CoreFieldProps) {
  return (
    <CheckboxField
      inline
      checked={values.large}
      onChange={(e) => onChange({ large: e.target.checked })}
    >
      Large target
    </CheckboxField>
  );
}
