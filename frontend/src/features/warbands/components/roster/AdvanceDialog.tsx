import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogKicker,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCatalogue } from "@/lib/catalogue-queries";

import { resolveAdvanceLabel } from "../../utils/levelup-utils";
import type { WarbandHero } from "../../types/warband-types";
import AdvanceGain, { gainLine } from "./advance/AdvanceGain";
import type { StatCode } from "./advance/advance-table";
import ChoiceSelect from "./advance/ChoiceSelect";
import DiceTable from "./advance/DiceTable";
import RollField from "./advance/RollField";
import { useAdvanceFlow } from "./advance/useAdvanceFlow";
import LadsGotTalent from "./LadsGotTalent";
import { unitName, type RosterUnit } from "./unit-view";

const LABEL = "text-[11px] font-bold uppercase tracking-[0.12em] text-faint";
const span = (from: number, to: number) => (from === to ? String(from) : `${from}–${to}`);
const plusOne = (stat: StatCode) => ({ value: stat, label: `+1 ${resolveAdvanceLabel(stat)}` });

/**
 * An advance, step by step in one dialog (William): roll 2D6, type the roll or click a row of the
 * unit's advance table, as if the dice had shown it; a row with two outcomes picks one from a
 * dropdown (its D6 presets it); a new skill row gives a skill, a spell or a boon or bane, picked
 * here, or "Choose later"; then what he gains and Confirm. A henchmen 10–12 is the lad's got talent.
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
  const isGroup = entry?.kind === "henchmen_group";
  const race = races?.find((candidate) => candidate.id === entry?.unit.race_id);
  const outcome = flow.row?.outcome;
  const close = () => {
    flow.reset();
    onClose();
  };
  const gain = entry ? gainLine(flow, entry, race) : null;
  const stats =
    outcome?.kind === "d6"
      ? [outcome.low, outcome.high]
      : outcome?.kind === "choose"
        ? outcome.stats
        : null;

  return (
    <Dialog open={entry !== null} onOpenChange={(open) => (open ? null : close())}>
      <DialogContent className="max-w-[620px]">
        <DialogHeader>
          <DialogKicker>Advance</DialogKicker>
          <DialogTitle>{entry ? unitName(entry.unit) : ""}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-2">
            <RollField dice={2} value={flow.roll2} onChange={flow.setRoll2} />
            <DiceTable
              label={isGroup ? "Henchmen advance table" : "Hero advance table"}
              current={flow.row ? String(flow.row.from) : undefined}
              onPick={(key) => flow.pickRow(Number(key))}
              rows={flow.table.map((row) => ({
                key: String(row.from),
                roll: span(row.from, row.to),
                result: row.label,
              }))}
            />
          </div>
          {stats ? (
            <div className="flex flex-wrap items-center gap-2">
              {outcome?.kind === "d6" ? (
                <RollField dice={1} value={flow.roll1} onChange={flow.setRoll1} />
              ) : null}
              <ChoiceSelect
                label="Characteristic"
                value={flow.stat}
                choices={stats.map(plusOne)}
                onChange={flow.setStat}
              />
            </div>
          ) : null}
          {flow.advance === "LGT" && entry?.kind === "henchmen_group" ? (
            <LadsGotTalent
              group={entry.unit}
              warbandId={warbandId}
              heroes={heroes}
              maxHeroes={maxHeroes}
              onDone={close}
            />
          ) : null}
          {entry ? <AdvanceGain flow={flow} entry={entry} campaignId={campaignId} /> : null}
        </div>
        <DialogFooter className="flex-wrap items-center">
          {gain ? (
            <span className="mr-auto flex flex-wrap items-baseline gap-x-2 text-sm font-semibold text-head">
              <span className={LABEL}>Gains</span>
              {gain.text}
              {gain.warning ? (
                <span className="text-xs font-semibold text-danger">{gain.warning}</span>
              ) : null}
            </span>
          ) : null}
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          {flow.advance === "LGT" ? null : (
            <Button disabled={!flow.ready || flow.saving} onClick={() => void flow.confirm()}>
              Confirm
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
