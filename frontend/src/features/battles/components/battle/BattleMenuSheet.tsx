import { ChevronRight } from "lucide-react";

import { ModalSheet } from "@/components/ui/modal-sheet";
import { cn } from "@/lib/utils";

export type BattleMenuRow = {
  label: string;
  detail: string;
  danger?: boolean;
  onSelect: () => void;
};

/**
 * The battle menu (design E): End my battle, Edit stats, Add a unit, Add a neutral group, Battle
 * notes, Leave battle, and the manager's actions when you have them, each with its line saying
 * what it does. `battle-menu.ts` holds the rows, their lines and their order.
 */
export default function BattleMenuSheet({
  open,
  onOpenChange,
  kicker,
  rows,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kicker: string;
  rows: BattleMenuRow[];
}) {
  return (
    <ModalSheet
      open={open}
      onOpenChange={onOpenChange}
      kicker={kicker}
      title="Battle menu"
      className="max-w-[480px]"
    >
      <div className="flex flex-col">
        {rows.map((row) => (
          <button
            key={row.label}
            type="button"
            onClick={() => {
              onOpenChange(false);
              row.onSelect();
            }}
            className="flex min-h-[52px] items-center justify-between gap-2.5 border-t border-line px-1 text-left"
          >
            <span className="flex flex-col">
              <span
                className={cn("text-[15px] font-bold", row.danger ? "text-danger" : "text-ink")}
              >
                {row.label}
              </span>
              <span className="text-xs text-muted-foreground">{row.detail}</span>
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </button>
        ))}
      </div>
    </ModalSheet>
  );
}
