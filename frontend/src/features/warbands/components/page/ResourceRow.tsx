import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { EllipsisVertical, Minus, Plus } from "lucide-react";

import { GameIcon } from "@/components/ui/game-icons";
import { IconButton } from "@/components/ui/icon-button";

import type { WarbandResource } from "../../types/warband-types";

const MENU_ITEM =
  "flex min-h-10 cursor-pointer items-center px-3 text-sm text-ink outline-none data-[highlighted]:bg-raised";

/**
 * One column of the resources section (William, 20 Nov 2026: "the resource name on the left side
 * and number with buttons on right side of each column spaced apart, and unable for a line to wrap
 * so name ellipsied if need be"): a hairline between columns, a stacked row on a phone.
 */
export default function ResourceRow({
  resource,
  canEdit,
  onChange,
  onRename,
  onSell,
  onDelete,
}: {
  resource: WarbandResource;
  canEdit: boolean;
  onChange: (delta: number) => void;
  onRename: () => void;
  onSell: () => void;
  onDelete: () => void;
}) {
  const { name, is_default: isDefault } = resource;
  // the default and the campaign's own counters stay: no Rename, no Delete
  const kept = isDefault || Boolean(resource.fixed);
  return (
    <div
      className={[
        "flex min-w-0 flex-1 basis-[230px] items-center justify-between gap-2 whitespace-nowrap border-line py-1",
        "border-t pt-2 first:border-t-0 first:pt-1",
        "min-[720px]:max-w-[340px] min-[720px]:border-l min-[720px]:border-t-0 min-[720px]:pl-4",
        "min-[720px]:pt-1 min-[720px]:first:border-l-0 min-[720px]:first:pl-0",
      ].join(" ")}
    >
      <span className="flex min-w-0 items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-faint">
        {!isDefault && /wyrd/i.test(name) ? (
          <GameIcon name="wyrdstone" className="h-3.5 w-3.5 shrink-0 text-good" />
        ) : null}
        <span className="truncate">{name}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        {canEdit ? (
          <IconButton
            aria-label={`One ${name} less`}
            className="h-8 w-8"
            onClick={() => onChange(-1)}
          >
            <Minus aria-hidden="true" />
          </IconButton>
        ) : null}
        <span className="min-w-[26px] text-center font-display text-2xl font-semibold text-head">
          {resource.amount}
        </span>
        {canEdit ? (
          <>
            <IconButton
              aria-label={`One ${name} more`}
              className="h-8 w-8"
              onClick={() => onChange(1)}
            >
              <Plus aria-hidden="true" />
            </IconButton>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <IconButton aria-label={`${name} actions`} look="plain" className="h-8 w-8">
                  <EllipsisVertical aria-hidden="true" />
                </IconButton>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  className="z-[70] min-w-[160px] border border-border bg-panel p-1"
                >
                  {kept ? null : (
                    <DropdownMenu.Item className={MENU_ITEM} onSelect={onRename}>
                      Rename
                    </DropdownMenu.Item>
                  )}
                  <DropdownMenu.Item className={MENU_ITEM} onSelect={onSell}>
                    Sell
                  </DropdownMenu.Item>
                  {kept ? null : (
                    <DropdownMenu.Item className={`${MENU_ITEM} text-danger`} onSelect={onDelete}>
                      Delete
                    </DropdownMenu.Item>
                  )}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </>
        ) : null}
      </span>
    </div>
  );
}
