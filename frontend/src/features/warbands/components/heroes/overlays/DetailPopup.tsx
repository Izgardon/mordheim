import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { getFeature } from "../../../../features/api/features-api";
import { getItem, listItemProperties } from "../../../../items/api/items-api";
import { getSkill } from "../../../../skills/api/skills-api";
import { getSpell } from "../../../../spells/api/spells-api";

import type { Feature } from "../../../../features/types/feature-types";
import type { Item, ItemProperty } from "../../../../items/types/item-types";
import type { Skill } from "../../../../skills/types/skill-types";
import type { Spell } from "../../../../spells/types/spell-types";

import { CardBackground } from "@/components/ui/card-background";
import { Tooltip } from "@components/tooltip";
import exitIcon from "@/assets/components/exit.webp";

export type DetailEntry = {
  id: number;
  type: "item" | "skill" | "spell" | "feature";
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [itemData, setItemData] = useState<Item | null>(null);
  const [itemPropertyMap, setItemPropertyMap] = useState<Record<number, ItemProperty>>({});
  const [skillData, setSkillData] = useState<Skill | null>(null);
  const [spellData, setSpellData] = useState<Spell | null>(null);
  const [featureData, setFeatureData] = useState<Feature | null>(null);
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
        } else if (entry.type === "spell") {
          const data = await getSpell(entry.id);
          setSpellData(data);
        } else if (entry.type === "feature") {
          const data = await getFeature(entry.id);
          setFeatureData(data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load details");
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [entry.id, entry.type]);

  useEffect(() => {
    if (!itemData?.type) {
      setItemPropertyMap({});
      return;
    }

    listItemProperties({
      type: itemData.type,
      campaignId: itemData.campaign_id ?? undefined,
    })
      .then((properties) => {
        const mapped = properties.reduce<Record<number, ItemProperty>>((acc, property) => {
          acc[property.id] = property;
          return acc;
        }, {});
        setItemPropertyMap(mapped);
      })
      .catch(() => setItemPropertyMap({}));
  }, [itemData?.type, itemData?.campaign_id]);

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
                      <Tooltip
                        key={prop.id}
                        trigger={
                          <span className="cursor-help border border-primary/30 bg-primary/20 px-2 py-1 text-sm underline decoration-dotted underline-offset-2">
                            {prop.name}
                          </span>
                        }
                        content={
                          itemPropertyMap[prop.id]?.description?.trim()
                            ? itemPropertyMap[prop.id].description
                            : "No description available yet."
                        }
                        className="inline-flex"
                      />
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
        const spell = spellData;
        if (!spell) return null;
        return (
          <>
            <div className="mb-4 pr-8">
              <h3 className="text-lg font-bold text-foreground">{spell.name}</h3>
              <span className="text-xs uppercase tracking-widest text-muted-foreground">{spell.type || "Spell"}</span>
            </div>
            <div className="flex flex-col gap-3">
              {spell.description && (
                <p className="text-sm leading-relaxed text-foreground">{spell.description}</p>
              )}
              {spell.dc !== undefined && spell.dc !== null && (
                <div className="flex flex-wrap gap-2">
                  <div className="flex flex-col gap-0.5 border border-primary/20 bg-background/50 px-3 py-2">
                    <span className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">Difficulty</span>
                    <span className="font-semibold">{spell.dc}</span>
                  </div>
                </div>
              )}
            </div>
          </>
        );
      }
      case "feature": {
        const feature = featureData;
        if (!feature) return null;
        return (
          <>
            <div className="mb-4 pr-8">
              <h3 className="text-lg font-bold text-foreground">{feature.name}</h3>
              <span className="text-xs uppercase tracking-widest text-muted-foreground">{feature.type || "Feature"}</span>
            </div>
            <div className="flex flex-col gap-3">
              {feature.description && (
                <p className="text-sm leading-relaxed text-foreground">{feature.description}</p>
              )}
            </div>
          </>
        );
      }
    }
  };

  if (!position) return null;

  return createPortal(
    <CardBackground
      className="w-80 overflow-y-auto p-5 text-foreground shadow-xl"
      style={popupStyle}
    >
      <button
        className="icon-button absolute right-3 top-3 flex h-6 w-6 cursor-pointer items-center justify-center border-none bg-transparent p-0 transition-[filter] hover:brightness-125"
        onClick={onClose}
      >
        <img src={exitIcon} alt="Close" className="h-5 w-5" />
      </button>
      {renderContent()}
    </CardBackground>,
    document.body
  );
}
