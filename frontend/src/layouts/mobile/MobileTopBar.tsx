import type { ReactNode } from "react";

type MobileTopBarProps = {
  /** The small line above the title: the campaign's name. */
  kicker: string;
  title: string;
  /** The dice, chat and notifications buttons (`CampaignTools`). */
  tools: ReactNode;
};

/** The phone's top bar (design E): kicker and title on the left, the three tools on the right. */
export default function MobileTopBar({ kicker, title, tools }: MobileTopBarProps) {
  return (
    <header className="flex items-center justify-between gap-2 border-b border-line bg-rail pb-2.5 pl-4 pr-3 pt-[calc(env(safe-area-inset-top,0px)+0.625rem)]">
      <div className="flex min-w-0 flex-col gap-px">
        <span className="truncate text-[11px] font-bold uppercase tracking-[0.12em] text-faint">
          {kicker}
        </span>
        <h1 className="truncate font-display text-xl font-semibold text-head">{title}</h1>
      </div>
      <div role="group" aria-label="Table tools" className="flex shrink-0 gap-1">
        {tools}
      </div>
    </header>
  );
}
