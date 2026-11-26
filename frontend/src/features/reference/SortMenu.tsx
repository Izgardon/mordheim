import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ArrowDownUp, Check } from "lucide-react";

import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils";

const ITEM =
  "flex min-h-10 cursor-pointer items-center gap-2 px-3 text-sm text-ink outline-none data-[highlighted]:bg-raised data-[highlighted]:text-head";

export type SortOption<T extends string> = { id: T; label: string };

/**
 * A list's sort: an arrows button that opens the orders to pick from, the current one ticked, so it
 * never reads as one more filter (William, 24 Nov 2026: "Can the sort here be more obviously a
 * sort as it seems like a filter"). It ends the filter line, a page's column headings sorting too.
 */
export default function SortMenu<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: ReadonlyArray<SortOption<T>>;
  value: T;
  onChange: (value: T) => void;
  /** The button's size, where the line it ends wants another. */
  className?: string;
}) {
  const current = options.find((option) => option.id === value)?.label ?? "";
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <IconButton
          aria-label={`Sorted by ${current}`}
          className={cn("h-[34px] w-10 border-strong", className)}
        >
          <ArrowDownUp aria-hidden="true" />
        </IconButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="z-[70] min-w-[180px] border border-accent-line bg-panel p-1 shadow-[0_16px_40px_var(--color-shadow)]"
        >
          <DropdownMenu.Label className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-faint">
            Sort by
          </DropdownMenu.Label>
          <DropdownMenu.RadioGroup value={value} onValueChange={(next) => onChange(next as T)}>
            {options.map((option) => (
              <DropdownMenu.RadioItem key={option.id} value={option.id} className={ITEM}>
                <span className="w-4">
                  <DropdownMenu.ItemIndicator>
                    <Check aria-hidden="true" className="h-4 w-4 text-accent" />
                  </DropdownMenu.ItemIndicator>
                </span>
                {option.label}
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
