import { useState } from "react";
import { toast } from "sonner";

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
import { getErrorMessage } from "@/lib/get-error-message";

import { useWarbandCacheUpdate, type WarbandUpdate } from "../../api/warband-cache";
import { unitApi } from "../../units/unit-api";
import {
  HENCHMEN_SELECTABLE_STATS,
  HERO_SELECTABLE_STATS,
  OTHER_OPTIONS,
  buildLevelUpPayload,
  needsHero1d6Followup,
  resolveAdvanceLabel,
  resolveHenchmen2d6Stat,
  resolveHero1d6Stat,
  resolveHero2d6Stat,
} from "../../utils/levelup-utils";
import { LIST_KEY, unitName, type RosterUnit } from "./unit-view";

const d6 = () => {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return (value[0] % 6) + 1;
};

/**
 * An advance (the existing level-up, restyled): roll 2D6 (and the 1D6 that follows) on the
 * advance table, or pick the advance by hand, then the server applies it.
 */
export default function AdvanceDialog({
  entry,
  warbandId,
  onClose,
}: {
  entry: RosterUnit | null;
  warbandId: number;
  onClose: () => void;
}) {
  const updateCache = useWarbandCacheUpdate();
  const [roll2, setRoll2] = useState<number | null>(null);
  const [roll1, setRoll1] = useState<number | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isGroup = entry?.kind === "henchmen_group";
  const stats = isGroup ? HENCHMEN_SELECTABLE_STATS : HERO_SELECTABLE_STATS;
  const options = [...stats, ...(isGroup ? [] : OTHER_OPTIONS.map((option) => option.id))];

  const reset = () => {
    setRoll2(null);
    setRoll1(null);
    setPicked(null);
  };
  const rollTable = () => {
    const total = d6() + d6();
    setRoll2(total);
    setRoll1(null);
    if (isGroup) {
      const result = resolveHenchmen2d6Stat(total);
      setPicked(result.stat);
      if (result.ladsGotTalent)
        toast.message(
          "The lad's got talent: he joins the heroes. Set him up from the group's Edit."
        );
    } else {
      setPicked(resolveHero2d6Stat(total));
    }
  };
  const followUp = () => {
    if (roll2 === null) return;
    const total = d6();
    setRoll1(total);
    setPicked(resolveHero1d6Stat(roll2, total));
  };

  const confirm = async () => {
    if (!entry || !picked) return;
    setSaving(true);
    try {
      const unit = await unitApi(entry.kind).levelUp(
        warbandId,
        entry.unit.id,
        buildLevelUpPayload({
          unitName: unitName(entry.unit),
          selectedStat: picked,
          roll2d6Total: roll2,
          roll1d6Total: roll1,
          nameKey: isGroup ? "group" : "hero",
        })
      );
      updateCache(warbandId, { [LIST_KEY[entry.kind]]: [unit] } as WarbandUpdate);
      reset();
      onClose();
    } catch (error) {
      toast.error("The advance didn't save.", { description: getErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={entry !== null}
      onOpenChange={(open) => {
        if (!open) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogKicker>Advance</DialogKicker>
          <DialogTitle>{entry ? unitName(entry.unit) : ""}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={rollTable}>
              Roll 2D6
            </Button>
            {roll2 !== null ? (
              <span className="font-mono text-xl font-bold text-head">{roll2}</span>
            ) : null}
            {!isGroup && roll2 !== null && needsHero1d6Followup(roll2) ? (
              <>
                <Button variant="secondary" onClick={followUp}>
                  Roll D6
                </Button>
                {roll1 !== null ? (
                  <span className="font-mono text-xl font-bold text-head">{roll1}</span>
                ) : null}
              </>
            ) : null}
          </div>
          <div role="group" aria-label="Advance" className="flex flex-wrap gap-1.5">
            {options.map((option) => (
              <Chip key={option} pressed={picked === option} onClick={() => setPicked(option)}>
                {resolveAdvanceLabel(option)}
              </Chip>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!picked || saving} onClick={() => void confirm()}>
            {picked ? `Take ${resolveAdvanceLabel(picked)}` : "Pick an advance"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
