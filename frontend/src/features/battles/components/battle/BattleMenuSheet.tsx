import { ChevronRight } from "lucide-react";

import { ModalSheet } from "@/components/ui/modal-sheet";
import { cn } from "@/lib/utils";

import type { BattleMenuSection } from "./battle-menu";

export type BattleMenuRow = {
  label: string;
  detail: string;
  danger?: boolean;
  onSelect: () => void;
};

export type BattleMenuPart = Pick<BattleMenuSection, "id" | "label"> & { rows: BattleMenuRow[] };

/**
 * The battle menu (design E): what you do in the fight, then, under its own heading, the rows
 * that end it, each with a short line. `battle-menu.ts` holds the rows and their order.
 */
export default function BattleMenuSheet({
  open,
  onOpenChange,
  kicker,
  sections,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kicker: string;
  sections: BattleMenuPart[];
}) {
  return (
    <ModalSheet
      open={open}
      onOpenChange={onOpenChange}
      kicker={kicker}
      title="Battle menu"
      className="max-w-[480px]"
    >
      <div className="flex flex-col gap-5">
        {sections.length === 0 ? (
          <p className="m-0 text-sm text-muted-foreground">Nothing to do here.</p>
        ) : null}
        {sections.map((section) => (
          <section
            key={section.id}
            aria-label={section.label}
            className="flex flex-col border-b border-line"
          >
            {section.label ? (
              <h3 className="m-0 pb-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-faint">
                {section.label}
              </h3>
            ) : null}
            {section.rows.map((row) => (
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
          </section>
        ))}
      </div>
    </ModalSheet>
  );
}
