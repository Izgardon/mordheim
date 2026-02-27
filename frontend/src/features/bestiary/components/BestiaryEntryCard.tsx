import { CardBackground } from "@/components/ui/card-background";
import type { BestiaryEntrySummary } from "../types/bestiary-types";

const STAT_HEADERS = [
  { key: "movement", label: "M" },
  { key: "weapon_skill", label: "WS" },
  { key: "ballistic_skill", label: "BS" },
  { key: "strength", label: "S" },
  { key: "toughness", label: "T" },
  { key: "wounds", label: "W" },
  { key: "initiative", label: "I" },
  { key: "attacks", label: "A" },
  { key: "leadership", label: "Ld" },
] as const;

type BestiaryEntryCardProps = {
  entry: BestiaryEntrySummary;
  onClick?: (entry: BestiaryEntrySummary) => void;
  isFavourite?: boolean;
  onToggleFavourite?: (entry: BestiaryEntrySummary) => void;
  actionSlot?: React.ReactNode;
};

export default function BestiaryEntryCard({
  entry,
  onClick,
  isFavourite,
  onToggleFavourite,
  actionSlot,
}: BestiaryEntryCardProps) {
  return (
    <div
      className="cursor-pointer transition hover:brightness-110 min-h-[244px]"
      onClick={() => onClick?.(entry)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick?.(entry);
      }}
    >
      <CardBackground className="space-y-2 p-3 sm:p-4 h-full">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold text-foreground">
              {entry.name}
            </h3>
            <p className="text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground">
              {entry.type}
              {entry.large ? " \u2022 Large" : ""}
              {entry.caster !== "No" ? ` \u2022 ${entry.caster}` : ""}
            </p>
          </div>
          <div
            className="flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            {onToggleFavourite ? (
              <button
                type="button"
                onClick={() => onToggleFavourite(entry)}
                className="flex h-7 w-7 items-center justify-center text-lg transition hover:scale-110"
                aria-label={isFavourite ? "Remove from favourites" : "Add to favourites"}
                title={isFavourite ? "Remove from favourites" : "Add to favourites"}
              >
                {isFavourite ? "\u2605" : "\u2606"}
              </button>
            ) : null}
            {actionSlot}
          </div>
        </div>

        {entry.description ? (
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {entry.description}
          </p>
        ) : null}

        <div className="overflow-x-auto rounded border border-border/60 bg-background/60">
          <table className="min-w-full text-[10px] text-muted-foreground">
            <thead className="bg-background/80 uppercase tracking-[0.2em]">
              <tr>
                {STAT_HEADERS.map((h) => (
                  <th key={h.key} className="px-2 py-1 text-center font-semibold">
                    {h.label}
                  </th>
                ))}
                <th className="px-2 py-1 text-center font-semibold">AS</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border/60">
                {STAT_HEADERS.map((h) => (
                  <td
                    key={h.key}
                    className="px-2 py-1 text-center text-xs font-semibold text-foreground"
                  >
                    {entry[h.key]}
                  </td>
                ))}
                <td className="px-2 py-1 text-center text-xs font-semibold text-foreground">
                  {entry.armour_save != null ? `${entry.armour_save}+` : "-"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardBackground>
    </div>
  );
}
