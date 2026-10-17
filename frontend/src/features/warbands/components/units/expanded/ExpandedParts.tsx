import { useState, type ReactNode } from "react";

import CollapsibleSection from "@/components/ui/collapsible-section";
import UnitKillHistoryTooltip from "../../shared/unit_details/UnitKillHistoryTooltip";
import { cardPanelStyle } from "./ExpandedTiles";

import type { NamedKillHistory } from "../../../types/warband-types";

type ExpandedIdentityProps = {
  title: ReactNode;
  raceName: string | null | undefined;
  unitType: string | null;
  xp: number | null;
};

/** Heading, "Race - Type" line and the XP total. */
export function ExpandedIdentity({ title, raceName, unitType, xp }: ExpandedIdentityProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        {title}
        <p className="text-sm text-muted-foreground">
          {raceName || "Unknown Race"} - {unitType || "Unknown Type"}
        </p>
      </div>
      <div className="text-right">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">XP</span>
        <p className="text-lg font-semibold">{xp ?? 0}</p>
      </div>
    </div>
  );
}

type KillsProps = {
  kills: number;
  name: string;
  loadKillHistory: () => Promise<NamedKillHistory>;
};

/** Phone layout: kills as a tile among the others. */
export function KillsTile({ kills, name, loadKillHistory }: KillsProps) {
  return (
    <UnitKillHistoryTooltip
      totalKills={kills}
      loadKillHistory={loadKillHistory}
      ariaLabel={`Show named kills for ${name}`}
    >
      <div className="px-3 py-2" style={cardPanelStyle}>
        <span className="text-xs uppercase tracking-widest text-muted-foreground">Kills</span>
        <p className="text-sm font-semibold">{kills}</p>
      </div>
    </UnitKillHistoryTooltip>
  );
}

/** Desktop layout: kills as a badge beside the tiles. */
export function KillsBadge({ kills, name, loadKillHistory }: KillsProps) {
  return (
    <UnitKillHistoryTooltip
      totalKills={kills}
      loadKillHistory={loadKillHistory}
      ariaLabel={`Show named kills for ${name}`}
    >
      <div
        className="relative flex items-center overflow-hidden border border-border/60 px-2 py-1.5 shadow-[0_16px_26px_rgba(6,3,2,0.4)]"
        style={{ backgroundColor: "rgba(33, 14, 13, 0.94)" }}
      >
        <div className="absolute -right-6 -top-6 h-16 w-16 rounded-full bg-rose-500/20 blur-2xl" />
        <div className="absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r from-rose-500/70 via-amber-400/50 to-transparent" />
        <div className="relative flex flex-col items-center gap-2 text-center">
          <span className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground">
            Kills
          </span>
          <div className="flex h-8 w-8 items-center justify-center border border-rose-400/50 bg-rose-500/15 text-foreground shadow-[0_8px_14px_rgba(92,28,24,0.3)]">
            <span className="text-sm font-bold leading-none">{kills}</span>
          </div>
        </div>
      </div>
    </UnitKillHistoryTooltip>
  );
}

/** Phone layout: deeds folded away until opened. */
export function CollapsibleDeeds({ deeds }: { deeds: string | null | undefined }) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  return (
    <CollapsibleSection
      title="Deeds"
      collapsed={isCollapsed}
      onToggle={() => setIsCollapsed((current) => !current)}
    >
      <div className="w-full p-3" style={cardPanelStyle}>
        {deeds ? (
          <p className="whitespace-pre-line text-sm text-foreground">{deeds}</p>
        ) : (
          <p className="text-sm text-muted-foreground">No deeds recorded yet.</p>
        )}
      </div>
    </CollapsibleSection>
  );
}

/** Desktop layout: the deeds column. */
export function DeedsPanel({ deeds }: { deeds: string | null | undefined }) {
  return (
    <div className="flex min-w-[200px] w-[40%] p-3 flex-col overflow-hidden" style={cardPanelStyle}>
      <p className="text-xs uppercase tracking-widest text-muted-foreground">Deeds</p>
      <div className="mt-2 max-h-[130px] flex-1 overflow-y-auto pr-1 text-xs">
        {deeds ? (
          <p className="whitespace-pre-line text-foreground">{deeds}</p>
        ) : (
          <p className="text-muted-foreground">No deeds recorded yet.</p>
        )}
      </div>
    </div>
  );
}
