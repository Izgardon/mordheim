import { useEffect, useState } from "react";

import { getItem } from "../../../../items/api/items-api";
import { getSkill } from "../../../../skills/api/skills-api";

import type { Item } from "../../../../items/types/item-types";
import type { Skill } from "../../../../skills/types/skill-types";

import { CardBackground } from "@/components/ui/card-background";
import exitIcon from "@/assets/components/exit.png";
import exitHoverIcon from "@/assets/components/exit_hover.png";

export type DetailEntry = {
  id: number;
  type: "item" | "skill" | "spell" | "other";
  name: string;
};

export type PopupPosition = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type DetailPopupProps = {
  entry: DetailEntry;
  onClose: () => void;
  anchorRect?: DOMRect | null;
  stackIndex?: number;
  existingPositions?: PopupPosition[];
  onPositionCalculated?: (position: PopupPosition) => void;
};

const POPUP_WIDTH = 320;
const POPUP_HEIGHT_ESTIMATE = 300;
const POPUP_GAP = 12;

function findNonOverlappingPosition(
  anchorRect: DOMRect,
  existingPositions: PopupPosition[]
): { top: number; left: number } {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const maxHeight = viewportHeight - 40;

  // Try right side first
  let left = anchorRect.right + POPUP_GAP;
  if (left + POPUP_WIDTH > viewportWidth - 20) {
    left = anchorRect.left - POPUP_WIDTH - POPUP_GAP;
  }
  left = Math.max(20, Math.min(left, viewportWidth - POPUP_WIDTH - 20));

  let top = anchorRect.top;
  top = Math.max(20, Math.min(top, viewportHeight - 200));

  // Check for overlaps and adjust
  const checkOverlap = (t: number, l: number) => {
    return existingPositions.some((pos) => {
      const noOverlap =
        l + POPUP_WIDTH < pos.left ||
        l > pos.left + pos.width ||
        t + POPUP_HEIGHT_ESTIMATE < pos.top ||
        t > pos.top + pos.height;
      return !noOverlap;
    });
  };

  // Try different positions if overlapping
  if (checkOverlap(top, left)) {
    // Try stacking below existing popups
    for (const pos of existingPositions) {
      const newTop = pos.top + pos.height + POPUP_GAP;
      if (newTop + POPUP_HEIGHT_ESTIMATE < maxHeight && !checkOverlap(newTop, left)) {
        top = newTop;
        break;
      }
    }

    // If still overlapping, try stacking to the right
    if (checkOverlap(top, left)) {
      for (const pos of existingPositions) {
        const newLeft = pos.left + pos.width + POPUP_GAP;
        if (newLeft + POPUP_WIDTH < viewportWidth - 20 && !checkOverlap(top, newLeft)) {
          left = newLeft;
          break;
        }
      }
    }

    // If still overlapping, try stacking to the left
    if (checkOverlap(top, left)) {
      for (const pos of existingPositions) {
        const newLeft = pos.left - POPUP_WIDTH - POPUP_GAP;
        if (newLeft > 20 && !checkOverlap(top, newLeft)) {
          left = newLeft;
          break;
        }
      }
    }
  }

  return { top, left };
}

export default function DetailPopup({
  entry,
  onClose,
  anchorRect,
  stackIndex = 0,
  existingPositions = [],
  onPositionCalculated,
}: DetailPopupProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [itemData, setItemData] = useState<Item | null>(null);
  const [skillData, setSkillData] = useState<Skill | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (anchorRect) {
      const pos = findNonOverlappingPosition(anchorRect, existingPositions);
      setPosition(pos);
      onPositionCalculated?.({
        top: pos.top,
        left: pos.left,
        width: POPUP_WIDTH,
        height: POPUP_HEIGHT_ESTIMATE,
      });
    }
  }, []);

  useEffect(() => {
    const fetchDetails = async () => {
      setLoading(true);
      setError(null);

      try {
        if (entry.type === "item") {
          const data = await getItem(entry.id);
          setItemData(data);
        } else if (entry.type === "skill") {
          const data = await getSkill(entry.id);
          setSkillData(data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load details");
      } finally {
        setLoading(false);
      }
    };

    if (entry.type === "item" || entry.type === "skill") {
      fetchDetails();
    }
  }, [entry.id, entry.type]);

  const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 800;
  const maxHeight = viewportHeight - 40;

  const popupStyle: React.CSSProperties = {
    position: "fixed",
    zIndex: 50 + stackIndex,
    maxHeight,
  };

  if (position) {
    popupStyle.top = position.top;
    popupStyle.left = position.left;
  }

  const renderContent = () => {
    if (loading) {
      return <p className="text-sm text-muted-foreground">Loading...</p>;
    }

    if (error) {
      return <p className="text-sm text-red-500">{error}</p>;
    }

    switch (entry.type) {
      case "item": {
        const item = itemData;
        if (!item) return null;
        return (
          <>
            <div className="mb-4 pr-8">
              <h3 className="text-lg font-bold text-foreground">{item.name}</h3>
              <span className="text-xs uppercase tracking-widest text-muted-foreground">
                {item.type}{item.subtype ? ` - ${item.subtype}` : ""}
              </span>
            </div>
            <div className="flex flex-col gap-3">
              {item.description && (
                <p className="text-sm leading-relaxed text-foreground">{item.description}</p>
              )}
              <div className="flex flex-wrap gap-2">
                {item.cost !== undefined && (
                  <div className="flex flex-col gap-0.5 border border-primary/20 bg-background/50 px-3 py-2">
                    <span className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">Cost</span>
                    <span className="font-semibold">{item.cost} gc</span>
                  </div>
                )}
                {item.rarity !== undefined && (
                  <div className="flex flex-col gap-0.5 border border-primary/20 bg-background/50 px-3 py-2">
                    <span className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">Rarity</span>
                    <span className="font-semibold">{item.rarity}</span>
                  </div>
                )}
                {item.strength && (
                  <div className="flex flex-col gap-0.5 border border-primary/20 bg-background/50 px-3 py-2">
                    <span className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">Strength</span>
                    <span className="font-semibold">{item.strength}</span>
                  </div>
                )}
                {item.range && (
                  <div className="flex flex-col gap-0.5 border border-primary/20 bg-background/50 px-3 py-2">
                    <span className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">Range</span>
                    <span className="font-semibold">{item.range}</span>
                  </div>
                )}
                {item.save && (
                  <div className="flex flex-col gap-0.5 border border-primary/20 bg-background/50 px-3 py-2">
                    <span className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">Save</span>
                    <span className="font-semibold">{item.save}</span>
                  </div>
                )}
              </div>
              {item.properties && item.properties.length > 0 && (
                <div className="flex flex-col gap-2">
                  <span className="text-xs uppercase tracking-widest text-muted-foreground">Properties</span>
                  <div className="flex flex-wrap gap-2">
                    {item.properties.map((prop) => (
                      <span
                        key={prop.id}
                        className="border border-primary/30 bg-primary/20 px-2 py-1 text-sm"
                      >
                        {prop.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        );
      }
      case "skill": {
        const skill = skillData;
        if (!skill) return null;
        return (
          <>
            <div className="mb-4 pr-8">
              <h3 className="text-lg font-bold text-foreground">{skill.name}</h3>
              <span className="text-xs uppercase tracking-widest text-muted-foreground">{skill.type}</span>
            </div>
            <div className="flex flex-col gap-3">
              {skill.description && (
                <p className="text-sm leading-relaxed text-foreground">{skill.description}</p>
              )}
            </div>
          </>
        );
      }
      case "spell": {
        return (
          <>
            <div className="mb-4 pr-8">
              <h3 className="text-lg font-bold text-foreground">{entry.name}</h3>
              <span className="text-xs uppercase tracking-widest text-muted-foreground">Spell</span>
            </div>
          </>
        );
      }
      case "other": {
        return (
          <>
            <div className="mb-4 pr-8">
              <h3 className="text-lg font-bold text-foreground">{entry.name}</h3>
              <span className="text-xs uppercase tracking-widest text-muted-foreground">Other</span>
            </div>
          </>
        );
      }
    }
  };

  if (!position) return null;

  return (
    <CardBackground
      className="w-80 overflow-y-auto p-5 text-foreground shadow-xl"
      style={popupStyle}
    >
      <button
        className="absolute right-3 top-3 flex h-6 w-6 cursor-pointer items-center justify-center border-none bg-transparent p-0"
        onClick={onClose}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <img src={isHovered ? exitHoverIcon : exitIcon} alt="Close" className="h-5 w-5" />
      </button>
      {renderContent()}
    </CardBackground>
  );
}
