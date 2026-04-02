import { Fragment } from "react";
import type { ReactNode } from "react";
import { Book, NotebookPen, Shield, Sparkles, Star, Users, type LucideIcon } from "lucide-react";

import DetailPopup, { type DetailEntry, type PopupPosition } from "../unit_details/DetailPopup";
import { Tooltip } from "@components/tooltip";

export type UnitListBlock<TEntry> = {
  id: string;
  title: string;
  entries: TEntry[];
};

export type UnitListPopup = {
  entry: DetailEntry;
  anchorRect: DOMRect;
  key: string;
  position?: PopupPosition;
};

const DEFAULT_TAB_GLYPHS: Record<string, LucideIcon> = {
  items: Shield,
  skills: Book,
  spells: Sparkles,
  special: Star,
  roster: Users,
  notes: NotebookPen,
};

type UnitListBlocksProps<TEntry extends { id: string }> = {
  blocks: UnitListBlock<TEntry>[];
  variant: "summary" | "detailed";
  activeTab: string | null;
  onActiveTabChange: (id: string) => void;
  renderEntry: (entry: TEntry, block: UnitListBlock<TEntry>) => ReactNode;
  getGridClassName?: (block: UnitListBlock<TEntry>, variant: "summary" | "detailed") => string;
  summaryRowCount?: number;
  summaryScrollable?: boolean;
  popups?: UnitListPopup[];
  onPopupClose?: (key: string) => void;
  onPopupPositionCalculated?: (key: string, position: PopupPosition) => void;
};

export default function UnitListBlocks<TEntry extends { id: string }>({
  blocks,
  variant,
  activeTab,
  onActiveTabChange,
  renderEntry,
  getGridClassName,
  summaryRowCount,
  summaryScrollable = true,
  popups = [],
  onPopupClose,
  onPopupPositionCalculated,
}: UnitListBlocksProps<TEntry>) {
  const isDetailed = variant === "detailed";
  const rowHeightRem = 1.75;
  const summaryRows = summaryRowCount ?? 4;
  const summaryHeight = `${summaryRows * rowHeightRem}rem`;
  const activeBlock = blocks.find((block) => block.id === activeTab) ?? blocks[0];

  const resolveTabTooltip = (block: UnitListBlock<TEntry>) => {
    switch (block.id) {
      case "items":
        return "Equipment";
      case "skills":
        return "Skills";
      case "spells":
        return "Spells";
      case "special":
        return "Specials";
      case "roster":
        return "Roster";
      case "notes":
        return "Notes";
      default:
        return block.title;
    }
  };

  const resolveGridClassName = (block: UnitListBlock<TEntry>) => {
    if (getGridClassName) {
      return getGridClassName(block, variant);
    }
    return isDetailed
      ? "grid grid-cols-1 gap-y-1 text-sm"
      : "grid grid-cols-2 gap-x-3 gap-y-1 text-sm";
  };

  const renderBlockEntries = (block: UnitListBlock<TEntry>) => (
    <div className="unit-list-panel relative rounded-md p-2.5">
      <div
        className={
          isDetailed
            ? "overflow-y-auto pr-1"
            : summaryScrollable
              ? "overflow-y-auto pr-1"
              : "pr-1"
        }
        style={
          isDetailed
            ? undefined
            : summaryScrollable
              ? { minHeight: summaryHeight, maxHeight: summaryHeight }
              : { minHeight: summaryHeight }
        }
      >
        <div className={resolveGridClassName(block)}>
          {block.entries.map((entry) => (
            <Fragment key={entry.id}>{renderEntry(entry, block)}</Fragment>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {isDetailed ? (
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: `repeat(${Math.max(blocks.length, 1)}, minmax(0, 1fr))` }}
        >
          {blocks.map((block) => {
            const Icon = DEFAULT_TAB_GLYPHS[block.id];
            return (
            <div key={block.id} className="space-y-1">
              <p className="unit-list-heading flex items-center gap-1.5 text-[0.65rem] uppercase tracking-widest">
                {Icon ? <Icon className="h-3 w-3 shrink-0" strokeWidth={2} /> : null}
                {block.title}
              </p>
              {renderBlockEntries(block)}
            </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2">
            {blocks.map((block) => {
              const isActive = block.id === activeBlock?.id;
              const tooltipLabel = resolveTabTooltip(block);
              const Icon = DEFAULT_TAB_GLYPHS[block.id];
              const buttonNode = (
                <button
                  type="button"
                  aria-label={tooltipLabel}
                  aria-pressed={isActive}
                  data-active={isActive ? "true" : "false"}
                  onClick={() => onActiveTabChange(block.id)}
                  className={[
                    "unit-list-tab relative -mb-2 flex h-8 w-8 items-center justify-center rounded-md transition-colors duration-150",
                  ].join(" ")}
                >
                  {Icon ? <Icon className="h-4 w-4" strokeWidth={2} /> : null}
                </button>
              );
              return (
                <Tooltip
                  key={block.id}
                  trigger={buttonNode}
                  content={tooltipLabel}
                  side="top"
                />
              );
            })}
          </div>
          {activeBlock ? renderBlockEntries(activeBlock) : null}
        </div>
      )}
      {popups.map((popup, index) => (
        <DetailPopup
          key={popup.key}
          entry={popup.entry}
          onClose={() => onPopupClose?.(popup.key)}
          anchorRect={popup.anchorRect}
          stackIndex={index}
          existingPositions={popups
            .slice(0, index)
            .filter((p) => p.position)
            .map((p) => p.position!)}
          onPositionCalculated={(pos) => onPopupPositionCalculated?.(popup.key, pos)}
        />
      ))}
    </>
  );
}
