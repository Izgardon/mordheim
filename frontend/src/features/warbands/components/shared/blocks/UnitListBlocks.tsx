import { Fragment } from "react";
import type { ReactNode } from "react";

import DetailPopup, { type DetailEntry, type PopupPosition } from "../unit_details/DetailPopup";
import { Tooltip } from "@components/tooltip";

import cardDetailed from "@/assets/containers/basic_bar.webp";

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

export type UnitListTabIcon = {
  primary: string;
  fallback?: string;
};

type UnitListBlocksProps<TEntry extends { id: string }> = {
  blocks: UnitListBlock<TEntry>[];
  variant: "summary" | "detailed";
  activeTab: string | null;
  onActiveTabChange: (id: string) => void;
  renderEntry: (entry: TEntry, block: UnitListBlock<TEntry>) => ReactNode;
  getGridClassName?: (block: UnitListBlock<TEntry>, variant: "summary" | "detailed") => string;
  resolveTabIcon: (blockId: string, index: number) => UnitListTabIcon;
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
  resolveTabIcon,
  popups = [],
  onPopupClose,
  onPopupPositionCalculated,
}: UnitListBlocksProps<TEntry>) {
  const isDetailed = variant === "detailed";
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
    <div
      className="relative p-2.5"
      style={{
        backgroundImage: `url(${cardDetailed})`,
        backgroundSize: "100% 100%",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
      }}
    >
      <div className={isDetailed ? "overflow-y-auto pr-1" : "min-h-[7rem] max-h-[7rem] overflow-y-auto pr-1"}>
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
        <div className="grid grid-cols-4 gap-4">
          {blocks.map((block) => (
            <div key={block.id} className="space-y-1">
              <p className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">
                {block.title}
              </p>
              {renderBlockEntries(block)}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2">
            {blocks.map((block, index) => {
              const { primary, fallback } = resolveTabIcon(block.id, index);
              const isActive = block.id === activeBlock?.id;
              const tooltipLabel = resolveTabTooltip(block);
              const buttonNode = (
                <button
                  type="button"
                  aria-label={block.title}
                  onClick={() => onActiveTabChange(block.id)}
                  className={[
                    "relative h-8 w-8 -mb-2 rounded-full border transition-all",
                    "bg-black/40 shadow-[0_0_12px_rgba(5,20,24,0.35)]",
                    "hover:scale-[1.03] hover:brightness-110 hover:shadow-[0_0_14px_rgba(215,170,90,0.35)]",
                    isActive ? "border-amber-300/80" : "border-white/20",
                  ].join(" ")}
                  style={{
                    backgroundImage: fallback
                      ? `url(${primary}), url(${fallback})`
                      : `url(${primary})`,
                    backgroundSize: "100% 100%",
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "center",
                  }}
                />
              );
              return (
                <Tooltip
                  key={block.id}
                  trigger={buttonNode}
                  content={tooltipLabel}
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
