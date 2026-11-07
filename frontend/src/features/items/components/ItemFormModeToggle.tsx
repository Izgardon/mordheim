import { cn } from "@/lib/utils";

import type { ItemFormMode } from "../utils/item-form-mode";

const MODES: { mode: ItemFormMode; label: string }[] = [
  { mode: "simple", label: "Simple" },
  { mode: "advanced", label: "Advanced" },
];

/** Simple / Advanced at the top of the item dialog: which of its fields show. */
export default function ItemFormModeToggle({
  mode,
  onChange,
}: {
  mode: ItemFormMode;
  onChange: (mode: ItemFormMode) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Fields" className="flex border border-strong">
      {MODES.map((option) => (
        <button
          key={option.mode}
          type="button"
          role="radio"
          aria-checked={mode === option.mode}
          onClick={() => (mode === option.mode ? undefined : onChange(option.mode))}
          className={cn(
            "min-h-8 border-r border-strong px-3 text-[13px] last:border-r-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
            mode === option.mode
              ? "bg-accent-soft font-bold text-accent-hi"
              : "font-semibold text-text2 hover:bg-raised hover:text-ink"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
