import { useState } from "react";

import { NumberInput } from "@/components/ui/number-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

import {
  STAT_FIELDS,
  isWritten,
  numberOnly,
  type StatKey,
} from "@/features/catalogue/utils/statblock";

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

/**
 * The nine characteristics and the armour save, one small box each. Written values turns the nine
 * into text boxes, for one the book writes ("2D6", "-"); turning it off keeps each one's number.
 */
export function StatsField({ values, onChange }: CoreFieldProps) {
  const [written, setWritten] = useState(() =>
    STAT_FIELDS.some((field) => isWritten(values.stats[field.key]))
  );
  const setStat = (key: StatKey, value: string) =>
    onChange({ stats: { ...values.stats, [key]: value } });
  const writeNumbers = (on: boolean) => {
    if (!on) {
      const numbers = STAT_FIELDS.map(({ key }) => [key, numberOnly(values.stats[key])]);
      onChange({ stats: Object.fromEntries(numbers) as BestiaryCoreValues["stats"] });
    }
    setWritten(on);
  };
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label>Stats</Label>
        <Switch
          look="plain"
          className="min-h-5 text-xs"
          checked={written}
          onCheckedChange={writeNumbers}
        >
          Written values
        </Switch>
      </div>
      <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
        {STAT_FIELDS.map((field) => (
          <div key={field.key} className="flex flex-col items-center gap-0.5">
            <span className="text-xs font-medium text-muted-foreground">{field.label}</span>
            {written ? (
              <Input
                maxLength={8}
                value={values.stats[field.key]}
                onChange={(e) => setStat(field.key, e.target.value)}
                aria-label={field.label}
                className="h-8 w-full px-1 text-center font-mono text-sm"
              />
            ) : (
              <NumberInput
                min={0}
                max={10}
                value={values.stats[field.key]}
                onChange={(e) => setStat(field.key, e.target.value)}
                aria-label={field.label}
                className="h-8 w-full px-1 text-center text-sm"
              />
            )}
          </div>
        ))}
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-xs font-medium text-muted-foreground">AS</span>
          <Input
            value={values.armour_save}
            onChange={(e) => onChange({ armour_save: e.target.value })}
            aria-label="Armour save"
            className="h-8 w-full px-1 text-center text-sm"
            placeholder="-"
          />
        </div>
      </div>
    </div>
  );
}

export function LargeTargetField({ values, onChange }: CoreFieldProps) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={values.large}
        onChange={(e) => onChange({ large: e.target.checked })}
        className="h-4 w-4 accent-[var(--color-accent)]"
      />
      Large target
    </label>
  );
}
