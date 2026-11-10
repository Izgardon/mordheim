import type { ReactNode, Ref } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronLeft } from "lucide-react";

import { cn } from "@/lib/utils";

export const AFTERMATH_TABS = [
  { id: "injuries", label: "Injuries", short: "Injuries" },
  { id: "xp", label: "Experience", short: "XP" },
  { id: "explore", label: "Explore", short: "Explore" },
] as const;
export type AftermathTab = (typeof AFTERMATH_TABS)[number]["id"];

/** Camp's steps, linked from the Aftermath: each opens its row on the warband page. */
export const CAMP_LINKS = [
  { id: "sell", label: "Sell" },
  { id: "recruit", label: "Recruit" },
  { id: "upkeep", label: "Upkeep" },
  { id: "buy", label: "Buy" },
  { id: "ready", label: "Ready" },
] as const;

type AftermathHeaderProps = {
  kicker: string;
  title: string;
  subtitle: string;
  saving: boolean;
  error: string;
  tab: AftermathTab;
  onTab: (tab: AftermathTab) => void;
  /** The tab bar, which a tab change keeps at the top of the screen (`useTabScroll`). */
  tabsRef?: Ref<HTMLDivElement>;
  warbandPath: string;
  isMobile: boolean;
  /** The ⋯ menu (Skip and Close post-battle), beside the saved state. */
  menu?: ReactNode;
};

function SaveState({ saving, error }: { saving: boolean; error: string }) {
  if (error) return <span className="text-xs font-semibold text-danger">Not saved</span>;
  if (saving) return <span className="text-xs font-semibold text-muted-foreground">Saving…</span>;
  return (
    <span className="flex items-center gap-1.5 text-xs font-semibold text-good">
      <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
      Saved
    </span>
  );
}

/** The Aftermath's header (design E): kicker, title and result, saved state, the three tabs. */
export default function AftermathHeader(props: AftermathHeaderProps) {
  const { tab, onTab } = props;
  const tabs = (
    <div
      ref={props.tabsRef}
      role="tablist"
      aria-label="Aftermath"
      className={cn(
        props.isMobile ? "grid grid-cols-3 border-b border-line bg-rail" : "flex gap-1"
      )}
    >
      {AFTERMATH_TABS.map((entry, index) => {
        const current = entry.id === tab;
        return (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={current}
            onClick={() => onTab(entry.id)}
            className={cn(
              "flex min-h-12 items-center justify-center gap-2 border-b-2 text-sm font-bold",
              props.isMobile ? "text-[13px]" : "-mb-px border px-[18px]",
              current
                ? "border-b-primary text-head"
                : "border-transparent border-b-transparent text-muted-foreground",
              current && !props.isMobile && "border-line bg-page"
            )}
          >
            <span
              className={cn(
                "flex h-[22px] w-[22px] items-center justify-center font-mono text-[11px]",
                current ? "bg-primary text-on-accent" : "bg-raised text-muted-foreground"
              )}
            >
              {index + 1}
            </span>
            {props.isMobile ? entry.short : entry.label}
          </button>
        );
      })}
    </div>
  );

  if (props.isMobile) {
    return (
      <div className="sticky top-0 z-10 -mx-3 bg-rail">
        <header className="flex items-center gap-1 py-2 pl-1 pr-3">
          <Link
            to={props.warbandPath}
            aria-label="Back to warband"
            className="flex h-11 w-11 items-center justify-center text-text2"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </Link>
          <div className="flex min-w-0 flex-1 flex-col">
            <h1 className="m-0 font-display text-lg font-semibold text-head">{props.title}</h1>
            <span className="truncate text-xs text-muted-foreground">{props.subtitle}</span>
          </div>
          <SaveState saving={props.saving} error={props.error} />
          {props.menu}
        </header>
        {tabs}
      </div>
    );
  }

  return (
    <header className="page-band flex flex-col gap-3.5 border-b border-line bg-bar pt-[18px]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-accent-text">
            {props.kicker}
          </span>
          <h1 className="m-0 font-display text-[32px] font-semibold text-head">{props.title}</h1>
          <span className="text-[13px] text-text2">{props.subtitle}</span>
        </div>
        <div className="flex items-center gap-3">
          <SaveState saving={props.saving} error={props.error} />
          {props.menu}
        </div>
      </div>
      <nav aria-label="Post-game steps" className="flex flex-wrap items-end gap-x-6">
        {tabs}
        <div className="flex flex-wrap items-center gap-2 pb-3">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-faint">
            Then at camp
          </span>
          {CAMP_LINKS.map((link) => (
            <Link
              key={link.id}
              to={`${props.warbandPath}?camp=${link.id}`}
              className="flex min-h-8 items-center border border-border px-2.5 text-[13px] font-semibold text-muted-foreground hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
