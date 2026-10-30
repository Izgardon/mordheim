import * as React from "react";

import { cn } from "@/lib/utils";

export type SegmentedTab<T extends string> = {
  id: T;
  label: React.ReactNode;
  disabled?: boolean;
};

type SegmentedTabsProps<T extends string> = {
  tabs: ReadonlyArray<SegmentedTab<T>>;
  value: T;
  onValueChange: (value: T) => void;
  "aria-label": string;
  className?: string;
};

/**
 * Equal-width tabs in a row ("Mine" / "Theirs", a step's sections). Arrow keys, Home and End move
 * the selection, as a tablist does; only the selected tab is in the tab order.
 */
export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onValueChange,
  "aria-label": ariaLabel,
  className,
}: SegmentedTabsProps<T>) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const enabled = tabs.map((tab, index) => (tab.disabled ? -1 : index)).filter((i) => i >= 0);

  const select = (index: number) => {
    onValueChange(tabs[index].id);
    refs.current[index]?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent, index: number) => {
    const position = enabled.indexOf(index);
    const next =
      event.key === "ArrowRight"
        ? enabled[(position + 1) % enabled.length]
        : event.key === "ArrowLeft"
          ? enabled[(position - 1 + enabled.length) % enabled.length]
          : event.key === "Home"
            ? enabled[0]
            : event.key === "End"
              ? enabled[enabled.length - 1]
              : undefined;
    if (next === undefined) return;
    event.preventDefault();
    select(next);
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn("grid gap-1", className)}
      style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
    >
      {tabs.map((tab, index) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            ref={(element) => {
              refs.current[index] = element;
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            disabled={tab.disabled}
            onClick={() => onValueChange(tab.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              "min-h-10 border px-2 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
              selected
                ? "border-accent-line bg-accent-soft text-accent-hi"
                : "border-border bg-transparent text-text2 hover:bg-raised"
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
