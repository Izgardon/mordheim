import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { STAT_FIELDS, type StatKey } from "@/features/catalogue/utils/statblock";

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
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        placeholder="Description..."
      />
    </div>
  );
}

/** The nine characteristics and the armour save, one small box each. */
export function StatsField({ values, onChange }: CoreFieldProps) {
  const setStat = (key: StatKey, value: string) =>
    onChange({ stats: { ...values.stats, [key]: value } });
  return (
    <div className="flex flex-col gap-1.5">
      <Label>Stats</Label>
      <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
        {STAT_FIELDS.map((field) => (
          <div key={field.key} className="flex flex-col items-center gap-0.5">
            <span className="text-xs font-medium text-muted-foreground">{field.label}</span>
            <Input
              type="number"
              min={0}
              max={10}
              value={values.stats[field.key]}
              onChange={(e) => setStat(field.key, e.target.value)}
              aria-label={field.label}
              className="h-8 w-full px-1 text-center text-sm"
            />
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
        className="h-4 w-4 rounded border-input"
      />
      Large target
    </label>
  );
}
