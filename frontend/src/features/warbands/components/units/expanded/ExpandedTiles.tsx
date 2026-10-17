import type { ReactNode } from "react";

import { Tooltip } from "@/components/ui/tooltip";
import { WARBAND_DARK_TOOLTIP_CONTENT_CLASSNAME } from "../../shared/unit_details/warband-tooltip-styles";

import type { CardLayout } from "../../../units/unit-slot-types";
import type { HeroCaster } from "../../../types/warband-types";

export const cardPanelStyle = {
  border: "1px solid rgba(var(--unit-card-border-rgb), 0.5)",
  backgroundColor: "var(--unit-card-panel-bg)",
} as const;

/** Tile padding: roomier on the phone layout. */
export const tilePadding = (layout: CardLayout) => (layout === "mobile" ? "px-3 py-2" : "p-2");

const labelClassName = "text-xs uppercase tracking-widest text-muted-foreground";
const dottedValueClassName =
  "text-sm font-semibold decoration-dotted underline underline-offset-4 decoration-muted-foreground/50";

type StatTileProps = {
  layout: CardLayout;
  label: string;
  value: ReactNode;
  className?: string;
};

export function StatTile({ layout, label, value, className }: StatTileProps) {
  return (
    <div
      className={[tilePadding(layout), className].filter(Boolean).join(" ")}
      style={cardPanelStyle}
    >
      <span className={labelClassName}>{label}</span>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

type TooltipTileProps = {
  layout: CardLayout;
  label: string;
  value: ReactNode;
  content: ReactNode;
  minWidth: number;
  maxWidth: number;
};

/** A tile whose value opens a breakdown on hover (caster spell lists, costs). */
export function TooltipTile({
  layout,
  label,
  value,
  content,
  minWidth,
  maxWidth,
}: TooltipTileProps) {
  return (
    <Tooltip
      trigger={
        <div
          className={`${tilePadding(layout)} cursor-help transition-[filter] duration-150 hover:brightness-125`}
          style={cardPanelStyle}
        >
          <span className={labelClassName}>{label}</span>
          <p className={dottedValueClassName}>{value}</p>
        </div>
      }
      content={content}
      minWidth={minWidth}
      maxWidth={maxWidth}
      contentClassName={WARBAND_DARK_TOOLTIP_CONTENT_CLASSNAME}
    />
  );
}

export function SizeTile({ layout, large }: { layout: CardLayout; large: boolean | null }) {
  return large ? <StatTile layout={layout} label="Size" value="Large" /> : null;
}

type CasterTileProps = {
  layout: CardLayout;
  caster: HeroCaster | null;
  spells?: { type?: string | null }[];
};

export function CasterTile({ layout, caster, spells }: CasterTileProps) {
  if (!caster || caster === "No") {
    return null;
  }
  const spellTypes = [
    ...new Set((spells ?? []).map((s) => s.type).filter((t) => t && t !== "Pending")),
  ] as string[];
  return (
    <TooltipTile
      layout={layout}
      label="Caster"
      value={caster}
      content={
        <div className="flex flex-col gap-1 text-sm not-italic">
          <span className="font-semibold">Spell Lists</span>
          {spellTypes.length > 0 ? (
            spellTypes.map((type) => <span key={type}>{type}</span>)
          ) : (
            <span className="text-muted-foreground">No spells known</span>
          )}
        </div>
      }
      minWidth={140}
      maxWidth={240}
    />
  );
}

export type CostLine = { key: string | number; label: ReactNode; cost: number };

type CostTileProps = {
  layout: CardLayout;
  label: string;
  total: number;
  baseCost: number;
  lines: CostLine[];
  /** Rows after the item lines (henchmen add their XP cost). */
  extraLines?: CostLine[];
};

export function CostTile({
  layout,
  label,
  total,
  baseCost,
  lines,
  extraLines = [],
}: CostTileProps) {
  const row = (key: string | number, text: ReactNode, cost: number) => (
    <div key={key} className="flex justify-between gap-4">
      <span>{text}</span>
      <span className="font-semibold">{cost}</span>
    </div>
  );
  return (
    <TooltipTile
      layout={layout}
      label={label}
      value={total}
      content={
        <div className="flex flex-col gap-1 text-sm not-italic">
          {row("base", "Base Cost", baseCost)}
          {lines.map((line) => row(line.key, line.label, line.cost))}
          {extraLines.map((line) => row(line.key, line.label, line.cost))}
        </div>
      }
      minWidth={180}
      maxWidth={280}
    />
  );
}
