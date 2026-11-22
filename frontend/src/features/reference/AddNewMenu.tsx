import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";

const MENU_ITEM =
  "flex min-h-10 cursor-pointer items-center px-3 text-sm text-ink outline-none data-[highlighted]:bg-raised data-[highlighted]:text-head";

/**
 * Add new on a page that adds more than one kind of entry (Skills: a skill or a skill group):
 * one button, its menu naming each (William, 22 Nov 2026: "All should just say Add New").
 */
export default function AddNewMenu({
  entries,
  className,
}: {
  entries: { label: string; onSelect: () => void }[];
  className?: string;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="secondary" className={className}>
          Add new
          <ChevronDown aria-hidden="true" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="z-[70] min-w-[180px] border border-accent-line bg-panel p-1 shadow-[0_16px_40px_var(--color-shadow)]"
        >
          {entries.map((entry) => (
            <DropdownMenu.Item key={entry.label} onSelect={entry.onSelect} className={MENU_ITEM}>
              {entry.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
