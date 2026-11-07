import { Chip } from "@/components/ui/chip";
import { countLabel, groupLabel } from "@/features/warband-templates/template-view";

import { useRaiseOutline } from "../../api/warband-template-queries";
import type { OutlineFighter } from "../../types/hire-template-types";
import WarbandRules from "../rules/WarbandRules";

const HEAD = "text-[11px] font-bold uppercase tracking-[0.12em] text-faint";

function Fighters({ title, fighters }: { title: string; fighters: OutlineFighter[] }) {
  if (!fighters.length) return null;
  return (
    <div className="flex flex-col">
      <span className={HEAD}>{title}</span>
      <ul className="m-0 flex list-none flex-col p-0">
        {fighters.map((fighter) => (
          <li
            key={fighter.key}
            className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-baseline gap-x-3 border-t border-line py-1.5 first:border-t-0"
          >
            <span className="text-sm font-semibold text-ink">
              {fighter.kind === "henchman" ? fighter.plural || fighter.name : fighter.name}
            </span>
            <span className="font-mono text-[13px] text-head">{fighter.cost} gc</span>
            <span className="min-w-[3.5rem] text-right text-[13px] text-text2">
              {countLabel(fighter)}
              {groupLabel(fighter) ? ` · ${groupLabel(fighter)}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The raise screen's outline of the type's template (the templates plan, "Raising a warband"):
 * the variant to pick when the type presets none, the gold the warband gets and its warband
 * size, each fighter with his cost and how many, and the warband rule pills. Nothing is hired
 * here. A type with no template shows nothing.
 */
export default function RaiseOutline({
  campaignId,
  typeId,
  typeName,
  variant,
  onVariant,
}: {
  campaignId: number;
  typeId: number;
  typeName: string;
  variant: string;
  onVariant: (variant: string) => void;
}) {
  const outline = useRaiseOutline(campaignId, typeId, variant).data;
  const template = outline?.template;
  if (!outline || !template) return null;
  const picking = template.variants.length > 0 && !template.preset_variant;
  const difference = (outline.book_gold ?? 500) - 500;
  return (
    <section
      aria-label="Template outline"
      className="flex flex-col gap-3 border-t border-line pt-4"
    >
      {picking ? (
        <div role="radiogroup" aria-label="Variant" className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-bold text-muted-foreground">Variant</span>
          {template.variants.map((entry) => (
            <Chip
              key={entry.key}
              role="radio"
              aria-checked={variant === entry.key}
              pressed={variant === entry.key}
              onClick={() => onVariant(entry.key)}
            >
              {entry.name}
            </Chip>
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-text2">
        <span>
          Starting gold <span className="font-mono font-bold text-head">{outline.gold} gc</span>
        </span>
        <span>
          Warband size{" "}
          <span className="font-mono font-bold text-head">{outline.most_warriors}</span>
        </span>
      </div>
      {difference !== 0 && outline.book_gold !== undefined ? (
        <p className="m-0 text-xs text-text2">
          The campaign&apos;s {outline.campaign_gold}, {difference > 0 ? "plus" : "less"}{" "}
          {Math.abs(difference)}: {typeName} start on {outline.book_gold} in the book.
        </p>
      ) : null}
      <div className="grid gap-3 min-[720px]:grid-cols-2">
        <Fighters title="Heroes" fighters={template.fighters.filter((f) => f.kind === "hero")} />
        <Fighters
          title="Henchmen"
          fighters={template.fighters.filter((f) => f.kind === "henchman")}
        />
      </div>
      {template.rules.length ? (
        <WarbandRules warbandName={template.name} rules={template.rules} canEdit={false} />
      ) : null}
    </section>
  );
}
