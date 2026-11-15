import { Button } from "@/components/ui/button";
import type { FoundPlace } from "@/features/exploration/utils/places-found";

/**
 * One place the dice found: the multiple that found it, its name and what the campaign's chart
 * says it does. The player reads it and gives himself whatever it says; nothing here is applied,
 * logged or rolled for him (William, 12 Nov 2026). A place nobody has written rules for shows its
 * name alone.
 */
export default function ExplorePlaceCard({
  found,
  onReadAndRoll,
}: {
  found: FoundPlace;
  /** Opens the campaign's locations searched for the place (none when they're switched off). */
  onReadAndRoll?: (place: string) => void;
}) {
  const { place } = found;
  return (
    <article className="flex flex-col gap-2.5 border border-accent-line bg-panel px-[18px] py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-accent-text">
            {found.kicker}
          </span>
          <span className="font-display text-[19px] font-semibold text-head">{place.name}</span>
        </div>
        {onReadAndRoll ? (
          <Button
            variant="secondary"
            className="border-accent-line text-accent-hi"
            onClick={() => onReadAndRoll(place.name)}
          >
            Read and roll
          </Button>
        ) : null}
      </div>
      {place.rules ? (
        <p className="m-0 whitespace-pre-line border-t border-accent-line pt-2.5 text-sm text-text2">
          {place.rules}
        </p>
      ) : null}
    </article>
  );
}
