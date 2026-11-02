import { cn } from "@/lib/utils";

export type Choice<T extends string> = { value: T; label: string };

/**
 * A dropdown for a result with more than one outcome (William: "options with multiple should just
 * have a dropdown as well even if rolling"): S or A, WS or BS, a skill, a spell or a boon or bane.
 * A roll presets it; it can always be changed.
 */
export default function ChoiceSelect<T extends string>({
  label,
  value,
  choices,
  onChange,
  className,
}: {
  /** Its name for a screen reader ("Characteristic"). */
  label: string;
  value: T | null;
  choices: Choice<T>[];
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <select
      aria-label={label}
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value as T)}
      className={cn(
        "min-h-9 border border-strong bg-page px-2.5 text-sm font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
    >
      {value === null ? (
        <option value="" disabled>
          Choose
        </option>
      ) : null}
      {choices.map((choice) => (
        <option key={choice.value} value={choice.value}>
          {choice.label}
        </option>
      ))}
    </select>
  );
}
