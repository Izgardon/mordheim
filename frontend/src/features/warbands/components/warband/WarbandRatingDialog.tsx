import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@components/dialog";

import ratingIcon from "@/assets/icons/Menu.webp";
import { mountsRating as countMounts, toNumber } from "../../utils/warband-utils";
import type { HenchmenGroup, WarbandHero, WarbandHireling } from "../../types/warband-types";

type WarbandRatingDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  heroes: WarbandHero[];
  hirelings: WarbandHireling[];
  henchmenGroups: HenchmenGroup[];
  /** The server's rating and its mounts' part (the summary's `rating`, `mounts_rating`). */
  rating?: number;
  mountsRating?: number;
};

export default function WarbandRatingDialog({
  open,
  onOpenChange,
  heroes,
  hirelings,
  henchmenGroups,
  rating,
  mountsRating,
}: WarbandRatingDialogProps) {
  const heroCount = heroes.length;
  const heroLargeCount = heroes.filter((h) => h.large).length;
  const heroTotalXp = heroes.reduce((sum, h) => sum + toNumber(h.xp), 0);
  const heroRating = heroes.reduce((sum, h) => {
    return sum + (h.large ? 20 : 5) + toNumber(h.xp);
  }, 0);

  const henchmenCount = henchmenGroups.reduce((sum, g) => sum + (g.henchmen?.length ?? 0), 0);
  const henchmenLargeCount = henchmenGroups.filter((g) => g.large).length;
  const henchmenTotalXp = henchmenGroups.reduce(
    (sum, g) => sum + (g.henchmen?.length ?? 0) * toNumber(g.xp),
    0
  );
  const henchmenRating = henchmenGroups.reduce((sum, g) => {
    const count = g.henchmen?.length ?? 0;
    return sum + count * ((g.large ? 20 : 5) + toNumber(g.xp));
  }, 0);

  const hirelingCount = hirelings.length;
  const hirelingTotalXp = hirelings.reduce((sum, hs) => sum + toNumber(hs.xp), 0);
  const hirelingRating = hirelings.reduce((sum, hs) => {
    return sum + toNumber(hs.rating ?? 0) + toNumber(hs.xp);
  }, 0);

  // The server's numbers when it sends them (step 5: a group on mixed mounts counts each one's);
  // worked out here only without them.
  const mountRating = mountsRating ?? countMounts(heroes, hirelings, henchmenGroups);
  const totalRating = rating ?? heroRating + henchmenRating + hirelingRating + mountRating;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[520px]">
        <DialogHeader className="items-start text-left">
          <DialogTitle>Warband Rating</DialogTitle>
          <DialogDescription>Rating calculation breakdown</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <img src={ratingIcon} alt="" className="h-5 w-5" />
            <span>{totalRating}</span>
          </div>

          <div className="space-y-2">
            {heroCount > 0 && (
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-muted-foreground">
                  Heroes:{" "}
                  <span className="text-foreground">
                    {heroCount}
                    {heroLargeCount > 0 && ` (${heroLargeCount} Large)`}
                  </span>
                  {heroTotalXp > 0 && (
                    <>
                      {" - "}
                      <span className="text-foreground">{heroTotalXp} XP</span>
                    </>
                  )}
                </span>
                <span className="font-semibold text-foreground">{heroRating}</span>
              </div>
            )}

            {henchmenCount > 0 && (
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-muted-foreground">
                  Henchmen:{" "}
                  <span className="text-foreground">
                    {henchmenCount}
                    {henchmenLargeCount > 0 &&
                      ` (${henchmenLargeCount} Large group${henchmenLargeCount > 1 ? "s" : ""})`}
                  </span>
                  {henchmenTotalXp > 0 && (
                    <>
                      {" - "}
                      <span className="text-foreground">{henchmenTotalXp} XP</span>
                    </>
                  )}
                </span>
                <span className="font-semibold text-foreground">{henchmenRating}</span>
              </div>
            )}

            {hirelingCount > 0 && (
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-muted-foreground">
                  Hired Swords: <span className="text-foreground">{hirelingCount}</span>
                  {hirelingTotalXp > 0 && (
                    <>
                      {" - "}
                      <span className="text-foreground">{hirelingTotalXp} XP</span>
                    </>
                  )}
                </span>
                <span className="font-semibold text-foreground">{hirelingRating}</span>
              </div>
            )}
            {mountRating > 0 && (
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-muted-foreground">Mounts:</span>
                <span className="font-semibold text-foreground">{mountRating}</span>
              </div>
            )}
          </div>

          <div className="border-t border-[#3b2f25] pt-2">
            <div className="flex items-baseline justify-between gap-2 font-semibold text-foreground">
              <span>Total</span>
              <span>{totalRating}</span>
            </div>
          </div>

          <p className="text-xs italic text-muted-foreground">
            Heroes: 5 per hero (20 if Large) + XP. Henchmen: group size &times; (5 per henchman (20
            if Large) + XP). Hired Swords: base rating + XP. Mounts: each rider's mount bonus (a
            group: one per member).
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
