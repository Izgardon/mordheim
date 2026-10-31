import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Ellipsis } from "lucide-react";

import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils";

/** One row of a ⋯ menu: an action, or a link that opens in a new tab. */
export type MoreMenuEntry = {
  label: string;
  onSelect?: () => void;
  href?: string;
  disabled?: boolean;
};

const MENU_ITEM =
  "flex min-h-10 cursor-pointer items-center px-3 text-sm text-ink outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-raised data-[highlighted]:text-head data-[disabled]:opacity-50";

/** The ⋯ button and its menu (design E): a page's less frequent actions. */
export function MoreMenu({
  label,
  entries,
  className,
}: {
  /** The button's accessible name ("More warband actions"). */
  label: string;
  entries: MoreMenuEntry[];
  className?: string;
}) {
  if (!entries.length) return null;
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <IconButton aria-label={label} className={cn("border-strong", className)}>
          <Ellipsis aria-hidden="true" />
        </IconButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="z-[70] min-w-[220px] border border-accent-line bg-panel p-1 shadow-[0_16px_40px_var(--color-shadow)]"
        >
          {entries.map((entry) =>
            entry.href ? (
              <DropdownMenu.Item key={entry.label} asChild disabled={entry.disabled}>
                <a href={entry.href} target="_blank" rel="noreferrer" className={MENU_ITEM}>
                  {entry.label}
                </a>
              </DropdownMenu.Item>
            ) : (
              <DropdownMenu.Item
                key={entry.label}
                onSelect={entry.onSelect}
                disabled={entry.disabled}
                className={MENU_ITEM}
              >
                {entry.label}
              </DropdownMenu.Item>
            )
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
