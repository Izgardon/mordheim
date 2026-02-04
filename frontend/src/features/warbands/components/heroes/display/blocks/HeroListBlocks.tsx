import { useState } from "react";

import DetailPopup, { type DetailEntry, type PopupPosition } from "../DetailPopup";

import type { WarbandHero } from "../../../../types/warband-types";

import cardDetailed from "@/assets/containers/basic_bar.png";

type BlockEntry = {
  id: string;
  visibleId: number;
  label: string;
  type: "item" | "skill" | "spell" | "feature";
};

type NormalizedBlock = {
  id: string;
  title: string;
  entries: BlockEntry[];
};

type OpenPopup = {
  entry: DetailEntry;
  anchorRect: DOMRect;
  key: string;
  position?: PopupPosition;
};

type HeroListBlocksProps = {
  hero: WarbandHero;
};

export default function HeroListBlocks({ hero }: HeroListBlocksProps) {
  const [openPopups, setOpenPopups] = useState<OpenPopup[]>([]);

  const itemBlock: BlockEntry[] = (hero.items ?? []).map((item, index) => ({
    id: `item-${item.id}-${index}`,
    visibleId: item.id,
    label: item.name,
    type: "item",
  }));

  const skillBlock: BlockEntry[] = (hero.skills ?? []).map((skill) => ({
    id: `skill-${skill.id}`,
    visibleId: skill.id,
    label: skill.name,
    type: "skill",
  }));

  const spellBlock: BlockEntry[] = (hero.spells ?? []).map((spell) => ({
    id: `spell-${spell.id}`,
    visibleId: spell.id,
    label: spell.name,
    type: "spell",
  }));

  const featureBlock: BlockEntry[] = (hero.features ?? []).map((entry) => ({
    id: `feature-${entry.id}`,
    visibleId: entry.id,
    label: entry.name,
    type: "feature",
  }));

  const blocks: NormalizedBlock[] = [
    { id: "items", title: "Items", entries: itemBlock },
    { id: "skills", title: "Skills", entries: skillBlock },
    { id: "spells", title: "Spells", entries: spellBlock },
    { id: "feature", title: "Features", entries: featureBlock },
  ].filter((block) => block.entries.length > 0);

  if (blocks.length === 0) {
    return null;
  }

  const handleEntryClick = (entry: BlockEntry, event: React.MouseEvent) => {
    const entryKey = `${entry.type}-${entry.visibleId}`;
    const existingIndex = openPopups.findIndex((p) => p.key === entryKey);

    if (existingIndex !== -1) {
      setOpenPopups((prev) => prev.filter((p) => p.key !== entryKey));
    } else {
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      setOpenPopups((prev) => [
        ...prev,
        {
          entry: {
            id: entry.visibleId,
            type: entry.type,
            name: entry.label,
          },
          anchorRect: rect,
          key: entryKey,
        },
      ]);
    }
  };

  const handleClose = (key: string) => {
    setOpenPopups((prev) => prev.filter((popup) => popup.key !== key));
  };

  const handlePositionCalculated = (key: string, position: PopupPosition) => {
    setOpenPopups((prev) =>
      prev.map((popup) =>
        popup.key === key ? { ...popup, position } : popup
      )
    );
  };

  const getExistingPositions = (currentIndex: number): PopupPosition[] => {
    return openPopups
      .slice(0, currentIndex)
      .filter((p) => p.position)
      .map((p) => p.position!);
  };

  return (
    <>
      <div className="grid gap-3">
        {blocks.map((block) => (
          <div
            key={block.id}
            className="relative p-2.5"
            style={{
              backgroundImage: `url(${cardDetailed})`,
              backgroundSize: "100% 100%",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center",
            }}
          >
            <div className="max-h-[4.5rem] overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                {block.entries.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    className="cursor-pointer border-none bg-transparent p-0 text-left font-inherit text-foreground transition-colors duration-150 hover:text-accent"
                    onClick={(e) => handleEntryClick(entry, e)}
                  >
                    {entry.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
      {openPopups.map((popup, index) => (
        <DetailPopup
          key={popup.key}
          entry={popup.entry}
          onClose={() => handleClose(popup.key)}
          anchorRect={popup.anchorRect}
          stackIndex={index}
          existingPositions={getExistingPositions(index)}
          onPositionCalculated={(pos) => handlePositionCalculated(popup.key, pos)}
        />
      ))}
    </>
  );
}

