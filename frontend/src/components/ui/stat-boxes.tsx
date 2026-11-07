import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** One box of a profile row: the field it edits and its label ("WS"). */
export type StatBoxField<K extends string> = { key: K; label: string };

/**
 * What a paste into the box at `from` fills (William: "allow a paste in the first box that pastes
 * the clipboard into the correct boxes"): the clipboard split on spaces and tabs, a value a box
 * from that one on, the rest dropped. Null for a single value, which pastes as usual.
 */
export function pastedStats<K extends string>(
  keys: readonly K[],
  from: number,
  text: string
): Partial<Record<K, string>> | null {
  const values = text.trim().split(/\s+/).filter(Boolean);
  if (values.length < 2) return null;
  const filled = keys.slice(from, from + values.length).map((key, at) => [key, values[at]]);
  return Object.fromEntries(filled) as Partial<Record<K, string>>;
}

type StatBoxesProps<K extends string> = {
  fields: ReadonlyArray<StatBoxField<K>>;
  values: Partial<Record<K, string>>;
  /** The boxes that changed: the one typed in, or every box a paste filled. */
  onChange: (patch: Partial<Record<K, string>>) => void;
  /** A box's name for a screen reader, from its label ("WS for Ulric"); the label by default. */
  name?: (label: string) => string;
  /** Numbers only (a race's maximums, a battle's changes): the number keyboard on a phone. */
  numeric?: boolean;
  /** The grid: five boxes a row on a phone, the whole row from 520 px by default. */
  className?: string;
};

const ROW = { 9: "min-[520px]:grid-cols-9", 10: "min-[520px]:grid-cols-10" } as const;

/**
 * A profile row as plain type boxes (William, 7 Nov 2026: "these should just be type boxes"),
 * each taking a number or the value as the book writes it ("2(4)", "D6", "3+", "-"), which the
 * server reads. Pasting a row of values into a box spreads them from that box on.
 */
export function StatBoxes<K extends string>({
  fields,
  values,
  onChange,
  name = (label) => label,
  numeric = false,
  className,
}: StatBoxesProps<K>) {
  const keys = fields.map((field) => field.key);
  const row = ROW[fields.length as keyof typeof ROW] ?? "";
  return (
    <div className={cn("grid grid-cols-5 gap-1", row, className)}>
      {fields.map((field, index) => (
        <label
          key={field.key}
          className="flex min-w-0 flex-col items-center gap-0.5 text-[10px] font-bold text-faint"
        >
          {field.label}
          <Input
            inputSize="sm"
            maxLength={8}
            autoComplete="off"
            spellCheck={false}
            inputMode={numeric ? "numeric" : "text"}
            aria-label={name(field.label)}
            className="w-full min-w-0 px-0.5 text-center font-mono text-sm"
            value={values[field.key] ?? ""}
            onChange={(event) =>
              onChange({ [field.key]: event.target.value } as Partial<Record<K, string>>)
            }
            onPaste={(event) => {
              const patch = pastedStats(keys, index, event.clipboardData.getData("text"));
              if (!patch) return;
              event.preventDefault();
              onChange(patch);
            }}
          />
        </label>
      ))}
    </div>
  );
}
