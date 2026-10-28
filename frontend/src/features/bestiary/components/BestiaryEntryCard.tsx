import { CardBackground } from "@/components/ui/card-background";
import { EntryBadge } from "@/features/catalogue/components/EntryBadge";
import { STAT_FIELDS } from "@/features/catalogue/utils/statblock";

import { shopLine } from "../utils/beast-shop";
import { BeastKindLabel } from "./BeastKindIcon";

import type { BestiaryEntrySummary } from "../types/bestiary-types";

/**
 * What the beast is worth beyond its profile: the shop's price ("80 gc · Rare 11", or "Not sold"),
 * a mount's bonus to its rider's rating, and whether a creature gains experience.
 */
export function BeastFacts({ entry }: { entry: BestiaryEntrySummary }) {
  return (
    <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
      <span>
        Shop: <span className="font-semibold text-foreground">{shopLine(entry)}</span>
      </span>
      {entry.kind === "mount" && entry.rating_bonus ? (
        <span>
          Rider rating: <span className="font-semibold text-foreground">+{entry.rating_bonus}</span>
        </span>
      ) : null}
      {entry.kind === "creature" && entry.gains_xp ? <span>Gains experience</span> : null}
    </p>
  );
}

/** The beast's stat line, M to Ld and its save; "No profile" for one without (most pets). */
export function BeastStatLine({ entry }: { entry: BestiaryEntrySummary }) {
  if (!entry.has_profile) {
    return <p className="text-xs italic text-muted-foreground">No profile</p>;
  }
  return (
    <div className="overflow-x-auto rounded border border-border/60 bg-background/60">
      <table className="min-w-full text-[10px] text-muted-foreground">
        <thead className="bg-background/80 uppercase tracking-[0.2em]">
          <tr>
            {STAT_FIELDS.map((field) => (
              <th key={field.key} className="px-2 py-1 text-center font-semibold">
                {field.label}
              </th>
            ))}
            <th className="px-2 py-1 text-center font-semibold">AS</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-border/60">
            {STAT_FIELDS.map((field) => (
              <td
                key={field.key}
                className="px-2 py-1 text-center text-xs font-semibold text-foreground"
              >
                {entry[field.key]}
              </td>
            ))}
            <td className="px-2 py-1 text-center text-xs font-semibold text-foreground">
              {entry.armour_save != null ? `${entry.armour_save}+` : "-"}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

type BestiaryEntryCardProps = {
  entry: BestiaryEntrySummary;
  /** Opens the beast's detail; without it (the Archived list) the card doesn't open. */
  onClick?: (entry: BestiaryEntrySummary) => void;
  isFavourite?: boolean;
  onToggleFavourite?: (entry: BestiaryEntrySummary) => void;
  /** Beside the star: the Archived list's Restore. */
  actionSlot?: React.ReactNode;
};

/**
 * A beast in the Bestiary: its name with its Custom, House rule or Archived badge, its kind, size
 * and caster, fluff, and stat line.
 */
export default function BestiaryEntryCard({
  entry,
  onClick,
  isFavourite,
  onToggleFavourite,
  actionSlot,
}: BestiaryEntryCardProps) {
  const opens = Boolean(onClick);
  return (
    <div
      className={`sm:min-h-[244px] ${opens ? "cursor-pointer transition hover:brightness-110" : ""}`}
      {...(opens
        ? {
            role: "button",
            tabIndex: 0,
            onClick: () => onClick?.(entry),
            onKeyDown: (event: React.KeyboardEvent) => {
              if (event.key === "Enter" || event.key === " ") onClick?.(entry);
            },
          }
        : { role: "article", "aria-label": entry.name })}
    >
      <CardBackground className="surface-panel-strong h-full space-y-2 p-3 sm:p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold text-foreground">
              {entry.name}
              <EntryBadge entry={entry} />
            </h3>
            <p className="text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground">
              <BeastKindLabel kind={entry.kind} />
              {entry.large ? " • Large" : ""}
              {entry.caster !== "No" ? ` • ${entry.caster}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {onToggleFavourite ? (
              <button
                type="button"
                onClick={() => onToggleFavourite(entry)}
                className="flex h-7 w-7 items-center justify-center text-lg transition hover:scale-110"
                aria-label={isFavourite ? "Remove from favourites" : "Add to favourites"}
                title={isFavourite ? "Remove from favourites" : "Add to favourites"}
              >
                {isFavourite ? "★" : "☆"}
              </button>
            ) : null}
            {actionSlot}
          </div>
        </div>

        <BeastFacts entry={entry} />

        {entry.description ? (
          <p className="line-clamp-2 text-xs text-muted-foreground">{entry.description}</p>
        ) : null}

        <BeastStatLine entry={entry} />
      </CardBackground>
    </div>
  );
}
