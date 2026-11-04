import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { NumberInput } from "@/components/ui/number-input";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { ModalSheet } from "@/components/ui/modal-sheet";
import { getErrorMessage } from "@/lib/get-error-message";

import { isWarbandQuery, useWarbandCacheUpdate } from "../../api/warband-cache";
import { useWarbandHireTemplate } from "../../api/warband-template-queries";
import { unitApi } from "../../units/unit-api";
import { isCreatureGroup } from "../../utils/companions";
import HireTally from "../recruit/HireTally";
import { overCount, overGroup } from "../recruit/hire-draft";
import { newUnitId, useOpenInEdit } from "../roster/useRosterCards";
import CampNewGroup from "./CampNewGroup";
import { RecruitNames, VeteranXp } from "./CampRecruitParts";
import type { OpenCamp } from "./camp-types";

const NEW = "new";

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
  const queryClient = useQueryClient();
  const openInEdit = useOpenInEdit();
  const groups = camp.groups.filter((group) => !isCreatureGroup(group));
  const [into, setInto] = useState<string>(NEW);
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [xpEach, setXpEach] = useState(0);
  const [recruits, setRecruits] = useState<string[]>(["", ""]);
  const [cost, setCost] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // a new group from the warband's template (the templates plan, phase 2): its henchmen to recruit as
  const [as, setAs] = useState("");
  const answer = useWarbandHireTemplate(camp.campaignId, camp.warbandId).data;
  const fighters = (answer?.template?.fighters ?? []).filter((entry) => entry.kind === "henchman");
  const fighter = into === NEW ? fighters.find((entry) => entry.key === as) : undefined;
  const record = camp.draft.camp ?? {};
  const vet = record.veterans ?? { dice: [0, 0], spent: 0 };
  const total = vet.dice[0] + vet.dice[1];
  const group = groups.find((entry) => String(entry.id) === into);
  const living = group ? group.henchmen.filter((member) => !member.dead) : [];
  const each = group ? Number(group.xp ?? 0) : xpEach;
  const left = total - vet.spent - each * recruits.length;
  const price =
    cost ?? String(group ? (group.hire_cost ?? group.price ?? 0) : (fighter?.cost ?? 25));
  const label = (index: number) =>
    recruits[index] || `${group?.unit_type || fighter?.name || type || "Recruit"} ${index + 1}`;
  const warnings = fighter
    ? [overCount(fighter, recruits.length), overGroup(fighter, recruits.length)].filter(Boolean)
    : [];

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
                name: name.trim() || fighter?.plural || null,
                // from the template, the server fills his type, race, profile and rules
                ...(fighter
                  ? { fighter_key: fighter.key }
                  : { unit_type: type.trim() || null, race: null }),
                price: gc,
                xp: xpEach,
                henchmen: names.map((recruitName) => ({ name: recruitName })),
              } as never,
            ],
          });
      updateCache(camp.warbandId, { henchmenGroups: result.units, summary: result.summary });
      void queryClient.invalidateQueries({ predicate: isWarbandQuery(camp.warbandId, "template") });
      const groupName = group
        ? group.name || group.unit_type || "Henchmen"
        : name.trim() || fighter?.plural || type.trim() || "Henchmen";
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
      openInEdit("henchmen_group", group?.id ?? newUnitId(camp.groups, result.units));
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
            disabled={saving || !recruits.length || (into === NEW && fighters.length > 0 && !as)}
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
        <CampNewGroup
          typeName={answer?.template?.name ?? ""}
          fighters={fighters}
          lists={answer?.template?.lists ?? []}
          as={as}
          onAs={(key) => {
            setAs(key);
            setCost(null);
          }}
          name={name}
          onName={setName}
          type={type}
          onType={setType}
        />
      )}
      <VeteranXp left={left} total={total} each={each} fixed={Boolean(group)} onEach={setXpEach} />
      <RecruitNames recruits={recruits} placeholder={label} onChange={setRecruits} />
      {group && living.length + recruits.length > (group.max_size ?? 5) ? (
        <p className="m-0 text-xs text-danger">
          That takes the group over its size of {group.max_size ?? 5}.
        </p>
      ) : null}
      {warnings.map((warning) => (
        <p key={warning} className="m-0 text-xs text-danger">
          {warning}
        </p>
      ))}
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={() => setRecruits((list) => [...list, ""])}
          className="min-h-9 border border-dashed border-strong px-3 text-[13px] font-bold text-accent-text"
        >
          Add another
        </button>
        {fighter ? null : (
          <label className="ml-auto flex items-center gap-2 text-xs font-bold text-muted-foreground">
            Each costs
            <NumberInput
              compact
              inputSize="sm"
              className="w-[70px] font-mono"
              value={price}
              onChange={(e) => setCost(e.target.value)}
            />
            gc
          </label>
        )}
      </div>
      {fighter ? (
        <HireTally
          name={fighter.plural || fighter.name}
          members={recruits.length}
          cost={price}
          onCost={setCost}
          picks={[]}
          lines={[]}
          prices={{}}
          onPrice={() => undefined}
          freeItem={fighter.free_item}
          gold={camp.gold}
        />
      ) : null}
    </ModalSheet>
  );
}
