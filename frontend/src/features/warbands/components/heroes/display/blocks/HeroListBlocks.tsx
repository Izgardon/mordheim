import type { WarbandHero } from "../../../../types/warband-types";

type BlockEntry = {
  id: string;
  label: string;
};

type NormalizedBlock = {
  id: string;
  entries: {
    visible: BlockEntry[];
    hiddenCount: number;
  };
};

type HeroListBlocksProps = {
  hero: WarbandHero;
  isMobile: boolean;
};

const LIST_BLOCK_LIMIT = 6;

const normalizeEntries = <T,>(
  entries: T[],
  getLabel: (entry: T) => string,
  getKey: (entry: T, index: number) => string,
  isMobile: boolean
) => {
  const mapped = entries.map((entry, index) => ({
    id: getKey(entry, index),
    label: getLabel(entry),
  }));
  if (!isMobile) {
    return { visible: mapped, hiddenCount: 0 };
  }
  const visible = mapped.slice(0, LIST_BLOCK_LIMIT);
  return { visible, hiddenCount: Math.max(0, mapped.length - visible.length) };
};

export default function HeroListBlocks({ hero, isMobile }: HeroListBlocksProps) {
  const itemBlock = normalizeEntries(
    hero.items ?? [],
    (item) => item.name,
    (item, index) => `${item.id}-${index}`,
    isMobile
  );

  const skillBlock = normalizeEntries(
    hero.skills ?? [],
    (skill) => skill.name,
    (skill) => String(skill.id),
    isMobile
  );

  const spellBlock = normalizeEntries(
    hero.spells ?? [],
    (spell) => spell.name,
    (spell) => String(spell.id),
    isMobile
  );

  const otherBlock = normalizeEntries(
    hero.other ?? [],
    (entry) => entry.name,
    (entry) => String(entry.id),
    isMobile
  );

  const blocks: NormalizedBlock[] = [
    { id: "items", entries: itemBlock },
    { id: "skills", entries: skillBlock },
    { id: "spells", entries: spellBlock },
    { id: "other", entries: otherBlock },
  ].filter((block) => block.entries.visible.length > 0);

  if (blocks.length === 0) {
    return null;
  }

  return (
    <div className="warband-hero-blocks">
      {blocks.map((block) => (
        <div
          key={block.id}
          className={[
            "warband-hero-block",
            isMobile ? "warband-hero-block--mobile" : "warband-hero-block--scroll",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <div className="warband-hero-block-grid">
            {block.entries.visible.map((entry) => (
              <div key={entry.id} className="warband-hero-block-item">
                {entry.label}
              </div>
            ))}
          </div>
          {block.entries.hiddenCount > 0 ? (
            <div className="warband-hero-block-more">+{block.entries.hiddenCount}</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
