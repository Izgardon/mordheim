import { Chip } from "@/components/ui/chip";
import { Field } from "@/features/campaigns/components/settings/settings-ui";

/** A row of chips picking one of a few (the source, a variant, a list's type). */
export default function ChipPick<T extends string | number>(props: {
  label: string;
  options: { key: T; name: string }[];
  value: T | null;
  onChange: (key: T) => void;
}) {
  return (
    <Field label={props.label}>
      <div role="group" aria-label={props.label} className="flex flex-wrap gap-1.5">
        {props.options.map((option) => (
          <Chip
            key={option.key}
            pressed={option.key === props.value}
            onClick={() => props.onChange(option.key)}
          >
            {option.name}
          </Chip>
        ))}
      </div>
    </Field>
  );
}
