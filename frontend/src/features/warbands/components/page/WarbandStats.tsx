import { useState } from "react";

import { GameIcon, type GameIconName } from "@/components/ui/game-icons";
import { useFitText } from "@/lib/use-fit-text";

import GoldWindow from "../header/GoldWindow";
import RatingWindow from "../header/RatingWindow";
import RecordWindow from "../header/RecordWindow";
import UnitsWindow from "../header/UnitsWindow";
import { getWarbandUnitCount, shownWarbandRating } from "../../utils/warband-utils";
import type {
  HenchmenGroup,
  Warband,
  WarbandHero,
  WarbandHireling,
} from "../../types/warband-types";

type WarbandStatsProps = {
  campaignId: number;
  warband: Warband;
  heroes: WarbandHero[];
  hirelings: WarbandHireling[];
  henchmenGroups: HenchmenGroup[];
  breakdownOpen: boolean;
  setBreakdownOpen: (open: boolean) => void;
  /** Shows the Treasury tab (the Gold window's link). */
  onTreasury: () => void;
};

type Window = "gold" | "units" | "record";

type Total = {
  label: string;
  icon: GameIconName;
  value: string | number;
  unit?: string;
  hint: string;
  onClick: () => void;
};

/**
 * A total's value, opening its window: on one line, its text shrinking to fit a narrow column
 * (William, 22 Nov 2026: "I would rather the text shrank ... data should try and stay on one line").
 */
function StatValue({ label, value, unit, hint, onClick }: Total) {
  const fit = useFitText<HTMLButtonElement>(26, [value, unit]);
  return (
    <button
      ref={fit}
      type="button"
      onClick={onClick}
      className="block w-full overflow-hidden whitespace-nowrap text-left font-display text-[26px] font-semibold text-head underline-offset-4 hover:underline"
      aria-label={`${label} ${value}${unit ? ` ${unit}` : ""}: ${hint}`}
    >
      {value}{" "}
      {unit ? <span className="font-sans text-[0.5em] font-medium text-faint">{unit}</span> : null}
    </button>
  );
}

/**
 * The info line (design E): Rating, Gold, Units of the maximum and Record, each with its small
 * icon, and each opening a window on what makes it up (William, 22 Nov 2026).
 */
export default function WarbandStats(props: WarbandStatsProps) {
  const { warband, heroes, hirelings, henchmenGroups, breakdownOpen, setBreakdownOpen } = props;
  const [shown, setShown] = useState<Window | null>(null);
  const rating = shownWarbandRating(warband, heroes, hirelings, henchmenGroups);
  const units = warband.unit_count ?? getWarbandUnitCount(heroes, hirelings, henchmenGroups);
  const record = `${warband.wins ?? 0}–${warband.losses ?? 0}`;
  const rows = warband.rating_breakdown ?? [];
  const totals: Total[] = [
    {
      label: "Rating",
      icon: "rating",
      value: rating,
      hint: "see the breakdown",
      onClick: () => setBreakdownOpen(true),
    },
    {
      label: "Gold",
      icon: "gold",
      value: warband.gold ?? 0,
      unit: "gc",
      hint: "see the last trades",
      onClick: () => setShown("gold"),
    },
    {
      label: "Units",
      icon: "units",
      value: units,
      unit: warband.max_units ? `of ${warband.max_units}` : undefined,
      hint: "see every unit",
      onClick: () => setShown("units"),
    },
    {
      label: "Record",
      icon: "record",
      value: record,
      hint: "see the last battles",
      onClick: () => setShown("record"),
    },
  ];
  const opener = (name: Window) => (open: boolean) => setShown(open ? name : null);

  return (
    <>
      <dl className="m-0 grid grid-cols-4 border-y border-line">
        {totals.map((total) => (
          <div key={total.label} className="flex min-w-0 flex-col gap-0.5 py-3.5 pr-3">
            <dt className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-faint">
              <GameIcon name={total.icon} className="h-3.5 w-3.5 text-accent-text" />
              {total.label}
            </dt>
            <dd className="m-0 min-w-0">
              <StatValue {...total} />
            </dd>
          </div>
        ))}
      </dl>
      <RatingWindow
        open={breakdownOpen}
        onOpenChange={setBreakdownOpen}
        warbandName={warband.name}
        rating={rating}
        rows={rows}
      />
      <GoldWindow
        open={shown === "gold"}
        onOpenChange={opener("gold")}
        campaignId={props.campaignId}
        warbandId={warband.id}
        warbandName={warband.name}
        gold={warband.gold ?? 0}
        onTreasury={() => {
          setShown(null);
          props.onTreasury();
        }}
      />
      <UnitsWindow
        open={shown === "units"}
        onOpenChange={opener("units")}
        warbandName={warband.name}
        rows={rows}
      />
      <RecordWindow
        open={shown === "record"}
        onOpenChange={opener("record")}
        campaignId={props.campaignId}
        warbandId={warband.id}
        warbandName={warband.name}
        record={record}
      />
    </>
  );
}
