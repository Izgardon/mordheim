import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogKicker,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCatalogue } from "@/lib/catalogue-queries";

import {
  HENCHMEN_SELECTABLE_STATS,
  HERO_SELECTABLE_STATS,
  OTHER_OPTIONS,
  resolveAdvanceLabel,
} from "../../utils/levelup-utils";
import type { WarbandHero } from "../../types/warband-types";
import AdvanceGain, { gainLine } from "./advance/AdvanceGain";
import DiceTable from "./advance/DiceTable";
import RollField from "./advance/RollField";
import { useAdvanceFlow } from "./advance/useAdvanceFlow";
import LadsGotTalent from "./LadsGotTalent";
import { unitName, type RosterUnit } from "./unit-view";

const LGT = "LGT";
const LABEL = "text-[11px] font-bold uppercase tracking-[0.12em] text-faint";
const span = (from: number, to: number) => (from === to ? String(from) : `${from}–${to}`);

/**
 * An advance, step by step in one dialog (William): roll 2D6 (or type the roll) on the unit's
 * advance table, shown with the row it lands on; the D6 or the WS/BS choice the row asks for; the
 * stat against his race's maximum, or the new skill or spell picked here (a caster may take a
 * spell for a skill), or "Choose later"; then what he gains and Confirm. A henchmen 10–12 is the
 * lad's got talent. An advance can also be chosen by hand.
 */
export default function AdvanceDialog({
  entry,
  campaignId,
  warbandId,
  heroes,
  maxHeroes,
  onClose,
}: {
  entry: RosterUnit | null;
  campaignId: number;
  warbandId: number;
  heroes: WarbandHero[];
  maxHeroes: number | null;
  onClose: () => void;
}) {
  const flow = useAdvanceFlow(entry, warbandId, onClose);
  const races = useCatalogue("races", campaignId, { enabled: entry !== null }).data;
  const [showHand, setShowHand] = useState(false);
  const isGroup = entry?.kind === "henchmen_group";
  const race = races?.find((candidate) => candidate.id === entry?.unit.race_id);
  const hand = [
    ...(isGroup ? HENCHMEN_SELECTABLE_STATS : HERO_SELECTABLE_STATS),
    ...(isGroup ? [LGT] : OTHER_OPTIONS.map((option) => option.id)),
  ];
  const outcome = flow.row?.outcome;
  const close = () => {
    flow.reset();
    setShowHand(false);
    onClose();
  };
  const gain = entry ? gainLine(flow, entry, race) : "";

  return (
    <Dialog open={entry !== null} onOpenChange={(open) => (open ? null : close())}>
      <DialogContent className="max-w-[620px]">
        <DialogHeader>
          <DialogKicker>Advance</DialogKicker>
          <DialogTitle>{entry ? unitName(entry.unit) : ""}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <RollField dice={2} value={flow.roll2} onChange={flow.setRoll2} />
              <Chip pressed={showHand} onClick={() => setShowHand(!showHand)}>
                By hand
              </Chip>
            </div>
            {showHand ? (
              <div role="group" aria-label="Advance by hand" className="flex flex-wrap gap-1.5">
                {hand.map((code) => (
                  <Chip
                    key={code}
                    pressed={flow.byHand === code}
                    onClick={() => flow.setByHand(flow.byHand === code ? null : code)}
                  >
                    {code === LGT ? "The lad's got talent" : resolveAdvanceLabel(code)}
                  </Chip>
                ))}
              </div>
            ) : null}
            <DiceTable
              label={isGroup ? "Henchmen advance table" : "Hero advance table"}
              current={flow.row ? String(flow.row.from) : undefined}
              rows={flow.table.map((row) => ({
                key: String(row.from),
                roll: span(row.from, row.to),
                result: row.label,
              }))}
            />
          </div>
          {outcome?.kind === "d6" ? (
            <div className="flex flex-col gap-1.5">
              <span className={LABEL}>
                D6: 1–3 {resolveAdvanceLabel(outcome.low)}, 4–6 {resolveAdvanceLabel(outcome.high)}
              </span>
              <RollField dice={1} value={flow.roll1} onChange={flow.setRoll1} />
            </div>
          ) : null}
          {outcome?.kind === "choose" ? (
            <div role="group" aria-label="Weapon Skill or Ballistic Skill" className="flex gap-1.5">
              {outcome.stats.map((stat) => (
                <Chip
                  key={stat}
                  pressed={flow.chosen === stat}
                  onClick={() => flow.setChosen(stat)}
                >
                  +1 {resolveAdvanceLabel(stat)}
                </Chip>
              ))}
            </div>
          ) : null}
          {flow.advance === LGT && entry?.kind === "henchmen_group" ? (
            <LadsGotTalent
              group={entry.unit}
              warbandId={warbandId}
              heroes={heroes}
              maxHeroes={maxHeroes}
              onDone={close}
            />
          ) : null}
          {entry ? (
            <AdvanceGain
              flow={flow}
              entry={entry}
              race={race}
              campaignId={campaignId}
              warbandId={warbandId}
            />
          ) : null}
        </div>
        <DialogFooter className="flex-wrap items-center">
          {gain ? (
            <span className="mr-auto flex items-baseline gap-2 text-sm font-semibold text-head">
              <span className={LABEL}>Gains</span>
              {gain}
            </span>
          ) : null}
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          {flow.advance === LGT ? null : (
            <Button disabled={!flow.ready || flow.saving} onClick={() => void flow.confirm()}>
              Confirm
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
