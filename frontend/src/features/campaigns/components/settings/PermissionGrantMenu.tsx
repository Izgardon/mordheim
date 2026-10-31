import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

import type { CampaignMember, CampaignPermission } from "../../types/campaign-types";

type PermissionGrantMenuProps = {
  member: CampaignMember;
  options: CampaignPermission[];
  /** The row's summary: the granted codes' labels, "None" or "All permissions". */
  label: string;
  canManagePermissions: boolean;
  isSaving: boolean;
  onToggle: (code: string) => void;
};

/**
 * A player's grants as a dropdown (CAMP-UX-07): arrow keys move between codes, Space or Enter
 * ticks one, Escape or a click outside closes it, and ticking keeps it open for the next code.
 * Owners and admins hold every code, so their button is disabled.
 */
export default function PermissionGrantMenu({
  member,
  options,
  label,
  canManagePermissions,
  isSaving,
  onToggle,
}: PermissionGrantMenuProps) {
  const disabled = member.role !== "player" || !canManagePermissions;
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger
        disabled={disabled}
        aria-label={`Permissions for ${member.name}: ${label}`}
        className={cn(
          "group flex min-h-10 w-[240px] min-w-0 items-center justify-between gap-2 border border-strong bg-page px-3 text-left text-[13px] text-ink max-[960px]:w-full",
          disabled ? "cursor-not-allowed text-muted-foreground" : "hover:bg-raised"
        )}
      >
        <span className="truncate">{label}</span>
        <ChevronDown
          className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition group-data-[state=open]:rotate-180"
          aria-hidden="true"
        />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={4}
          collisionPadding={8}
          aria-label={`Permissions for ${member.name}`}
          // Every code is taller than the room left on a phone: the list scrolls instead.
          className="z-[70] flex max-h-[var(--radix-dropdown-menu-content-available-height)] w-80 max-w-[calc(100vw-1rem)] flex-col gap-0.5 overflow-y-auto border border-accent-line bg-panel p-1 shadow-[0_16px_40px_var(--color-shadow)]"
        >
          {options.map((option) => (
            <DropdownMenu.CheckboxItem
              key={option.code}
              checked={member.permissions.includes(option.code)}
              disabled={isSaving}
              onCheckedChange={() => onToggle(option.code)}
              onSelect={(event) => event.preventDefault()}
              className="flex cursor-pointer items-start gap-2.5 px-2.5 py-2 text-sm outline-none data-[disabled]:cursor-not-allowed data-[highlighted]:bg-raised data-[disabled]:opacity-60"
            >
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center border border-strong">
                <DropdownMenu.ItemIndicator>
                  <Check className="h-3 w-3 text-accent-hi" aria-hidden="true" />
                </DropdownMenu.ItemIndicator>
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="font-bold text-ink">{option.label}</span>
                <span className="text-xs text-muted-foreground">{option.description}</span>
              </span>
            </DropdownMenu.CheckboxItem>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
