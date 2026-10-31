import { ChevronRight } from "lucide-react";

import { ModalSheet } from "@/components/ui/modal-sheet";
import { cn } from "@/lib/utils";

export type BattleMenuRow = {
  label: string;
  detail?: string;
  danger?: boolean;
  disabled?: boolean;
  onSelect: () => void;
};

/**
 * The battle menu (design E): End my battle, Edit stats, Add a unit, Add a neutral group, Battle
 * notes, Chat, Notifications, the manager's actions when you have them, and Leave battle.
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
            disabled={row.disabled}
            onClick={() => {
              onOpenChange(false);
              row.onSelect();
            }}
            className="flex min-h-[52px] items-center justify-between gap-2.5 border-t border-line px-1 text-left disabled:opacity-50"
          >
            <span className="flex flex-col">
              <span
                className={cn("text-[15px] font-bold", row.danger ? "text-danger" : "text-ink")}
              >
                {row.label}
              </span>
              {row.detail ? (
                <span className="text-xs text-muted-foreground">{row.detail}</span>
              ) : null}
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </button>
        ))}
      </div>
    </ModalSheet>
  );
}
