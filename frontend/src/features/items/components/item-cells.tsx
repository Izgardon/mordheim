import { Tooltip } from "@components/tooltip";

import {
  profileValues,
  readItemStatblock,
  STAT_LABELS,
} from "@/features/catalogue/utils/statblock";
import { renderBoldMarkdown } from "@/lib/render-bold-markdown";

import type { Item, ItemProperty } from "../types/item-types";

const NONE = <span className="text-muted-foreground">-</span>;

/** A rule's name, its text in a tooltip. */
function RuleTip({ name, text }: { name: string; text?: string | null }) {
  return (
    <Tooltip
      trigger={
        <span className="text-xs font-semibold text-muted-foreground underline decoration-dotted underline-offset-2 transition hover:text-foreground">
          {name}
        </span>
      }
      content={text?.trim() ? text : "No description available yet."}
      className="inline-flex"
    />
  );
}

/** An item's properties, each with its text from the cached property list. */
export function PropertiesCell({
  item,
  propertyMap,
}: {
  item: Item;
  propertyMap: Record<number, ItemProperty>;
}) {
  if (!item.properties || item.properties.length === 0) {
    return NONE;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {item.properties.map((property) => (
        <RuleTip
          key={property.id}
          name={property.name}
          text={propertyMap[property.id]?.description}
        />
      ))}
    </div>
  );
}

/** An animal's special rules, from its bestiary entry. */
export function SpecialsCell({ item }: { item: Item }) {
  const specials = item.bestiary_entry?.specials;
  if (!specials || specials.length === 0) {
    return NONE;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {specials.map((special) => (
        <RuleTip key={special.id} name={special.name} text={special.description?.trim()} />
      ))}
    </div>
  );
}

/** A one-row profile table: M to Ld over their values. */
function StatLineTable({ values }: { values: (string | number | null | undefined)[] }) {
  return (
    <div className="scrollbar-hidden-mobile overflow-x-auto rounded-lg border border-border/60 bg-background/60">
      <table className="min-w-full text-[10px] text-muted-foreground">
        <thead className="bg-background/80 uppercase tracking-[0.2em]">
          <tr>
            {STAT_LABELS.map((label) => (
              <th key={label} className="px-2 py-1 text-left font-semibold">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-border/60">
            {values.map((value, index) => (
              <td
                key={STAT_LABELS[index]}
                className="px-2 py-1 text-xs font-semibold text-foreground"
              >
                {value ?? "-"}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** An item's own statblock text: a table for a profile, the text for anything else. */
function StatblockText({ statblock }: { statblock?: string | null }) {
  if (!statblock) {
    return NONE;
  }
  if (statblock.includes("[[table]]")) {
    return <div className="text-xs text-muted-foreground">{renderBoldMarkdown(statblock)}</div>;
  }
  const parsed = readItemStatblock(statblock);
  if (!parsed) {
    return <span className="text-xs text-muted-foreground">{statblock}</span>;
  }
  const values = STAT_LABELS.map((label) => parsed?.[label]);
  if (values.every((value) => value === undefined || value === null || value === "")) {
    return NONE;
  }
  return <StatLineTable values={values} />;
}

/** An animal's profile: its bestiary entry's, or the item's own statblock. */
export function AnimalStatsCell({ item }: { item: Item }) {
  return item.bestiary_entry ? (
    <StatLineTable values={profileValues(item.bestiary_entry)} />
  ) : (
    <StatblockText statblock={item.statblock} />
  );
}
