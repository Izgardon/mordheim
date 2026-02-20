import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@components/dialog"

import fightIcon from "@/assets/icons/Fight.webp"
import { toNumber } from "../../utils/warband-utils"
import type { HenchmenGroup, WarbandHero, WarbandHiredSword } from "../../types/warband-types"

type WarbandRatingDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  heroes: WarbandHero[]
  hiredSwords: WarbandHiredSword[]
  henchmenGroups: HenchmenGroup[]
}

export default function WarbandRatingDialog({
  open,
  onOpenChange,
  heroes,
  hiredSwords,
  henchmenGroups,
}: WarbandRatingDialogProps) {
  const heroCount = heroes.length
  const heroLargeCount = heroes.filter((h) => h.large).length
  const heroTotalXp = heroes.reduce((sum, h) => sum + toNumber(h.xp), 0)
  const heroRating = heroes.reduce((sum, h) => {
    return sum + (h.large ? 20 : 5) + toNumber(h.xp)
  }, 0)

  const henchmenCount = henchmenGroups.reduce(
    (sum, g) => sum + (g.henchmen?.length ?? 0),
    0,
  )
  const henchmenLargeCount = henchmenGroups.filter((g) => g.large).length
  const henchmenTotalXp = henchmenGroups.reduce(
    (sum, g) => sum + (g.henchmen?.length ?? 0) * toNumber(g.xp),
    0,
  )
  const henchmenRating = henchmenGroups.reduce((sum, g) => {
    const count = g.henchmen?.length ?? 0
    return sum + count * ((g.large ? 20 : 5) + toNumber(g.xp))
  }, 0)

  const hiredSwordCount = hiredSwords.length
  const hiredSwordTotalXp = hiredSwords.reduce(
    (sum, hs) => sum + toNumber(hs.xp),
    0,
  )
  const hiredSwordRating = hiredSwords.reduce((sum, hs) => {
    return sum + toNumber(hs.rating ?? 0) + toNumber(hs.xp)
  }, 0)

  const totalRating = heroRating + henchmenRating + hiredSwordRating

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Warband Rating</DialogTitle>
          <DialogDescription>Rating calculation breakdown</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <img src={fightIcon} alt="" className="h-5 w-5" />
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
                      {" — "}
                      <span className="text-foreground">{heroTotalXp} XP</span>
                    </>
                  )}
                </span>
                <span className="font-semibold text-foreground">
                  {heroRating}
                </span>
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
                      {" — "}
                      <span className="text-foreground">
                        {henchmenTotalXp} XP
                      </span>
                    </>
                  )}
                </span>
                <span className="font-semibold text-foreground">
                  {henchmenRating}
                </span>
              </div>
            )}

            {hiredSwordCount > 0 && (
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-muted-foreground">
                  Hired Swords:{" "}
                  <span className="text-foreground">{hiredSwordCount}</span>
                  {hiredSwordTotalXp > 0 && (
                    <>
                      {" — "}
                      <span className="text-foreground">
                        {hiredSwordTotalXp} XP
                      </span>
                    </>
                  )}
                </span>
                <span className="font-semibold text-foreground">
                  {hiredSwordRating}
                </span>
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
            Heroes: 5 per hero (20 if Large) + XP. Henchmen: group size
            &times; (5 per henchman (20 if Large) + XP). Hired Swords: base
            rating + XP.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
