import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { ModalSheet } from "@/components/ui/modal-sheet";
import { NumberInput } from "@/components/ui/number-input";
import type { NeutralCreaturesInput } from "@/features/battles/api/battles-api";
import CustomUnitFields from "@/features/battles/components/shared/CustomUnitFields";
import type { CustomUnitDraftState } from "@/features/battles/hooks/useCustomUnitDraft";
import type { BattleNeutralGroup } from "@/features/battles/types/battle-types";
import { useCatalogue } from "@/lib/catalogue-queries";
import { getErrorMessage } from "@/lib/get-error-message";

import { beastDraft, beastStats, beastWounds } from "./bestiary-creature";
import CreaturePicker from "./CreaturePicker";

const MAX_CREATURES = 30;

/**
 * Add a unit (design E's battle menu), for this battle only. To your warband: a bestiary creature
 * fills the temporary unit's form (name, profile), or the form is typed in whole (William, 25 Nov
 * 2026: "add Bestiary creatures to my warband in the battle and fall back to the full type
 * menu"). To a neutral group: a creature from the bestiary (its profile comes with it) or a typed
 * type, and how many; a group holds as many kinds as are added to it.
 */
export default function AddUnitSheet({
  open,
  onOpenChange,
  campaignId,
  draft,
  groups,
  canAddToWarband,
  initialGroup,
  onAddToWarband,
  onAddCreatures,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: number;
  draft: CustomUnitDraftState;
  groups: BattleNeutralGroup[];
  canAddToWarband: boolean;
  /** Opened from a neutral group (its Add a unit, or the group just made): that group is picked. */
  initialGroup?: string;
  onAddToWarband: () => Promise<boolean>;
  onAddCreatures: (groupKey: string, creatures: NeutralCreaturesInput) => Promise<void>;
}) {
  const bestiary = useCatalogue("bestiary", campaignId, { enabled: open }).data;
  const [target, setTarget] = useState("warband");
  const [beastId, setBeastId] = useState<number | null>(null);
  const [typed, setTyped] = useState("");
  const [count, setCount] = useState("1");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const pickTarget = (next: string) => {
    setTarget(next);
    setBeastId(null);
    setTyped("");
    setCount("1");
    setError("");
  };
  useEffect(() => {
    if (open) pickTarget(initialGroup ?? (canAddToWarband ? "warband" : (groups[0]?.key ?? "")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialGroup]);
  const group = groups.find((entry) => entry.key === target);
  const beast = bestiary.find((entry) => entry.id === beastId);

  const addCreatures = async (groupKey: string) => {
    const creatureType = (beast?.name ?? typed).trim();
    if (!creatureType) {
      setError("Pick a creature or type one in.");
      return;
    }
    const stats = beast ? beastStats(beast) : undefined;
    await onAddCreatures(groupKey, {
      creature_type: creatureType,
      count: Math.max(1, Math.min(MAX_CREATURES, Number.parseInt(count, 10) || 1)),
      wounds: beastWounds(beast),
      ...(stats ? { stats } : {}),
    });
    onOpenChange(false);
  };
  const add = async () => {
    setSaving(true);
    setError("");
    try {
      if (group) await addCreatures(group.key);
      else if (await onAddToWarband()) onOpenChange(false);
    } catch (failure) {
      setError(getErrorMessage(failure, "Couldn't add the creatures."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalSheet
      open={open}
      onOpenChange={onOpenChange}
      kicker="This battle only"
      title="Add a unit"
      footer={
        <div className="grid grid-cols-[1fr_2fr] gap-2">
          <Button variant="secondary" className="min-h-12" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="min-h-12 text-[15px]" disabled={saving} onClick={() => void add()}>
            {group ? `Add to ${group.name}` : "Add to my warband"}
          </Button>
        </div>
      }
    >
      <div role="group" aria-label="Add to" className="flex flex-wrap gap-1.5">
        {canAddToWarband ? (
          <Chip pressed={target === "warband"} onClick={() => pickTarget("warband")}>
            My warband
          </Chip>
        ) : null}
        {groups.map((entry) => (
          <Chip
            key={entry.key}
            pressed={target === entry.key}
            onClick={() => pickTarget(entry.key)}
          >
            {entry.name} · neutral
          </Chip>
        ))}
      </div>
      {group ? (
        <div className="grid grid-cols-[minmax(0,1fr)_5rem] items-end gap-2">
          <CreaturePicker
            label="Creature"
            bestiary={bestiary}
            beast={beast}
            typed={{ value: typed, onType: setTyped }}
            onPick={(picked) => setBeastId(picked?.id ?? null)}
          />
          <label className="flex flex-col gap-1 text-xs font-bold text-text2">
            How many
            <NumberInput
              value={count}
              onChange={(event) => setCount(event.target.value.replace(/[^\d]/g, "").slice(0, 2))}
            />
          </label>
        </div>
      ) : (
        <>
          <CreaturePicker
            label="From the bestiary"
            bestiary={bestiary}
            beast={beast}
            onPick={(picked) => {
              setBeastId(picked?.id ?? null);
              if (picked) draft.changeDraft(beastDraft(picked));
            }}
          />
          <CustomUnitFields draft={draft} />
        </>
      )}
      {error ? <p className="m-0 text-sm text-danger">{error}</p> : null}
    </ModalSheet>
  );
}
