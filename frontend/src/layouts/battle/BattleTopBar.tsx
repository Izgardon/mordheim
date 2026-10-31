import { ChevronLeft } from "lucide-react";

import { IconButton } from "@/components/ui/icon-button";

type BattleTopBarProps = {
  /** The small line above the title: the campaign's name. */
  kicker: string;
  title: string;
  onBack: () => void;
};

/** The phone's top bar on a battle route: back to the campaign, and the battle's name. */
export default function BattleTopBar({ kicker, title, onBack }: BattleTopBarProps) {
  return (
    <header className="flex items-center gap-1 border-b border-line bg-rail pb-2 pl-1 pr-2.5 pt-[calc(env(safe-area-inset-top,0px)+0.5rem)]">
      <IconButton look="plain" aria-label="Back to the campaign" onClick={onBack}>
        <ChevronLeft aria-hidden="true" />
      </IconButton>
      <div className="flex min-w-0 flex-col gap-px">
        <span className="truncate text-[11px] font-bold uppercase tracking-[0.12em] text-faint">
          {kicker}
        </span>
        <h1 className="truncate font-display text-[17px] font-semibold text-head">{title}</h1>
      </div>
    </header>
  );
}
