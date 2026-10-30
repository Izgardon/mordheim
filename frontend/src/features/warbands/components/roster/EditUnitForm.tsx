import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ChipLabel } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { STAT_KEYS } from "@/components/ui/stat-strip";
import { useCatalogue } from "@/lib/catalogue-queries";
import { getErrorMessage } from "@/lib/get-error-message";

import { useWarbandCacheUpdate, type WarbandUpdate } from "../../api/warband-cache";
import { unitApi } from "../../units/unit-api";
import type { HeroCaster, Henchman } from "../../types/warband-types";
import { LIST_KEY, isGroup, type RosterUnit } from "./unit-view";

const STAT_FIELDS = {
  M: "movement",
  WS: "weapon_skill",
  BS: "ballistic_skill",
  S: "strength",
  T: "toughness",
  W: "wounds",
  I: "initiative",
  A: "attacks",
  Ld: "leadership",
  Sv: "armour_save",
} as const;
type Draft = Record<string, unknown>;
const REMOVED_KEY = {
  hero: "removedHeroIds",
  henchmen_group: "removedHenchmenGroupIds",
  hireling: "removedHirelingIds",
} as const;
type Named = { id: number; name: string };

/** One unit's edit form, in its open card (design E); saved alone through the batch save. */
export default function EditUnitForm({
  entry,
  campaignId,
  warbandId,
  onClose,
}: {
  entry: RosterUnit;
  campaignId: number;
  warbandId: number;
  onClose: () => void;
}) {
  const { kind, unit } = entry;
  const queryClient = useQueryClient();
  const updateCache = useWarbandCacheUpdate();
  const skills = useCatalogue("skills", campaignId).data ?? [];
  const specials = useCatalogue("specials", campaignId).data ?? [];
  const spells = useCatalogue("spells", campaignId).data ?? [];
  const [draft, setDraft] = useState<Draft>(() => ({
    name: unit.name ?? "",
    unit_type: unit.unit_type ?? "",
    price: unit.price ?? 0,
    xp: unit.xp ?? 0,
    half_rate: Boolean(unit.half_rate),
    missing_games: unit.missing_games ?? 0,
    missing_reason: unit.missing_reason ?? "",
    large: Boolean(unit.large),
    ...Object.fromEntries(Object.values(STAT_FIELDS).map((field) => [field, unit[field] ?? ""])),
    ...("is_leader" in unit
      ? { is_leader: Boolean(unit.is_leader), trading_action: Boolean(unit.trading_action) }
      : {}),
    ...("caster" in unit ? { caster: unit.caster ?? "No" } : {}),
    ...(kind === "hireling"
      ? {
          no_level_ups: Boolean(entry.unit.no_level_ups),
          blood_pacted: Boolean(entry.unit.blood_pacted),
        }
      : {}),
  }));
  const [lists, setLists] = useState({
    skills: (unit.skills ?? []) as Named[],
    specials: (unit.specials ?? []) as Named[],
    spells: ("spells" in unit ? (unit.spells ?? []) : []) as Named[],
  });
  const [members, setMembers] = useState<Partial<Henchman>[]>(
    isGroup(entry) ? entry.unit.henchmen : []
  );
  const [saving, setSaving] = useState(false);
  const [confirmDismiss, setConfirmDismiss] = useState(false);
  const set = (key: string, value: unknown) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const numberOrNull = (value: unknown) => (value === "" || value === null ? null : Number(value));

  const payload = () => ({
    ...draft,
    price: Number(draft.price) || 0,
    xp: Number(draft.xp) || 0,
    missing_games: Number(draft.missing_games) || 0,
    ...Object.fromEntries(
      Object.values(STAT_FIELDS).map((field) => [field, numberOrNull(draft[field])])
    ),
    skill_ids: lists.skills.map((skill) => skill.id),
    special_ids: lists.specials.map((special) => special.id),
    ...(kind === "henchmen_group" ? {} : { spell_ids: lists.spells.map((spell) => spell.id) }),
    ...(isGroup(entry)
      ? {
          henchmen: members.map(({ id, name, kills, dead }) => ({
            id,
            name: name ?? "",
            kills,
            dead,
          })),
        }
      : {}),
  });

  const run = async (body: Parameters<ReturnType<typeof unitApi>["batch"]>[1], close = true) => {
    setSaving(true);
    try {
      const result = await unitApi(kind).batch(warbandId, body as never);
      updateCache(warbandId, {
        [LIST_KEY[kind]]: result.units,
        summary: result.summary,
        ...(body.dismiss ? { [REMOVED_KEY[kind]]: body.dismiss } : {}),
      } as WarbandUpdate);
      void queryClient.invalidateQueries({
        queryKey: ["campaign", campaignId, "warband", warbandId],
      });
      if (close) onClose();
    } catch (error) {
      toast.error("That didn't save.", { description: getErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, key: string, numeric = false) => (
    <label className="flex flex-col gap-1 text-xs font-bold text-muted-foreground">
      {label}
      <Input
        inputSize="sm"
        inputMode={numeric ? "numeric" : undefined}
        value={String(draft[key] ?? "")}
        onChange={(event) => set(key, event.target.value)}
      />
    </label>
  );
  const toggle = (label: string, key: string) =>
    key in draft ? (
      <Switch key={key} checked={Boolean(draft[key])} onCheckedChange={(on) => set(key, on)}>
        {label}
      </Switch>
    ) : null;
  const picker = (label: string, key: keyof typeof lists, options: Named[]) => (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-faint">{label}</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {lists[key].map((entry) => (
          <ChipLabel key={entry.id} className="gap-1 pr-1">
            {entry.name}
            <button
              type="button"
              aria-label={`Remove ${entry.name}`}
              onClick={() =>
                setLists((c) => ({ ...c, [key]: c[key].filter((x) => x.id !== entry.id) }))
              }
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </ChipLabel>
        ))}
        <select
          aria-label={`Add ${label.toLowerCase()}`}
          value=""
          onChange={(event) => {
            const picked = options.find((option) => option.id === Number(event.target.value));
            if (picked) setLists((c) => ({ ...c, [key]: [...c[key], picked] }));
          }}
          className="h-8 border border-strong bg-page px-2 text-xs text-ink"
        >
          <option value="">Add…</option>
          {options
            .filter((option) => !lists[key].some((x) => x.id === option.id))
            .map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
        </select>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-4 border-t border-line pt-3">
      <div className="grid grid-cols-2 gap-2 min-[720px]:grid-cols-4">
        {field("Name", "name")}
        {field("Type", "unit_type")}
        {field(kind === "hireling" ? "Hire fee" : "Cost", "price", true)}
        {field("XP", "xp", true)}
        {field("Missing games", "missing_games", true)}
        <div className="col-span-1 min-[720px]:col-span-3">{field("Why", "missing_reason")}</div>
      </div>
      <div className="grid grid-cols-5 gap-1.5 min-[720px]:grid-cols-10">
        {STAT_KEYS.map((key) => (
          <label
            key={key}
            className="flex flex-col items-center gap-1 text-[10px] font-bold text-faint"
          >
            {key}
            <Input
              inputSize="sm"
              inputMode="numeric"
              className="px-1 text-center font-mono"
              value={String(draft[STAT_FIELDS[key]] ?? "")}
              onChange={(event) => set(STAT_FIELDS[key], event.target.value)}
            />
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {toggle("Leader", "is_leader")}
        {toggle("Large", "large")}
        {toggle("Trading action", "trading_action")}
        {toggle("Half-rate XP", "half_rate")}
        {toggle("No level ups", "no_level_ups")}
        {toggle("Bloodpacted", "blood_pacted")}
        {"caster" in draft ? (
          <select
            aria-label="Caster"
            value={String(draft.caster)}
            onChange={(event) => set("caster", event.target.value as HeroCaster)}
            className="h-11 border border-strong bg-page px-2 text-sm text-ink"
          >
            <option value="No">Not a caster</option>
            <option value="Wizard">Wizard</option>
            <option value="Priest">Priest</option>
          </select>
        ) : null}
      </div>
      {picker("Skills", "skills", skills)}
      {picker("Specials", "specials", specials)}
      {kind !== "henchmen_group" ? picker("Spells", "spells", spells) : null}
      {isGroup(entry) ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-faint">
            Models
          </span>
          {members.map((member, index) => (
            <div key={member.id ?? `new-${index}`} className="flex items-center gap-2">
              <Input
                inputSize="sm"
                aria-label={`Model ${index + 1} name`}
                value={member.name ?? ""}
                onChange={(event) =>
                  setMembers((list) =>
                    list.map((m, i) => (i === index ? { ...m, name: event.target.value } : m))
                  )
                }
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setMembers((list) => list.filter((_, i) => i !== index))}
              >
                Remove
              </Button>
            </div>
          ))}
          <Button
            size="sm"
            variant="secondary"
            className="self-start"
            onClick={() =>
              setMembers((list) => [
                ...list,
                { name: `${draft.unit_type || "Henchman"} ${list.length + 1}` },
              ])
            }
          >
            Add a model
          </Button>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2 border-t border-line pt-3">
        <Button
          disabled={saving}
          onClick={() =>
            void run({ update: [{ id: unit.id, updated_at: unit.updated_at, ...payload() }] })
          }
        >
          Save
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="secondary"
          className="ml-auto"
          disabled={saving}
          onClick={() =>
            void run({
              create: [
                {
                  ...payload(),
                  ...(isGroup(entry)
                    ? { henchmen: members.map(({ name }) => ({ name: name ?? "" })) }
                    : {}),
                  name: `${draft.name || draft.unit_type} (copy)`,
                },
              ],
            })
          }
        >
          Duplicate
        </Button>
        {confirmDismiss ? (
          <Button
            variant="danger"
            disabled={saving}
            onClick={() => void run({ dismiss: [unit.id] })}
          >
            Dismiss for good: carried items are lost
          </Button>
        ) : (
          <Button variant="danger" disabled={saving} onClick={() => setConfirmDismiss(true)}>
            Dismiss
          </Button>
        )}
      </div>
    </div>
  );
}
