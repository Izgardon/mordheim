import { useState } from "react";
import { Minus, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { ModalSheet } from "@/components/ui/modal-sheet";
import { getErrorMessage } from "@/lib/get-error-message";
import { cn } from "@/lib/utils";

import { useWarbandCacheUpdate } from "../../api/warband-cache";
import { unitApi } from "../../units/unit-api";
import { isCreatureGroup } from "../../utils/companions";
import type { OpenCamp } from "./camp-types";

const NEW = "new";
const fieldLabel = "flex flex-col gap-1 text-xs font-bold text-muted-foreground";

/**
 * The recruit helper (design E): recruits for a new group (name and type) or an existing one,
 * their experience shared out of the veterans' pool (a group's members share one XP, so a new
 * group's recruits take the same XP each and an existing group's join at its XP), at a cost per
 * model. Going over the pool or the group's size warns; it doesn't stop you.
 */
export default function VeteransDialog({
  camp,
  open,
  onClose,
}: {
  camp: OpenCamp;
  open: boolean;
  onClose: () => void;
}) {
  const updateCache = useWarbandCacheUpdate();
  const groups = camp.groups.filter((group) => !isCreatureGroup(group));
  const [into, setInto] = useState<string>(NEW);
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [xpEach, setXpEach] = useState(0);
  const [recruits, setRecruits] = useState<string[]>(["", ""]);
  const [cost, setCost] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const record = camp.draft.camp ?? {};
  const vet = record.veterans ?? { dice: [0, 0], spent: 0 };
  const total = vet.dice[0] + vet.dice[1];
  const group = groups.find((entry) => String(entry.id) === into);
  const living = group ? group.henchmen.filter((member) => !member.dead) : [];
  const each = group ? Number(group.xp ?? 0) : xpEach;
  const left = total - vet.spent - each * recruits.length;
  const price = cost ?? String(group ? (group.hire_cost ?? group.price ?? 0) : 25);
  const label = (index: number) =>
    recruits[index] || `${group?.unit_type || type || "Recruit"} ${index + 1}`;

  const recruit = async () => {
    setSaving(true);
    const names = recruits.map((_, index) => label(index));
    const gc = Number(price) || 0;
    try {
      const result = group
        ? await unitApi("henchmen_group").batch(camp.warbandId, {
            update: [
              {
                id: group.id,
                updated_at: group.updated_at,
                henchmen: [
                  ...living.map(({ id, name: member }) => ({ id, name: member ?? "" })),
                  ...names.map((recruitName) => ({ name: recruitName, cost: gc })),
                ] as never,
              },
            ],
          })
        : await unitApi("henchmen_group").batch(camp.warbandId, {
            create: [
              {
                name: name.trim() || null,
                unit_type: type.trim() || null,
                race: null,
                price: gc,
                xp: xpEach,
                henchmen: names.map((recruitName) => ({ name: recruitName })),
              } as never,
            ],
          });
      updateCache(camp.warbandId, { henchmenGroups: result.units, summary: result.summary });
      const groupName = group
        ? group.name || group.unit_type || "Henchmen"
        : name.trim() || type.trim() || "Henchmen";
      await camp.save({
        ...camp.draft,
        camp: {
          ...record,
          veterans: { ...vet, spent: vet.spent + each * names.length },
          recruited: [
            ...(record.recruited ?? []),
            { group: groupName, count: names.length, xp: each },
          ],
        },
      });
      onClose();
    } catch (error) {
      toast.error("Couldn't recruit.", { description: getErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalSheet
      open={open}
      onOpenChange={(next) => (next ? null : onClose())}
      kicker="Camp · veterans"
      title="Recruit henchmen"
      className="max-w-[640px]"
      footer={
        <div className="grid w-full grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-2">
          <Button variant="secondary" className="min-h-12" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="min-h-12"
            disabled={saving || !recruits.length}
            onClick={() => void recruit()}
          >
            Recruit
          </Button>
        </div>
      }
    >
      <div role="radiogroup" aria-label="Recruit into" className="flex flex-wrap gap-1.5">
        {[
          { id: NEW, text: "New group" },
          ...groups.map((entry) => ({
            id: String(entry.id),
            text: `${entry.name || entry.unit_type} (${entry.henchmen.filter((m) => !m.dead).length}/${entry.max_size ?? 5})`,
          })),
        ].map((option) => (
          <Chip
            key={option.id}
            role="radio"
            aria-checked={into === option.id}
            pressed={into === option.id}
            onClick={() => {
              setInto(option.id);
              setCost(null);
            }}
          >
            {option.text}
          </Chip>
        ))}
      </div>
      {group ? null : (
        <div className="grid grid-cols-2 gap-2.5">
          <label className={fieldLabel}>
            Group name
            <Input
              placeholder="The Dock Rats"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className={fieldLabel}>
            Type
            <Input placeholder="Warriors" value={type} onChange={(e) => setType(e.target.value)} />
          </label>
        </div>
      )}
      <div className="flex items-baseline justify-between border-t border-line pt-2.5">
        <span className="text-xs font-bold text-muted-foreground">Veteran experience to share</span>
        <span className="font-mono text-sm text-text2">
          <span className={cn("font-bold", left < 0 ? "text-danger" : "text-head")}>{left}</span> of{" "}
          {total} left
        </span>
      </div>
      <div className="flex items-center gap-2.5">
        <span className="flex-1 text-sm font-semibold text-ink">
          {group ? "Each joins at the group's XP" : "XP each"}
        </span>
        {group ? null : (
          <IconButton
            aria-label="Less experience each"
            className="h-9 w-9"
            disabled={xpEach <= 0}
            onClick={() => setXpEach(xpEach - 1)}
          >
            <Minus aria-hidden="true" />
          </IconButton>
        )}
        <span className="min-w-[54px] text-center font-mono text-sm font-bold text-head">
          {each} XP
        </span>
        {group ? null : (
          <IconButton
            aria-label="More experience each"
            className="h-9 w-9"
            onClick={() => setXpEach(xpEach + 1)}
          >
            <Plus aria-hidden="true" />
          </IconButton>
        )}
      </div>
      {recruits.map((recruitName, index) => (
        <div key={index} className="flex items-center gap-2">
          <Input
            inputSize="sm"
            aria-label={`Recruit ${index + 1} name`}
            placeholder={label(index)}
            value={recruitName}
            onChange={(e) =>
              setRecruits((list) => list.map((n, i) => (i === index ? e.target.value : n)))
            }
          />
          <IconButton
            aria-label={`Remove recruit ${index + 1}`}
            className="h-9 w-9"
            onClick={() => setRecruits((list) => list.filter((_, i) => i !== index))}
          >
            <X aria-hidden="true" />
          </IconButton>
        </div>
      ))}
      {group && living.length + recruits.length > (group.max_size ?? 5) ? (
        <p className="m-0 text-xs text-danger">
          That takes the group over its size of {group.max_size ?? 5}.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={() => setRecruits((list) => [...list, ""])}
          className="min-h-9 border border-dashed border-strong px-3 text-[13px] font-bold text-accent-text"
        >
          Add another
        </button>
        <label className="ml-auto flex items-center gap-2 text-xs font-bold text-muted-foreground">
          Each costs
          <Input
            inputSize="sm"
            inputMode="numeric"
            className="w-[70px] font-mono"
            value={price}
            onChange={(e) => setCost(e.target.value)}
          />
          gc
        </label>
      </div>
    </ModalSheet>
  );
}
