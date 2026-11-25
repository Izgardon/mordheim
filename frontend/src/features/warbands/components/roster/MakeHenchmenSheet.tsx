import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { ModalSheet } from "@/components/ui/modal-sheet";
import { NumberInput } from "@/components/ui/number-input";
import { getErrorMessage } from "@/lib/get-error-message";

import type { RecruitSource, RecruitTarget } from "../../api/beasts-api";
import { useRecruitBeasts } from "../../hooks/units/useRecruitBeasts";
import { isGroup, liveMembers, unitName, type RosterUnit } from "./unit-view";

/** A creature's item about to become henchmen: where its copies are and how many there are. */
export type BeastCopies = {
  source: RecruitSource;
  itemName: string;
  /** Its beast: only a group recruited from the same one can take them in. */
  beastId: number | null;
  /** Copies held there. */
  most: number;
  /** A henchmen group's row: the whole row goes, a copy for each member carrying it. */
  wholeRow?: boolean;
};

type MakeHenchmenSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warbandId: number;
  copies: BeastCopies;
  /** The roster: its groups of the same beast can be joined. */
  units: RosterUnit[];
  onDone?: () => void;
};

/** The groups recruited from this beast, which the server lets the copies join. */
export const sameBeastGroups = (units: RosterUnit[], beastId: number | null) =>
  beastId == null
    ? []
    : units.filter((entry) => isGroup(entry) && entry.unit.source_beast_id === beastId);

const NEW = "new";

/** Make henchmen (the bestiary rewrite): how many copies, and a new group or one of the same beast. */
export default function MakeHenchmenSheet(props: MakeHenchmenSheetProps) {
  const { copies } = props;
  const groups = sameBeastGroups(props.units, copies.beastId);
  const [count, setCount] = useState(String(copies.most));
  const [into, setInto] = useState<string>(NEW);
  const recruit = useRecruitBeasts(props.warbandId);
  const quantity = copies.wholeRow
    ? copies.most
    : Math.min(Math.max(Number(count) || 1, 1), copies.most);

  const submit = () => {
    const target: RecruitTarget = into === NEW ? { new: {} } : { group_id: Number(into) };
    recruit.mutate(
      { source: copies.source, quantity, target },
      {
        onSuccess: () => {
          props.onOpenChange(false);
          props.onDone?.();
        },
      }
    );
  };

  return (
    <ModalSheet
      open={props.open}
      onOpenChange={props.onOpenChange}
      kicker={copies.itemName}
      title="Make henchmen"
      footer={
        <div className="grid grid-cols-[1fr_2fr] gap-2">
          <Button
            variant="secondary"
            className="min-h-12"
            onClick={() => props.onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button className="min-h-12 text-[15px]" disabled={recruit.isPending} onClick={submit}>
            {recruit.isPending
              ? "Making…"
              : `Make ${quantity} ${quantity === 1 ? "henchman" : "henchmen"}`}
          </Button>
        </div>
      }
    >
      {!copies.wholeRow && copies.most > 1 ? (
        <label className="flex flex-col gap-1 text-xs font-bold text-text2">
          How many (of {copies.most})
          <NumberInput
            compact
            min={1}
            max={copies.most}
            value={count}
            onChange={(event) => setCount(event.target.value)}
          />
        </label>
      ) : null}
      <div role="group" aria-label="Into" className="flex flex-col gap-1.5">
        <span className="text-xs font-bold text-text2">Into</span>
        <div className="flex flex-wrap gap-1.5">
          <Chip pressed={into === NEW} onClick={() => setInto(NEW)}>
            New group
          </Chip>
          {groups.map((group) => (
            <Chip
              key={group.unit.id}
              pressed={into === String(group.unit.id)}
              onClick={() => setInto(String(group.unit.id))}
            >
              {unitName(group.unit)}
              {isGroup(group) ? ` ×${liveMembers(group.unit).length}` : ""}
            </Chip>
          ))}
        </div>
      </div>
      {recruit.error ? (
        <p role="alert" className="m-0 text-sm text-danger">
          {getErrorMessage(recruit.error, "Couldn't make the henchmen.")}
        </p>
      ) : null}
    </ModalSheet>
  );
}
