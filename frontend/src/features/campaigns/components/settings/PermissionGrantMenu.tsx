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
  className?: string;
};

/**
 * A player's grants as a Radix dropdown (CAMP-UX-07): arrow keys move between codes, Space or
 * Enter ticks one, Escape or a click outside closes it. Owners and admins hold every code, so
 * their trigger is disabled. Ticking keeps the menu open for the next code.
 */
export default function PermissionGrantMenu({
  member,
  options,
  label,
  canManagePermissions,
  isSaving,
  onToggle,
  className,
}: PermissionGrantMenuProps) {
  const isPlayer = member.role === "player";
  const isDisabled = !isPlayer || !canManagePermissions;

  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger
        disabled={isDisabled}
        className={cn(
          "group flex min-w-0 cursor-pointer items-center justify-between gap-2 rounded-xl border border-border/60 bg-background/70 px-3 py-1 text-xs",
          isDisabled ? "cursor-not-allowed opacity-70" : "hover:border-primary/50",
          className
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
          sideOffset={8}
          collisionPadding={8}
          // Named for whose grants they are, not by the trigger's summary of them.
          aria-labelledby={undefined}
          aria-label={`Permissions for ${member.name}`}
          className="z-[9999] w-72 max-w-[calc(100vw-1rem)] space-y-1 rounded-2xl border border-border/60 bg-background p-2 shadow-[0_12px_22px_rgba(5,20,24,0.35)]"
        >
          {options.map((option) => (
            <DropdownMenu.CheckboxItem
              key={option.code}
              checked={member.permissions.includes(option.code)}
              disabled={isSaving}
              onCheckedChange={() => onToggle(option.code)}
              // Keep the menu open, so several codes can be ticked in a row.
              onSelect={(event) => event.preventDefault()}
              className="flex cursor-pointer items-start gap-2 rounded-xl px-2 py-1.5 text-xs outline-none data-[disabled]:cursor-not-allowed data-[highlighted]:bg-primary/10 data-[disabled]:opacity-60"
            >
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-border/70">
                <DropdownMenu.ItemIndicator>
                  <Check className="h-3 w-3 text-primary" aria-hidden="true" />
                </DropdownMenu.ItemIndicator>
              </span>
              <span>
                <span className="font-semibold text-foreground">{option.label}</span>
                <span className="block text-[11px] text-muted-foreground">
                  {option.description}
                </span>
              </span>
            </DropdownMenu.CheckboxItem>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
