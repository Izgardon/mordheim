import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogKicker,
  DialogTitle,
} from "@/components/ui/dialog";

import { getWarbandUnitCount, mountsRating, shownWarbandRating } from "../../utils/warband-utils";
import type {
  HenchmenGroup,
  Warband,
  WarbandHero,
  WarbandHireling,
} from "../../types/warband-types";

type WarbandStatsProps = {
  warband: Warband;
  heroes: WarbandHero[];
  hirelings: WarbandHireling[];
  henchmenGroups: HenchmenGroup[];
  breakdownOpen: boolean;
  setBreakdownOpen: (open: boolean) => void;
};

/** The info line (design E): Rating (opens its breakdown), Gold, Units of the maximum, Record. */
export default function WarbandStats(props: WarbandStatsProps) {
  const { warband, heroes, hirelings, henchmenGroups, breakdownOpen, setBreakdownOpen } = props;
  const rating = shownWarbandRating(warband, heroes, hirelings, henchmenGroups);
  const units = warband.unit_count ?? getWarbandUnitCount(heroes, hirelings, henchmenGroups);
  const members = henchmenGroups.reduce((sum, group) => sum + (group.henchmen?.length ?? 0), 0);
  const mounts = warband.mounts_rating ?? mountsRating(heroes, hirelings, henchmenGroups);
  const totals: { label: string; value: string | number; unit?: string; onClick?: () => void }[] = [
    { label: "Rating", value: rating, onClick: () => setBreakdownOpen(true) },
    { label: "Gold", value: warband.gold ?? 0, unit: "gc" },
    {
      label: "Units",
      value: units,
      unit: warband.max_units ? `of ${warband.max_units}` : undefined,
    },
    { label: "Record", value: `${warband.wins ?? 0}–${warband.losses ?? 0}` },
  ];

  return (
    <>
      <dl className="m-0 grid grid-cols-4 border-y border-line">
        {totals.map((total) => {
          const value = (
            <dd className="m-0 font-display text-[26px] font-semibold text-head">
              {total.value}{" "}
              {total.unit ? (
                <span className="font-sans text-[13px] font-medium text-faint">{total.unit}</span>
              ) : null}
            </dd>
          );
          return (
            <div key={total.label} className="flex flex-col gap-0.5 py-3.5 pr-3">
              <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-faint">
                {total.label}
              </dt>
              {total.onClick ? (
                <button
                  type="button"
                  onClick={total.onClick}
                  className="text-left underline-offset-4 hover:underline"
                  aria-label={`Rating ${total.value}: see the breakdown`}
                >
                  {value}
                </button>
              ) : (
                value
              )}
            </div>
          );
        })}
      </dl>
      <Dialog open={breakdownOpen} onOpenChange={setBreakdownOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogKicker>{warband.name}</DialogKicker>
            <DialogTitle>Warband rating</DialogTitle>
          </DialogHeader>
          <dl className="m-0 flex flex-col">
            {[
              ["Heroes", `${heroes.length} × 5 (20 if large), plus their XP`],
              ["Henchmen", `${members} models × 5 (20 if large), plus each group's XP per model`],
              ["Hired swords", `${hirelings.length}, at their rating plus XP`],
              ["Mounts", `${mounts}`],
              ["Total", `${rating}`],
            ].map(([label, value]) => (
              <div
                key={label}
                className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 border-t border-line py-2"
              >
                <dt className="pt-0.5 text-[11px] font-bold uppercase tracking-[0.12em] text-faint">
                  {label}
                </dt>
                <dd className="m-0 text-sm text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        </DialogContent>
      </Dialog>
    </>
  );
}
